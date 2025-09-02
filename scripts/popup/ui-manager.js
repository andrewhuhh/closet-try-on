(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.ui = ns.ui || {};

  // UI Management Class
  ns.ui.UIManager = class UIManager {
    constructor() {
      this.activeTab = 'outfits';
      this.activeSection = 'main-interface';
    }

    // Section Management
    showSection(sectionId) {
      document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
      });
      
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        targetSection.classList.remove('hidden');
        this.activeSection = sectionId;
      } else {
        console.error(`Section with id '${sectionId}' not found`);
      }
    }

    // Tab Management
    async switchTab(tabName) {
      // Update tab buttons
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      // Update tab content
      document.querySelectorAll('.tabs').forEach(tab => {
        tab.classList.toggle('active', tab.id === `${tabName}-tab`);
      });

      this.activeTab = tabName;

      // Emit custom event for tab switch
      const event = new CustomEvent('tabSwitched', { 
        detail: { 
          tabName,
          previousTab: this.activeTab 
        } 
      });
      document.dispatchEvent(event);
    }

    // Status Display
    showStatus(message, type = 'info', targetId = 'global-status') {
      const statusDiv = document.getElementById(targetId);
      if (!statusDiv) {
        console.error(`Status div with id '${targetId}' not found`);
        return;
      }

      statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
      
      // Clear status after 5 seconds
      setTimeout(() => {
        statusDiv.innerHTML = '';
      }, 5000);
    }

    // Settings Dropdown Management
    toggleSettingsDropdown() {
      const menu = document.getElementById('settings-menu');
      if (!menu) {
        console.error('Settings menu not found');
        return;
      }
      
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
    }

    hideSettingsDropdown() {
      const menu = document.getElementById('settings-menu');
      if (menu) {
        menu.style.display = 'none';
      }
    }

    // Settings Section Management
    openSettingsSection(sectionName) {
      this.hideSettingsDropdown();
      
      // Emit custom event for settings section opening
      const event = new CustomEvent('settingsSectionOpened', { 
        detail: { sectionName } 
      });
      document.dispatchEvent(event);

      if (sectionName === 'avatar-management') {
        this.showSection('avatar-management-section');
      } else if (sectionName === 'api-settings') {
        this.showSection('api-settings-section');
      }
    }

    // Drag and Drop UI Feedback
    addDragOverEffect(element) {
      if (element && element.classList) {
        element.classList.add('dragover');
      }
    }

    removeDragOverEffect(element) {
      if (element && element.classList) {
        element.classList.remove('dragover');
      }
    }

    // Loading State Management
    setLoadingState(elementId, isLoading) {
      const element = document.getElementById(elementId);
      if (!element) return;

      if (isLoading) {
        element.disabled = true;
        element.classList.add('loading');
        
        // Add loading spinner if button
        if (element.tagName === 'BUTTON') {
          const originalText = element.textContent;
          element.dataset.originalText = originalText;
          element.innerHTML = '<span class="loading-spinner"></span> Loading...';
        }
      } else {
        element.disabled = false;
        element.classList.remove('loading');
        
        // Restore original text if button
        if (element.tagName === 'BUTTON' && element.dataset.originalText) {
          element.textContent = element.dataset.originalText;
          delete element.dataset.originalText;
        }
      }
    }

    // Button State Management
    updateButtonState(buttonId, enabled, text = null) {
      const button = document.getElementById(buttonId);
      if (!button) return;

      button.disabled = !enabled;
      if (text) {
        button.textContent = text;
      }
    }

    // Form Validation UI
    showFieldError(fieldId, message) {
      const field = document.getElementById(fieldId);
      if (!field) return;

      // Remove existing error
      this.clearFieldError(fieldId);

      // Add error class
      field.classList.add('error');

      // Create error message element
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.textContent = message;
      errorDiv.id = `${fieldId}-error`;

      // Insert after the field
      field.parentNode.insertBefore(errorDiv, field.nextSibling);
    }

    clearFieldError(fieldId) {
      const field = document.getElementById(fieldId);
      const errorDiv = document.getElementById(`${fieldId}-error`);
      
      if (field) {
        field.classList.remove('error');
      }
      if (errorDiv) {
        errorDiv.remove();
      }
    }

    // Utility Methods
    getActiveTab() {
      return this.activeTab;
    }

    getActiveSection() {
      return this.activeSection;
    }

    // Element Visibility
    showElement(elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.style.display = '';
        element.classList.remove('hidden');
      }
    }

    hideElement(elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.style.display = 'none';
        element.classList.add('hidden');
      }
    }

    toggleElement(elementId, show = null) {
      const element = document.getElementById(elementId);
      if (!element) return;

      const isHidden = element.style.display === 'none' || element.classList.contains('hidden');
      
      if (show === null) {
        // Toggle current state
        if (isHidden) {
          this.showElement(elementId);
        } else {
          this.hideElement(elementId);
        }
      } else {
        // Set specific state
        if (show) {
          this.showElement(elementId);
        } else {
          this.hideElement(elementId);
        }
      }
    }

    // Focus Management
    focusElement(elementId) {
      const element = document.getElementById(elementId);
      if (element && element.focus) {
        element.focus();
      }
    }

    // Scroll Management
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrollToElement(elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Create global UI manager instance
  ns.ui.manager = new ns.ui.UIManager();

})(window); 