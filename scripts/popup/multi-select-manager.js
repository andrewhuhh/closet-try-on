(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.multiSelect = ns.multiSelect || {};

  // Multi-Select Manager Class
  ns.multiSelect.Manager = class MultiSelectManager {
    constructor() {
      this.selectedItems = new Map(); // Map of context -> Set of selected item IDs
      this.contexts = new Set(['outfits', 'wardrobe', 'wardrobe-for-outfit', 'wardrobe-popup']);
    }

    // Initialize multi-select for all contexts
    init() {
      // Initialize selection maps for each context
      this.contexts.forEach(context => {
        this.selectedItems.set(context, new Set());
      });

      // Setup mass action event listeners
      this.setupMassActionListeners();
    }

    // Create multi-select checkbox element
    createMultiSelectCheckbox(itemId, context, item) {
      const checkbox = document.createElement('label');
      checkbox.className = 'multi-select-checkbox';
      checkbox.innerHTML = `
        <input type="checkbox" data-item-id="${itemId}" data-context="${context}">
        <span class="checkbox-custom"></span>
      `;

      const input = checkbox.querySelector('input');
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleSelection(itemId, context, item, e.target.checked);
      });

      return checkbox;
    }

    // Toggle selection of an item
    toggleSelection(itemId, context, item, isSelected) {
      const selectedSet = this.selectedItems.get(context);
      
      if (isSelected) {
        selectedSet.add(itemId);
        // Store item data for later use
        selectedSet[itemId] = item;
      } else {
        selectedSet.delete(itemId);
        delete selectedSet[itemId];
      }

      this.updateItemVisualState(itemId, context, isSelected);
      this.updateMassActionsBar(context);
    }

    // Update visual state of item
    updateItemVisualState(itemId, context, isSelected) {
      // Find element by data attribute value (more reliable than CSS selector)
      const className = context === 'wardrobe-popup' ? 'wardrobe-popup-item' : 'outfit-item';
      const elements = document.querySelectorAll(`.${className}`);
      
      let itemElement = null;
      for (const element of elements) {
        if (element.getAttribute('data-item-id') === itemId) {
          itemElement = element;
          break;
        }
      }
      
      if (itemElement) {
        if (isSelected) {
          itemElement.classList.add('selected');
        } else {
          itemElement.classList.remove('selected');
        }
      } else {
        console.warn(`Could not find ${className} element with data-item-id: ${itemId}`);
      }
    }

    // Update mass actions bar visibility and count
    updateMassActionsBar(context) {
      const selectedSet = this.selectedItems.get(context);
      const count = selectedSet.size;
      
      const massActionsBar = document.getElementById(`${context}-mass-actions`);
      const countElement = massActionsBar?.querySelector('.selected-count');
      
      if (massActionsBar && countElement) {
        countElement.textContent = count;
        
        if (count > 0) {
          massActionsBar.classList.add('active');
        } else {
          massActionsBar.classList.remove('active');
        }
      }
    }

    // Clear all selections in a context
    clearSelection(context) {
      const selectedSet = this.selectedItems.get(context);
      
      // Update visual state for all selected items
      selectedSet.forEach(itemId => {
        this.updateItemVisualState(itemId, context, false);
        // Uncheck the checkbox by finding it directly
        const checkboxes = document.querySelectorAll(`input[data-context="${context}"]`);
        for (const checkbox of checkboxes) {
          if (checkbox.getAttribute('data-item-id') === itemId) {
            checkbox.checked = false;
            break;
          }
        }
      });

      // Clear the selection set
      selectedSet.clear();
      this.updateMassActionsBar(context);
    }

    // Get selected items for a context
    getSelectedItems(context) {
      const selectedSet = this.selectedItems.get(context);
      const items = [];
      
      selectedSet.forEach(itemId => {
        if (selectedSet[itemId]) {
          items.push({
            id: itemId,
            data: selectedSet[itemId]
          });
        }
      });
      
      return items;
    }

    // Mass delete selected items
    async massDelete(context) {
      const selectedItems = this.getSelectedItems(context);
      
      if (selectedItems.length === 0) {
        if (global.toastManager) {
          global.toastManager.warning('No Items Selected', 'Please select items to delete');
        }
        return;
      }

      const confirmMessage = `Are you sure you want to delete ${selectedItems.length} ${context === 'outfits' ? 'outfit' : 'item'}${selectedItems.length !== 1 ? 's' : ''}?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

      try {
        if (context === 'outfits') {
          await this.massDeleteOutfits(selectedItems);
        } else {
          await this.massDeleteClothingItems(selectedItems);
        }

        // Clear selection after successful deletion
        this.clearSelection(context);

        if (global.toastManager) {
          global.toastManager.success('Items Deleted', `Successfully deleted ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`);
        }
      } catch (error) {
        console.error('Error during mass delete:', error);
        if (global.toastManager) {
          global.toastManager.error('Delete Failed', 'Some items could not be deleted');
        }
      }
    }

    // Mass delete outfits
    async massDeleteOutfits(selectedItems) {
      if (!CTO.outfit?.manager) throw new Error('Outfit manager not available');

      // Get current outfits
      const { generatedOutfits = [] } = await CTO.storage.get('generatedOutfits');
      
      // Create a set of URLs to delete for faster lookup
      const urlsToDelete = new Set(selectedItems.map(item => item.data.generatedImage));
      
      // Filter out the selected outfits
      const remainingOutfits = generatedOutfits.filter(outfit => !urlsToDelete.has(outfit.generatedImage));
      
      // Save updated outfits
      await CTO.storage.set({ generatedOutfits: remainingOutfits });
      
      // Update manager state and refresh display
      CTO.outfit.manager.generatedOutfits = remainingOutfits;
      CTO.outfit.manager.displayOutfits();
    }

    // Mass delete clothing items
    async massDeleteClothingItems(selectedItems) {
      if (!CTO.outfit?.manager) throw new Error('Outfit manager not available');

      // Get current clothing items
      const { clothingItems = [] } = await CTO.storage.get('clothingItems');
      
      // Create a set of URLs to delete for faster lookup
      const urlsToDelete = new Set(selectedItems.map(item => item.data.url));
      
      // Filter out the selected items
      const remainingItems = clothingItems.filter(item => !urlsToDelete.has(item.url));
      
      // Save updated items
      await CTO.storage.set({ clothingItems: remainingItems });
      
      // Update manager state and refresh displays
      CTO.outfit.manager.clothingItems = remainingItems;
      CTO.outfit.manager.displayWardrobe();
      CTO.outfit.manager.loadWardrobeForOutfit();
    }

    // Mass download selected items
    async massDownload(context) {
      const selectedItems = this.getSelectedItems(context);
      
      if (selectedItems.length === 0) {
        if (global.toastManager) {
          global.toastManager.warning('No Items Selected', 'Please select items to download');
        }
        return;
      }

      try {
        // Show loading toast
        if (global.toastManager) {
          global.toastManager.info('Preparing Download', `Creating zip with ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}...`);
        }

        // Create zip file
        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        
        // Add files to zip
        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          const imageUrl = context === 'outfits' ? item.data.generatedImage : item.data.url;
          
          try {
            // Fetch image as blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            // Determine file extension
            const mimeType = blob.type;
            const extension = mimeType.includes('png') ? 'png' : 'jpg';
            
            // Create filename
            let filename;
            if (context === 'outfits') {
              const date = new Date(item.data.createdAt).toLocaleDateString().replace(/\//g, '-');
              filename = `outfit-${date}-${i + 1}.${extension}`;
            } else {
              const itemName = CTO.outfit.manager.generateItemName(item.data);
              const sanitizedName = itemName.replace(/[^a-zA-Z0-9-_]/g, '_');
              filename = `${sanitizedName}-${i + 1}.${extension}`;
            }
            
            zip.file(filename, blob);
          } catch (error) {
            console.error(`Error adding item ${i + 1} to zip:`, error);
            // Continue with other files
          }
        }

        // Generate and download zip
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = zipUrl;
        downloadLink.download = `closet-try-on-${context}-${timestamp}.zip`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up URL
        URL.revokeObjectURL(zipUrl);

        if (global.toastManager) {
          global.toastManager.success('Download Complete', `Downloaded ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} as zip file`);
        }

      } catch (error) {
        console.error('Error during mass download:', error);
        if (global.toastManager) {
          global.toastManager.error('Download Failed', 'Could not create zip file');
        }
      }
    }

    // Setup mass action event listeners
    setupMassActionListeners() {
      // Clear selection buttons
      this.contexts.forEach(context => {
        const clearBtn = document.getElementById(`${context}-clear-selection`);
        if (clearBtn) {
          clearBtn.addEventListener('click', () => this.clearSelection(context));
        }

        const deleteBtn = document.getElementById(`${context}-mass-delete`);
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => this.massDelete(context));
        }

        const downloadBtn = document.getElementById(`${context}-mass-download`);
        if (downloadBtn) {
          downloadBtn.addEventListener('click', () => this.massDownload(context));
        }
      });
    }
  };

  // Create global multi-select manager instance
  ns.multiSelect.manager = new ns.multiSelect.Manager();

})(window); 