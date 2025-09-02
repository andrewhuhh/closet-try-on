// Closet Try-On Extension Popup Script

// Toast Notification System
class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.toastCounter = 0;
    this.init();
  }

  init() {
    // Ensure container exists
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      console.error('Toast container not found in DOM');
      return;
    }
  }

  show(options) {
    const {
      title,
      message = '',
      type = 'info', // 'success', 'error', 'warning', 'info'
      duration = 3000,
      clickAction = null, // Function to call when toast is clicked
      icon = null,
      persistent = false // If true, toast won't auto-dismiss
    } = options;

    if (!this.container) {
      console.error('Toast container not available');
      return null;
    }

    const toastId = `toast-${++this.toastCounter}`;
    const toast = this.createToastElement(toastId, title, message, type, icon, clickAction);
    
    // Add to container (newest on top)
    this.container.insertBefore(toast, this.container.firstChild);
    this.toasts.set(toastId, {
      element: toast,
      clickAction,
      timer: null
    });

    // Set up auto-dismiss timer if not persistent
    if (!persistent && duration > 0) {
      this.setupAutoDismiss(toastId, duration);
    }

    // Limit number of toasts (keep max 5)
    this.limitToasts();

    return toastId;
  }

  createToastElement(toastId, title, message, type, icon, clickAction) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('data-toast-id', toastId);
    
    // Default icons for each type
    const defaultIcons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const toastIcon = icon || defaultIcons[type] || defaultIcons.info;
    
    toast.innerHTML = `
      <div class="toast-icon">${toastIcon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close notification">×</button>
      <div class="toast-progress"></div>
    `;

    // Add click handler for navigation
    if (clickAction && typeof clickAction === 'function') {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', (e) => {
        if (e.target.classList.contains('toast-close')) return;
        try {
          clickAction();
          this.dismiss(toastId);
        } catch (error) {
          console.error('Error executing toast click action:', error);
        }
      });
    }

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss(toastId);
    });

    return toast;
  }

  setupAutoDismiss(toastId, duration) {
    const toastData = this.toasts.get(toastId);
    if (!toastData) return;

    const progressBar = toastData.element.querySelector('.toast-progress');
    if (progressBar) {
      progressBar.style.width = '100%';
      
      // Animate progress bar
      setTimeout(() => {
        progressBar.style.transition = `width ${duration}ms linear`;
        progressBar.style.width = '0%';
      }, 50);
    }

    // Set dismissal timer
    toastData.timer = setTimeout(() => {
      this.dismiss(toastId);
    }, duration);
  }

  dismiss(toastId) {
    const toastData = this.toasts.get(toastId);
    if (!toastData) return;

    // Clear timer if exists
    if (toastData.timer) {
      clearTimeout(toastData.timer);
    }

    // Add removal animation
    toastData.element.classList.add('toast-removing');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (toastData.element.parentNode) {
        toastData.element.parentNode.removeChild(toastData.element);
      }
      this.toasts.delete(toastId);
    }, 300);
  }

  dismissAll() {
    const toastIds = Array.from(this.toasts.keys());
    toastIds.forEach(id => this.dismiss(id));
  }

  limitToasts() {
    const maxToasts = 5;
    if (this.toasts.size > maxToasts) {
      const oldestToasts = Array.from(this.toasts.keys()).slice(0, this.toasts.size - maxToasts);
      oldestToasts.forEach(id => this.dismiss(id));
    }
  }

  // Convenience methods for different toast types
  success(title, message, options = {}) {
    return this.show({ ...options, title, message, type: 'success' });
  }

  error(title, message, options = {}) {
    return this.show({ ...options, title, message, type: 'error', duration: 5000 });
  }

  warning(title, message, options = {}) {
    return this.show({ ...options, title, message, type: 'warning', duration: 4000 });
  }

  info(title, message, options = {}) {
    return this.show({ ...options, title, message, type: 'info' });
  }

  // Generation-specific convenience methods
  generationStarted(message, clickAction) {
    return this.info('Generation Started', message, {
      icon: '🎨',
      clickAction,
      duration: 2000
    });
  }

  generationComplete(message, clickAction) {
    return this.success('Generation Complete!', message, {
      icon: '🎉',
      clickAction,
      duration: 4000
    });
  }

  avatarGenerated(clickAction) {
    return this.success('Avatar Created!', 'Your avatar has been generated successfully', {
      icon: '👤',
      clickAction,
      duration: 4000
    });
  }

  outfitGenerated(clickAction) {
    return this.success('Outfit Ready!', 'Your try-on result is ready to view', {
      icon: '👕',
      clickAction,
      duration: 4000
    });
  }
}

class ClosetTryOn {
  constructor() {
    this.apiKey = null;
    this.avatars = [];
    this.uploadedPhotos = [];
    this.selectedAvatarIndex = 0;
    this.currentImageCollection = [];
    this.currentImageIndex = 0;
    this.generationCheckInterval = null;
    this.elapsedTimeInterval = null;
    this.currentOutfit = []; // Array of clothing items in current outfit
    this.toastManager = new ToastManager(); // Initialize toast system
    this.init();
  }

  async init() {
    await this.checkSetupStatus();
    this.setupEventListeners();
    this.setupDragAndDrop();
  }

