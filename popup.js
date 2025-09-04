// Closet Try-On Extension - Main Entry Point
// This file orchestrates all the modular components for the extension

class ClosetTryOn {
  constructor() {
    this.apiKey = null;
    this.toastManager = null;
    this.setupComplete = false;
    this.notificationMode = false;
    this.notificationData = null;
  }

  async init() {
    try {
      // Check if we should start in notification mode
      await this.checkNotificationMode();

      if (!this.notificationMode) {
        // Initialize full popup
        await this.initializeFullPopup();
      } else {
        // Setup minimal event listeners for notification mode
        this.setupNotificationEventListeners();
        console.log('ClosetTryOn extension initialized in notification mode');
        return; // Exit early for notification mode
      }

      this.setupComplete = true;
      console.log('ClosetTryOn extension initialized successfully');
    } catch (error) {
      console.error('Error initializing ClosetTryOn extension:', error);
      this.showError('Failed to initialize extension. Please refresh and try again.');
    }
  }

  async loadFullPopupScripts() {
    // Scripts to load for full popup functionality
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
      'scripts/common/image-utils.js',
      'scripts/popup/api.js',
      'scripts/popup/toast.js',
      'scripts/popup/ui-manager.js',
      'scripts/popup/avatar-manager.js',
      'scripts/popup/multi-select-manager.js',
      'scripts/popup/outfit-manager.js',
      'scripts/popup/image-viewer.js',
      'scripts/popup/generation-monitor.js'
    ];

