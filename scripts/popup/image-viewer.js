(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.imageViewer = ns.imageViewer || {};

  // Image Viewer Class
  ns.imageViewer.ImageViewer = class ImageViewer {
    constructor() {
      this.currentImageCollection = [];
      this.currentImageIndex = 0;
      this.currentOutfitForRegeneration = null;
      this.modalInitialized = false;
    }

    // Initialization
    init() {
      this.ensureImageViewerSetup();
    }

    ensureImageViewerSetup() {
      // Check if modal exists, if not wait and retry
      const modal = document.getElementById('image-viewer-modal');
      if (modal && !this.modalInitialized) {
        this.setupImageViewerListeners();
        this.modalInitialized = true;
      } else if (!modal) {
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
      const modal = document.getElementById('image-viewer-modal');
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target.id === 'image-viewer-modal') {
            this.closeImageViewer();
          }
        });
      }
      
      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('image-viewer-modal');
        if (!modal || !modal.classList.contains('active')) return;
        
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

    // Main Viewer Functions
    openImageViewer(imageUrl, imageInfo, imageCollection = null, index = 0) {
      const modal = document.getElementById('image-viewer-modal');
      const image = document.getElementById('image-viewer-image');
      const info = document.getElementById('image-viewer-info');
      const prevBtn = document.getElementById('image-viewer-prev');
      const nextBtn = document.getElementById('image-viewer-next');
      
      if (!modal || !image || !info) {
        console.error('Image viewer elements not found');
        return;
      }
      
      // Set current image data
      this.currentImageCollection = imageCollection || [{ url: imageUrl, info: imageInfo }];
      this.currentImageIndex = index;
      
      // Display the image
      image.src = imageUrl;
      info.innerHTML = this.formatImageInfo(imageInfo);
      
      // Show/hide navigation arrows
      const hasMultiple = this.currentImageCollection.length > 1;
      if (prevBtn) {
        prevBtn.style.display = hasMultiple ? 'flex' : 'none';
        prevBtn.disabled = this.currentImageIndex <= 0;
      }
      if (nextBtn) {
        nextBtn.style.display = hasMultiple ? 'flex' : 'none';
        nextBtn.disabled = this.currentImageIndex >= this.currentImageCollection.length - 1;
      }
      
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

    // Extended Modal Controls
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
        if (originalClothingSection) originalClothingSection.style.display = 'block';
        if (regenerationControls) regenerationControls.style.display = 'block';
      } else {
        if (originalClothingSection) originalClothingSection.style.display = 'none';
        if (regenerationControls) regenerationControls.style.display = 'none';
      }

      // Show/hide source button based on whether item has source information
      const hasSource = imageInfo?.source?.url || imageInfo?.sourceUrl;
      if (viewSourceBtn) {
        viewSourceBtn.style.display = hasSource ? 'inline-block' : 'none';
      }
    }

    showOriginalClothingThumbnails(outfitData) {
      const thumbnailsContainer = document.getElementById('original-clothing-thumbnails');
      if (!thumbnailsContainer) return;
      
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
      
      if (!poseSelector) return;
      
      // Store current outfit data for regeneration
      this.currentOutfitForRegeneration = outfitData;
      
      // Populate pose selector with available avatars
      try {
        const { avatars = [] } = await CTO.storage.get('avatars');
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
      if (!poseSelector) return;
      
      const selectedAvatarIndex = parseInt(poseSelector.value);
      
      if (!this.currentOutfitForRegeneration) {
        if (global.toastManager) {
          global.toastManager.error('Error', 'No outfit data available for regeneration');
        }
        return;
      }
      
      if (isNaN(selectedAvatarIndex)) {
        if (global.toastManager) {
          global.toastManager.warning('Select Pose', 'Please select a pose for regeneration');
        }
        return;
      }
      
      try {
        // Close the modal
        this.closeImageViewer();
        
        // Show loading state
        const event = new CustomEvent('generationStatusChanged', { 
          detail: { inProgress: true } 
        });
        document.dispatchEvent(event);
        
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
        await CTO.storage.set({ selectedAvatarIndex });
        
        // Trigger regeneration via outfit manager
        if (CTO.outfit.manager) {
          await CTO.outfit.manager.generateTryOnWithMultipleItems(clothingUrls);
        }
        
        if (global.toastManager) {
          global.toastManager.success('Regeneration Started', 'Your outfit is being regenerated with the selected pose');
        }
        
      } catch (error) {
        console.error('Error during regeneration:', error);
        
        const errorEvent = new CustomEvent('generationStatusChanged', { 
          detail: { inProgress: false } 
        });
        document.dispatchEvent(errorEvent);
        
        if (global.toastManager) {
          global.toastManager.error('Regeneration Failed', error.message || 'Failed to regenerate outfit');
        }
      }
    }

    // Source Viewing
    async viewCurrentItemSource() {
      if (!this.currentImageCollection || this.currentImageIndex < 0) {
        if (global.toastManager) {
          global.toastManager.error('Error', 'No image selected');
        }
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
        if (global.toastManager) {
          global.toastManager.warning('No Source', 'No source information available for this item');
        }
        return;
      }

      try {
        // Open the source URL in a new tab
        await chrome.tabs.create({ url: sourceUrl });
        if (global.toastManager) {
          global.toastManager.success('Source Opened', 'Original source opened in new tab');
        }
      } catch (error) {
        console.error('Error opening source URL:', error);
        if (global.toastManager) {
          global.toastManager.error('Error', 'Failed to open source URL');
        }
      }
    }

    // Image Actions
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
        CTO.ui.manager.showStatus('Error opening image in new tab', 'error');
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
        
        if (global.toastManager) {
          global.toastManager.success('Download Complete!', 'Image saved to downloads folder', {
            icon: '💾',
            duration: 2000
          });
        }
      } catch (error) {
        console.error('Error downloading image:', error);
        CTO.ui.manager.showStatus('Error downloading image', 'error');
      }
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
          if (global.toastManager) {
            global.toastManager.success('Link Copied!', 'Image URL copied to clipboard', {
              icon: '📋',
              duration: 2000
            });
          }
        }
      } catch (error) {
        console.error('Error sharing image:', error);
        CTO.ui.manager.showStatus('Error sharing image', 'error');
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
        if (global.toastManager) {
          global.toastManager.success('Image Deleted', 'Successfully removed from your collection', {
            icon: '🗑️',
            duration: 2000
          });
        }
        
      } catch (error) {
        console.error('Error deleting image:', error);
        CTO.ui.manager.showStatus('Error deleting image', 'error');
      }
    }

    // Deletion Helpers
    async deleteGeneratedOutfit(imageData) {
      const { generatedOutfits = [] } = await CTO.storage.get('generatedOutfits');
      const imageUrl = imageData.url;
      
      // Find and remove the outfit
      const updatedOutfits = generatedOutfits.filter(outfit => outfit.generatedImage !== imageUrl);
      
      if (updatedOutfits.length === generatedOutfits.length) {
        throw new Error('Outfit not found');
      }
      
      await CTO.storage.set({ generatedOutfits: updatedOutfits });
      
      // Refresh the outfits and try-on displays
      if (CTO.outfit.manager) {
        await CTO.outfit.manager.loadOutfits();
        await CTO.outfit.manager.loadLatestTryOn();
      }
    }

    async deleteClothingItem(imageData) {
      const { clothingItems = [] } = await CTO.storage.get('clothingItems');
      const imageUrl = imageData.url;
      
      // Find and remove the clothing item
      const updatedItems = clothingItems.filter(item => item.url !== imageUrl);
      
      if (updatedItems.length === clothingItems.length) {
        throw new Error('Clothing item not found');
      }
      
      await CTO.storage.set({ clothingItems: updatedItems });
      
      // Refresh the wardrobe display
      if (CTO.outfit.manager) {
        await CTO.outfit.manager.loadWardrobe();
      }
    }

    async deleteAvatarImage(imageData) {
      const imageUrl = imageData.url;
      const avatarIndex = imageData.info.index - 1; // Convert from 1-based to 0-based
      
      if (CTO.avatar.manager) {
        const avatars = CTO.avatar.manager.avatars;
        if (avatars.length <= 1) {
          throw new Error('Cannot delete the last avatar. Create a new one first.');
        }
        
        // Use existing avatar management delete function
        await CTO.avatar.manager.deleteAvatarFromManagement(avatarIndex);
      }
    }

    // Utility Functions
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

    generateImageFilename(imageData) {
      const timestamp = new Date().toISOString().split('T')[0];
      const type = imageData.info?.type || 'image';
      const pose = imageData.info?.pose || '';
      
      let filename = `closet-try-on-${type}-${timestamp}`;
      if (pose) filename += `-${pose}`;
      filename += '.png';
      
      return filename.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
    }
  };

  // Global helper functions for backward compatibility
  global.addViewButtonToImage = function(container, imageUrl, imageInfo, imageCollection = null, index = 0) {
    const viewBtn = document.createElement('button');
    viewBtn.className = 'image-item-view-btn';
    viewBtn.textContent = '👁️ View';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      ns.imageViewer.viewer.openImageViewer(imageUrl, imageInfo, imageCollection, index);
    };
    container.appendChild(viewBtn);
  };

  global.addSourceButtonToImage = function(container, sourceInfo) {
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
        if (global.toastManager) {
          global.toastManager.success('Source Opened', 'Original source opened in new tab');
        }
      } catch (error) {
        console.error('Error opening source URL:', error);
        if (global.toastManager) {
          global.toastManager.error('Error', 'Failed to open source URL');
        }
      }
    };
    
    container.appendChild(sourceBtn);
  };

  // Create global image viewer instance
  ns.imageViewer.viewer = new ns.imageViewer.ImageViewer();

})(window); 