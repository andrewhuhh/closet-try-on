(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.outfit = ns.outfit || {};

  // Outfit Management Class
  ns.outfit.OutfitManager = class OutfitManager {
    constructor() {
      this.currentOutfit = [];
      this.generatedOutfits = [];
      this.clothingItems = [];
    }

    // Utility function to generate meaningful names for clothing items
    generateItemName(item) {
      // Try to extract name from source title if available
      if (item.source && item.source.title) {
        // Clean up common e-commerce patterns and get the most descriptive part
        let title = item.source.title
          .replace(/\s*-\s*[^-]*(?:shop|store|buy|sale|price|\$|€|£).*$/i, '') // Remove shop/price info
          .replace(/\s*\|\s*.*$/i, '') // Remove everything after |
          .replace(/\s*\(\s*\d+.*?\)\s*$/i, '') // Remove size/price in parentheses
          .replace(/\s*(buy|shop|store|sale|online|cheap|best|new).*$/i, '') // Remove common e-commerce terms
          .trim();
        
        // If we have a meaningful title, use it
        if (title.length > 3) {
          return title;
        }
      }
      
      // Fallback to generic name based on item type or index
      const addedDate = new Date(item.addedAt);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `Item ${monthNames[addedDate.getMonth()]}-${addedDate.getDate()}`;
    }

    // Utility function to truncate text with ellipsis
    truncateText(text, maxLength = 10) {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    }

    // Initialization
    async init() {
      await this.loadCurrentOutfit();
      await this.loadOutfits();
      await this.loadWardrobe();
    }

    // Current Outfit Management
    async loadCurrentOutfit() {
      const { currentOutfit = [] } = await CTO.storage.get('currentOutfit');
      this.currentOutfit = currentOutfit;
    }

    async saveCurrentOutfit() {
      try {
        await CTO.storage.set({ currentOutfit: this.currentOutfit });
      } catch (error) {
        console.error('Error saving current outfit:', error);
        if (error.message && error.message.includes('quota')) {
          if (global.toastManager) {
            global.toastManager.error('Storage Full', 'Unable to save outfit - storage quota exceeded. Click to manage storage.', {
              duration: 8000,
              clickAction: () => {
                this.showStorageManagement();
              }
            });
          }
        }
        throw error; // Re-throw so calling code knows it failed
      }
    }

    async addToOutfit(item) {
      // Check if item is already in outfit
      if (this.currentOutfit.some(outfitItem => outfitItem.url === item.url)) {
        if (global.toastManager) {
          global.toastManager.warning('Already Added', 'This item is already in your outfit');
        }
        return;
      }

      // Add item to outfit
      this.currentOutfit.push(item);
      
      try {
        await this.saveCurrentOutfit();

        // Update displays
        this.updateOutfitDisplay();
        await this.loadWardrobeForOutfit(); // Refresh to update button states

        if (global.toastManager) {
          global.toastManager.success('Item Added!', `${this.currentOutfit.length} item${this.currentOutfit.length !== 1 ? 's' : ''} in outfit`, {
            icon: '👕',
            clickAction: () => {
              // Already on outfit builder, just focus the current outfit area
            },
            duration: 2000
          });
        }
      } catch (error) {
        // Revert the addition if save failed
        this.currentOutfit.pop();
        console.error('Failed to add item to outfit:', error);
        
        // Display appropriate error message based on error type
        if (error.message && error.message.includes('quota')) {
          // Storage quota exceeded - offer storage management
          if (global.toastManager) {
            global.toastManager.error('Storage Full', 'Cannot add item - storage quota exceeded. Click to manage storage.', {
              duration: 8000,
              clickAction: () => {
                this.showStorageManagement();
              }
            });
          }
        } else {
          // Other storage error
          if (global.toastManager) {
            global.toastManager.error('Save Failed', 'Could not save item to outfit. Please try again.');
          }
        }
      }
    }

    async addOutfitImageToWardrobe(outfit) {
      try {
        // Create a clothing item from the generated outfit image
        const clothingItem = {
          url: outfit.generatedImage,
          addedAt: new Date().toISOString(),
          source: {
            title: `Generated Outfit ${new Date(outfit.createdAt).toLocaleDateString()}`,
            url: null, // No external source for generated images
            imageUrl: outfit.generatedImage
          }
        };

        // Get existing wardrobe and check for duplicates
        const { clothingItems = [] } = await CTO.storage.get('clothingItems');
        
        // Check if this outfit image is already in wardrobe
        if (clothingItems.some(item => item.url === outfit.generatedImage)) {
          if (global.toastManager) {
            global.toastManager.wardrobeItemExists('Generated Outfit');
          }
          return;
        }

        // Add to wardrobe
        clothingItems.push(clothingItem);
        await CTO.storage.set({ clothingItems });

        // Reload wardrobe to reflect changes
        await this.loadWardrobe();

        if (global.toastManager) {
          global.toastManager.wardrobeItemAdded('Generated Outfit', () => {
            document.querySelector('button[data-tab="wardrobe"]').click();
          });
        }
      } catch (error) {
        console.error('Error adding outfit to wardrobe:', error);
        if (global.toastManager) {
          global.toastManager.error('Save Failed', 'Could not add outfit to wardrobe');
        }
      }
    }

    async removeFromOutfit(index) {
      if (index >= 0 && index < this.currentOutfit.length) {
        this.currentOutfit.splice(index, 1);
        await this.saveCurrentOutfit();

        // Update displays
        this.updateOutfitDisplay();
        await this.loadWardrobeForOutfit(); // Refresh to update button states

        if (global.toastManager) {
          global.toastManager.info('Item Removed', `${this.currentOutfit.length} item${this.currentOutfit.length !== 1 ? 's' : ''} remaining`, {
            icon: '🗑️',
            duration: 2000
          });
        }
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

        if (global.toastManager) {
          global.toastManager.info('Outfit Cleared', 'Ready to build a new outfit', {
            icon: '🧹',
            duration: 2000
          });
        }
      }
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
          removeBtn.textContent = '-';
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

    // Try-on Generation
    async tryOnCurrentOutfit() {
      if (this.currentOutfit.length === 0) {
        if (global.toastManager) {
          global.toastManager.warning('Empty Outfit', 'Add some items to your outfit first!', {
            icon: '👕',
            clickAction: () => {
              // Already on outfit builder, user can see the wardrobe section below
            }
          });
        }
        return;
      }

      // Set generation status to loading
      await CTO.storage.set({ 
        generationInProgress: true, 
        generationStartTime: new Date().toISOString() 
      });

      // Show generation started toast
      if (global.toastManager) {
        global.toastManager.generationStarted('Generating your outfit try-on...', () => {
          CTO.ui.manager.switchTab('outfits');
        });
      }

      // Show loading state immediately - trigger custom event
      const event = new CustomEvent('generationStatusChanged', { 
        detail: { inProgress: true } 
      });
      document.dispatchEvent(event);

      try {
        // Get avatar, API key, and size preference
        const { apiKey, avatars, selectedAvatarIndex = 0, sizePreference = 'fit' } = await CTO.storage.get(['apiKey', 'avatars', 'selectedAvatarIndex', 'sizePreference']);
        
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

        // Generate outfit try-on using Gemini API with size preference
        const generatedImageUrl = await CTO.api.callMultiItemTryOnAPI(baseImageData, clothingDataArray, apiKey, sizePreference);

        // Store the generated outfit
        await this.storeGeneratedMultiItemOutfit(generatedImageUrl, this.currentOutfit, selectedAvatar);

        // Clear generation status
        await CTO.storage.set({ generationInProgress: false, generationStartTime: null });

        // Trigger update events
        const completeEvent = new CustomEvent('generationStatusChanged', { 
          detail: { inProgress: false } 
        });
        document.dispatchEvent(completeEvent);

        // Refresh outfit and try-on displays
        await this.loadOutfits();
        await this.loadLatestTryOn();

        // Show toast notification with navigation to outfits
        if (global.toastManager) {
          global.toastManager.outfitGenerated(() => {
            CTO.ui.manager.switchTab('outfits');
          });
        }

        // Switch to outfits tab to show result
        setTimeout(() => {
          CTO.ui.manager.switchTab('outfits');
        }, 1500);

      } catch (error) {
        // Clear generation status on error
        await CTO.storage.set({ generationInProgress: false, generationStartTime: null });
        
        const errorEvent = new CustomEvent('generationStatusChanged', { 
          detail: { inProgress: false } 
        });
        document.dispatchEvent(errorEvent);
        
        this.handleApiError(error, 'trying on outfit');
      }
    }

    // Generated Outfits Management
    async loadOutfits() {
      const { generatedOutfits = [] } = await CTO.storage.get('generatedOutfits');
      this.generatedOutfits = generatedOutfits;
      this.displayOutfits();
    }

    displayOutfits() {
      const outfitGallery = document.getElementById('outfit-gallery');
      const noOutfits = document.getElementById('no-outfits');

      if (!outfitGallery) return;

      outfitGallery.innerHTML = '';

      // Check if generation is in progress
      const generationInProgress = document.getElementById('outfit-loading')?.style.display === 'flex';
      if (generationInProgress) {
        // Keep loading state visible, don't show no outfits message
        return;
      }

      if (this.generatedOutfits.length === 0) {
        if (noOutfits) noOutfits.style.display = 'block';
        return;
      }

      if (noOutfits) noOutfits.style.display = 'none';

      // Sort outfits by newest first (latest createdAt)
      const sortedOutfits = [...this.generatedOutfits].sort((a, b) => 
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

        // Create image container div
        const imgContainer = document.createElement('div');
        imgContainer.className = 'outfit-item-image-container';

        const img = document.createElement('img');
        img.src = outfit.generatedImage;
        img.alt = 'Generated outfit';

        const info = document.createElement('div');
        info.className = 'info';
        
        // Generate a meaningful name for the outfit
        const outfitName = `Outfit ${new Date(outfit.createdAt).toLocaleDateString().replace(/\//g, '-')}`;
        info.textContent = this.truncateText(outfitName, 10);

        // Add to wardrobe button for generated outfits
        const addBtn = document.createElement('button');
        addBtn.className = 'add-to-outfit-btn';
        addBtn.innerHTML = '+';
        addBtn.style.lineHeight = '1';
        addBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent triggering other click events
          this.addOutfitImageToWardrobe(outfit);
        };

        // Add click handler for image to open viewer
        img.onclick = (e) => {
          // Only open viewer if not clicking on buttons
          if (!e.target.closest('.add-to-outfit-btn') && !e.target.closest('.more-options-btn')) {
            if (global.CTO?.imageViewer?.viewer) {
              global.CTO.imageViewer.viewer.openImageViewer(outfit.generatedImage, {
                type: outfit.isMultiItem ? 'Multi-Item Outfit' : 'Generated Outfit',
                createdAt: outfit.createdAt,
                usedAvatar: outfit.usedAvatar,
                itemCount: outfit.isMultiItem ? outfit.outfitItems?.length || 1 : (outfit.clothingItems?.length || 1),
                index: index + 1,
                originalData: outfit // Pass the full outfit data
              }, outfitCollection, index);
            }
          }
        };

        // Add more options for generated outfits
        this.addMoreOptionsToOutfit(outfitItem, outfit, index);

        // Append img to container, then add elements to outfit item
        imgContainer.appendChild(img);
        outfitItem.appendChild(imgContainer);
        outfitItem.appendChild(info);
        outfitItem.appendChild(addBtn);
        outfitGallery.appendChild(outfitItem);
      });
    }

    // Latest Try-on Display
    async loadLatestTryOn() {
      const latestTryOn = document.getElementById('latest-try-on');
      const noTryOn = document.getElementById('no-try-on');

      if (!latestTryOn) return;

      latestTryOn.innerHTML = '';

      // Check if generation is in progress
      const generationInProgress = document.getElementById('tryon-loading')?.style.display === 'flex';
      if (generationInProgress) {
        // Keep loading state visible, don't show no try-on message
        return;
      }

      if (this.generatedOutfits.length === 0) {
        if (noTryOn) noTryOn.style.display = 'block';
        return;
      }

      if (noTryOn) noTryOn.style.display = 'none';

      // Show the most recent try-on
      const latest = this.generatedOutfits[this.generatedOutfits.length - 1];
      
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

      // Add click handler for image to open viewer
      img.onclick = (e) => {
        if (global.CTO?.imageViewer?.viewer) {
          global.CTO.imageViewer.viewer.openImageViewer(latest.generatedImage, {
            type: 'Latest Try-On Result',
            createdAt: latest.createdAt,
            usedAvatar: latest.usedAvatar
          });
        }
      };

      // Make image cursor pointer to indicate it's clickable
      img.style.cursor = 'pointer';

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

    // Wardrobe Management
    async loadWardrobe() {
      const { clothingItems = [] } = await CTO.storage.get('clothingItems');
      this.clothingItems = clothingItems;
      this.displayWardrobe();
    }

    displayWardrobe() {
      const wardrobeGallery = document.getElementById('wardrobe-gallery');
      const noWardrobe = document.getElementById('no-wardrobe');

      if (!wardrobeGallery) return;

      wardrobeGallery.innerHTML = '';

      if (this.clothingItems.length === 0) {
        if (noWardrobe) noWardrobe.style.display = 'block';
        return;
      }

      if (noWardrobe) noWardrobe.style.display = 'none';

      const wardrobeCollection = this.clothingItems.map((item, idx) => ({
        url: item.url,
        info: {
          type: 'Clothing Item',
          addedAt: item.addedAt,
          index: idx + 1,
          source: item.source // Include source information
        }
      }));

      this.clothingItems.forEach((item, index) => {
        const wardrobeItem = document.createElement('div');
        wardrobeItem.className = 'outfit-item';
        wardrobeItem.style.position = 'relative';

        // Create image container div
        const imgContainer = document.createElement('div');
        imgContainer.className = 'outfit-item-image-container';

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'Saved clothing item';

        const info = document.createElement('div');
        info.className = 'info';
        const itemName = this.generateItemName(item);
        info.textContent = this.truncateText(itemName, 10);

        // Add to outfit button for wardrobe items
        const addBtn = document.createElement('button');
        addBtn.className = 'add-to-outfit-btn';
        addBtn.innerHTML = '+';
        addBtn.style.lineHeight = '1';
        addBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent triggering other click events
          this.addToOutfit(item);
        };

        // Add click handler for image to open viewer
        img.onclick = (e) => {
          // Only open viewer if not clicking on buttons
          if (!e.target.closest('.add-to-outfit-btn') && !e.target.closest('.more-options-btn')) {
            if (global.CTO?.imageViewer?.viewer) {
              global.CTO.imageViewer.viewer.openImageViewer(item.url, {
                type: 'Clothing Item',
                addedAt: item.addedAt,
                index: index + 1,
                source: item.source // Include source information
              }, wardrobeCollection, index);
            } else {
              console.error('Image viewer not available');
            }
          }
        };

        // Add more options button and dropdown
        if (item.source?.url || global.CTO?.imageViewer?.viewer) {
          this.addMoreOptionsToItem(wardrobeItem, item, index);
        }

        // Append img to container, then add elements to wardrobe item
        imgContainer.appendChild(img);
        wardrobeItem.appendChild(imgContainer);
        wardrobeItem.appendChild(info);
        wardrobeItem.appendChild(addBtn);
        wardrobeGallery.appendChild(wardrobeItem);
      });
    }

    // Wardrobe for Outfit Builder
    async loadWardrobeForOutfit() {
      const wardrobeForOutfit = document.getElementById('wardrobe-for-outfit');
      const noWardrobeForOutfit = document.getElementById('no-wardrobe-for-outfit');

      if (!wardrobeForOutfit) return;

      wardrobeForOutfit.innerHTML = '';

      if (this.clothingItems.length === 0) {
        if (noWardrobeForOutfit) noWardrobeForOutfit.style.display = 'block';
        return;
      }

      if (noWardrobeForOutfit) noWardrobeForOutfit.style.display = 'none';

      this.clothingItems.forEach((item, index) => {
        const wardrobeItem = document.createElement('div');
        wardrobeItem.className = 'outfit-item';
        wardrobeItem.style.position = 'relative';

        // Create image container div
        const imgContainer = document.createElement('div');
        imgContainer.className = 'outfit-item-image-container';

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'Wardrobe item';

        const info = document.createElement('div');
        info.className = 'info';
        const itemName = this.generateItemName(item);
        info.textContent = this.truncateText(itemName, 10);

        // Check if item is already in outfit
        const isInOutfit = this.currentOutfit.some(outfitItem => outfitItem.url === item.url);

        // Add to outfit button
        const addBtn = document.createElement('button');
        addBtn.className = `add-to-outfit-btn ${isInOutfit ? 'added' : ''}`;
        addBtn.innerHTML = isInOutfit ? '✓' : '+';
        addBtn.style.lineHeight = '1';
        addBtn.disabled = isInOutfit;
        addBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent triggering other click events
          this.addToOutfit(item);
        };

        // Add click handler for image to open viewer
        img.onclick = (e) => {
          // Only open viewer if not clicking on buttons
          if (!e.target.closest('.add-to-outfit-btn') && !e.target.closest('.more-options-btn')) {
            if (global.CTO?.imageViewer?.viewer) {
              const wardrobeCollection = this.clothingItems.map((wardrobeItem, idx) => ({
                url: wardrobeItem.url,
                info: {
                  type: 'Clothing Item',
                  addedAt: wardrobeItem.addedAt,
                  index: idx + 1,
                  source: wardrobeItem.source
                }
              }));
              global.CTO.imageViewer.viewer.openImageViewer(item.url, {
                type: 'Clothing Item',
                addedAt: item.addedAt,
                index: index + 1,
                source: item.source
              }, wardrobeCollection, index);
            }
          }
        };

        // Add more options button and dropdown
        if (item.source?.url || global.CTO?.imageViewer?.viewer) {
          this.addMoreOptionsToItem(wardrobeItem, item, index);
        }

        // Append img to container, then add elements to wardrobe item
        imgContainer.appendChild(img);
        wardrobeItem.appendChild(imgContainer);
        wardrobeItem.appendChild(info);
        wardrobeItem.appendChild(addBtn);
        wardrobeForOutfit.appendChild(wardrobeItem);
      });
    }

    // Multi-item generation helpers
    async storeGeneratedMultiItemOutfit(generatedImageUrl, outfitItems, usedAvatar) {
      this.generatedOutfits.push({
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
      
      await CTO.storage.set({ generatedOutfits: this.generatedOutfits });
    }

    async generateTryOnWithMultipleItems(clothingUrls) {
      // Set generation status to loading
      await CTO.storage.set({ 
        generationInProgress: true, 
        generationStartTime: new Date().toISOString() 
      });

      try {
        // Get avatar, API key, and size preference
        const { apiKey, avatars, selectedAvatarIndex = 0, sizePreference = 'fit' } = await CTO.storage.get(['apiKey', 'avatars', 'selectedAvatarIndex', 'sizePreference']);
        
        if (!apiKey) {
          throw new Error('API key required');
        }
        
        if (!avatars || avatars.length === 0) {
          throw new Error('Avatar required');
        }
        
        const validAvatarIndex = Math.min(Math.max(selectedAvatarIndex || 0, 0), avatars.length - 1);
        const selectedAvatar = avatars[validAvatarIndex];
        
        if (!selectedAvatar || !selectedAvatar.url || selectedAvatar.failed) {
          throw new Error('Selected avatar is invalid or failed to generate. Please generate or retry avatar creation first.');
        }

        // Convert avatar to base64
        const baseImageData = await CTO.image.imageUrlToBase64(selectedAvatar.url);
        
        // Convert all clothing items to base64
        const clothingDataArray = await Promise.all(
          clothingUrls.map(url => CTO.image.imageUrlToBase64(url))
        );

        // Generate outfit try-on using Gemini API with size preference
        const generatedImageUrl = await CTO.api.callMultiItemTryOnAPI(baseImageData, clothingDataArray, apiKey, sizePreference);

        // Store the generated outfit
        const outfitItems = clothingUrls.map(url => ({ url, addedAt: new Date().toISOString() }));
        await this.storeGeneratedMultiItemOutfit(generatedImageUrl, outfitItems, selectedAvatar);

        // Clear generation status
        await CTO.storage.set({ generationInProgress: false, generationStartTime: null });

        // Refresh outfit and try-on displays
        await this.loadOutfits();
        await this.loadLatestTryOn();

        // Show toast notification with navigation to outfits
        if (global.toastManager) {
          global.toastManager.generationComplete('Regeneration complete!', () => {
            CTO.ui.manager.switchTab('outfits');
          });
        }

      } catch (error) {
        console.error('Error generating try-on with multiple items:', error);
        
        // Clear generation status on error
        await CTO.storage.set({ generationInProgress: false, generationStartTime: null });
        
        throw error; // Re-throw to be handled by caller
      }
    }

    // Storage Management
    async getStorageInfo() {
      try {
        const totalBytes = await CTO.storage.getBytesInUse();
        const clothingBytes = await CTO.storage.getBytesInUse('clothingItems');
        const outfitBytes = await CTO.storage.getBytesInUse('generatedOutfits');
        const avatarBytes = await CTO.storage.getBytesInUse('avatars');
        
        return {
          total: totalBytes,
          clothing: clothingBytes,
          outfits: outfitBytes,
          avatars: avatarBytes,
          totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
          clothingMB: (clothingBytes / (1024 * 1024)).toFixed(2),
          outfitsMB: (outfitBytes / (1024 * 1024)).toFixed(2),
          avatarsMB: (avatarBytes / (1024 * 1024)).toFixed(2)
        };
      } catch (error) {
        console.error('Error getting storage info:', error);
        return null;
      }
    }

    async showStorageManagement() {
      const storageInfo = await this.getStorageInfo();
      if (!storageInfo) {
        if (global.toastManager) {
          global.toastManager.error('Storage Info', 'Unable to get storage information');
        }
        return;
      }

      const message = `
Storage Usage: ${storageInfo.totalMB} MB / 10 MB
• Clothing Items: ${storageInfo.clothingMB} MB
• Generated Outfits: ${storageInfo.outfitsMB} MB  
• Avatars: ${storageInfo.avatarsMB} MB

Would you like to clear some data to free up space?`;

      if (confirm(message)) {
        this.showStorageClearOptions();
      }
    }

    async showStorageClearOptions() {
      const options = [
        'Clear oldest generated outfits',
        'Clear all generated outfits', 
        'Clear clothing items (wardrobe)',
        'Clear everything (reset app)'
      ];
      
      const choice = prompt(`Choose what to clear:\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nEnter number (1-4):`);
      
      if (!choice) return;
      
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < options.length) {
        switch (index) {
          case 0:
            await this.clearOldestOutfits();
            break;
          case 1:
            await this.clearAllOutfits();
            break;
          case 2:
            await this.clearClothingItems();
            break;
          case 3:
            await this.clearAllData();
            break;
        }
      }
    }

    async clearOldestOutfits() {
      if (this.generatedOutfits.length === 0) {
        if (global.toastManager) {
          global.toastManager.info('Nothing to Clear', 'No generated outfits found');
        }
        return;
      }

      // Sort by date and remove oldest half
      const sorted = [...this.generatedOutfits].sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      const toRemove = Math.ceil(sorted.length / 2);
      const remaining = sorted.slice(toRemove);
      
      await CTO.storage.set({ generatedOutfits: remaining });
      this.generatedOutfits = remaining;
      this.displayOutfits();
      
      if (global.toastManager) {
        global.toastManager.success('Storage Cleared', `Removed ${toRemove} oldest generated outfits`);
      }
    }

    async clearAllOutfits() {
      if (confirm('Are you sure you want to delete all generated outfits?')) {
        await CTO.storage.set({ generatedOutfits: [] });
        this.generatedOutfits = [];
        this.displayOutfits();
        
        if (global.toastManager) {
          global.toastManager.success('Storage Cleared', 'All generated outfits removed');
        }
      }
    }

    async clearClothingItems() {
      if (confirm('Are you sure you want to delete all clothing items from your wardrobe?')) {
        await CTO.storage.set({ clothingItems: [] });
        this.clothingItems = [];
        this.displayWardrobe();
        await this.loadWardrobeForOutfit();
        
        if (global.toastManager) {
          global.toastManager.success('Storage Cleared', 'All clothing items removed');
        }
      }
    }

    async clearAllData() {
      if (confirm('Are you sure you want to reset the entire app? This will delete ALL data including avatars, outfits, and clothing items.')) {
        await CTO.storage.clear();
        this.currentOutfit = [];
        this.generatedOutfits = [];
        this.clothingItems = [];
        this.updateOutfitDisplay();
        this.displayOutfits();
        this.displayWardrobe();
        await this.loadWardrobeForOutfit();
        
        if (global.toastManager) {
          global.toastManager.success('App Reset', 'All data cleared - app has been reset');
        }
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

    // Add more options button and dropdown to outfit items
    addMoreOptionsToItem(container, item, index) {
      const moreOptionsBtn = document.createElement('button');
      moreOptionsBtn.className = 'more-options-btn';
      moreOptionsBtn.innerHTML = '...';
      
      const dropdown = document.createElement('div');
      dropdown.className = 'more-options-dropdown';
      
      // Add delete option
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'more-options-item delete';
      deleteBtn.textContent = 'Remove';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deleteClothingItem(index);
        dropdown.classList.remove('active');
      };
      
      // Add view source option if available
      if (item.source?.url) {
        const sourceBtn = document.createElement('button');
        sourceBtn.className = 'more-options-item';
        sourceBtn.textContent = 'Source';
        sourceBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await chrome.tabs.create({ url: item.source.url });
            if (global.toastManager) {
              global.toastManager.success('Source Opened', 'Original source opened in new tab');
            }
          } catch (error) {
            console.error('Error opening source URL:', error);
            if (global.toastManager) {
              global.toastManager.error('Error', 'Failed to open source URL');
            }
          }
          dropdown.classList.remove('active');
        };
        dropdown.appendChild(sourceBtn);
      }
      
      dropdown.appendChild(deleteBtn);
      
      // Toggle dropdown on button click
      moreOptionsBtn.onclick = (e) => {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.more-options-dropdown.active').forEach(d => {
          if (d !== dropdown) d.classList.remove('active');
        });
        dropdown.classList.toggle('active');
      };
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
      
      container.appendChild(moreOptionsBtn);
      container.appendChild(dropdown);
    }

    // Delete clothing item from wardrobe
    async deleteClothingItem(index) {
      if (index < 0 || index >= this.clothingItems.length) return;
      
      const item = this.clothingItems[index];
      
      // Remove from local array
      this.clothingItems.splice(index, 1);
      
      // Update storage
      await CTO.storage.set({ clothingItems: this.clothingItems });
      
      // Refresh displays
      this.displayWardrobe();
      this.loadWardrobeForOutfit();
      
      // Show notification for item removal
      if (global.toastManager) {
        const itemName = this.generateItemName(item);
        global.toastManager.wardrobeItemRemoved(itemName);
      }
     }

     // Add more options button and dropdown to generated outfit items
     addMoreOptionsToOutfit(container, outfit, index) {
       const moreOptionsBtn = document.createElement('button');
       moreOptionsBtn.className = 'more-options-btn';
       moreOptionsBtn.innerHTML = '...';
       
       const dropdown = document.createElement('div');
       dropdown.className = 'more-options-dropdown';
       
       // Add delete option
       const deleteBtn = document.createElement('button');
       deleteBtn.className = 'more-options-item delete';
       deleteBtn.textContent = 'Delete';
       deleteBtn.onclick = (e) => {
         e.stopPropagation();
         this.deleteGeneratedOutfit(index);
         dropdown.classList.remove('active');
       };
       
       dropdown.appendChild(deleteBtn);
       
       // Toggle dropdown on button click
       moreOptionsBtn.onclick = (e) => {
         e.stopPropagation();
         // Close all other dropdowns
         document.querySelectorAll('.more-options-dropdown.active').forEach(d => {
           if (d !== dropdown) d.classList.remove('active');
         });
         dropdown.classList.toggle('active');
       };
       
       // Close dropdown when clicking outside
       document.addEventListener('click', (e) => {
         if (!container.contains(e.target)) {
           dropdown.classList.remove('active');
         }
       });
       
       container.appendChild(moreOptionsBtn);
       container.appendChild(dropdown);
     }

         // Delete generated outfit
    async deleteGeneratedOutfit(index) {
      const sortedOutfits = this.generatedOutfits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (index < 0 || index >= sortedOutfits.length) return;
      
      const outfitToDelete = sortedOutfits[index];
      
      // Find the original index in the unsorted array
      const originalIndex = this.generatedOutfits.findIndex(outfit => 
        outfit.createdAt === outfitToDelete.createdAt && 
        outfit.generatedImage === outfitToDelete.generatedImage
      );
      
      if (originalIndex === -1) return;
      
      // Remove from local array
      this.generatedOutfits.splice(originalIndex, 1);
      
      // Update storage
      await CTO.storage.set({ generatedOutfits: this.generatedOutfits });
      
      // Refresh display
      this.displayOutfits();
      
      if (global.toastManager) {
        global.toastManager.success('Deleted', 'Outfit removed from collection');
      }
    }
   };

  // Create global outfit manager instance
  ns.outfit.manager = new ns.outfit.OutfitManager();

})(window); 