    // Load scripts sequentially to maintain dependency order
    for (const src of scripts) {
      await this.loadScript(src);
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        console.warn(`Failed to load script: ${src}`);
        resolve(); // Continue even if a script fails to load
      };
      document.head.appendChild(script);
    });
  }

  async initializeFullPopup() {
    // Load additional scripts needed for full popup
    await this.loadFullPopupScripts();
    
    // Initialize Toast Manager first (using the modular version)
    if (window.ToastManager) {
      this.toastManager = new window.ToastManager();
      window.toastManager = this.toastManager;
    }

    // Initialize all modules
    await this.initializeModules();

    // Setup event listeners
    this.setupEventListeners();

    // Setup drag and drop
    this.setupDragAndDrop();

    // Check setup status and show appropriate section
    await this.checkSetupStatus();
  }

  async initializeModules() {
    // Initialize UI Manager
    if (CTO.ui?.manager) {
      console.log('UI Manager ready');
    }

    // Initialize Storage
    if (CTO.storage) {
      console.log('Storage module ready');
    }

    // Initialize Avatar Manager
    if (CTO.avatar?.manager) {
      await CTO.avatar.manager.init();
      console.log('Avatar Manager initialized');
    }

    // Initialize Outfit Manager
    if (CTO.outfit?.manager) {
      await CTO.outfit.manager.init();
      console.log('Outfit Manager initialized');
    }

    // Initialize Image Viewer
    if (CTO.imageViewer?.viewer) {
      CTO.imageViewer.viewer.init();
      console.log('Image Viewer initialized');
    }

    // Initialize Generation Monitor
    if (CTO.generation?.monitor) {
      console.log('Generation Monitor ready (auto-initialized)');
    }

    // Initialize Multi-Select Manager
    if (CTO.multiSelect?.manager) {
      CTO.multiSelect.manager.init();
      console.log('Multi-Select Manager initialized');
    }
  }

  async checkSetupStatus() {
    try {
      const { apiKey, avatarGenerated, userModifiers } = await CTO.storage.get([
        'apiKey', 'avatarGenerated', 'userModifiers'
      ]);

      this.apiKey = apiKey;

      if (!apiKey) {
        // No API key - show API setup
        CTO.ui.manager.showSection('api-section');
      } else if (!avatarGenerated) {
        // API key exists but no avatar - show avatar setup
        CTO.ui.manager.showSection('avatar-section');
        if (CTO.avatar.manager) {
          CTO.avatar.manager.populateModifiers(userModifiers);
          
          // Show back button if we have avatars (user is returning from main interface)
          const avatars = CTO.avatar.manager.avatars;
          if (avatars && avatars.length > 0) {
            const backBtn = document.getElementById('back-to-main-from-avatar');
            if (backBtn) backBtn.style.display = 'inline-block';
          }
        }
      } else {
        // Everything set up - show main interface
        CTO.ui.manager.showSection('main-interface');
        
        // Check for tab switching from notification
        await this.checkNotificationTabRequest();
        
        // Migrate existing PNG avatars to JPEG if needed
        if (CTO.avatar.manager) {
          await CTO.avatar.manager.migratePNGAvatarsToJPEG();
        }
        
        // Check for active generations
        if (CTO.generation.monitor) {
          await CTO.generation.monitor.checkAndShowGenerationStatus();
        }
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      this.showError('Error loading extension state');
    }
  }

  async checkNotificationMode() {
    try {
      // Check if there's pending notification data
      const { notificationData } = await chrome.storage.local.get('notificationData');
      if (notificationData) {
        this.notificationMode = true;
        this.notificationData = notificationData;
        
        // Ensure main container is hidden from the start
        const containerEl = document.querySelector('.container');
        if (containerEl) {
          containerEl.style.display = 'none';
          containerEl.classList.add('hidden');
        }
        
        this.showNotificationMode(notificationData);
        // Clear the notification data from storage
        await chrome.storage.local.remove('notificationData');
        
        console.log('Notification mode activated:', notificationData);
      } else {
        // Ensure notification mode is hidden
        const notificationModeEl = document.getElementById('notification-mode');
        if (notificationModeEl) {
          notificationModeEl.classList.add('hidden');
          notificationModeEl.style.display = 'none';
        }
        
        // Ensure main container is visible
        const containerEl = document.querySelector('.container');
        if (containerEl) {
          containerEl.style.display = '';
          containerEl.classList.remove('hidden');
        }
      }
    } catch (error) {
      console.error('Error checking notification mode:', error);
    }
  }

  showNotificationMode(data) {
    const notificationModeEl = document.getElementById('notification-mode');
    const containerEl = document.querySelector('.container');
    
    if (!notificationModeEl) {
      console.error('Notification mode element not found');
      return;
    }

    // Ensure main container is completely hidden
    if (containerEl) {
      containerEl.style.display = 'none';
      containerEl.classList.add('hidden');
    }

    // Populate notification content
    const titleEl = document.getElementById('notification-title');
    const messageEl = document.getElementById('notification-message');
    const emojiEl = document.getElementById('notification-emoji');
    const iconEl = document.querySelector('.notification-icon');
    const primaryActionEl = document.getElementById('notification-primary-action');
    const imageEl = document.getElementById('notification-image');

    // Set content with fallbacks
    if (titleEl) titleEl.textContent = data.title || 'Notification';
    if (messageEl) messageEl.textContent = data.message || '';
    if (emojiEl) emojiEl.textContent = data.icon || '📢';
    
    // Set notification image if provided
    if (imageEl && data.imageUrl) {
      imageEl.src = data.imageUrl;
      imageEl.style.display = 'block';
      imageEl.alt = data.title || 'Notification Image';
      
      // Handle image loading errors
      imageEl.onerror = () => {
        console.warn('Failed to load notification image:', data.imageUrl);
        imageEl.style.display = 'none';
      };
      
      // Show the image container
      const imageContainer = imageEl.parentElement;
      if (imageContainer) {
        imageContainer.style.display = 'block';
      }
    } else if (imageEl) {
      // Hide image if no URL provided
      imageEl.style.display = 'none';
      const imageContainer = imageEl.parentElement;
      if (imageContainer) {
        imageContainer.style.display = 'none';
      }
    }
    
    // Set icon type styling
    if (iconEl && data.type) {
      iconEl.className = `notification-icon ${data.type}`;
    }

    // Configure primary action button
    if (primaryActionEl) {
      if (data.actionText) {
        primaryActionEl.textContent = data.actionText;
        primaryActionEl.style.display = 'block';
      } else {
        primaryActionEl.style.display = 'none';
      }
    }

    // Show notification mode
    notificationModeEl.classList.remove('hidden');
    notificationModeEl.style.display = 'block';

    // Force html and body to adjust to notification content height
    setTimeout(() => {
      const notificationHeight = notificationModeEl.offsetHeight;
      
      // Set height on both html and body elements
      document.documentElement.style.height = `${notificationHeight}px`;
      document.documentElement.style.minHeight = `${notificationHeight}px`;
      document.documentElement.style.maxHeight = `${notificationHeight}px`;
      
      document.body.style.height = `${notificationHeight}px`;
      document.body.style.minHeight = `${notificationHeight}px`;
      document.body.style.maxHeight = `${notificationHeight}px`;
    }, 50);

    console.log('Showing notification mode:', data);
  }

  setupNotificationEventListeners() {
    
    // Primary action
    this.bindEvent('notification-primary-action', 'click', () => this.handleNotificationAction());
    
    // Dismiss notification
    this.bindEvent('dismiss-notification', 'click', () => this.dismissNotification());

    // Click anywhere on notification header to expand
    const header = document.querySelector('.notification-header');
    if (header) {
      header.addEventListener('click', (e) => {
        // Don't expand if clicking on action buttons
        if (!e.target.closest('button')) {
          this.expandToFullPopup();
        }
      });
    }
  }

  async expandToFullPopup() {
    console.log('Expanding to full popup');
    
    // Store the tab we want to open to if specified
    if (this.notificationData && this.notificationData.actionType) {
      const tabMap = {
        'view-wardrobe': 'wardrobe',
        'view-outfits': 'outfits',
        'view-latest': 'try-on'
      };
      
      const targetTab = tabMap[this.notificationData.actionType];
      if (targetTab) {
        await chrome.storage.local.set({ openToTab: targetTab });
      }
    }

    // Hide notification mode
    const notificationModeEl = document.getElementById('notification-mode');
    const containerEl = document.querySelector('.container');
    
    if (notificationModeEl) {
      notificationModeEl.classList.add('hidden');
      notificationModeEl.style.display = 'none';
    }
    
    // Show main container
    if (containerEl) {
      containerEl.style.display = '';
      containerEl.classList.remove('hidden');
    }

    // Restore html and body height for full popup
    document.documentElement.style.height = '';
    document.documentElement.style.minHeight = '';
    document.documentElement.style.maxHeight = '';
    
    document.body.style.height = '';
    document.body.style.minHeight = '';
    document.body.style.maxHeight = '';

    // Exit notification mode and initialize normal popup
    this.notificationMode = false;
    this.notificationData = null;
    
    // Initialize the full popup instead of reloading
    try {
      if (!this.setupComplete) {
        await this.initializeFullPopup();
        this.setupComplete = true;
      } else {
        // Just check setup status and update UI
        await this.checkSetupStatus();
      }
    } catch (error) {
      console.error('Error expanding to full popup:', error);
      // Fallback to reload if initialization fails
      window.location.reload();
    }
  }

  async handleNotificationAction() {
    console.log('Handling notification action:', this.notificationData?.actionType);
    
    if (this.notificationData?.actionType) {
      switch (this.notificationData.actionType) {
        case 'view-wardrobe':
          await chrome.storage.local.set({ openToTab: 'wardrobe' });
          break;
        case 'view-outfits':
          await chrome.storage.local.set({ openToTab: 'outfits' });
          break;
        case 'view-latest':
          await chrome.storage.local.set({ openToTab: 'try-on' });
          break;
        case 'open-url':
          if (this.notificationData.actionData?.url) {
            chrome.tabs.create({ url: this.notificationData.actionData.url });
            window.close();
            return;
          }
          break;
        case 'open-tab':
          // Just expand to full popup for general extension access
          break;
      }
    }
    
    // Expand to full popup
    await this.expandToFullPopup();
  }

  dismissNotification() {
    console.log('Dismissing notification');
    window.close();
  }

  // Debug function to test notification mode
  testNotificationMode() {
    const testData = {
      title: 'Test Notification',
      message: 'This is a test notification to verify the system works correctly.',
      type: 'info',
      icon: '🧪',
      actionText: 'View Extension',
      actionType: 'open-tab'
    };
    
    this.notificationMode = true;
    this.notificationData = testData;
    this.showNotificationMode(testData);
    this.setupNotificationEventListeners();
  }

  async checkNotificationTabRequest() {
    try {
      // Check if there's a request to open to a specific tab from notification
      const { openToTab } = await chrome.storage.local.get('openToTab');
      if (openToTab && CTO.ui.manager) {
        // Switch to the requested tab
        CTO.ui.manager.switchTab(openToTab);
        // Clear the request
        await chrome.storage.local.remove('openToTab');
      }
    } catch (error) {
      console.error('Error checking notification tab request:', error);
    }
  }

  setupEventListeners() {
    // API Key Management
    this.bindEvent('save-api-key', 'click', () => this.saveApiKey());
    this.bindEvent('update-api-key', 'click', () => this.updateApiKey());
    this.bindEvent('update-main-api-key', 'click', () => this.updateMainApiKey());
    this.bindEvent('test-api-key', 'click', () => this.testApiKey());

    // Avatar Generation
    this.bindEvent('generate-avatar', 'click', () => this.delegateToAvatarManager('generateAvatar'));
    this.bindEvent('regenerate-avatar', 'click', () => this.delegateToAvatarManager('regenerateAvatar'));

    // File Upload
    this.bindEvent('photo-upload', 'click', () => {
      const input = document.getElementById('photo-input');
      if (input) input.click();
    });
    this.bindEvent('photo-input', 'change', (e) => {
      if (CTO.avatar.manager) {
        CTO.avatar.manager.handleFileSelection(e.target.files);
      }
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Settings dropdown
    this.bindEvent('settings-toggle', 'click', () => CTO.ui.manager.toggleSettingsDropdown());
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => CTO.ui.manager.openSettingsSection(item.dataset.setting));
    });

    // Settings navigation
    this.bindEvent('close-avatar-management', 'click', () => CTO.ui.manager.showSection('main-interface'));
    this.bindEvent('close-api-settings', 'click', () => CTO.ui.manager.showSection('main-interface'));

    // Avatar management navigation
    this.bindEvent('back-to-avatar', 'click', () => CTO.ui.manager.showSection('avatar-section'));
    this.bindEvent('manage-api-from-avatar', 'click', () => this.delegateToAvatarManager('switchToApiSettingsFromAvatar'));
    this.bindEvent('back-to-main-from-avatar', 'click', () => CTO.ui.manager.showSection('main-interface'));
    this.bindEvent('proceed-to-main', 'click', () => CTO.ui.manager.showSection('main-interface'));

    // Avatar Management Event Listeners
    this.setupAvatarManagementListeners();

    // Outfit Builder Event Listeners
    this.setupOutfitBuilderListeners();

    // Settings Section Event Listeners
    document.addEventListener('settingsSectionOpened', (e) => {
      const { sectionName } = e.detail;
      if (sectionName === 'avatar-management' && CTO.avatar.manager) {
        CTO.avatar.manager.loadAvatarManagement();
      } else if (sectionName === 'api-settings') {
        this.loadApiSettings();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.settings-dropdown')) {
        CTO.ui.manager.hideSettingsDropdown();
      }
    });
  }

  setupAvatarManagementListeners() {
    // Avatar creation from management panel
    this.bindEvent('create-new-avatar', 'click', () => this.delegateToAvatarManager('createNewAvatarFromManagement'));
    this.bindEvent('start-avatar-creation', 'click', () => this.delegateToAvatarManager('createNewAvatarFromManagement'));
    
    // Avatar actions
    this.bindEvent('regenerate-all-avatars', 'click', () => this.delegateToAvatarManager('regenerateAllAvatars'));
    this.bindEvent('delete-selected-avatar', 'click', () => this.delegateToAvatarManager('deleteSelectedAvatar'));
    this.bindEvent('export-avatars', 'click', () => this.delegateToAvatarManager('exportAvatars'));
  }

  setupOutfitBuilderListeners() {
    // Clear outfit button
    this.bindEvent('clear-outfit', 'click', () => this.delegateToOutfitManager('clearCurrentOutfit'));

    // Try on outfit button
    this.bindEvent('try-on-outfit', 'click', () => this.delegateToOutfitManager('tryOnCurrentOutfit'));

    // Size preference toggle handler
    this.bindEvent('size-toggle', 'change', (e) => {
      const preference = e.target.checked ? 'fit' : 'retain';
      this.saveSizePreference(preference);
    });
    
    // Load initial size preference
    this.loadSizePreference();
  }

  setupDragAndDrop() {
    const uploadArea = document.getElementById('photo-upload');
    if (!uploadArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        CTO.ui.manager.addDragOverEffect(uploadArea);
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        CTO.ui.manager.removeDragOverEffect(uploadArea);
      }, false);
    });

    uploadArea.addEventListener('drop', (e) => {
      if (CTO.avatar.manager) {
        CTO.avatar.manager.handleDrop(e);
      }
    }, false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Tab Management
  async switchTab(tabName) {
    await CTO.ui.manager.switchTab(tabName);

    // Handle tab-specific logic
    if (tabName === 'outfit-builder' && CTO.outfit.manager) {
      await CTO.outfit.manager.loadCurrentOutfit();
      CTO.outfit.manager.updateOutfitDisplay();
      await CTO.outfit.manager.loadWardrobeForOutfit();
    }
  }

  // API Key Management
  async saveApiKey() {
    const apiKeyInput = document.getElementById('api-key');
    if (!apiKeyInput) return;

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      CTO.ui.manager.showStatus('Please enter an API key', 'error', 'api-status');
      return;
    }

    // Show validation in progress
    CTO.ui.manager.showStatus('Validating API key...', 'info', 'api-status');
    apiKeyInput.disabled = true;

    try {
      // Validate the API key before saving
      const validation = await CTO.api.validateApiKey(apiKey);
      
      if (!validation.valid) {
        CTO.ui.manager.showStatus(validation.message, 'error', 'api-status');
        apiKeyInput.disabled = false;
        return;
      }

      // Save the validated API key
      await CTO.storage.set({ apiKey });
      this.apiKey = apiKey;
      CTO.ui.manager.showStatus('API key validated and saved successfully!', 'success', 'api-status');
      
      // Hide API section and show avatar setup
      setTimeout(() => {
        CTO.ui.manager.showSection('avatar-section');
      }, 1500);
    } catch (error) {
      console.error('Error saving API key:', error);
      CTO.ui.manager.showStatus('Error saving API key', 'error', 'api-status');
    } finally {
      apiKeyInput.disabled = false;
    }
  }

  async updateApiKey() {
    const newApiKeyInput = document.getElementById('new-api-key');
    if (!newApiKeyInput) return;

    const newApiKey = newApiKeyInput.value.trim();

    if (!newApiKey) {
      CTO.ui.manager.showStatus('Please enter a new API key', 'error', 'api-update-status');
      return;
    }

    // Show validation in progress
    CTO.ui.manager.showStatus('Validating API key...', 'info', 'api-update-status');
    newApiKeyInput.disabled = true;

    try {
      // Validate the API key before saving
      const validation = await CTO.api.validateApiKey(newApiKey);
      
      if (!validation.valid) {
        CTO.ui.manager.showStatus(validation.message, 'error', 'api-update-status');
        newApiKeyInput.disabled = false;
        return;
      }

      // Save the validated API key
      await CTO.storage.set({ apiKey: newApiKey });
      this.apiKey = newApiKey;
      CTO.ui.manager.showStatus('API key validated and updated successfully!', 'success', 'api-update-status');
      
      // Hide update section and show avatar setup
      setTimeout(() => {
        CTO.ui.manager.showSection('avatar-section');
      }, 1500);
    } catch (error) {
      console.error('Error updating API key:', error);
      CTO.ui.manager.showStatus('Error updating API key', 'error', 'api-update-status');
    } finally {
      newApiKeyInput.disabled = false;
    }
  }

  async updateMainApiKey() {
    const newApiKeyInput = document.getElementById('new-main-api-key');
    if (!newApiKeyInput) return;

    const newApiKey = newApiKeyInput.value.trim();

    if (!newApiKey) {
      CTO.ui.manager.showStatus('Please enter a new API key', 'error', 'main-api-status');
      return;
    }

    // Show validation in progress
    CTO.ui.manager.showStatus('Validating API key...', 'info', 'main-api-status');
    newApiKeyInput.disabled = true;

    try {
      // Validate the API key before saving
      const validation = await CTO.api.validateApiKey(newApiKey);
      
      if (!validation.valid) {
        CTO.ui.manager.showStatus(validation.message, 'error', 'main-api-status');
        newApiKeyInput.disabled = false;
        return;
      }

      // Save the validated API key
      await CTO.storage.set({ apiKey: newApiKey });
      this.apiKey = newApiKey;
      CTO.ui.manager.showStatus('API key validated and updated successfully!', 'success', 'main-api-status');
      
      // Clear the input and reload settings
      newApiKeyInput.value = '';
      this.loadApiSettings();
      
      // Return to avatar setup if that's where we came from
      if (CTO.avatar.manager && CTO.avatar.manager.returnToAvatar) {
        setTimeout(() => {
          CTO.avatar.manager.returnToAvatarSetup();
        }, 1500);
      }
    } catch (error) {
      console.error('Error updating API key:', error);
      CTO.ui.manager.showStatus('Error updating API key', 'error', 'main-api-status');
    } finally {
      newApiKeyInput.disabled = false;
    }
  }

  async testApiKey() {
    const { apiKey } = await CTO.storage.get('apiKey');
    
    if (!apiKey) {
      CTO.ui.manager.showStatus('No API key to test', 'error', 'main-api-status');
      return;
    }

    CTO.ui.manager.showStatus('Testing API key...', 'info', 'main-api-status');

    try {
      const validation = await CTO.api.validateApiKey(apiKey);
      
      if (validation.valid) {
        CTO.ui.manager.showStatus('API key is working correctly!', 'success', 'main-api-status');
        const statusInfo = document.getElementById('api-status-info');
        if (statusInfo) {
          statusInfo.textContent = 'API key is valid and working.';
          statusInfo.style.color = 'var(--success-color)';
        }
      } else {
        CTO.ui.manager.showStatus(validation.message, 'error', 'main-api-status');
        const statusInfo = document.getElementById('api-status-info');
        if (statusInfo) {
          statusInfo.textContent = validation.message;
          statusInfo.style.color = 'var(--error-color)';
        }
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      CTO.ui.manager.showStatus('Error testing API key', 'error', 'main-api-status');
    }
  }

  async loadApiSettings() {
    try {
      const { apiKey } = await CTO.storage.get('apiKey');
      const apiKeyInput = document.getElementById('main-api-key');
      const statusInfo = document.getElementById('api-status-info');
      
      if (!apiKeyInput || !statusInfo) return;
      
      if (apiKey) {
        // Show masked API key
        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
        apiKeyInput.value = maskedKey;
        statusInfo.textContent = 'API key is configured and ready to use.';
        statusInfo.style.color = 'var(--success-color)';
      } else {
        apiKeyInput.value = '';
        statusInfo.textContent = 'No API key configured. Please add one to use the extension.';
        statusInfo.style.color = 'var(--error-color)';
      }
    } catch (error) {
      console.error('Error loading API settings:', error);
    }
  }

  // Delegation Methods
  delegateToAvatarManager(method, ...args) {
    if (CTO.avatar.manager && typeof CTO.avatar.manager[method] === 'function') {
      return CTO.avatar.manager[method](...args);
    } else {
      console.error(`Avatar manager method ${method} not available`);
    }
  }

  delegateToOutfitManager(method, ...args) {
    if (CTO.outfit.manager && typeof CTO.outfit.manager[method] === 'function') {
      return CTO.outfit.manager[method](...args);
    } else {
      console.error(`Outfit manager method ${method} not available`);
    }
  }

  // Utility Methods
  bindEvent(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(eventType, handler);
    } else {
      console.warn(`Element with id '${elementId}' not found for event binding`);
    }
  }

  showError(message) {
    if (this.toastManager) {
      this.toastManager.error('Error', message);
    } else {
      console.error(message);
    }
  }

  // Size Preference Management
  async saveSizePreference(preference) {
    try {
      await CTO.storage.set({ sizePreference: preference });
      console.log(`Size preference saved: ${preference}`);
    } catch (error) {
      console.error('Error saving size preference:', error);
    }
  }

  async loadSizePreference() {
    try {
      const { sizePreference = 'fit' } = await CTO.storage.get('sizePreference');
      
      // Update toggle switch to reflect saved preference
      const sizeToggle = document.getElementById('size-toggle');
      
      if (sizeToggle) {
        sizeToggle.checked = sizePreference === 'fit';
        console.log(`Size preference loaded: ${sizePreference}, toggle checked: ${sizeToggle.checked}`);
      }
      
    } catch (error) {
      console.error('Error loading size preference:', error);
      // Default to 'fit' on error
      const sizeToggle = document.getElementById('size-toggle');
      if (sizeToggle) {
        sizeToggle.checked = true;
        console.log('Error loading preference, defaulted to fit (checked: true)');
      }
    }
  }

  updateNotificationImage(imageUrl) {
    if (!this.notificationMode) {
      console.log('Not in notification mode, ignoring image update');
      return;
    }

    const imageEl = document.getElementById('notification-image');
    if (imageEl && imageUrl) {
      console.log('Updating notification image with:', imageUrl);
      imageEl.src = imageUrl;
      imageEl.style.display = 'block';
      imageEl.alt = 'Clothing Item';
      
      // Handle image loading errors
      imageEl.onerror = () => {
        console.warn('Failed to load updated notification image:', imageUrl);
        imageEl.style.display = 'none';
      };
      
      // Show the image container
      const imageContainer = imageEl.parentElement;
      if (imageContainer) {
        imageContainer.style.display = 'block';
      }
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'switchToWardrobe') {
    // Switch to wardrobe tab
    if (CTO.ui.manager) {
      CTO.ui.manager.switchTab('wardrobe');
    }
    sendResponse({ success: true });
  } else if (message.action === 'switchToOutfits') {
    // Switch to outfits tab and refresh gallery
    if (CTO.ui.manager) {
      CTO.ui.manager.switchTab('outfits');
    }
    // Refresh the gallery to show existing items
    if (CTO.outfit.manager) {
      CTO.outfit.manager.loadOutfits();
    }
  } else if (message.action === 'updateNotificationImage') {
    // Update notification image if in notification mode
    if (window.closetTryOn && window.closetTryOn.notificationMode) {
      window.closetTryOn.updateNotificationImage(message.imageUrl);
    }
    sendResponse({ success: true });
  } else if (message.action === 'generationStatusChanged') {
    // Handle generation status changes from background script
    console.log('Received generation status change:', message);
    
    // Use a small delay to ensure modules are initialized
    setTimeout(async () => {
      if (CTO.generation.monitor) {
        if (message.inProgress) {
          CTO.generation.monitor.showGenerationLoading(message.startTime);
          CTO.generation.monitor.startGenerationStatusMonitoring();
          CTO.generation.monitor.startGenerationTimeout(message.startTime);
        } else {
          CTO.generation.monitor.hideGenerationLoading();
          
          // Refresh displays if manager is available
          if (CTO.outfit.manager) {
            await CTO.outfit.manager.loadOutfits();
            await CTO.outfit.manager.loadLatestTryOn();
          }
          
          // Show completion toast if not in progress
          if (global.toastManager) {
            global.toastManager.generationComplete('Click to view your results', () => {
              CTO.ui.manager.switchTab('outfits');
            });
          }
        }
      } else {
        console.warn('Generation monitor not available yet, status change will be handled on init');
      }
    }, 100);
    
    sendResponse({ success: true });
  }
});

// Initialize the extension when popup opens
document.addEventListener('DOMContentLoaded', () => {
  const extension = new ClosetTryOn();
  extension.init();
  
  // Store global reference for debugging
  window.closetTryOnExtension = extension;
  
  // Add debug functions to window for testing
  window.testNotification = () => extension.testNotificationMode();
}); 