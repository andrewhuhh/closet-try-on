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
      await CTO.storage.set({ currentOutfit: this.currentOutfit });
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
        // Get avatar and API key
        const { apiKey, avatars, selectedAvatarIndex = 0 } = await CTO.storage.get(['apiKey', 'avatars', 'selectedAvatarIndex']);
        
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

        // Add view button if the global function exists
        if (global.addViewButtonToImage) {
          global.addViewButtonToImage(outfitItem, outfit.generatedImage, {
            type: outfit.isMultiItem ? 'Multi-Item Outfit' : 'Generated Outfit',
            createdAt: outfit.createdAt,
            usedAvatar: outfit.usedAvatar,
            itemCount: itemCount,
            index: index + 1,
            originalData: outfit // Pass the full outfit data
          }, outfitCollection, index);
        }

        outfitItem.appendChild(img);
        outfitItem.appendChild(info);
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

      // Add view button to latest try-on if the global function exists
      if (global.addViewButtonToImage) {
        global.addViewButtonToImage(imageContainer, latest.generatedImage, {
          type: 'Latest Try-On Result',
          createdAt: latest.createdAt,
          usedAvatar: latest.usedAvatar
        });
      }

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

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'Saved clothing item';

        const info = document.createElement('div');
        info.className = 'info';
        info.textContent = new Date(item.addedAt).toLocaleDateString();

        // Add source link button if available and global function exists
        if (item.source?.url && global.addSourceButtonToImage) {
          global.addSourceButtonToImage(wardrobeItem, item.source);
        }

        // Add view button if global function exists
        if (global.addViewButtonToImage) {
          global.addViewButtonToImage(wardrobeItem, item.url, {
            type: 'Clothing Item',
            addedAt: item.addedAt,
            index: index + 1,
            source: item.source // Include source information
          }, wardrobeCollection, index);
        }

        wardrobeItem.appendChild(img);
        wardrobeItem.appendChild(info);
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

        // Add source link button if available and global function exists
        if (item.source?.url && global.addSourceButtonToImage) {
          global.addSourceButtonToImage(wardrobeItem, item.source);
        }

        // Add view button for the clothing item if global function exists
        if (global.addViewButtonToImage) {
          const wardrobeCollection = this.clothingItems.map((wardrobeItem, idx) => ({
            url: wardrobeItem.url,
            info: {
              type: 'Clothing Item',
              addedAt: wardrobeItem.addedAt,
              index: idx + 1,
              source: wardrobeItem.source
            }
          }));
          global.addViewButtonToImage(wardrobeItem, item.url, {
            type: 'Clothing Item',
            addedAt: item.addedAt,
            index: index + 1,
            source: item.source
          }, wardrobeCollection, index);
        }

        wardrobeItem.appendChild(img);
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
        // Get avatar and API key
        const { apiKey, avatars, selectedAvatarIndex = 0 } = await CTO.storage.get(['apiKey', 'avatars', 'selectedAvatarIndex']);
        
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
  };

  // Create global outfit manager instance
  ns.outfit.manager = new ns.outfit.OutfitManager();

})(window); 