// Closet Try-On Extension - Main Entry Point
// This file orchestrates all the modular components for the extension

class ClosetTryOn {
  constructor() {
    this.apiKey = null;
    this.toastManager = null;
    this.setupComplete = false;
  }

  async init() {
    try {
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

      this.setupComplete = true;
      console.log('ClosetTryOn extension initialized successfully');
    } catch (error) {
      console.error('Error initializing ClosetTryOn extension:', error);
      this.showError('Failed to initialize extension. Please refresh and try again.');
    }
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
  }

  async checkSetupStatus() {
    try {
      const { apiKey, avatarGenerated, userGender } = await CTO.storage.get([
        'apiKey', 'avatarGenerated', 'userGender'
      ]);

      this.apiKey = apiKey;

      if (!apiKey) {
        // No API key - show API setup
        CTO.ui.manager.showSection('api-section');
      } else if (!avatarGenerated) {
        // API key exists but no avatar - show avatar setup
        CTO.ui.manager.showSection('avatar-section');
        if (CTO.avatar.manager) {
          CTO.avatar.manager.populateGenderSelection(userGender);
          
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
}

// Initialize the extension when popup opens
document.addEventListener('DOMContentLoaded', () => {
  const extension = new ClosetTryOn();
  extension.init();
  
  // Store global reference for debugging
  window.closetTryOnExtension = extension;
}); 