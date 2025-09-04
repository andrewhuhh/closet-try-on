(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.avatar = ns.avatar || {};

  // Avatar Management Class
  ns.avatar.AvatarManager = class AvatarManager {
    constructor() {
      this.avatars = [];
      this.selectedAvatarIndex = 0;
      this.uploadedPhotos = [];
      this.returnToAvatar = false;
    }

    // Initialization
    async init() {
      await this.loadAvatars();
    }

    // Avatar Loading
    async loadAvatars() {
      const { avatars, selectedAvatarIndex, partialAvatarGeneration } = await CTO.storage.get(['avatars', 'selectedAvatarIndex', 'partialAvatarGeneration']);
      this.avatars = avatars || [];
      this.selectedAvatarIndex = selectedAvatarIndex || 0;
      this.partialAvatarGeneration = partialAvatarGeneration || false;
      
      // If we have avatars and some are in a failed state, show the retry interface
      if (this.avatars.length > 0 && this.partialAvatarGeneration) {
        // Ensure we have a proper retry interface when the page loads
        setTimeout(() => {
          if (document.getElementById('avatar-grid')) {
            this.displayAvatarsWithRetry();
          }
        }, 100);
      }
    }

    // Avatar Generation
    populateGenderSelection(savedGender) {
      if (savedGender) {
        const radio = document.querySelector(`input[name="gender"][value="${savedGender}"]`);
        if (radio) radio.checked = true;
      }
    }

    // File Management
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
        CTO.ui.manager.showStatus('Please select image files only', 'error');
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
      if (!fileList) return;

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
      this.uploadedPhotos.splice(index, 1);
      this.updateFileList();
      this.updateGenerateButton();
    }

    updateGenerateButton() {
      const generateBtn = document.getElementById('generate-avatar');
      if (!generateBtn) return;

      const hasEnoughPhotos = this.uploadedPhotos.length >= 3;
      generateBtn.disabled = !hasEnoughPhotos;
      
      if (!hasEnoughPhotos) {
        generateBtn.title = 'Upload at least 3 photos to generate avatar';
      } else {
        generateBtn.title = '';
      }
    }

    // Avatar Generation
    async generateAvatar() {
      if (this.uploadedPhotos.length < 3) {
        CTO.ui.manager.showStatus('Please upload at least 3 photos', 'error');
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
        const genderInput = document.querySelector('input[name="gender"]:checked');
        if (!genderInput) {
          throw new Error('Please select a gender option');
        }
        const gender = genderInput.value;
        await CTO.storage.set({ userGender: gender });

        // Validate formats
        const allImages = this.uploadedPhotos.every(f => f.type && f.type.startsWith('image/'));
        if (!allImages) {
          const err = new Error('Unsupported file format');
          err.userMessage = 'Unsupported file detected. Please upload JPEG/PNG photos.';
          throw err;
        }

        // Compress and convert photos to base64 (JPEG)
        const compressionOptions = { 
          maxDimension: 1200, 
          targetMaxBytes: 1200000, 
          quality: 0.85, 
          minQuality: 0.5 
        };
        
        const photoPromises = this.uploadedPhotos.map(async (file) => {
          return await CTO.image.compressToBase64JPEG(file, compressionOptions);
        });

        const photoDataArray = await Promise.all(photoPromises);

        // Generate avatar using Gemini API
        const result = await CTO.api.callAvatarGenerationAPI(photoDataArray, CTO.storage.get.bind(CTO.storage));

        // Handle partial success
        if (result.partialSuccess) {
          // Show partial success message
          CTO.ui.manager.showStatus(`Generated ${result.successCount} of ${result.totalRequested} avatars successfully. You can retry the failed poses below.`, 'warning');
          
          // Save partial results
          await CTO.storage.set({ 
            avatars: result.avatars, 
            avatarGenerated: true,
            avatarGeneratedAt: new Date().toISOString(),
            partialAvatarGeneration: true
          });
          
          this.avatars = result.avatars;
          
          // Show avatar gallery with retry options
          setTimeout(() => {
            CTO.ui.manager.showSection('avatar-gallery-section');
            this.displayAvatarsWithRetry();
          }, 1500);
          
        } else if (result.successCount === 0) {
          // Complete failure
          throw new Error('No avatar images were generated. Please try with different photos.');
        } else {
          // Complete success
          await CTO.storage.set({ 
            avatars: result.avatars, 
            avatarGenerated: true,
            avatarGeneratedAt: new Date().toISOString(),
            partialAvatarGeneration: false
          });

          this.avatars = result.avatars;
          
          // Show toast notification with navigation
          if (global.toastManager) {
            global.toastManager.avatarGenerated(() => {
              CTO.ui.manager.showSection('avatar-gallery-section');
              this.displayAvatars();
            });
          }

          // Show avatar gallery
          setTimeout(() => {
            CTO.ui.manager.showSection('avatar-gallery-section');
            this.displayAvatars();
          }, 1500);
        }

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
      await CTO.storage.set({ avatarGenerated: false });
      CTO.ui.manager.showSection('avatar-section');
    }

    // Avatar Display
    displayAvatars() {
      const avatarGrid = document.getElementById('avatar-grid');
      if (!avatarGrid) return;

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

        // Add view button if the global function exists
        if (global.addViewButtonToImage) {
          const avatarCollection = this.avatars.map((avatar, idx) => ({
            url: avatar.url,
            info: {
              type: 'Avatar',
              pose: avatar.pose,
              createdAt: avatar.createdAt,
              index: idx + 1
            }
          }));
          global.addViewButtonToImage(avatarItem, avatar.url, {
            type: 'Avatar',
            pose: avatar.pose,
            createdAt: avatar.createdAt,
            index: index + 1
          }, avatarCollection, index);
        }

        avatarItem.appendChild(img);
        avatarItem.addEventListener('click', () => this.selectAvatar(index));
        avatarGrid.appendChild(avatarItem);
      });
    }

    // Avatar Display with Retry Options
    displayAvatarsWithRetry() {
      const avatarGrid = document.getElementById('avatar-grid');
      if (!avatarGrid) return;

      avatarGrid.innerHTML = '';

      this.avatars.forEach((avatar, index) => {
        const avatarItem = document.createElement('div');
        avatarItem.className = 'avatar-item';
        if (index === this.selectedAvatarIndex && !avatar.failed) {
          avatarItem.classList.add('selected');
        }

        if (avatar.failed) {
          // Create placeholder for failed avatar
          avatarItem.classList.add('failed-avatar');
          
          const placeholder = document.createElement('div');
          placeholder.className = 'avatar-placeholder';
          placeholder.innerHTML = `
            <div class="placeholder-icon">❌</div>
            <div class="placeholder-text">
              <div class="pose-label">${avatar.poseLabel}</div>
              <div class="failed-message">Generation failed</div>
            </div>
            <button class="retry-btn" data-pose-index="${index}">
              <span class="retry-icon">🔄</span> Retry
            </button>
          `;
          
          avatarItem.appendChild(placeholder);
        } else {
          // Display successful avatar
          const img = document.createElement('img');
          img.src = avatar.url;
          img.alt = `Avatar ${index + 1} - ${avatar.pose}`;

          // Add view button if the global function exists
          if (global.addViewButtonToImage) {
            const avatarCollection = this.avatars.filter(a => !a.failed).map((avatar, idx) => ({
              url: avatar.url,
              info: {
                type: 'Avatar',
                pose: avatar.pose,
                createdAt: avatar.createdAt,
                index: idx + 1
              }
            }));
            global.addViewButtonToImage(avatarItem, avatar.url, {
              type: 'Avatar',
              pose: avatar.pose,
              createdAt: avatar.createdAt,
              index: index + 1
            }, avatarCollection, index);
          }

          avatarItem.appendChild(img);
          avatarItem.addEventListener('click', () => this.selectAvatar(index));
        }

        avatarGrid.appendChild(avatarItem);
      });

      // Add event listeners for retry buttons
      avatarGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('retry-btn') || e.target.closest('.retry-btn')) {
          const retryBtn = e.target.classList.contains('retry-btn') ? e.target : e.target.closest('.retry-btn');
          const poseIndex = parseInt(retryBtn.dataset.poseIndex);
          this.retryFailedPose(poseIndex);
        }
      });
    }

    async retryFailedPose(poseIndex) {
      const avatar = this.avatars[poseIndex];
      if (!avatar || !avatar.failed) return;

      const retryBtn = document.querySelector(`[data-pose-index="${poseIndex}"]`);
      if (retryBtn) {
        retryBtn.disabled = true;
        retryBtn.innerHTML = '<span class="retry-icon">⏳</span> Retrying...';
      }

      try {
        // Get the original photos used for generation
        if (this.uploadedPhotos.length < 3) {
          throw new Error('Original photos not available. Please regenerate all avatars.');
        }

        // Compress photos again
        const compressionOptions = { 
          maxDimension: 1200, 
          targetMaxBytes: 1200000, 
          quality: 0.85, 
          minQuality: 0.5 
        };
        
        const photoPromises = this.uploadedPhotos.map(async (file) => {
          return await CTO.image.compressToBase64JPEG(file, compressionOptions);
        });

        const photoDataArray = await Promise.all(photoPromises);

        // Create a specific prompt for this pose
        const posePrompts = {
          'front-neutral': 'Generate 1 realistic avatar image of this person in a neutral front-facing pose: standing, facing the camera directly, arms relaxed at sides.',
          'front-open': 'Generate 1 realistic avatar image of this person in a front-facing open stance: standing, facing the camera directly, arms slightly apart from the body, legs slightly apart.',
          'three-quarter': 'Generate 1 realistic avatar image of this person in a three-quarter angle pose: standing at a ¾ angle (about 45° to camera), upright, arms relaxed.',
          'side-profile': 'Generate 1 realistic avatar image of this person in a side profile pose: standing in a full side profile (90° angle to camera), arms relaxed.'
        };

        const specificPrompt = posePrompts[avatar.pose] || posePrompts['front-neutral'];
        const fullPrompt = `${specificPrompt} Use the provided photos to capture identity, face, hairstyle, body type, and skin tone. Dress in plain white/grey T-shirt, black/grey/neutral shorts (not long pants), neutral shoes if visible. The shorts should be mid-thigh length for optimal outfit layering. Use a plain white background. Generate a high-resolution, realistic photo result.\n\nIMAGE SPECIFICATIONS:\n- Generate the image in portrait orientation with dimensions 768 pixels wide by 1152 pixels tall\n- Use JPEG format for the output image\n- Ensure high quality and clarity at these specific dimensions`;

        // Call API for single pose
        const result = await this.generateSinglePose(photoDataArray, fullPrompt);
        
        if (result && result.url) {
          // Update the avatar in our array
          this.avatars[poseIndex] = {
            url: result.url,
            pose: avatar.pose,
            poseLabel: avatar.poseLabel,
            failed: false,
            createdAt: new Date().toISOString()
          };

          // Save updated avatars
          await CTO.storage.set({ 
            avatars: this.avatars,
            partialAvatarGeneration: this.avatars.some(a => a.failed)
          });

          // Refresh display
          this.displayAvatarsWithRetry();

          CTO.ui.manager.showStatus(`Successfully generated ${avatar.poseLabel} avatar!`, 'success');
        } else {
          throw new Error('Failed to generate avatar for this pose');
        }

      } catch (error) {
        console.error('Error retrying pose:', error);
        CTO.ui.manager.showStatus(`Failed to retry ${avatar.poseLabel}: ${error.message}`, 'error');
        
        // Reset retry button
        if (retryBtn) {
          retryBtn.disabled = false;
          retryBtn.innerHTML = '<span class="retry-icon">🔄</span> Retry';
        }
      }
    }

    async generateSinglePose(photoDataArray, prompt) {
      const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
      const { apiKey } = await CTO.storage.get('apiKey');
      
      const contents = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...photoDataArray.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } }))
          ]
        }
      ];

      const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { responseModalities: ['text', 'image'] } })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const generatedImage = parts.find(part => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/'));
      
      if (!generatedImage) {
        throw new Error('No image generated in response');
      }

      const mime = generatedImage.inlineData.mimeType || 'image/png';
      const base64 = generatedImage.inlineData.data || '';
      const dataUrl = `data:${mime};base64,${base64}`;
      
      // Convert to JPEG
      const jpegDataUrl = await global.CTO.image.convertToJPEG(dataUrl);
      
      return { url: jpegDataUrl };
    }

    selectAvatar(index) {
      // Don't allow selecting failed avatars
      if (this.avatars[index] && this.avatars[index].failed) {
        return;
      }
      
      this.selectedAvatarIndex = index;
      this.displayAvatars();
      CTO.storage.set({ selectedAvatarIndex: index });
    }

    // Avatar Management (Admin Interface)
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
      
      if (!grid) return;

      // Update avatar count
      if (avatarCount) {
        avatarCount.textContent = `${this.avatars.length} avatar${this.avatars.length !== 1 ? 's' : ''}`;
      }
      
      // Show/hide no avatars message
      if (this.avatars.length === 0) {
        if (noAvatarsMsg) noAvatarsMsg.style.display = 'block';
        if (grid) grid.style.display = 'none';
        if (activePreview) activePreview.innerHTML = 'No avatar selected';
        if (activeInfo) activeInfo.textContent = 'Create your first avatar to get started';
        this.updateAvatarActionButtons(false);
        return;
      }
      
      if (noAvatarsMsg) noAvatarsMsg.style.display = 'none';
      if (grid) grid.style.display = 'grid';
      
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
        
        // Add view button if the global function exists
        if (global.addViewButtonToImage) {
          const avatarCollection = this.avatars.map((avatar, idx) => ({
            url: avatar.url,
            info: {
              type: 'Avatar',
              pose: avatar.pose,
              createdAt: avatar.createdAt,
              index: idx + 1
            }
          }));
          global.addViewButtonToImage(avatarItem, avatar.url, {
            type: 'Avatar',
            pose: avatar.pose,
            createdAt: avatar.createdAt,
            index: index + 1
          }, avatarCollection, index);
        }
        
        // Click to select avatar
        avatarItem.addEventListener('click', () => this.selectAvatarFromManagement(index));
        
        grid.appendChild(avatarItem);
      });
      
      // Update active avatar preview
      if (this.avatars[this.selectedAvatarIndex] && activePreview && activeInfo) {
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
      
      if (regenBtn) regenBtn.disabled = !hasAvatars;
      if (deleteBtn) deleteBtn.disabled = !hasAvatars;
      if (exportBtn) exportBtn.disabled = !hasAvatars;
    }

    async selectAvatarFromManagement(index) {
      this.selectedAvatarIndex = index;
      await CTO.storage.set({ selectedAvatarIndex: index });
      this.updateAvatarManagementDisplay();
      
      // Show toast notification with navigation to try-on
      if (global.toastManager) {
        global.toastManager.success('Avatar Selected!', 'Ready to use for outfit try-ons', {
          icon: '👤',
          clickAction: () => {
            CTO.ui.manager.showSection('main-interface');
            CTO.ui.manager.switchTab('outfit-builder');
          }
        });
      }
    }

    async deleteAvatarFromManagement(index) {
      if (this.avatars.length <= 1) {
        CTO.ui.manager.showStatus('Cannot delete the last avatar. Create a new one first.', 'error');
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
        
        await CTO.storage.set({ 
          avatars: this.avatars, 
          selectedAvatarIndex: this.selectedAvatarIndex 
        });
        
        this.updateAvatarManagementDisplay();
        
        if (global.toastManager) {
          global.toastManager.success('Avatar Deleted', 'Avatar removed from collection', {
            icon: '🗑️',
            duration: 2000
          });
        }
      }
    }

    createNewAvatarFromManagement() {
      CTO.ui.manager.showSection('avatar-section');
    }

    async regenerateAllAvatars() {
      if (!confirm('This will regenerate all your avatars using your original photos. Continue?')) {
        return;
      }
      
      const regenBtn = document.getElementById('regenerate-all-avatars');
      const regenText = document.getElementById('regen-text');
      const regenLoading = document.getElementById('regen-loading');
      
      if (regenBtn) regenBtn.disabled = true;
      if (regenText) regenText.textContent = 'Regenerating...';
      if (regenLoading) regenLoading.style.display = 'inline-block';
      
      try {
        // Reset avatar generated flag to trigger regeneration
        await CTO.storage.set({ avatarGenerated: false });
        CTO.ui.manager.showStatus('Redirecting to avatar creation...', 'info');
        
        setTimeout(() => {
          CTO.ui.manager.showSection('avatar-section');
        }, 1500);
      } catch (error) {
        console.error('Error initiating regeneration:', error);
        CTO.ui.manager.showStatus('Error starting regeneration', 'error');
      } finally {
        if (regenBtn) regenBtn.disabled = false;
        if (regenText) regenText.textContent = 'Regenerate All';
        if (regenLoading) regenLoading.style.display = 'none';
      }
    }

    async deleteSelectedAvatar() {
      if (this.avatars.length <= 1) {
        CTO.ui.manager.showStatus('Cannot delete the last avatar. Create a new one first.', 'error');
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
        
        if (global.toastManager) {
          global.toastManager.success('Export Complete!', 'Avatars saved to downloads folder', {
            icon: '📁',
            duration: 3000
          });
        }
      } catch (error) {
        console.error('Error exporting avatars:', error);
        CTO.ui.manager.showStatus('Error exporting avatars', 'error');
      }
    }

    // Migrate existing PNG avatars to JPEG format
    async migratePNGAvatarsToJPEG() {
      try {
        const { avatars } = await CTO.storage.get('avatars');
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
          await CTO.storage.set({ avatars: migratedAvatars });
          this.avatars = migratedAvatars;
          
          if (global.toastManager) {
            global.toastManager.info('Format Updated', 'Avatars converted for better compatibility', {
              icon: '🔄',
              duration: 3000
            });
          }
        }
      } catch (error) {
        console.error('Error migrating PNG avatars:', error);
        // Don't throw - this is a non-critical migration
      }
    }

    // Error handling
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
      
      CTO.ui.manager.showStatus(userMessage, 'error');
      
      // Redirect to API settings if needed
      if (shouldRedirectToSettings) {
        setTimeout(() => {
          if (document.getElementById('main-interface') && !document.getElementById('main-interface').classList.contains('hidden')) {
            // Already in main interface, switch to API settings tab
            CTO.ui.manager.switchTab('api-settings');
          } else {
            // Show main interface and switch to API settings
            CTO.ui.manager.showSection('main-interface');
            setTimeout(() => CTO.ui.manager.switchTab('api-settings'), 500);
          }
        }, 2000);
      }
      
      return userMessage;
    }

    // API Settings Integration
    switchToApiSettingsFromAvatar() {
      // Store current state to return to avatar setup
      this.returnToAvatar = true;
      CTO.ui.manager.showSection('main-interface');
      CTO.ui.manager.switchTab('api-settings');
    }

    returnToAvatarSetup() {
      if (this.returnToAvatar) {
        this.returnToAvatar = false;
        CTO.ui.manager.showSection('avatar-section');
      }
    }

    showAvatarSetupWithBack() {
      CTO.ui.manager.showSection('avatar-section');
      const backBtn = document.getElementById('back-to-main-from-avatar');
      if (backBtn) {
        backBtn.style.display = 'inline-block';
      }
    }
  };

  // Create global avatar manager instance
  ns.avatar.manager = new ns.avatar.AvatarManager();

})(window); 