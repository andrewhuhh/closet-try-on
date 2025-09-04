(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.generation = ns.generation || {};

  // Generation Monitor Class
  ns.generation.GenerationMonitor = class GenerationMonitor {
    constructor() {
      this.generationCheckInterval = null;
      this.elapsedTimeInterval = null;
      this.generationTimeoutId = null;
      this.isMonitoring = false;
      
      // Timeout configuration
      this.TIMEOUT_DURATION = 1 * 60 * 1000; // 1 minute in milliseconds
      this.TIMEOUT_WARNING_DURATION = 30 * 1000; // 30 seconds - show warning
    }

    // Initialization
    init() {
      // Listen for generation status changes
      document.addEventListener('generationStatusChanged', (e) => {
        const { inProgress } = e.detail;
        if (inProgress) {
          this.showGenerationLoading(new Date().toISOString());
          this.startGenerationStatusMonitoring();
          this.startGenerationTimeout(); // Start timeout timer
        } else {
          this.hideGenerationLoading();
          this.clearGenerationTimeout(); // Clear timeout timer
        }
      });

      // Listen for tab switches to check generation status
      document.addEventListener('tabSwitched', (e) => {
        const { tabName } = e.detail;
        if (tabName === 'outfits' || tabName === 'try-on') {
          this.checkAndShowGenerationStatus();
        }
      });

      // Check status on initialization
      this.checkAndShowGenerationStatus();
    }

    // Main Status Checking
    async checkAndShowGenerationStatus() {
      try {
        // First, try to get fresh status from background script
        await this.syncWithBackgroundScript();
        
        const { generationInProgress, generationStartTime } = await CTO.storage.get([
          'generationInProgress', 'generationStartTime'
        ]);

        console.log('Checking generation status:', { generationInProgress, generationStartTime });

        if (generationInProgress && generationStartTime) {
          console.log('Generation in progress detected, showing loading state');
          this.showGenerationLoading(generationStartTime);
          if (!this.isMonitoring) {
            this.startGenerationStatusMonitoring();
            this.startGenerationTimeout(generationStartTime); // Start timeout with existing start time
          }
        } else {
          console.log('No generation in progress, hiding loading state');
          this.hideGenerationLoading();
          this.clearGenerationTimeout();
          
          // Refresh outfit displays to ensure they're up to date
          // This handles the case where generation completed while popup was closed
          if (CTO.outfit.manager) {
            await CTO.outfit.manager.loadOutfits();
            await CTO.outfit.manager.loadLatestTryOn();
          }
        }
      } catch (error) {
        console.error('Error checking generation status:', error);
      }
    }

    // Sync with background script to get latest generation status
    async syncWithBackgroundScript() {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getGenerationStatus' });
        if (response && response.inProgress !== undefined) {
          // Update storage with authoritative status from background script
          await CTO.storage.set({
            generationInProgress: response.inProgress,
            generationStartTime: response.startTime
          });
          console.log('Synced generation status with background:', response);
        }
      } catch (error) {
        console.log('Could not sync with background script (may be normal):', error.message);
      }
    }

    // Loading State Management
    showGenerationLoading(startTime) {
      // Show loading widgets (inline, not replacing content)
      const outfitLoading = document.getElementById('outfit-loading');
      const tryonLoading = document.getElementById('tryon-loading');
      const noOutfits = document.getElementById('no-outfits');
      const noTryOn = document.getElementById('no-try-on');

      if (outfitLoading) {
        outfitLoading.style.display = 'flex';
        if (noOutfits) noOutfits.style.display = 'none';
        // Keep gallery content visible, just show loading widget above it
      }

      if (tryonLoading) {
        tryonLoading.style.display = 'flex';
        if (noTryOn) noTryOn.style.display = 'none';
        // Keep try-on content visible, just show loading widget above it
      }

      // Start elapsed time counters
      this.startElapsedTimeCounters(startTime);
    }

    hideGenerationLoading() {
      // Hide loading widgets
      const outfitLoading = document.getElementById('outfit-loading');
      const tryonLoading = document.getElementById('tryon-loading');

      if (outfitLoading) {
        outfitLoading.style.display = 'none';
      }

      if (tryonLoading) {
        tryonLoading.style.display = 'none';
      }

      // Content was never hidden, so no need to restore visibility

      // Stop timers
      this.stopGenerationStatusMonitoring();
      this.stopElapsedTimeCounters();
      this.clearGenerationTimeout(); // Clear timeout when hiding loading
    }

    // Elapsed Time Counters
    startElapsedTimeCounters(startTime) {
      this.stopElapsedTimeCounters(); // Clear any existing interval

      const updateElapsed = () => {
        const now = new Date();
        const start = new Date(startTime);
        const elapsedSeconds = Math.floor((now - start) / 1000);

        const outfitTimeSpan = document.getElementById('outfit-elapsed-time');
        const tryonTimeSpan = document.getElementById('tryon-elapsed-time');

        if (outfitTimeSpan) {
          outfitTimeSpan.textContent = `${elapsedSeconds}s`;
        }
        if (tryonTimeSpan) {
          tryonTimeSpan.textContent = `${elapsedSeconds}s`;
        }
      };

      // Update immediately then every second
      updateElapsed();
      this.elapsedTimeInterval = setInterval(updateElapsed, 1000);
    }

    stopElapsedTimeCounters() {
      if (this.elapsedTimeInterval) {
        clearInterval(this.elapsedTimeInterval);
        this.elapsedTimeInterval = null;
      }
    }

    // Status Monitoring
    startGenerationStatusMonitoring() {
      if (this.isMonitoring) return; // Already monitoring

      this.stopGenerationStatusMonitoring(); // Clear any existing interval
      this.isMonitoring = true;

      this.generationCheckInterval = setInterval(async () => {
        try {
          const { generationInProgress } = await CTO.storage.get('generationInProgress');
          
          if (!generationInProgress) {
            // Generation completed, refresh the UI
            this.hideGenerationLoading();
            
            // Refresh outfit displays if manager is available
            if (CTO.outfit.manager) {
              await CTO.outfit.manager.loadOutfits();
              await CTO.outfit.manager.loadLatestTryOn();
            }
            
            // Show toast notification with navigation to results
            if (global.toastManager) {
              global.toastManager.generationComplete('Click to view your results', () => {
                CTO.ui.manager.switchTab('outfits');
              });
            }
          }
        } catch (error) {
          console.error('Error monitoring generation status:', error);
        }
      }, 2000); // Check every 2 seconds
    }

    stopGenerationStatusMonitoring() {
      if (this.generationCheckInterval) {
        clearInterval(this.generationCheckInterval);
        this.generationCheckInterval = null;
      }
      this.isMonitoring = false;
    }

    // Manual Status Control
    async setGenerationStatus(inProgress, startTime = null) {
      const data = { 
        generationInProgress: inProgress,
        generationStartTime: startTime || (inProgress ? new Date().toISOString() : null)
      };
      
      await CTO.storage.set(data);
      
      // Emit event for other components
      const event = new CustomEvent('generationStatusChanged', { 
        detail: { inProgress, startTime: data.generationStartTime } 
      });
      document.dispatchEvent(event);
    }

    async startGeneration() {
      await this.setGenerationStatus(true);
    }

    async completeGeneration() {
      await this.setGenerationStatus(false);
    }

    // Generation Helper Functions
    async isGenerationInProgress() {
      const { generationInProgress } = await CTO.storage.get('generationInProgress');
      return !!generationInProgress;
    }

    async getGenerationStartTime() {
      const { generationStartTime } = await CTO.storage.get('generationStartTime');
      return generationStartTime;
    }

    async getGenerationElapsedTime() {
      const startTime = await this.getGenerationStartTime();
      if (!startTime) return 0;
      
      const now = new Date();
      const start = new Date(startTime);
      return Math.floor((now - start) / 1000);
    }

    // Error Handling
    async handleGenerationError(error, context = '') {
      console.error(`Generation Error ${context}:`, error);
      
      // Clear generation status on error
      await this.setGenerationStatus(false);
      
      // Handle different types of errors
      let title = 'Generation Failed';
      let message = 'Failed to generate image. Please try again.';
      
      if (error.message) {
        if (error.message.includes('Resource::kQuotaBytes quota exceeded') || error.message.includes('quotaBytes')) {
          title = 'Image Too Large';
          message = 'Image file size exceeds API limits. Try using smaller, lower resolution images.';
        } else if (error.message.includes('429')) {
          title = 'API Quota Exceeded';
          message = 'API quota exceeded. Please check your billing or try again later.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
          title = 'API Key Error';
          message = 'Invalid or expired API key. Please update your API key in the extension.';
        } else if (error.message.includes('Network error') || error.message.includes('fetch')) {
          title = 'Network Error';
          message = 'Network error. Please check your internet connection and try again.';
        }
      }
      
      if (global.toastManager) {
        global.toastManager.error(title, message, {
          duration: 5000,
          clickAction: () => {
            // Navigate to API settings if it's an API-related error
            if (title.includes('API') || title.includes('Quota')) {
              CTO.ui.manager.showSection('main-interface');
              setTimeout(() => CTO.ui.manager.switchTab('api-settings'), 500);
            }
          }
        });
      }
    }

    // UI State Management for Loading Indicators
    updateLoadingProgress(percentage, message = '') {
      const progressBars = document.querySelectorAll('.generation-progress');
      const progressMessages = document.querySelectorAll('.generation-message');
      
      progressBars.forEach(bar => {
        if (bar.style) {
          bar.style.width = `${percentage}%`;
        }
      });
      
      if (message) {
        progressMessages.forEach(msgElement => {
          if (msgElement.textContent !== undefined) {
            msgElement.textContent = message;
          }
        });
      }
    }

    showGenerationNotification(type = 'info', title = '', message = '') {
      if (global.toastManager) {
        switch (type) {
          case 'started':
            global.toastManager.generationStarted(message, () => {
              CTO.ui.manager.switchTab('outfits');
            });
            break;
          case 'complete':
            global.toastManager.generationComplete(message, () => {
              CTO.ui.manager.switchTab('outfits');
            });
            break;
          case 'error':
            global.toastManager.error(title, message);
            break;
          default:
            global.toastManager.info(title, message);
        }
      }
    }

    // Lifecycle Management
    cleanup() {
      this.stopGenerationStatusMonitoring();
      this.stopElapsedTimeCounters();
      this.clearGenerationTimeout();
    }

    // Visibility Change Handling
    handleVisibilityChange() {
      if (!document.hidden) {
        // Page became visible, check generation status
        this.checkAndShowGenerationStatus();
      }
    }

    handleWindowFocus() {
      // Window gained focus, check generation status
      this.checkAndShowGenerationStatus();
    }

    // Auto-setup visibility listeners
    setupVisibilityListeners() {
      document.addEventListener('visibilitychange', () => {
        this.handleVisibilityChange();
      });
      
      window.addEventListener('focus', () => {
        this.handleWindowFocus();
      });
      
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }

    // Timeout Management
    startGenerationTimeout(startTime = null) {
      this.clearGenerationTimeout(); // Clear any existing timeout
      
      const now = new Date();
      const start = startTime ? new Date(startTime) : now;
      const elapsed = now - start;
      const remainingTimeout = Math.max(0, this.TIMEOUT_DURATION - elapsed);
      const remainingWarning = Math.max(0, this.TIMEOUT_WARNING_DURATION - elapsed);
      
      console.log('Starting generation timeout:', {
        elapsed: elapsed / 1000,
        remainingTimeout: remainingTimeout / 1000,
        remainingWarning: remainingWarning / 1000
      });
      
      // Set warning timeout if we haven't passed the warning time
      if (remainingWarning > 0) {
        setTimeout(() => {
          this.showTimeoutWarning();
        }, remainingWarning);
      } else if (elapsed >= this.TIMEOUT_WARNING_DURATION && elapsed < this.TIMEOUT_DURATION) {
        // We're already in warning period
        this.showTimeoutWarning();
      }
      
      // Set main timeout if we haven't passed the timeout time
      if (remainingTimeout > 0) {
        this.generationTimeoutId = setTimeout(() => {
          this.handleGenerationTimeout();
        }, remainingTimeout);
      } else if (elapsed >= this.TIMEOUT_DURATION) {
        // Generation has already timed out
        this.handleGenerationTimeout();
      }
    }
    
    clearGenerationTimeout() {
      if (this.generationTimeoutId) {
        clearTimeout(this.generationTimeoutId);
        this.generationTimeoutId = null;
      }
      this.hideTimeoutWarning();
    }
    
    showTimeoutWarning() {
      // Add warning styling to loading widgets
      const outfitLoading = document.getElementById('outfit-loading');
      const tryonLoading = document.getElementById('tryon-loading');
      
      [outfitLoading, tryonLoading].forEach(loading => {
        if (loading && loading.style.display === 'flex') {
          loading.classList.add('timeout-warning');
          
          // Update loading text to show warning
          const titleElement = loading.querySelector('.loading-title');
          if (titleElement) {
            titleElement.innerHTML = '⚠️ Generation Taking Longer Than Expected...';
          }
        }
      });
      
      // Show toast warning
      if (global.toastManager) {
        global.toastManager.warning(
          'Generation Delay', 
          'Try-on generation is taking longer than expected. It will timeout in 1 minute if not completed.', 
          {
            duration: 8000,
            icon: '⏱️',
            clickAction: () => {
              CTO.ui.manager.switchTab('outfits');
            }
          }
        );
      }
    }
    
    hideTimeoutWarning() {
      // Remove warning styling from loading widgets
      const outfitLoading = document.getElementById('outfit-loading');
      const tryonLoading = document.getElementById('tryon-loading');
      
      [outfitLoading, tryonLoading].forEach(loading => {
        if (loading) {
          loading.classList.remove('timeout-warning');
          
          // Restore original loading text
          const titleElement = loading.querySelector('.loading-title');
          if (titleElement) {
            if (loading.id === 'outfit-loading') {
              titleElement.innerHTML = '🎨 Generating Your Try-On...';
            } else if (loading.id === 'tryon-loading') {
              titleElement.innerHTML = '✨ Creating Your Look...';
            }
          }
        }
      });
    }
    
    async handleGenerationTimeout() {
      console.log('Generation timeout reached, clearing status');
      
      // Clear generation status
      await this.setGenerationStatus(false);
      
      // Show timeout error with retry option
      if (global.toastManager) {
        global.toastManager.error(
          'Generation Timeout', 
          'Try-on generation timed out after 1 minute. Click here for retry instructions.', 
          {
            duration: 10000,
            icon: '⏰',
            clickAction: () => {
              // Show retry instructions
              global.toastManager.info(
                'How to Retry',
                'Right-click on the clothing item again to retry the try-on generation.',
                { duration: 5000, icon: '🔄' }
              );
            }
          }
        );
      }
      
      this.clearGenerationTimeout();
    }
  };

  // Create global generation monitor instance
  ns.generation.monitor = new ns.generation.GenerationMonitor();

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ns.generation.monitor.init();
      ns.generation.monitor.setupVisibilityListeners();
    });
  } else {
    // DOM is already ready
    ns.generation.monitor.init();
    ns.generation.monitor.setupVisibilityListeners();
  }

})(window); 