  // Storage helpers (callback-based for maximal compatibility)
  storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          const err = chrome.runtime?.lastError;
          if (err) return reject(err);
          resolve(result || {});
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  storageSet(items) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(items, () => {
          const err = chrome.runtime?.lastError;
          if (err) return reject(err);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async checkSetupStatus() {
    try {
      const { apiKey, avatarGenerated, avatars, userGender } = await this.storageGet([
        'apiKey', 'avatarGenerated', 'avatars', 'userGender'
      ]);

      this.apiKey = apiKey;
      this.avatars = avatars || [];

      if (!apiKey) {
        // No API key - show API setup
        this.showSection('api-section');
      } else if (!avatarGenerated) {
        // API key exists but no avatar - show avatar setup
        this.showSection('avatar-section');
        this.populateGenderSelection(userGender);
        // Show back button if we have avatars (user is returning from main interface)
        if (this.avatars.length > 0) {
          document.getElementById('back-to-main-from-avatar').style.display = 'inline-block';
        }
      } else {
        // Everything set up - show main interface
        this.showSection('main-interface');
        await this.loadAvatars();
        
        // Migrate existing PNG avatars to JPEG if needed
        await this.migratePNGAvatarsToJPEG();
        
        await this.loadOutfits();
        await this.loadWardrobe();
        await this.loadLatestTryOn();
        await this.loadCurrentOutfit(); // Load current outfit data
        
        // Start checking for active generations
        await this.checkAndShowGenerationStatus();
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      this.showStatus('Error loading extension state', 'error');
    }
  }

  setupEventListeners() {
    // API Key
    document.getElementById('save-api-key').addEventListener('click', () => this.saveApiKey());

    // Avatar Generation
    document.getElementById('generate-avatar').addEventListener('click', () => this.generateAvatar());
    document.getElementById('regenerate-avatar').addEventListener('click', () => this.regenerateAvatar());

    // File Upload
    document.getElementById('photo-upload').addEventListener('click', () => {
      document.getElementById('photo-input').click();
    });
    document.getElementById('photo-input').addEventListener('change', (e) => this.handleFileSelection(e.target.files));

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Settings dropdown
    document.getElementById('settings-toggle').addEventListener('click', () => this.toggleSettingsDropdown());
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => this.openSettingsSection(item.dataset.setting));
    });

    // Settings navigation
    document.getElementById('close-avatar-management').addEventListener('click', () => this.showSection('main-interface'));
    document.getElementById('close-api-settings').addEventListener('click', () => this.showSection('main-interface'));

    // API Key Update
    document.getElementById('update-api-key').addEventListener('click', () => this.updateApiKey());
    document.getElementById('back-to-avatar').addEventListener('click', () => this.showSection('avatar-section'));
    
    // Main API Settings
    document.getElementById('update-main-api-key').addEventListener('click', () => this.updateMainApiKey());
    document.getElementById('test-api-key').addEventListener('click', () => this.testApiKey());
    
    // Avatar section API management
    document.getElementById('manage-api-from-avatar').addEventListener('click', () => this.switchToApiSettingsFromAvatar());
    document.getElementById('back-to-main-from-avatar').addEventListener('click', () => this.showSection('main-interface'));

    // Avatar Management Event Listeners
    this.setupAvatarManagementListeners();

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.settings-dropdown')) {
        this.hideSettingsDropdown();
      }
    });

    // Image Viewer Event Listeners - setup after ensuring DOM is ready
    this.ensureImageViewerSetup();

    // Outfit Builder Event Listeners
    this.setupOutfitBuilderListeners();
  }

  setupDragAndDrop() {
    const uploadArea = document.getElementById('photo-upload');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
    });

    uploadArea.addEventListener('drop', (e) => this.handleDrop(e), false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // API Key Management
  async saveApiKey() {
    const apiKeyInput = document.getElementById('api-key');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error', 'api-status');
      return;
    }

    // Show validation in progress
    this.showStatus('Validating API key...', 'info', 'api-status');
    apiKeyInput.disabled = true;

    try {
      // Validate the API key before saving
      const validation = await CTO.api.validateApiKey(apiKey);
      
      if (!validation.valid) {
        this.showStatus(validation.message, 'error', 'api-status');
        apiKeyInput.disabled = false;
        return;
      }

      // Save the validated API key
      await this.storageSet({ apiKey });
      this.apiKey = apiKey;
      this.showStatus('API key validated and saved successfully!', 'success', 'api-status');
      
      // Hide API section and show avatar setup
      setTimeout(() => {
        this.showSection('avatar-section');
      }, 1500);
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showStatus('Error saving API key', 'error', 'api-status');
    } finally {
      apiKeyInput.disabled = false;
    }
  }

  async updateApiKey() {
    const newApiKeyInput = document.getElementById('new-api-key');
    const newApiKey = newApiKeyInput.value.trim();

    if (!newApiKey) {
      this.showStatus('Please enter a new API key', 'error', 'api-update-status');
      return;
    }

    // Show validation in progress
    this.showStatus('Validating API key...', 'info', 'api-update-status');
    newApiKeyInput.disabled = true;

    try {
      // Validate the API key before saving
      const validation = await this.validateApiKey(newApiKey);
      
      if (!validation.valid) {
        this.showStatus(validation.message, 'error', 'api-update-status');
        newApiKeyInput.disabled = false;
        return;
      }

      // Save the validated API key
      await this.storageSet({ apiKey: newApiKey });
      this.apiKey = newApiKey;
      this.showStatus('API key validated and updated successfully!', 'success', 'api-update-status');
      
      // Hide update section and show avatar setup
      setTimeout(() => {
        this.showSection('avatar-section');
      }, 1500);
    } catch (error) {
      console.error('Error updating API key:', error);
      this.showStatus('Error updating API key', 'error', 'api-update-status');
    } finally {
      newApiKeyInput.disabled = false;
    }
  }

  showApiKeyUpdateSection() {
    this.showSection('api-update-section');
  }

  // Avatar Generation
  populateGenderSelection(savedGender) {
    if (savedGender) {
      const radio = document.querySelector(`input[name="gender"][value="${savedGender}"]`);
      if (radio) radio.checked = true;
    }
  }

  handleFileSelection(files) {
    this.addFiles(files);
  }

  handleDrop(e) {
    const files = e.dataTransfer.files;
    this.addFiles(files);
  }

  addFiles(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      this.showStatus('Please select image files only', 'error');
      return;
    }

    imageFiles.forEach(file => {
      if (!this.uploadedPhotos.some(photo => photo.name === file.name)) {
        this.uploadedPhotos.push(file);
      }
    });

    this.updateFileList();
    this.updateGenerateButton();
  }

  updateFileList() {
    const fileList = document.getElementById('uploaded-photos');
    fileList.innerHTML = '';

    this.uploadedPhotos.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;

      const info = document.createElement('div');
      info.textContent = file.name;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = () => this.removeFile(index);

      fileItem.appendChild(img);
      fileItem.appendChild(info);
      fileItem.appendChild(removeBtn);
      fileList.appendChild(fileItem);
    });

    fileList.classList.toggle('hidden', this.uploadedPhotos.length === 0);
  }

  removeFile(index) {
    // Note: We created object URLs for previews but did not store them per file.
    // To avoid errors, skip revoke here.
    this.uploadedPhotos.splice(index, 1);
    this.updateFileList();
    this.updateGenerateButton();
  }

  updateGenerateButton() {
    const generateBtn = document.getElementById('generate-avatar');
    const hasEnoughPhotos = this.uploadedPhotos.length >= 3;
    generateBtn.disabled = !hasEnoughPhotos;
    
    if (!hasEnoughPhotos) {
      generateBtn.title = 'Upload at least 3 photos to generate avatar';
    } else {
      generateBtn.title = '';
    }
  }

  async generateAvatar() {
    if (this.uploadedPhotos.length < 3) {
      this.showStatus('Please upload at least 3 photos', 'error');
      return;
    }

    const generateBtn = document.getElementById('generate-avatar');
    const generateText = document.getElementById('generate-text');
    const generateLoading = document.getElementById('generate-loading');

    // Update UI
    generateBtn.disabled = true;
    generateText.textContent = 'Generating Avatar...';
    generateLoading.style.display = 'inline-block';

    try {
      // Save gender preference
      const gender = document.querySelector('input[name="gender"]:checked').value;
      await this.storageSet({ userGender: gender });

      // Validate formats
      const allImages = this.uploadedPhotos.every(f => f.type && f.type.startsWith('image/'));
      if (!allImages) {
        const err = new Error('Unsupported file format');
        err.userMessage = 'Unsupported file detected. Please upload JPEG/PNG photos.';
        throw err;
      }

      // Compress and convert photos to base64 (JPEG)
      const compressionOptions = { maxDimension: 1200, targetMaxBytes: 1200000, quality: 0.85, minQuality: 0.5 };
      const photoPromises = this.uploadedPhotos.map(async (file) => {
        return await CTO.image.compressToBase64JPEG(file, compressionOptions);
      });

      const photoDataArray = await Promise.all(photoPromises);

      // Generate avatar using Gemini API
      const avatars = await CTO.api.callAvatarGenerationAPI(photoDataArray, this.storageGet.bind(this));

      // Save avatars
      await this.storageSet({ 
        avatars, 
        avatarGenerated: true,
        avatarGeneratedAt: new Date().toISOString()
      });

      this.avatars = avatars;
      
      // Show toast notification with navigation
      this.toastManager.avatarGenerated(() => {
        this.showSection('avatar-gallery-section');
        this.displayAvatars();
      });

      // Show avatar gallery
      setTimeout(() => {
        this.showSection('avatar-gallery-section');
        this.displayAvatars();
      }, 1500);

    } catch (error) {
      this.handleApiError(error, 'generating avatar');
    } finally {
      // Reset UI
      generateBtn.disabled = false;
      generateText.textContent = 'Generate Avatar';
      generateLoading.style.display = 'none';
    }
  }

  async regenerateAvatar() {
    await this.storageSet({ avatarGenerated: false });
    this.showSection('avatar-section');
  }

  async callAvatarGenerationAPI(photoDataArray) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
    const { apiKey } = await this.storageGet('apiKey');

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: 'Generate 4 realistic avatar images of this person in neutral clothing on a white background. Use the provided photos to capture identity, face, hairstyle, body type, and skin tone. Dress in plain white/grey T-shirt, black/grey/neutral shorts (not long pants), neutral shoes if visible. The shorts should be mid-thigh length for optimal outfit layering. Output 4 separate images: 1) Neutral front-facing standing, 2) Front-facing open stance, 3) Three-quarter angle, 4) Side profile. Each should be high-resolution and realistic.\n\nIMAGE SPECIFICATIONS:\n- Generate images in portrait orientation with dimensions 768 pixels wide by 1152 pixels tall\n- Use JPEG format for the output images\n- Ensure high quality and clarity at these specific dimensions'
          },
          ...photoDataArray.map(data => ({
            inlineData: {
              mimeType: 'image/jpeg',
              data: data
            }
          }))
        ]
      }
    ];

    const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        contents, 
        generationConfig: { 
          responseModalities: ['text', 'image']
        } 
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let errorMessage = `API request failed: ${response.status} ${text}`;
      
      // Parse error details for better user messages
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          if (errorData.error.code === 429) {
            errorMessage = 'API quota exceeded. Please check your billing or try again later.';
          } else if (errorData.error.code === 401 || errorData.error.code === 403) {
            errorMessage = 'Invalid API key. Please update your API key.';
          }
        }
      } catch (e) {
        // Keep original error message if parsing fails
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Extract generated images from response
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const generatedImages = parts
      .filter(part => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/'))
      .map(part => {
        const mime = part.inlineData.mimeType || 'image/png';
        const base64 = part.inlineData.data || '';
        return `data:${mime};base64,${base64}`;
      });

    if (generatedImages.length < 4) {
      const err = new Error('Not enough avatar images generated');
      err.userMessage = 'The model did not return enough images. Try fewer/smaller photos.';
      throw err;
    }

    // Convert all avatar images to JPEG format to avoid transparency issues
    const jpegAvatars = await Promise.all(
      generatedImages.map(async (dataUrl, index) => {
        const jpegDataUrl = await this.convertToJPEG(dataUrl);
        return {
          url: jpegDataUrl,
          pose: ['front-neutral', 'front-open', 'three-quarter', 'side-profile'][index] || 'front-neutral',
          createdAt: new Date().toISOString()
        };
      })
    );

    return jpegAvatars;
  }

  // Convert any image format to JPEG with white background (removes transparency)
  async convertToJPEG(dataUrl, quality = 0.9) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Fill with white background to remove transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image on top
        ctx.drawImage(img, 0, 0);
        
        // Convert to JPEG
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegDataUrl);
      };
      
      img.src = dataUrl;
    });
  }

  displayAvatars() {
    const avatarGrid = document.getElementById('avatar-grid');
    avatarGrid.innerHTML = '';

    this.avatars.forEach((avatar, index) => {
      const avatarItem = document.createElement('div');
      avatarItem.className = 'avatar-item';
      if (index === this.selectedAvatarIndex) {
        avatarItem.classList.add('selected');
      }

      const img = document.createElement('img');
      img.src = avatar.url;
      img.alt = `Avatar ${index + 1} - ${avatar.pose}`;

      avatarItem.appendChild(img);
      avatarItem.addEventListener('click', () => this.selectAvatar(index));
      avatarGrid.appendChild(avatarItem);
    });
  }

  selectAvatar(index) {
    this.selectedAvatarIndex = index;
    this.displayAvatars();
    this.storageSet({ selectedAvatarIndex: index });
  }

  // Settings Dropdown Management
  toggleSettingsDropdown() {
    const menu = document.getElementById('settings-menu');
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
  }

  hideSettingsDropdown() {
    const menu = document.getElementById('settings-menu');
    menu.style.display = 'none';
  }

  openSettingsSection(sectionName) {
    this.hideSettingsDropdown();
    
    if (sectionName === 'avatar-management') {
      this.showSection('avatar-management-section');
      this.loadAvatarManagement();
    } else if (sectionName === 'api-settings') {
      this.showSection('api-settings-section');
      this.loadApiSettings();
    }
  }

  // Main Interface
  async switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tabs').forEach(tab => {
      tab.classList.toggle('active', tab.id === `${tabName}-tab`);
    });

    // Check generation status when switching to relevant tabs
    if (tabName === 'outfits' || tabName === 'try-on') {
      await this.checkAndShowGenerationStatus();
    } else if (tabName === 'outfit-builder') {
      await this.loadOutfitBuilder();
    }
  }

  async loadAvatars() {
    const { avatars, selectedAvatarIndex } = await this.storageGet(['avatars', 'selectedAvatarIndex']);
    this.avatars = avatars || [];
    this.selectedAvatarIndex = selectedAvatarIndex || 0;
  }

  async loadOutfits() {
    const { generatedOutfits = [] } = await this.storageGet('generatedOutfits');
    const outfitGallery = document.getElementById('outfit-gallery');
    const noOutfits = document.getElementById('no-outfits');

    outfitGallery.innerHTML = '';

    // Check if generation is in progress
    const { generationInProgress } = await this.storageGet('generationInProgress');
    if (generationInProgress) {
      // Keep loading state visible, don't show no outfits message
      return;
    }

    if (generatedOutfits.length === 0) {
      noOutfits.style.display = 'block';
      return;
    }

    noOutfits.style.display = 'none';

    // Sort outfits by newest first (latest createdAt)
    const sortedOutfits = [...generatedOutfits].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    const outfitCollection = sortedOutfits.map((outfit, idx) => ({
      url: outfit.generatedImage,
      info: {
        type: outfit.isMultiItem ? 'Multi-Item Outfit' : 'Generated Outfit',
        createdAt: outfit.createdAt,
        usedAvatar: outfit.usedAvatar,
        itemCount: outfit.isMultiItem ? outfit.outfitItems?.length || (outfit.clothingItems?.length || 1) : 1,
        index: idx + 1,
        originalData: outfit // Store the full outfit data for regeneration
      }
    }));

    sortedOutfits.forEach((outfit, index) => {
      const outfitItem = document.createElement('div');
      outfitItem.className = 'outfit-item';
      outfitItem.style.position = 'relative';

      const img = document.createElement('img');
      img.src = outfit.generatedImage;
      img.alt = 'Generated outfit';

      const info = document.createElement('div');
      info.className = 'info';
      
      const dateText = new Date(outfit.createdAt).toLocaleDateString();
      const avatarText = outfit.usedAvatar ? ` • ${outfit.usedAvatar.pose}` : '';
      const itemCount = outfit.isMultiItem ? outfit.outfitItems?.length || 1 : (outfit.clothingItems?.length || 1);
      const typeText = ` • ${itemCount} item${itemCount > 1 ? 's' : ''}`;
      info.textContent = dateText + avatarText + typeText;

      // Add view button
      this.addViewButtonToImage(outfitItem, outfit.generatedImage, {
        type: outfit.isMultiItem ? 'Multi-Item Outfit' : 'Generated Outfit',
        createdAt: outfit.createdAt,
        usedAvatar: outfit.usedAvatar,
        itemCount: itemCount,
        index: index + 1,
        originalData: outfit // Pass the full outfit data
      }, outfitCollection, index);

      outfitItem.appendChild(img);
      outfitItem.appendChild(info);
      outfitGallery.appendChild(outfitItem);
    });
  }

  async loadWardrobe() {
    const { clothingItems = [] } = await this.storageGet('clothingItems');
    const wardrobeGallery = document.getElementById('wardrobe-gallery');
    const noWardrobe = document.getElementById('no-wardrobe');

    wardrobeGallery.innerHTML = '';

    if (clothingItems.length === 0) {
      noWardrobe.style.display = 'block';
      return;
    }

    noWardrobe.style.display = 'none';

    const wardrobeCollection = clothingItems.map((item, idx) => ({
      url: item.url,
      info: {
        type: 'Clothing Item',
        addedAt: item.addedAt,
        index: idx + 1,
        source: item.source // Include source information
      }
    }));

    clothingItems.forEach((item, index) => {
      const wardrobeItem = document.createElement('div');
      wardrobeItem.className = 'outfit-item';
      wardrobeItem.style.position = 'relative';

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = 'Saved clothing item';

      const info = document.createElement('div');
      info.className = 'info';
      info.textContent = new Date(item.addedAt).toLocaleDateString();

      // Add source link button if available
      if (item.source?.url) {
        this.addSourceButtonToImage(wardrobeItem, item.source);
      }

      // Add view button
      this.addViewButtonToImage(wardrobeItem, item.url, {
        type: 'Clothing Item',
        addedAt: item.addedAt,
        index: index + 1,
        source: item.source // Include source information
      }, wardrobeCollection, index);

      wardrobeItem.appendChild(img);
      wardrobeItem.appendChild(info);
      wardrobeGallery.appendChild(wardrobeItem);
    });
  }

  async loadLatestTryOn() {
    const { generatedOutfits = [] } = await this.storageGet('generatedOutfits');
    const latestTryOn = document.getElementById('latest-try-on');
    const noTryOn = document.getElementById('no-try-on');

    latestTryOn.innerHTML = '';

    // Check if generation is in progress
    const { generationInProgress } = await this.storageGet('generationInProgress');
    if (generationInProgress) {
      // Keep loading state visible, don't show no try-on message
      return;
    }

    if (generatedOutfits.length === 0) {
      noTryOn.style.display = 'block';
      return;
    }

    noTryOn.style.display = 'none';

    // Show the most recent try-on
    const latest = generatedOutfits[generatedOutfits.length - 1];
    
    // Create container for positioning
    const imageContainer = document.createElement('div');
    imageContainer.style.position = 'relative';
    imageContainer.style.display = 'inline-block';
    imageContainer.style.width = '100%';
    
    const img = document.createElement('img');
    img.src = latest.generatedImage;
    img.alt = 'Latest try-on result';
    img.style.width = '100%';
    img.style.borderRadius = '8px';

    // Add view button to latest try-on
    this.addViewButtonToImage(imageContainer, latest.generatedImage, {
      type: 'Latest Try-On Result',
      createdAt: latest.createdAt,
      usedAvatar: latest.usedAvatar
    });

    const info = document.createElement('p');
    const dateText = `Generated on ${new Date(latest.createdAt).toLocaleString()}`;
    const avatarText = latest.usedAvatar ? ` using ${latest.usedAvatar.pose} avatar` : '';
    info.textContent = dateText + avatarText;
    info.style.textAlign = 'center';
    info.style.margin = '8px 0';
    info.style.color = 'var(--text-2)';

    imageContainer.appendChild(img);
    latestTryOn.appendChild(imageContainer);
    latestTryOn.appendChild(info);
  }

  // Outfit Builder Methods
  setupOutfitBuilderListeners() {
    // Clear outfit button
    const clearOutfitBtn = document.getElementById('clear-outfit');
    if (clearOutfitBtn) {
      clearOutfitBtn.addEventListener('click', () => this.clearCurrentOutfit());
    }

    // Try on outfit button
    const tryOnOutfitBtn = document.getElementById('try-on-outfit');
    if (tryOnOutfitBtn) {
      tryOnOutfitBtn.addEventListener('click', () => this.tryOnCurrentOutfit());
    }
  }

  async loadOutfitBuilder() {
    // Load current outfit from storage
    await this.loadCurrentOutfit();
    // Update the outfit display
    this.updateOutfitDisplay();
    // Load wardrobe items for adding to outfit
    await this.loadWardrobeForOutfit();
  }

  async loadCurrentOutfit() {
    const { currentOutfit = [] } = await this.storageGet('currentOutfit');
    this.currentOutfit = currentOutfit;
  }

  async saveCurrentOutfit() {
    await this.storageSet({ currentOutfit: this.currentOutfit });
  }

  updateOutfitDisplay() {
    const outfitItemsGrid = document.getElementById('current-outfit-items');
    const outfitItemCount = document.getElementById('outfit-item-count');
    const clearOutfitBtn = document.getElementById('clear-outfit');
    const tryOnOutfitBtn = document.getElementById('try-on-outfit');
    const currentOutfitDiv = document.querySelector('.current-outfit');

    if (!outfitItemsGrid) return;

    // Update count
    if (outfitItemCount) {
      outfitItemCount.textContent = this.currentOutfit.length;
    }

    // Clear existing items
    outfitItemsGrid.innerHTML = '';

    if (this.currentOutfit.length === 0) {
      // Show empty state
      const emptyState = document.createElement('div');
      emptyState.style.textAlign = 'center';
      emptyState.style.color = 'var(--text-2)';
      emptyState.style.gridColumn = '1 / -1';
      emptyState.innerHTML = `
        <p>No items in outfit yet</p>
        <p style="font-size: 12px;">Add items from your wardrobe below!</p>
      `;
      outfitItemsGrid.appendChild(emptyState);
      
      // Update button states
      if (clearOutfitBtn) clearOutfitBtn.disabled = true;
      if (tryOnOutfitBtn) tryOnOutfitBtn.disabled = true;
      if (currentOutfitDiv) currentOutfitDiv.classList.remove('has-items');
    } else {
      // Show outfit items
      this.currentOutfit.forEach((item, index) => {
        const outfitItemCard = document.createElement('div');
        outfitItemCard.className = 'outfit-item-card';

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'Outfit item';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'outfit-item-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => this.removeFromOutfit(index);

        outfitItemCard.appendChild(img);
        outfitItemCard.appendChild(removeBtn);
        outfitItemsGrid.appendChild(outfitItemCard);
      });

      // Update button states
      if (clearOutfitBtn) clearOutfitBtn.disabled = false;
      if (tryOnOutfitBtn) tryOnOutfitBtn.disabled = false;
      if (currentOutfitDiv) currentOutfitDiv.classList.add('has-items');
    }
  }

  async loadWardrobeForOutfit() {
    const { clothingItems = [] } = await this.storageGet('clothingItems');
    const wardrobeForOutfit = document.getElementById('wardrobe-for-outfit');
    const noWardrobeForOutfit = document.getElementById('no-wardrobe-for-outfit');

    if (!wardrobeForOutfit) return;

    wardrobeForOutfit.innerHTML = '';

    if (clothingItems.length === 0) {
      if (noWardrobeForOutfit) noWardrobeForOutfit.style.display = 'block';
      return;
    }

    if (noWardrobeForOutfit) noWardrobeForOutfit.style.display = 'none';

    clothingItems.forEach((item, index) => {
      const wardrobeItem = document.createElement('div');
      wardrobeItem.className = 'outfit-item';
      wardrobeItem.style.position = 'relative';

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = 'Wardrobe item';

      const info = document.createElement('div');
      info.className = 'info';
      info.textContent = new Date(item.addedAt).toLocaleDateString();

      // Check if item is already in outfit
      const isInOutfit = this.currentOutfit.some(outfitItem => outfitItem.url === item.url);

      // Add to outfit button
      const addBtn = document.createElement('button');
      addBtn.className = `add-to-outfit-btn ${isInOutfit ? 'added' : ''}`;
      addBtn.textContent = isInOutfit ? '✓ Added' : '+ Add';
      addBtn.disabled = isInOutfit;
      addBtn.onclick = () => this.addToOutfit(item);

      // Add source link button if available
      if (item.source?.url) {
        this.addSourceButtonToImage(wardrobeItem, item.source);
      }

      // Add view button for the clothing item
      const wardrobeCollection = clothingItems.map((wardrobeItem, idx) => ({
        url: wardrobeItem.url,
        info: {
          type: 'Clothing Item',
          addedAt: wardrobeItem.addedAt,
          index: idx + 1,
          source: wardrobeItem.source // Include source information
        }
      }));
      this.addViewButtonToImage(wardrobeItem, item.url, {
        type: 'Clothing Item',
        addedAt: item.addedAt,
        index: index + 1,
        source: item.source // Include source information
      }, wardrobeCollection, index);

      wardrobeItem.appendChild(img);
      wardrobeItem.appendChild(info);
      wardrobeItem.appendChild(addBtn);
      wardrobeForOutfit.appendChild(wardrobeItem);
    });
  }

  async addToOutfit(item) {
    // Check if item is already in outfit
    if (this.currentOutfit.some(outfitItem => outfitItem.url === item.url)) {
      this.toastManager.warning('Already Added', 'This item is already in your outfit');
      return;
    }

    // Add item to outfit
    this.currentOutfit.push(item);
    await this.saveCurrentOutfit();

    // Update displays
    this.updateOutfitDisplay();
    await this.loadWardrobeForOutfit(); // Refresh to update button states

    this.toastManager.success('Item Added!', `${this.currentOutfit.length} item${this.currentOutfit.length !== 1 ? 's' : ''} in outfit`, {
      icon: '👕',
      clickAction: () => {
        // Already on outfit builder, just focus the current outfit area
      },
      duration: 2000
    });
  }

  async removeFromOutfit(index) {
    if (index >= 0 && index < this.currentOutfit.length) {
      this.currentOutfit.splice(index, 1);
      await this.saveCurrentOutfit();

      // Update displays
      this.updateOutfitDisplay();
      await this.loadWardrobeForOutfit(); // Refresh to update button states

      this.toastManager.info('Item Removed', `${this.currentOutfit.length} item${this.currentOutfit.length !== 1 ? 's' : ''} remaining`, {
        icon: '🗑️',
        duration: 2000
      });
    }
  }

  async clearCurrentOutfit() {
    if (this.currentOutfit.length === 0) return;

    if (confirm('Are you sure you want to clear your current outfit?')) {
      this.currentOutfit = [];
      await this.saveCurrentOutfit();

      // Update displays
      this.updateOutfitDisplay();
      await this.loadWardrobeForOutfit(); // Refresh to update button states

      this.toastManager.info('Outfit Cleared', 'Ready to build a new outfit', {
        icon: '🧹',
        duration: 2000
      });
    }
  }

  async tryOnCurrentOutfit() {
    if (this.currentOutfit.length === 0) {
      this.toastManager.warning('Empty Outfit', 'Add some items to your outfit first!', {
        icon: '👕',
        clickAction: () => {
          // Already on outfit builder, user can see the wardrobe section below
        }
      });
      return;
    }

    // Set generation status to loading
    await this.storageSet({ 
      generationInProgress: true, 
      generationStartTime: new Date().toISOString() 
    });

    // Show generation started toast
    this.toastManager.generationStarted('Generating your outfit try-on...', () => {
      this.switchTab('outfits');
    });

    // Show loading state immediately
    await this.checkAndShowGenerationStatus();

    try {
      // Get avatar and API key
      const { apiKey, avatars, selectedAvatarIndex = 0 } = await this.storageGet(['apiKey', 'avatars', 'selectedAvatarIndex']);
      
      if (!apiKey) {
        throw new Error('API key required');
      }
      
      if (!avatars || avatars.length === 0) {
        throw new Error('Avatar required');
      }
      
      const validAvatarIndex = Math.min(Math.max(selectedAvatarIndex || 0, 0), avatars.length - 1);
      const selectedAvatar = avatars[validAvatarIndex];
      
      if (!selectedAvatar || !selectedAvatar.url) {
        throw new Error('Selected avatar is invalid');
      }

      // Convert avatar to base64
      const baseImageData = await CTO.image.imageUrlToBase64(selectedAvatar.url);
      
      // Convert all outfit items to base64
      const clothingDataArray = await Promise.all(
        this.currentOutfit.map(item => CTO.image.imageUrlToBase64(item.url))
      );

      // Generate outfit try-on using Gemini API
      const generatedImageUrl = await CTO.api.callMultiItemTryOnAPI(baseImageData, clothingDataArray, apiKey);

      // Store the generated outfit
      await this.storeGeneratedMultiItemOutfit(generatedImageUrl, this.currentOutfit, selectedAvatar);

      // Clear generation status
      await this.storageSet({ generationInProgress: false, generationStartTime: null });

      // Refresh outfit and try-on displays
      await this.loadOutfits();
      await this.loadLatestTryOn();

      // Show toast notification with navigation to outfits
      this.toastManager.outfitGenerated(() => {
        this.switchTab('outfits');
      });

      // Switch to outfits tab to show result
      setTimeout(() => {
        this.switchTab('outfits');
      }, 1500);

    } catch (error) {
      // Clear generation status on error
      await this.storageSet({ generationInProgress: false, generationStartTime: null });
      this.handleApiError(error, 'trying on outfit');
    }
  }

  async imageUrlToBase64(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      const blob = await response.blob();
      
      // Convert blob to file for compression
      const file = new File([blob], 'image.jpg', { type: blob.type });
      
      // Compress the image before converting to base64
      const compressionOptions = { 
        maxDimension: 1024, // Smaller than avatar generation for faster processing
        targetMaxBytes: 100000, // 100kB target
        quality: 0.6, 
        minQuality: 0.4 
      };
      
      const compressedBase64 = await CTO.image.compressToBase64JPEG(file, compressionOptions);
      return compressedBase64;
    } catch (err) {
      console.error('Error converting and compressing image to base64:', err);
      throw err;
    }
  }

  async callMultiItemTryOnAPI(baseImageData, clothingDataArray, apiKey) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
    
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Remove existing clothing from the base image and dress the person in the provided clothing items. Layer the clothes naturally and ensure realistic fit, drape, and alignment. The first image is the person, followed by ${clothingDataArray.length} clothing items to be worn together. Preserve the person's face, hairstyle, body type, and skin tone. Use a plain white background. Generate a high-resolution, realistic photo result.\n\nIMAGE SPECIFICATIONS:\n- Generate the image in portrait orientation with dimensions 768 pixels wide by 1152 pixels tall\n- Use JPEG format for the output image\n- Ensure high quality and clarity at these specific dimensions`
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: baseImageData
            }
          },
          ...clothingDataArray.map(data => ({
            inlineData: {
              mimeType: 'image/jpeg',
              data: data
            }
          }))
        ]
      }
    ];

    const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        contents, 
        generationConfig: { 
          responseModalities: ['text', 'image']
        } 
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let errorMessage = `API request failed: ${response.status}`;
      
      // Parse error details for better user messages
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          if (errorData.error.code === 429) {
            errorMessage = 'API quota exceeded. Please check your billing or try again later.';
          } else if (errorData.error.code === 401 || errorData.error.code === 403) {
            errorMessage = 'Invalid or expired API key. Please update your API key.';
          } else if (errorData.error.code === 400 && errorData.error.message?.includes('API key not valid')) {
            errorMessage = 'Invalid API key. Please check your key and try again.';
          }
        }
      } catch (e) {
        // Keep original error message if parsing fails
        errorMessage += ` ${text}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Extract generated image from response
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const generatedImage = parts.find(part => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/'));
    if (!generatedImage) {
      throw new Error('No image generated in response');
    }

    const mime = generatedImage.inlineData.mimeType || 'image/png';
    const base64 = generatedImage.inlineData.data || '';
    return `data:${mime};base64,${base64}`;
  }

  async storeGeneratedMultiItemOutfit(generatedImageUrl, outfitItems, usedAvatar) {
    const { generatedOutfits = [] } = await this.storageGet('generatedOutfits');
    
    generatedOutfits.push({
      generatedImage: generatedImageUrl,
      outfitItems: outfitItems.map(item => ({
        url: item.url,
        addedAt: item.addedAt
      })),
      usedAvatar: {
        pose: usedAvatar.pose,
        createdAt: usedAvatar.createdAt
      },
      isMultiItem: true,
      createdAt: new Date().toISOString()
    });
    
    await this.storageSet({ generatedOutfits });
  }

  async loadApiSettings() {
    try {
      const { apiKey } = await this.storageGet('apiKey');
      const apiKeyInput = document.getElementById('main-api-key');
      const statusInfo = document.getElementById('api-status-info');
      
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

  async updateMainApiKey() {
    const newApiKeyInput = document.getElementById('new-main-api-key');
    const newApiKey = newApiKeyInput.value.trim();

    if (!newApiKey) {
      this.showStatus('Please enter a new API key', 'error', 'main-api-status');
      return;
    }

    // Show validation in progress
    this.showStatus('Validating API key...', 'info', 'main-api-status');
    newApiKeyInput.disabled = true;

    try {
      // Validate the API key before saving
      const validation = await this.validateApiKey(newApiKey);
      
      if (!validation.valid) {
        this.showStatus(validation.message, 'error', 'main-api-status');
        newApiKeyInput.disabled = false;
        return;
      }

      // Save the validated API key
      await this.storageSet({ apiKey: newApiKey });
      this.apiKey = newApiKey;
      this.showStatus('API key validated and updated successfully!', 'success', 'main-api-status');
      
      // Clear the input and reload settings
      newApiKeyInput.value = '';
      this.loadApiSettings();
      
      // Return to avatar setup if that's where we came from
      if (this.returnToAvatar) {
        setTimeout(() => {
          this.returnToAvatarSetup();
        }, 1500);
      }
    } catch (error) {
      console.error('Error updating API key:', error);
      this.showStatus('Error updating API key', 'error', 'main-api-status');
    } finally {
      newApiKeyInput.disabled = false;
    }
  }

  async testApiKey() {
    const { apiKey } = await this.storageGet('apiKey');
    
    if (!apiKey) {
      this.showStatus('No API key to test', 'error', 'main-api-status');
      return;
    }

    this.showStatus('Testing API key...', 'info', 'main-api-status');

    try {
      const validation = await CTO.api.validateApiKey(apiKey);
      
      if (validation.valid) {
        this.showStatus('API key is working correctly!', 'success', 'main-api-status');
        const statusInfo = document.getElementById('api-status-info');
        statusInfo.textContent = 'API key is valid and working.';
        statusInfo.style.color = 'var(--success-color)';
      } else {
        this.showStatus(validation.message, 'error', 'main-api-status');
        const statusInfo = document.getElementById('api-status-info');
        statusInfo.textContent = validation.message;
        statusInfo.style.color = 'var(--error-color)';
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      this.showStatus('Error testing API key', 'error', 'main-api-status');
    }
  }

  switchToApiSettingsFromAvatar() {
    // Store current state to return to avatar setup
    this.returnToAvatar = true;
    this.showSection('main-interface');
    this.switchTab('api-settings');
  }

  returnToAvatarSetup() {
    if (this.returnToAvatar) {
      this.returnToAvatar = false;
      this.showSection('avatar-section');
    }
  }

  // Utility Methods
  async compressToBase64JPEG(file, options) {
    const { maxDimension = 1200, targetMaxBytes = 1200000, quality = 0.85, minQuality = 0.5 } = options || {};
    try {
      const dataUrl = await this.readFileAsDataURL(file);
      const image = await this.loadImageFromDataURL(dataUrl);

      const { width, height } = this.getScaledDimensions(image.width, image.height, maxDimension);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(image, 0, 0, width, height);

      let currentQuality = quality;
      let blob = await this.canvasToBlob(canvas, 'image/jpeg', currentQuality);

      // Iteratively reduce quality until under size or minQuality
      while (blob && blob.size > targetMaxBytes && currentQuality > minQuality) {
        currentQuality = Math.max(minQuality, currentQuality - 0.1);
        blob = await this.canvasToBlob(canvas, 'image/jpeg', currentQuality);
      }

      if (!blob) {
        const err = new Error('Compression failed');
        err.userMessage = 'Image compression failed. Try different photos.';
        throw err;
      }

      const base64Data = await this.blobToBase64Data(blob);
      return base64Data;
    } catch (e) {
      if (!e.userMessage) {
        e.userMessage = 'Could not process one or more photos. Use standard JPEG/PNG images.';
      }
      throw e;
    }
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  loadImageFromDataURL(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  }

  getScaledDimensions(origW, origH, maxDim) {
    if (origW <= maxDim && origH <= maxDim) return { width: origW, height: origH };
    const scale = origW > origH ? maxDim / origW : maxDim / origH;
    return { width: Math.round(origW * scale), height: Math.round(origH * scale) };
  }

  canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, quality);
    });
  }

  blobToBase64Data(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = String(result).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  }

  showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
      section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
  }

  showStatus(message, type, targetId = 'global-status') {
    const statusDiv = document.getElementById(targetId);
    statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
    
    // Clear status after 5 seconds
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 5000);
  }

  // Centralized API error handling
  handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    let userMessage = '';
    let shouldRedirectToSettings = false;
    
    if (error.message) {
      if (error.message.includes('429')) {
        userMessage = 'API quota exceeded. Please check your billing or try again later.';
        shouldRedirectToSettings = true;
      } else if (error.message.includes('401') || error.message.includes('403')) {
        userMessage = 'Invalid or expired API key. Please update your API key.';
        shouldRedirectToSettings = true;
      } else if (error.message.includes('400') && error.message.includes('API key not valid')) {
        userMessage = 'Invalid API key. Please check your key and try again.';
        shouldRedirectToSettings = true;
      } else if (error.message.includes('Network error') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.userMessage) {
        userMessage = error.userMessage;
      } else {
        userMessage = 'An unexpected error occurred. Please try again.';
      }
    } else {
      userMessage = 'An unexpected error occurred. Please try again.';
    }
    
    this.showStatus(userMessage, 'error');
    
    // Redirect to API settings if needed
    if (shouldRedirectToSettings) {
      setTimeout(() => {
        if (document.getElementById('main-interface') && !document.getElementById('main-interface').classList.contains('hidden')) {
          // Already in main interface, switch to API settings tab
          this.switchTab('api-settings');
        } else {
          // Show main interface and switch to API settings
          this.showSection('main-interface');
          setTimeout(() => this.switchTab('api-settings'), 500);
        }
      }, 2000);
    }
    
    return userMessage;
  }

  async validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
      return { valid: false, message: 'Please enter an API key' };
    }

    try {
      // Test with a simple API call
      const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
        })
      });

      if (testResponse.ok) {
        return { valid: true, message: 'API key is valid and working' };
      } else {
        const errorText = await testResponse.text();
        let errorMessage = `API key validation failed: ${testResponse.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            if (errorData.error.code === 400 && errorData.error.message?.includes('API key not valid')) {
              errorMessage = 'Invalid API key. Please check your key and try again.';
            } else if (errorData.error.code === 429) {
              errorMessage = 'API quota exceeded. Please check your billing or try again later.';
            } else if (errorData.error.code === 403) {
              errorMessage = 'API key does not have permission to access this service.';
            }
          }
        } catch (e) {
          // Keep original error message if parsing fails
        }
        
        return { valid: false, message: errorMessage };
      }
    } catch (error) {
      console.error('Error validating API key:', error);
      return { valid: false, message: 'Network error while validating API key. Please check your connection.' };
    }
  }

  showAvatarSetupWithBack() {
    this.showSection('avatar-section');
    document.getElementById('back-to-main-from-avatar').style.display = 'inline-block';
  }

  // Avatar Management Methods
  setupAvatarManagementListeners() {
    // Avatar creation from management panel
    document.getElementById('create-new-avatar').addEventListener('click', () => this.createNewAvatarFromManagement());
    document.getElementById('start-avatar-creation').addEventListener('click', () => this.createNewAvatarFromManagement());
    
    // Avatar actions
    document.getElementById('regenerate-all-avatars').addEventListener('click', () => this.regenerateAllAvatars());
    document.getElementById('delete-selected-avatar').addEventListener('click', () => this.deleteSelectedAvatar());
    document.getElementById('export-avatars').addEventListener('click', () => this.exportAvatars());
  }

  async loadAvatarManagement() {
    await this.loadAvatars();
    this.updateAvatarManagementDisplay();
  }

  updateAvatarManagementDisplay() {
    const grid = document.getElementById('avatar-management-grid');
    const noAvatarsMsg = document.getElementById('no-avatars-message');
    const avatarCount = document.getElementById('avatar-count');
    const activePreview = document.getElementById('active-avatar-preview');
    const activeInfo = document.getElementById('active-avatar-info');
    
    // Update avatar count
    avatarCount.textContent = `${this.avatars.length} avatar${this.avatars.length !== 1 ? 's' : ''}`;
    
    // Show/hide no avatars message
    if (this.avatars.length === 0) {
      noAvatarsMsg.style.display = 'block';
      grid.style.display = 'none';
      activePreview.innerHTML = 'No avatar selected';
      activeInfo.textContent = 'Create your first avatar to get started';
      this.updateAvatarActionButtons(false);
      return;
    }
    
    noAvatarsMsg.style.display = 'none';
    grid.style.display = 'grid';
    
    // Clear and populate grid
    grid.innerHTML = '';
    
    this.avatars.forEach((avatar, index) => {
      const avatarItem = document.createElement('div');
      avatarItem.className = 'avatar-item';
      
      if (index === this.selectedAvatarIndex) {
        avatarItem.classList.add('selected');
        avatarItem.classList.add('active');
      }
      
      const img = document.createElement('img');
      img.src = avatar.url;
      img.alt = `Avatar ${index + 1} - ${avatar.pose}`;
      
      // Add badge for active avatar
      if (index === this.selectedAvatarIndex) {
        const badge = document.createElement('div');
        badge.className = 'avatar-badge active';
        badge.textContent = 'Active';
        avatarItem.appendChild(badge);
      }
      
      // Add overlay with actions
      const overlay = document.createElement('div');
      overlay.className = 'avatar-overlay';
      
      const actions = document.createElement('div');
      actions.className = 'overlay-actions';
      
      const selectBtn = document.createElement('button');
      selectBtn.className = 'overlay-btn select';
      selectBtn.textContent = index === this.selectedAvatarIndex ? 'Active' : 'Select';
      selectBtn.disabled = index === this.selectedAvatarIndex;
      selectBtn.onclick = (e) => {
        e.stopPropagation();
        this.selectAvatarFromManagement(index);
      };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'overlay-btn delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deleteAvatarFromManagement(index);
      };
      
      actions.appendChild(selectBtn);
      actions.appendChild(deleteBtn);
      overlay.appendChild(actions);
      
      avatarItem.appendChild(img);
      avatarItem.appendChild(overlay);
      
      // Add view button
      const avatarCollection = this.avatars.map((avatar, idx) => ({
        url: avatar.url,
        info: {
          type: 'Avatar',
          pose: avatar.pose,
          createdAt: avatar.createdAt,
          index: idx + 1
        }
      }));
      this.addViewButtonToImage(avatarItem, avatar.url, {
        type: 'Avatar',
        pose: avatar.pose,
        createdAt: avatar.createdAt,
        index: index + 1
      }, avatarCollection, index);
      
      // Click to select avatar
      avatarItem.addEventListener('click', () => this.selectAvatarFromManagement(index));
      
      grid.appendChild(avatarItem);
    });
    
    // Update active avatar preview
    if (this.avatars[this.selectedAvatarIndex]) {
      const activeAvatar = this.avatars[this.selectedAvatarIndex];
      activePreview.innerHTML = `<img src="${activeAvatar.url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
      activeInfo.textContent = `Currently using avatar ${this.selectedAvatarIndex + 1} (${activeAvatar.pose}) for try-ons`;
    }
    
    this.updateAvatarActionButtons(true);
  }

  updateAvatarActionButtons(hasAvatars) {
    const regenBtn = document.getElementById('regenerate-all-avatars');
    const deleteBtn = document.getElementById('delete-selected-avatar');
    const exportBtn = document.getElementById('export-avatars');
    
    regenBtn.disabled = !hasAvatars;
    deleteBtn.disabled = !hasAvatars;
    exportBtn.disabled = !hasAvatars;
  }

  async selectAvatarFromManagement(index) {
    this.selectedAvatarIndex = index;
    await this.storageSet({ selectedAvatarIndex: index });
    this.updateAvatarManagementDisplay();
    
    // Show toast notification with navigation to try-on
    this.toastManager.success('Avatar Selected!', 'Ready to use for outfit try-ons', {
      icon: '👤',
      clickAction: () => {
        this.showSection('main-interface');
        this.switchTab('outfit-builder');
      }
    });
  }

  async deleteAvatarFromManagement(index) {
    if (this.avatars.length <= 1) {
      this.showStatus('Cannot delete the last avatar. Create a new one first.', 'error');
      return;
    }
    
    if (confirm('Are you sure you want to delete this avatar? This action cannot be undone.')) {
      this.avatars.splice(index, 1);
      
      // Adjust selected index if needed
      if (this.selectedAvatarIndex >= this.avatars.length) {
        this.selectedAvatarIndex = this.avatars.length - 1;
      } else if (this.selectedAvatarIndex >= index) {
        this.selectedAvatarIndex = Math.max(0, this.selectedAvatarIndex - 1);
      }
      
      await this.storageSet({ 
        avatars: this.avatars, 
        selectedAvatarIndex: this.selectedAvatarIndex 
      });
      
      this.updateAvatarManagementDisplay();
      this.toastManager.success('Avatar Deleted', 'Avatar removed from collection', {
        icon: '🗑️',
        duration: 2000
      });
    }
  }

  createNewAvatarFromManagement() {
    this.showSection('avatar-section');
  }

  async regenerateAllAvatars() {
    if (!confirm('This will regenerate all your avatars using your original photos. Continue?')) {
      return;
    }
    
    const regenBtn = document.getElementById('regenerate-all-avatars');
    const regenText = document.getElementById('regen-text');
    const regenLoading = document.getElementById('regen-loading');
    
    regenBtn.disabled = true;
    regenText.textContent = 'Regenerating...';
    regenLoading.style.display = 'inline-block';
    
    try {
      // Reset avatar generated flag to trigger regeneration
      await this.storageSet({ avatarGenerated: false });
      this.showStatus('Redirecting to avatar creation...', 'info');
      
      setTimeout(() => {
        this.showSection('avatar-section');
      }, 1500);
    } catch (error) {
      console.error('Error initiating regeneration:', error);
      this.showStatus('Error starting regeneration', 'error');
    } finally {
      regenBtn.disabled = false;
      regenText.textContent = 'Regenerate All';
      regenLoading.style.display = 'none';
    }
  }

  async deleteSelectedAvatar() {
    if (this.avatars.length <= 1) {
      this.showStatus('Cannot delete the last avatar. Create a new one first.', 'error');
      return;
    }
    
    await this.deleteAvatarFromManagement(this.selectedAvatarIndex);
  }

  async exportAvatars() {
    try {
      const dataStr = JSON.stringify({
        avatars: this.avatars,
        selectedAvatarIndex: this.selectedAvatarIndex,
        exportedAt: new Date().toISOString()
      }, null, 2);
      
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `closet-try-on-avatars-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.toastManager.success('Export Complete!', 'Avatars saved to downloads folder', {
        icon: '📁',
        duration: 3000
      });
    } catch (error) {
      console.error('Error exporting avatars:', error);
      this.showStatus('Error exporting avatars', 'error');
    }
  }

  // Image Viewer Methods
  ensureImageViewerSetup() {
    // Check if modal exists, if not wait and retry
    const modal = document.getElementById('image-viewer-modal');
    if (modal) {
      this.setupImageViewerListeners();
    } else {
      console.log('Image viewer modal not found, retrying...');
      setTimeout(() => this.ensureImageViewerSetup(), 100);
    }
  }

  setupImageViewerListeners() {
    // Modal controls with error handling
    const closeBtn = document.getElementById('image-viewer-close');
    const prevBtn = document.getElementById('image-viewer-prev');
    const nextBtn = document.getElementById('image-viewer-next');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeImageViewer());
    } else {
      console.error('image-viewer-close button not found');
    }
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigateImage(-1));
    } else {
      console.error('image-viewer-prev button not found');
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigateImage(1));
    } else {
      console.error('image-viewer-next button not found');
    }
    
    // Action buttons with error handling
    const openTabBtn = document.getElementById('open-in-tab');
    const downloadBtn = document.getElementById('download-image');
    const shareBtn = document.getElementById('share-image');
    
    if (openTabBtn) {
      openTabBtn.addEventListener('click', () => this.openImageInTab());
    } else {
      console.error('open-in-tab button not found');
    }
    
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadCurrentImage());
    } else {
      console.error('download-image button not found');
    }
    
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareCurrentImage());
    } else {
      console.error('share-image button not found');
    }
    
    const deleteBtn = document.getElementById('delete-image');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteCurrentImage());
    } else {
      console.error('delete-image button not found');
    }

    // Regeneration button
    const regenerateBtn = document.getElementById('regenerate-outfit');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => this.regenerateOutfit());
    }

    // View source button
    const viewSourceBtn = document.getElementById('view-source');
    if (viewSourceBtn) {
      viewSourceBtn.addEventListener('click', () => this.viewCurrentItemSource());
    }
    
    // Close modal when clicking outside
    document.getElementById('image-viewer-modal').addEventListener('click', (e) => {
      if (e.target.id === 'image-viewer-modal') {
        this.closeImageViewer();
      }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('image-viewer-modal').classList.contains('active')) return;
      
      switch(e.key) {
        case 'Escape':
          this.closeImageViewer();
          break;
        case 'ArrowLeft':
          this.navigateImage(-1);
          break;
        case 'ArrowRight':
          this.navigateImage(1);
          break;
      }
    });
  }

  openImageViewer(imageUrl, imageInfo, imageCollection = null, index = 0) {
    const modal = document.getElementById('image-viewer-modal');
    const image = document.getElementById('image-viewer-image');
    const info = document.getElementById('image-viewer-info');
    const prevBtn = document.getElementById('image-viewer-prev');
    const nextBtn = document.getElementById('image-viewer-next');
    
    // Set current image data
    this.currentImageCollection = imageCollection || [{ url: imageUrl, info: imageInfo }];
    this.currentImageIndex = index;
    
    // Display the image
    image.src = imageUrl;
    info.innerHTML = this.formatImageInfo(imageInfo);
    
    // Show/hide navigation arrows
    const hasMultiple = this.currentImageCollection.length > 1;
    prevBtn.style.display = hasMultiple ? 'flex' : 'none';
    nextBtn.style.display = hasMultiple ? 'flex' : 'none';
    
    // Update navigation button states
    prevBtn.disabled = this.currentImageIndex <= 0;
    nextBtn.disabled = this.currentImageIndex >= this.currentImageCollection.length - 1;
    
    // Show original clothing thumbnails and regeneration controls for generated outfits
    this.updateModalExtendedControls(imageInfo);
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  closeImageViewer() {
    console.log('closeImageViewer called');
    const modal = document.getElementById('image-viewer-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = ''; // Restore scrolling
      console.log('Modal closed successfully');
    } else {
      console.error('image-viewer-modal not found');
    }
  }

  updateModalExtendedControls(imageInfo) {
    const originalClothingSection = document.getElementById('original-clothing-section');
    const regenerationControls = document.getElementById('regeneration-controls');
    const viewSourceBtn = document.getElementById('view-source');
    
    // Show extended controls only for generated outfits
    const isGeneratedOutfit = imageInfo?.originalData && (
      imageInfo.type === 'Generated Outfit' || 
      imageInfo.type === 'Multi-Item Outfit'
    );
    
    if (isGeneratedOutfit && imageInfo.originalData) {
      this.showOriginalClothingThumbnails(imageInfo.originalData);
      this.showRegenerationControls(imageInfo.originalData);
      originalClothingSection.style.display = 'block';
      regenerationControls.style.display = 'block';
    } else {
      originalClothingSection.style.display = 'none';
      regenerationControls.style.display = 'none';
    }

    // Show/hide source button based on whether item has source information
    const hasSource = imageInfo?.source?.url || imageInfo?.sourceUrl;
    if (viewSourceBtn) {
      viewSourceBtn.style.display = hasSource ? 'inline-block' : 'none';
    }
  }

  showOriginalClothingThumbnails(outfitData) {
    const thumbnailsContainer = document.getElementById('original-clothing-thumbnails');
    thumbnailsContainer.innerHTML = '';
    
    // Get original clothing URLs from the outfit data
    let clothingUrls = [];
    if (outfitData.isMultiItem && outfitData.outfitItems) {
      clothingUrls = outfitData.outfitItems.map(item => item.url);
    } else if (outfitData.clothingItems) {
      clothingUrls = Array.isArray(outfitData.clothingItems) ? outfitData.clothingItems : [outfitData.clothingItems];
    } else if (outfitData.originalClothing) {
      clothingUrls = Array.isArray(outfitData.originalClothing) ? outfitData.originalClothing : [outfitData.originalClothing];
    }
    
    clothingUrls.forEach((url, index) => {
      const thumbnail = document.createElement('div');
      thumbnail.className = 'original-clothing-thumbnail';
      thumbnail.innerHTML = `
        <img src="${url}" alt="Original clothing ${index + 1}">
        <div class="expand-icon">🔍</div>
      `;
      
      // Click to view original clothing item in larger view
      thumbnail.addEventListener('click', () => {
        const clothingCollection = clothingUrls.map((clothingUrl, idx) => ({
          url: clothingUrl,
          info: {
            type: 'Original Clothing Item',
            index: idx + 1,
            total: clothingUrls.length
          }
        }));
        
        this.openImageViewer(url, {
          type: 'Original Clothing Item',
          index: index + 1,
          total: clothingUrls.length
        }, clothingCollection, index);
      });
      
      thumbnailsContainer.appendChild(thumbnail);
    });
  }

  async showRegenerationControls(outfitData) {
    const poseSelector = document.getElementById('pose-selector');
    const regenerateBtn = document.getElementById('regenerate-outfit');
    
    // Store current outfit data for regeneration
    this.currentOutfitForRegeneration = outfitData;
    
    // Populate pose selector with available avatars
    try {
      const { avatars = [] } = await this.storageGet('avatars');
      poseSelector.innerHTML = '<option value="">Select pose...</option>';
      
      avatars.forEach((avatar, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = avatar.pose || `Avatar ${index + 1}`;
        
        // Mark current pose if it matches
        if (outfitData.usedAvatar && avatar.pose === outfitData.usedAvatar.pose) {
          option.textContent += ' (current)';
        }
        
        poseSelector.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading avatars for pose selector:', error);
    }
  }

  async regenerateOutfit() {
    const poseSelector = document.getElementById('pose-selector');
    const selectedAvatarIndex = parseInt(poseSelector.value);
    
    if (!this.currentOutfitForRegeneration) {
      this.toastManager.error('Error', 'No outfit data available for regeneration');
      return;
    }
    
    if (isNaN(selectedAvatarIndex)) {
      this.toastManager.warning('Select Pose', 'Please select a pose for regeneration');
      return;
    }
    
    try {
      // Close the modal
      this.closeImageViewer();
      
      // Show loading state
      this.showGenerationLoading(new Date().toISOString());
      
      // Get clothing URLs for regeneration
      let clothingUrls = [];
      if (this.currentOutfitForRegeneration.isMultiItem && this.currentOutfitForRegeneration.outfitItems) {
        clothingUrls = this.currentOutfitForRegeneration.outfitItems.map(item => item.url);
      } else if (this.currentOutfitForRegeneration.clothingItems) {
        clothingUrls = Array.isArray(this.currentOutfitForRegeneration.clothingItems) 
          ? this.currentOutfitForRegeneration.clothingItems 
          : [this.currentOutfitForRegeneration.clothingItems];
      } else if (this.currentOutfitForRegeneration.originalClothing) {
        clothingUrls = Array.isArray(this.currentOutfitForRegeneration.originalClothing)
          ? this.currentOutfitForRegeneration.originalClothing 
          : [this.currentOutfitForRegeneration.originalClothing];
      }
      
      if (clothingUrls.length === 0) {
        throw new Error('No clothing items found for regeneration');
      }
      
      // Set the selected avatar index in storage
      await this.storageSet({ selectedAvatarIndex });
      
      // Trigger regeneration via background script
      // Send message to background script or call the generation function directly
      await this.generateTryOnWithMultipleItems(clothingUrls);
      
      this.toastManager.success('Regeneration Started', 'Your outfit is being regenerated with the selected pose');
      
    } catch (error) {
      console.error('Error during regeneration:', error);
      this.hideGenerationLoading();
      this.toastManager.error('Regeneration Failed', error.message || 'Failed to regenerate outfit');
    }
  }

  async viewCurrentItemSource() {
    if (!this.currentImageCollection || this.currentImageIndex < 0) {
      this.toastManager.error('Error', 'No image selected');
      return;
    }

    const currentItem = this.currentImageCollection[this.currentImageIndex];
    const imageInfo = currentItem?.info;
    
    // Get source URL from different possible locations
    let sourceUrl = null;
    if (imageInfo?.source?.url) {
      sourceUrl = imageInfo.source.url;
    } else if (imageInfo?.sourceUrl) {
      sourceUrl = imageInfo.sourceUrl;
    }
    
    if (!sourceUrl) {
      this.toastManager.warning('No Source', 'No source information available for this item');
      return;
    }

    try {
      // Open the source URL in a new tab
      await chrome.tabs.create({ url: sourceUrl });
      this.toastManager.success('Source Opened', 'Original source opened in new tab');
    } catch (error) {
      console.error('Error opening source URL:', error);
      this.toastManager.error('Error', 'Failed to open source URL');
    }
  }

  async generateTryOnWithMultipleItems(clothingUrls) {
    // Set generation status to loading
    await this.storageSet({ 
      generationInProgress: true, 
      generationStartTime: new Date().toISOString() 
    });

    try {
      // Get avatar and API key
      const { apiKey, avatars, selectedAvatarIndex = 0 } = await this.storageGet(['apiKey', 'avatars', 'selectedAvatarIndex']);
      
      if (!apiKey) {
        throw new Error('API key required');
      }
      
      if (!avatars || avatars.length === 0) {
        throw new Error('Avatar required');
      }
      
      const validAvatarIndex = Math.min(Math.max(selectedAvatarIndex || 0, 0), avatars.length - 1);
      const selectedAvatar = avatars[validAvatarIndex];
      
      if (!selectedAvatar || !selectedAvatar.url) {
        throw new Error('Selected avatar is invalid');
      }

      // Convert avatar to base64
      const baseImageData = await CTO.image.imageUrlToBase64(selectedAvatar.url);
      
      // Convert all clothing items to base64
      const clothingDataArray = await Promise.all(
        clothingUrls.map(url => CTO.image.imageUrlToBase64(url))
      );

      // Generate outfit try-on using Gemini API
      const generatedImageUrl = await CTO.api.callMultiItemTryOnAPI(baseImageData, clothingDataArray, apiKey);

      // Store the generated outfit
      const outfitItems = clothingUrls.map(url => ({ url, addedAt: new Date().toISOString() }));
      await this.storeGeneratedMultiItemOutfit(generatedImageUrl, outfitItems, selectedAvatar);

      // Clear generation status
      await this.storageSet({ generationInProgress: false, generationStartTime: null });

      // Refresh outfit and try-on displays
      await this.loadOutfits();
      await this.loadLatestTryOn();

      // Show toast notification with navigation to outfits
      this.toastManager.generationComplete('Regeneration complete!', () => {
        this.switchTab('outfits');
      });

    } catch (error) {
      console.error('Error generating try-on with multiple items:', error);
      
      // Clear generation status on error
      await this.storageSet({ generationInProgress: false, generationStartTime: null });
      
      throw error; // Re-throw to be handled by caller
    }
  }

  navigateImage(direction) {
    console.log(`navigateImage called with direction: ${direction}`);
    console.log(`Current index: ${this.currentImageIndex}, Collection length: ${this.currentImageCollection.length}`);
    
    const newIndex = this.currentImageIndex + direction;
    
    if (newIndex >= 0 && newIndex < this.currentImageCollection.length) {
      const imageData = this.currentImageCollection[newIndex];
      console.log(`Navigating to index ${newIndex}`);
      this.openImageViewer(imageData.url, imageData.info, this.currentImageCollection, newIndex);
    } else {
      console.log(`Cannot navigate to index ${newIndex} - out of bounds`);
    }
  }

  formatImageInfo(imageInfo) {
    if (typeof imageInfo === 'string') {
      return imageInfo;
    }
    
    let infoHtml = '';
    
    if (imageInfo.type) {
      infoHtml += `<strong>${imageInfo.type}</strong><br>`;
    }
    
    if (imageInfo.pose) {
      infoHtml += `Pose: ${imageInfo.pose}<br>`;
    }
    
    if (imageInfo.createdAt) {
      infoHtml += `Created: ${new Date(imageInfo.createdAt).toLocaleString()}<br>`;
    }
    
    if (imageInfo.addedAt) {
      infoHtml += `Added: ${new Date(imageInfo.addedAt).toLocaleString()}<br>`;
    }
    
    if (imageInfo.usedAvatar) {
      infoHtml += `Avatar: ${imageInfo.usedAvatar.pose}<br>`;
    }
    
    if (imageInfo.itemCount && imageInfo.itemCount > 1) {
      infoHtml += `Items: ${imageInfo.itemCount}<br>`;
    }
    
    // Add source information if available
    if (imageInfo.source?.title || imageInfo.source?.url) {
      const sourceTitle = imageInfo.source.title || 'Unknown Source';
      infoHtml += `<br><strong>Source:</strong><br>${sourceTitle}`;
    }
    
    return infoHtml || 'Image';
  }

  async openImageInTab() {
    const currentImage = this.currentImageCollection[this.currentImageIndex];
    if (!currentImage) return;
    
    try {
      // Create a new tab with the image
      const newTab = window.open('', '_blank');
      newTab.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Closet Try-On - Image Viewer</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                background: #1a1a1a;
                display: flex;
                flex-direction: column;
                align-items: center;
                font-family: system-ui, -apple-system, sans-serif;
                color: white;
              }
              img {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
              }
              .info {
                margin-top: 20px;
                text-align: center;
                font-size: 14px;
                color: #ccc;
              }
              .actions {
                margin-top: 16px;
                display: flex;
                gap: 12px;
              }
              .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                background: #6366f1;
                color: white;
                text-decoration: none;
              }
              .btn:hover {
                background: #5855eb;
              }
            </style>
          </head>
          <body>
            <img src="${currentImage.url}" alt="Closet Try-On Image">
            <div class="info">${this.formatImageInfo(currentImage.info)}</div>
            <div class="actions">
              <a href="${currentImage.url}" download class="btn">Download Image</a>
              <button onclick="window.close()" class="btn">Close</button>
            </div>
          </body>
        </html>
      `);
      newTab.document.close();
    } catch (error) {
      console.error('Error opening image in tab:', error);
      this.showStatus('Error opening image in new tab', 'error');
    }
  }

  async downloadCurrentImage() {
    const currentImage = this.currentImageCollection[this.currentImageIndex];
    if (!currentImage) return;
    
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = this.generateImageFilename(currentImage);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.toastManager.success('Download Complete!', 'Image saved to downloads folder', {
        icon: '💾',
        duration: 2000
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      this.showStatus('Error downloading image', 'error');
    }
  }

  generateImageFilename(imageData) {
    const timestamp = new Date().toISOString().split('T')[0];
    const type = imageData.info?.type || 'image';
    const pose = imageData.info?.pose || '';
    
    let filename = `closet-try-on-${type}-${timestamp}`;
    if (pose) filename += `-${pose}`;
    filename += '.png';
    
    return filename.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  }

  async shareCurrentImage() {
    const currentImage = this.currentImageCollection[this.currentImageIndex];
    if (!currentImage) return;
    
    try {
      if (navigator.share) {
        // Use native sharing if available
        const response = await fetch(currentImage.url);
        const blob = await response.blob();
        const file = new File([blob], this.generateImageFilename(currentImage), { type: blob.type });
        
        await navigator.share({
          title: 'Closet Try-On Result',
          text: 'Check out this virtual try-on result!',
          files: [file]
        });
      } else {
        // Fallback to copying image URL
        await navigator.clipboard.writeText(currentImage.url);
        this.toastManager.success('Link Copied!', 'Image URL copied to clipboard', {
          icon: '📋',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      this.showStatus('Error sharing image', 'error');
    }
  }

  async deleteCurrentImage() {
    const currentImage = this.currentImageCollection[this.currentImageIndex];
    if (!currentImage) return;
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }
    
    try {
      const imageInfo = currentImage.info;
      
      if (imageInfo.type === 'Generated Outfit' || imageInfo.type === 'Latest Try-On Result') {
        // Delete from generated outfits
        await this.deleteGeneratedOutfit(currentImage);
      } else if (imageInfo.type === 'Clothing Item') {
        // Delete from wardrobe (clothing items)
        await this.deleteClothingItem(currentImage);
      } else if (imageInfo.type === 'Avatar') {
        // Delete avatar
        await this.deleteAvatarImage(currentImage);
      }
      
      // Close the modal after deletion
      this.closeImageViewer();
      this.toastManager.success('Image Deleted', 'Successfully removed from your collection', {
        icon: '🗑️',
        duration: 2000
      });
      
    } catch (error) {
      console.error('Error deleting image:', error);
      this.showStatus('Error deleting image', 'error');
    }
  }

  async deleteGeneratedOutfit(imageData) {
    const { generatedOutfits = [] } = await this.storageGet('generatedOutfits');
    const imageUrl = imageData.url;
    
    // Find and remove the outfit
    const updatedOutfits = generatedOutfits.filter(outfit => outfit.generatedImage !== imageUrl);
    
    if (updatedOutfits.length === generatedOutfits.length) {
      throw new Error('Outfit not found');
    }
    
    await this.storageSet({ generatedOutfits: updatedOutfits });
    
    // Refresh the outfits and try-on displays
    await this.loadOutfits();
    await this.loadLatestTryOn();
  }

  async deleteClothingItem(imageData) {
    const { clothingItems = [] } = await this.storageGet('clothingItems');
    const imageUrl = imageData.url;
    
    // Find and remove the clothing item
    const updatedItems = clothingItems.filter(item => item.url !== imageUrl);
    
    if (updatedItems.length === clothingItems.length) {
      throw new Error('Clothing item not found');
    }
    
    await this.storageSet({ clothingItems: updatedItems });
    
    // Refresh the wardrobe display
    await this.loadWardrobe();
  }

  async deleteAvatarImage(imageData) {
    const imageUrl = imageData.url;
    const avatarIndex = imageData.info.index - 1; // Convert from 1-based to 0-based
    
    if (this.avatars.length <= 1) {
      throw new Error('Cannot delete the last avatar. Create a new one first.');
    }
    
    // Use existing avatar management delete function
    await this.deleteAvatarFromManagement(avatarIndex);
  }

  // Helper method to add view buttons to images
  addViewButtonToImage(container, imageUrl, imageInfo, imageCollection = null, index = 0) {
    const viewBtn = document.createElement('button');
    viewBtn.className = 'image-item-view-btn';
    viewBtn.textContent = '👁️ View';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.openImageViewer(imageUrl, imageInfo, imageCollection, index);
    };
    container.appendChild(viewBtn);
  }

  addSourceButtonToImage(container, sourceInfo) {
    const sourceBtn = document.createElement('button');
    sourceBtn.className = 'source-link-btn';
    sourceBtn.title = `View source: ${sourceInfo.title || sourceInfo.url}`;
    
    // Create button content with favicon and text
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.gap = '4px';
    
    if (sourceInfo.favicon) {
      const favicon = document.createElement('img');
      favicon.src = sourceInfo.favicon;
      favicon.className = 'source-favicon';
      favicon.alt = '';
      favicon.onerror = () => {
        // If favicon fails to load, replace with globe icon
        favicon.style.display = 'none';
        content.insertAdjacentText('afterbegin', '🌐 ');
      };
      content.appendChild(favicon);
    } else {
      content.insertAdjacentText('afterbegin', '🌐 ');
    }
    
    const text = document.createElement('span');
    text.textContent = 'Source';
    content.appendChild(text);
    
    sourceBtn.appendChild(content);
    
    sourceBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await chrome.tabs.create({ url: sourceInfo.url });
        this.toastManager.success('Source Opened', 'Original source opened in new tab');
      } catch (error) {
        console.error('Error opening source URL:', error);
        this.toastManager.error('Error', 'Failed to open source URL');
      }
    };
    
    container.appendChild(sourceBtn);
  }

  // Generation Status Management
  async checkAndShowGenerationStatus() {
    try {
      const { generationInProgress, generationStartTime } = await this.storageGet([
        'generationInProgress', 'generationStartTime'
      ]);

      console.log('Checking generation status:', { generationInProgress, generationStartTime });

      if (generationInProgress && generationStartTime) {
        console.log('Generation in progress detected, showing loading state');
        this.showGenerationLoading(generationStartTime);
        this.startGenerationStatusMonitoring();
      } else {
        console.log('No generation in progress, hiding loading state');
        this.hideGenerationLoading();
      }
    } catch (error) {
      console.error('Error checking generation status:', error);
    }
  }

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

  startGenerationStatusMonitoring() {
    this.stopGenerationStatusMonitoring(); // Clear any existing interval

    this.generationCheckInterval = setInterval(async () => {
      try {
        const { generationInProgress } = await this.storageGet('generationInProgress');
        
        if (!generationInProgress) {
          // Generation completed, refresh the UI
          this.hideGenerationLoading();
          await this.loadOutfits();
          await this.loadLatestTryOn();
          
          // Show toast notification with navigation to results
          this.toastManager.generationComplete('Click to view your results', () => {
            this.switchTab('outfits');
          });
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
  }

  // Migrate existing PNG avatars to JPEG format
  async migratePNGAvatarsToJPEG() {
    try {
      const { avatars } = await this.storageGet('avatars');
      if (!avatars || avatars.length === 0) return;
      
      let needsMigration = false;
      const migratedAvatars = await Promise.all(
        avatars.map(async (avatar) => {
          if (avatar.url && avatar.url.startsWith('data:image/png')) {
            console.log(`Migrating PNG avatar (${avatar.pose}) to JPEG format`);
            needsMigration = true;
            const jpegUrl = await CTO.image.convertToJPEG(avatar.url);
            return { ...avatar, url: jpegUrl };
          }
          return avatar;
        })
      );
      
      if (needsMigration) {
        console.log('Saving migrated JPEG avatars');
        await this.storageSet({ avatars: migratedAvatars });
        this.avatars = migratedAvatars;
        this.toastManager.info('Format Updated', 'Avatars converted for better compatibility', {
          icon: '🔄',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Error migrating PNG avatars:', error);
      // Don't throw - this is a non-critical migration
    }
  }
}

// Initialize the extension when popup opens
document.addEventListener('DOMContentLoaded', () => {
  const extension = new ClosetTryOn();
  
  // Check for active generations immediately when popup opens (with a small delay to ensure UI is ready)
  setTimeout(() => {
    extension.checkAndShowGenerationStatus();
  }, 100);
  
  // Also check again after a bit more time in case the first check was too early
  setTimeout(() => {
    extension.checkAndShowGenerationStatus();
  }, 500);
  
  // Check for active generations when popup becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      extension.checkAndShowGenerationStatus();
    }
  });
  
  // Also check when window gains focus
  window.addEventListener('focus', () => {
    extension.checkAndShowGenerationStatus();
  });
  
  // Cleanup intervals when popup is closed
  window.addEventListener('beforeunload', () => {
    extension.stopGenerationStatusMonitoring();
    extension.stopElapsedTimeCounters();
  });
});
