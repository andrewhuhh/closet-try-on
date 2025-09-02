(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.generation = ns.generation || {};

  // Generation Monitor Class
  ns.generation.GenerationMonitor = class GenerationMonitor {
    constructor() {
      this.generationCheckInterval = null;
      this.elapsedTimeInterval = null;
      this.isMonitoring = false;
    }

    // Initialization
    init() {
      // Listen for generation status changes
      document.addEventListener('generationStatusChanged', (e) => {
        const { inProgress } = e.detail;
        if (inProgress) {
          this.showGenerationLoading(new Date().toISOString());
          this.startGenerationStatusMonitoring();
        } else {
          this.hideGenerationLoading();
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
        const { generationInProgress, generationStartTime } = await CTO.storage.get([
          'generationInProgress', 'generationStartTime'
        ]);

        console.log('Checking generation status:', { generationInProgress, generationStartTime });

        if (generationInProgress && generationStartTime) {
          console.log('Generation in progress detected, showing loading state');
          this.showGenerationLoading(generationStartTime);
          if (!this.isMonitoring) {
            this.startGenerationStatusMonitoring();
          }
        } else {
          console.log('No generation in progress, hiding loading state');
          this.hideGenerationLoading();
        }
      } catch (error) {
        console.error('Error checking generation status:', error);
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