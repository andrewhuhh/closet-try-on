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
      
      // New floating action buttons
      const moreOptionsBtn = document.getElementById('more-options-btn');
      const regenerateBtn = document.getElementById('regenerate-outfit-btn');
      
      if (moreOptionsBtn) {
        moreOptionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleMoreOptionsDropdown();
        });
      }
      
      if (regenerateBtn) {
        regenerateBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleRegenerateDropdown();
        });
      }
      
      // More options dropdown actions
      const moreOptionsDropdown = document.getElementById('more-options-dropdown');
      if (moreOptionsDropdown) {
        moreOptionsDropdown.addEventListener('click', (e) => {
          const action = e.target.closest('.dropdown-item')?.dataset.action;
          if (action) {
            e.stopPropagation();
            this.handleMoreOptionsAction(action);
            this.closeAllDropdowns();
          }
        });
      }
      
      // Pose options in regenerate dropdown
      const poseOptions = document.getElementById('pose-options');
      if (poseOptions) {
        poseOptions.addEventListener('click', (e) => {
          const poseBtn = e.target.closest('.pose-option');
          if (poseBtn) {
            e.stopPropagation();
            const avatarIndex = parseInt(poseBtn.dataset.avatarIndex);
            this.regenerateWithPose(avatarIndex);
            this.closeAllDropdowns();
          }
        });
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
      
      // Close dropdowns when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.image-viewer-floating-actions')) {
          this.closeAllDropdowns();
        }
      });
      
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
      const prevBtn = document.getElementById('image-viewer-prev');
      const nextBtn = document.getElementById('image-viewer-next');
      
      if (!modal || !image) {
        console.error('Image viewer elements not found');
        return;
      }
      
      // Set current image data
      this.currentImageCollection = imageCollection || [{ url: imageUrl, info: imageInfo }];
      this.currentImageIndex = index;
      
      // Display the image
      image.src = imageUrl;
      
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
      
      // Show/hide floating action buttons and update controls
      this.updateFloatingActionButtons(imageInfo);
      this.updateModalExtendedControls(imageInfo);
      
      // Show modal
      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeImageViewer() {
      console.log('closeImageViewer called');
      const modal = document.getElementById('image-viewer-modal');
      if (modal) {
        this.closeAllDropdowns();
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

    // Floating Action Buttons Control
    updateFloatingActionButtons(imageInfo) {
      const regenerateBtn = document.getElementById('regenerate-outfit-btn');
      const viewSourceBtn = document.querySelector('[data-action="view-source"]');
      
      // Show regenerate button only for generated outfits
      const isGeneratedOutfit = imageInfo?.originalData && (
        imageInfo.type === 'Generated Outfit' || 
        imageInfo.type === 'Multi-Item Outfit'
      );
      
      if (regenerateBtn) {
        regenerateBtn.style.display = isGeneratedOutfit ? 'flex' : 'none';
      }
      
      // Show/hide source option in dropdown based on whether item has source information
      const hasSource = imageInfo?.source?.url || imageInfo?.sourceUrl;
      if (viewSourceBtn) {
        viewSourceBtn.style.display = hasSource ? 'flex' : 'none';
      }
      
      // Store current outfit data for regeneration
      if (isGeneratedOutfit && imageInfo.originalData) {
        this.currentOutfitForRegeneration = imageInfo.originalData;
      }
    }

    // Extended Modal Controls
    updateModalExtendedControls(imageInfo) {
      const originalClothingSection = document.getElementById('original-clothing-section');
      
      // Show extended controls only for generated outfits
      const isGeneratedOutfit = imageInfo?.originalData && (
        imageInfo.type === 'Generated Outfit' || 
        imageInfo.type === 'Multi-Item Outfit'
      );
      
      if (isGeneratedOutfit && imageInfo.originalData) {
        this.showOriginalClothingThumbnails(imageInfo.originalData);
        if (originalClothingSection) originalClothingSection.style.display = 'block';
      } else {
        if (originalClothingSection) originalClothingSection.style.display = 'none';
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
        thumbnail.title = 'Click to view this item in your wardrobe';
        thumbnail.innerHTML = `
          <img src="${url}" alt="Original clothing ${index + 1}">
        `;
        
        // Click to navigate to wardrobe and find the clothing item
        thumbnail.addEventListener('click', async () => {
          try {
            // Close the current image viewer modal
            this.closeImageViewer();
            
            // Switch to wardrobe tab
            if (CTO.ui.manager) {
              await CTO.ui.manager.switchTab('wardrobe');
            }
            
            // Wait a moment for the tab to switch
            setTimeout(async () => {
              await this.findAndHighlightClothingItem(url);
            }, 300);
            
          } catch (error) {
            console.error('Error navigating to wardrobe:', error);
            if (global.toastManager) {
              global.toastManager.error('Navigation Error', 'Could not navigate to wardrobe');
            }
          }
        });
        
        thumbnailsContainer.appendChild(thumbnail);
      });
    }

    // New helper method to find and highlight clothing item in wardrobe
    async findAndHighlightClothingItem(clothingUrl) {
      try {
        // Get all clothing items from storage
        const { clothingItems = [] } = await CTO.storage.get('clothingItems');
        
        // Find the index of the clothing item with matching URL
        const itemIndex = clothingItems.findIndex(item => item.url === clothingUrl);
        
        if (itemIndex === -1) {
          if (global.toastManager) {
            global.toastManager.warning('Item Not Found', 'This clothing item is not in your wardrobe');
          }
          return;
        }
        
        // Find the wardrobe gallery
        const wardrobeGallery = document.getElementById('wardrobe-gallery');
        if (!wardrobeGallery) {
          console.error('Wardrobe gallery not found');
          return;
        }
        
        // Find the corresponding clothing item element
        const clothingItems_elements = wardrobeGallery.querySelectorAll('.outfit-item');
        
        if (itemIndex < clothingItems_elements.length) {
          const targetItem = clothingItems_elements[itemIndex];
          
          // Scroll the item into view
          targetItem.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
          });
          
          // Add highlight effect
          targetItem.style.transition = 'all 0.3s ease';
          targetItem.style.transform = 'scale(1.05)';
          targetItem.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.6)';
          targetItem.style.border = '2px solid var(--primary-color)';
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            targetItem.style.transform = '';
            targetItem.style.boxShadow = '';
            targetItem.style.border = '';
          }, 3000);
          
          // Show success toast
          if (global.toastManager) {
            global.toastManager.success('Item Found!', 'Clothing item highlighted in wardrobe', {
              icon: '👕',
              duration: 2000
            });
          }
        }
        
      } catch (error) {
        console.error('Error finding clothing item:', error);
        if (global.toastManager) {
          global.toastManager.error('Error', 'Could not find clothing item in wardrobe');
        }
      }
    }

    // Dropdown Controls
    toggleMoreOptionsDropdown() {
      const dropdown = document.getElementById('more-options-dropdown');
      if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        this.closeAllDropdowns();
        if (!isActive) {
          dropdown.classList.add('active');
        }
      }
    }

    toggleRegenerateDropdown() {
      const dropdown = document.getElementById('regenerate-dropdown');
      if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        this.closeAllDropdowns();
        if (!isActive) {
          this.populatePoseOptions();
          dropdown.classList.add('active');
        }
      }
    }

    closeAllDropdowns() {
      const dropdowns = document.querySelectorAll('.image-viewer-dropdown');
      dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
    }

    async populatePoseOptions() {
      const poseOptions = document.getElementById('pose-options');
      if (!poseOptions) return;
      
      try {
        const { avatars = [] } = await CTO.storage.get('avatars');
        poseOptions.innerHTML = '';
        
        avatars.forEach((avatar, index) => {
          const option = document.createElement('button');
          option.className = 'pose-option';
          option.dataset.avatarIndex = index;
          option.textContent = avatar.pose || `Avatar ${index + 1}`;
          
          // Mark current pose if it matches
          if (this.currentOutfitForRegeneration?.usedAvatar && avatar.pose === this.currentOutfitForRegeneration.usedAvatar.pose) {
            option.classList.add('current');
            option.textContent += ' (current)';
          }
          
          poseOptions.appendChild(option);
        });
      } catch (error) {
        console.error('Error loading avatars for pose selector:', error);
      }
    }

    handleMoreOptionsAction(action) {
      switch (action) {
        case 'download':
          this.downloadCurrentImage();
          break;
        case 'copy':
          this.copyImageLink();
          break;
        case 'open':
          this.openImageInTab();
          break;
        case 'view-source':
          this.viewCurrentItemSource();
          break;
        case 'delete':
          this.deleteCurrentImage();
          break;
        default:
          console.warn('Unknown action:', action);
      }
    }

    async copyImageLink() {
      const currentImage = this.currentImageCollection[this.currentImageIndex];
      if (!currentImage) return;
      
      try {
        await navigator.clipboard.writeText(currentImage.url);
        if (global.toastManager) {
          global.toastManager.success('Link Copied!', 'Image URL copied to clipboard', {
            icon: '📋',
            duration: 2000
          });
        }
      } catch (error) {
        console.error('Error copying image URL:', error);
        if (global.toastManager) {
          global.toastManager.error('Copy Failed', 'Could not copy image URL');
        }
      }
    }

    async regenerateWithPose(avatarIndex) {
      if (!this.currentOutfitForRegeneration) {
        if (global.toastManager) {
          global.toastManager.error('Error', 'No outfit data available for regeneration');
        }
        return;
      }
      
      if (isNaN(avatarIndex)) {
        if (global.toastManager) {
          global.toastManager.warning('Invalid Pose', 'Please select a valid pose for regeneration');
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
        await CTO.storage.set({ selectedAvatarIndex: avatarIndex });
        
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
        console.log('Deleting image with info:', imageInfo);
        
        if (imageInfo.type === 'Generated Outfit' || imageInfo.type === 'Latest Try-On Result') {
          // Delete from generated outfits
          console.log('Deleting generated outfit:', currentImage.url);
          await this.deleteGeneratedOutfit(currentImage);
        } else if (imageInfo.type === 'Clothing Item') {
          // Delete from wardrobe (clothing items)
          console.log('Deleting clothing item:', currentImage.url);
          await this.deleteClothingItem(currentImage);
        } else if (imageInfo.type === 'Avatar') {
          // Delete avatar
          console.log('Deleting avatar:', currentImage.url);
          await this.deleteAvatarImage(currentImage);
        } else {
          console.warn('Unknown image type for deletion:', imageInfo.type);
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
        console.error('Error details:', error.message, error.stack);
        if (global.toastManager) {
          global.toastManager.error('Delete Failed', error.message || 'Failed to delete image');
        } else {
          CTO.ui.manager.showStatus('Error deleting image', 'error');
        }
      }
    }

    // Deletion Helpers
    async deleteGeneratedOutfit(imageData) {
      const { generatedOutfits = [] } = await CTO.storage.get('generatedOutfits');
      const imageUrl = imageData.url;
      
      console.log(`Attempting to delete outfit with URL: ${imageUrl}`);
      console.log(`Total outfits before deletion: ${generatedOutfits.length}`);
      
      // Find and remove the outfit
      const updatedOutfits = generatedOutfits.filter(outfit => outfit.generatedImage !== imageUrl);
      
      console.log(`Total outfits after filtering: ${updatedOutfits.length}`);
      
      if (updatedOutfits.length === generatedOutfits.length) {
        console.error('Outfit not found in generatedOutfits array');
        console.log('Available outfit URLs:', generatedOutfits.map(o => o.generatedImage));
        throw new Error('Outfit not found');
      }
      
      await CTO.storage.set({ generatedOutfits: updatedOutfits });
      console.log('Storage updated successfully');
      
      // Update the outfit manager's instance data directly and refresh displays
      if (CTO.outfit.manager) {
        // Update the instance variable directly to ensure immediate sync
        CTO.outfit.manager.generatedOutfits = updatedOutfits;
        console.log('Outfit manager instance updated');
        
        // Then refresh the displays
        await CTO.outfit.manager.loadOutfits();
        await CTO.outfit.manager.loadLatestTryOn();
        console.log('Displays refreshed');
      } else {
        console.error('CTO.outfit.manager not available');
      }
    }

    async deleteClothingItem(imageData) {
      const { clothingItems = [] } = await CTO.storage.get('clothingItems');
      const imageUrl = imageData.url;
      
      // Find the item being deleted for notification
      const itemToDelete = clothingItems.find(item => item.url === imageUrl);
      
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
      
      // Show notification for item removal
      if (global.toastManager && itemToDelete) {
        let itemName = 'Item';
        if (itemToDelete.source && itemToDelete.source.title) {
          itemName = itemToDelete.source.title;
        } else {
          itemName = 'Clothing Item';
        }
        global.toastManager.wardrobeItemRemoved(itemName);
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

  // These functions have been deprecated in favor of direct click handlers on images
  // and more options buttons for additional functionality

  // Create global image viewer instance
  ns.imageViewer.viewer = new ns.imageViewer.ImageViewer();

})(window); 