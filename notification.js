// Notification View Script
(function() {
  'use strict';

  // DOM elements
  const elements = {
    container: null,
    icon: null,
    title: null,
    message: null,
    actionBtn: null,
    openExtensionBtn: null,
    closeBtn: null
  };

  // Notification configuration
  let currentNotification = null;
  let autoHideTimeout = null;

  // Initialize the notification view
  function init() {
    // Get DOM elements
    elements.container = document.querySelector('.notification-container');
    elements.icon = document.getElementById('notification-icon');
    elements.title = document.getElementById('notification-title');
    elements.message = document.getElementById('notification-message');
    elements.actionBtn = document.getElementById('notification-action');
    elements.openExtensionBtn = document.getElementById('open-extension');
    elements.closeBtn = document.getElementById('close-notification');

    // Set up event listeners
    setupEventListeners();

    // Listen for notification data from background script
    listenForNotificationData();

    // Auto-size window to content
    requestAnimationFrame(autoSizeWindow);
  }

  function setupEventListeners() {
    // Close button
    elements.closeBtn.addEventListener('click', closeNotification);

    // Open extension button
    elements.openExtensionBtn.addEventListener('click', openExtension);

    // Action button (will be configured per notification)
    elements.actionBtn.addEventListener('click', handleActionClick);

    // Listen for escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNotification();
      }
    });

    // Auto-close on click outside (if supported)
    document.addEventListener('click', (e) => {
      if (e.target === document.body) {
        closeNotification();
      }
    });
  }

  function listenForNotificationData() {
    console.log('Setting up notification data listeners...');
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Notification received message:', message);
      if (message.type === 'SHOW_NOTIFICATION') {
        showNotification(message.data);
        sendResponse({ success: true });
      }
      return true; // Keep message channel open for async response
    });

    // Request notification data on load (in case it was passed during window creation)
    console.log('Requesting notification data from background...');
    chrome.runtime.sendMessage({ type: 'GET_NOTIFICATION_DATA' }, (response) => {
      console.log('Background response:', response);
      if (response && response.data) {
        showNotification(response.data);
      } else {
        console.log('No notification data available');
      }
    });
  }

  function showNotification(data) {
    console.log('showNotification called with data:', data);
    currentNotification = data;

    // Set notification type class
    elements.container.className = 'notification-container';
    if (data.type) {
      elements.container.classList.add(data.type);
    }

    // Set icon
    setNotificationIcon(data.type, data.icon);

    // Set text content
    elements.title.textContent = data.title || 'Notification';
    elements.message.textContent = data.message || '';

    // Configure action button
    if (data.actionText && data.actionType) {
      elements.actionBtn.textContent = data.actionText;
      elements.actionBtn.style.display = 'inline-block';
      elements.actionBtn.dataset.actionType = data.actionType;
      elements.actionBtn.dataset.actionData = JSON.stringify(data.actionData || {});
    } else {
      elements.actionBtn.style.display = 'none';
    }

    // Auto-hide timer
    if (data.duration && data.duration > 0) {
      clearTimeout(autoHideTimeout);
      autoHideTimeout = setTimeout(() => {
        closeNotification();
      }, data.duration);
    }

    // Auto-size window
    requestAnimationFrame(autoSizeWindow);

    // Focus the window
    window.focus();
  }

  function setNotificationIcon(type, customIcon) {
    // Clear existing classes
    elements.icon.className = 'notification-icon';
    
    if (customIcon) {
      elements.icon.textContent = customIcon;
    } else {
      // Set default icon based on type
      switch (type) {
        case 'success':
          elements.icon.textContent = '✅';
          elements.icon.classList.add('success');
          break;
        case 'warning':
          elements.icon.textContent = '⚠️';
          elements.icon.classList.add('warning');
          break;
        case 'error':
          elements.icon.textContent = '❌';
          elements.icon.classList.add('error');
          break;
        case 'info':
          elements.icon.textContent = 'ℹ️';
          elements.icon.classList.add('info');
          break;
        default:
          elements.icon.textContent = '📢';
          elements.icon.classList.add('info');
      }
    }

    // Add type class if specified
    if (type) {
      elements.icon.classList.add(type);
    }
  }

  function handleActionClick() {
    const actionType = elements.actionBtn.dataset.actionType;
    const actionData = JSON.parse(elements.actionBtn.dataset.actionData || '{}');

    switch (actionType) {
      case 'open-tab':
        if (actionData.tab) {
          openExtensionTab(actionData.tab);
        } else {
          openExtension();
        }
        break;
      case 'open-url':
        if (actionData.url) {
          chrome.tabs.create({ url: actionData.url });
        }
        break;
      case 'view-wardrobe':
        openExtensionTab('wardrobe');
        break;
      case 'view-outfits':
        openExtensionTab('outfits');
        break;
      case 'view-latest':
        openExtensionTab('try-on');
        break;
      default:
        openExtension();
    }

    // Close notification after action
    closeNotification();
  }

  function openExtension() {
    chrome.action.openPopup().catch(() => {
      // If popup can't be opened (e.g., another popup is open), 
      // try to focus an existing popup or create a new window
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 400,
        height: 600
      });
    });
    closeNotification();
  }

  function openExtensionTab(tab) {
    // Store the tab preference and open extension
    if (tab) {
      chrome.storage.local.set({ openToTab: tab });
    }
    openExtension();
  }

  function closeNotification() {
    // Clear auto-hide timer
    clearTimeout(autoHideTimeout);

    // Add fade-out animation
    elements.container.classList.add('fade-out');

    // Close window after animation
    setTimeout(() => {
      window.close();
    }, 300);
  }

  function autoSizeWindow() {
    // Get the actual content height
    const contentHeight = elements.container.offsetHeight;
    const contentWidth = elements.container.offsetWidth;

    // Resize window to fit content
    try {
      chrome.windows.getCurrent((currentWindow) => {
        chrome.windows.update(currentWindow.id, {
          width: Math.max(contentWidth, 400),
          height: contentHeight + 50 // Add some padding for window chrome
        });
      });
    } catch (error) {
      console.log('Could not auto-resize window:', error);
    }
  }

  // Handle window close events
  window.addEventListener('beforeunload', () => {
    clearTimeout(autoHideTimeout);
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Global functions for external access
  window.NotificationView = {
    show: showNotification,
    close: closeNotification
  };

})(); 