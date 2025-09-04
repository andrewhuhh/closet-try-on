(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.storage = ns.storage || {};

  // IndexedDB configuration
  const DB_NAME = 'ClosetTryOnDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'storage';

  // Initialize IndexedDB
  let dbInstance = null;

  async function initDB() {
    if (dbInstance) return dbInstance;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      
      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };
    });
  }

  // Migration helper: move data from chrome.storage.local to IndexedDB
  async function migrateFromChromeStorage() {
    try {
      // Check if we have chrome storage and haven't migrated yet
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const migrationKey = '__indexeddb_migration_complete__';
        
        // Check if migration already completed
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const migrationCheck = await new Promise((resolve) => {
          const request = store.get(migrationKey);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        });

        if (!migrationCheck) {
          // Get all data from chrome storage
          const chromeData = await new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
              resolve(result || {});
            });
          });

          // Migrate to IndexedDB
          if (Object.keys(chromeData).length > 0) {
            console.log('Migrating data from Chrome storage to IndexedDB...', Object.keys(chromeData));
            const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
            const writeStore = writeTransaction.objectStore(STORE_NAME);
            
            for (const [key, value] of Object.entries(chromeData)) {
              writeStore.put({ key, value });
            }
            
            // Mark migration as complete
            writeStore.put({ key: migrationKey, value: true });
            
            await new Promise((resolve, reject) => {
              writeTransaction.oncomplete = resolve;
              writeTransaction.onerror = () => reject(writeTransaction.error);
            });
            
            console.log('Migration to IndexedDB completed successfully');
          } else {
            // No data to migrate, just mark as complete
            const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
            const writeStore = writeTransaction.objectStore(STORE_NAME);
            writeStore.put({ key: migrationKey, value: true });
            
            await new Promise((resolve, reject) => {
              writeTransaction.oncomplete = resolve;
              writeTransaction.onerror = () => reject(writeTransaction.error);
            });
          }
        }
      }
    } catch (error) {
      console.warn('Migration from Chrome storage failed:', error);
      // Continue anyway - we'll start fresh with IndexedDB
    }
  }

  // Storage helpers (maintaining same API as chrome.storage.local)
  ns.storage.get = async function(keys) {
    try {
      await migrateFromChromeStorage();
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      if (keys === null || keys === undefined) {
        // Get all data
        const result = {};
        const request = store.getAll();
        const allData = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        for (const item of allData) {
          if (item.key !== '__indexeddb_migration_complete__') {
            result[item.key] = item.value;
          }
        }
        return result;
      }
      
      const keysArray = Array.isArray(keys) ? keys : [keys];
      const result = {};
      
      for (const key of keysArray) {
        const request = store.get(key);
        const data = await new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        });
        
        if (data && data.value !== undefined) {
          result[key] = data.value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Storage get error:', error);
      return {};
    }
  };

  ns.storage.set = async function(items) {
    try {
      await migrateFromChromeStorage();
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      for (const [key, value] of Object.entries(items)) {
        store.put({ key, value });
      }
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Storage set error:', error);
      throw error;
    }
  };

  // Convenience method for getting a single key
  ns.storage.getValue = async function(key, defaultValue = null) {
    const result = await ns.storage.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  };

  // Convenience method for setting a single key-value pair
  ns.storage.setValue = async function(key, value) {
    const items = {};
    items[key] = value;
    return await ns.storage.set(items);
  };

  // Clear all storage (useful for development/testing)
  ns.storage.clear = async function() {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Storage clear error:', error);
      throw error;
    }
  };

  // Get storage usage information (approximation for IndexedDB)
  ns.storage.getBytesInUse = async function(keys = null) {
    try {
      await migrateFromChromeStorage();
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      let totalSize = 0;
      
      if (keys === null) {
        // Calculate total size
        const request = store.getAll();
        const allData = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        for (const item of allData) {
          if (item.key !== '__indexeddb_migration_complete__') {
            totalSize += JSON.stringify(item.value).length * 2; // Rough estimate (UTF-16)
          }
        }
      } else {
        // Calculate size for specific keys
        const keysArray = Array.isArray(keys) ? keys : [keys];
        
        for (const key of keysArray) {
          const request = store.get(key);
          const data = await new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
          });
          
          if (data && data.value !== undefined) {
            totalSize += JSON.stringify(data.value).length * 2; // Rough estimate (UTF-16)
          }
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Storage getBytesInUse error:', error);
      return 0;
    }
  };

  // Notification utilities for wardrobe actions
  function notifyWardrobeAction(action, itemName = 'Item', options = {}) {
    // Check if we're in the popup context (has toastManager) or background context
    if (typeof global !== 'undefined' && global.toastManager) {
      // We're in popup context - use toast notifications
      switch (action) {
        case 'added':
          return global.toastManager.wardrobeItemAdded(itemName, options.clickAction);
        case 'removed':
          return global.toastManager.wardrobeItemRemoved(itemName);
        case 'exists':
          return global.toastManager.wardrobeItemExists(itemName);
        default:
          return global.toastManager.info('Wardrobe Action', `${action} - ${itemName}`);
      }
    } else if (typeof chrome !== 'undefined' && chrome.notifications) {
      // We're in background context - use browser notifications
      switch (action) {
        case 'added':
          chrome.notifications.create(`wardrobe-${action}-${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/128.png',
            title: '✅ Added to Wardrobe',
            message: `${itemName} saved successfully! Click to view your wardrobe.`,
            buttons: [{ title: 'View Wardrobe' }],
            requireInteraction: false
          });
          break;
        case 'removed':
          chrome.notifications.create(`wardrobe-${action}-${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/128.png',
            title: '🗑️ Removed from Wardrobe',
            message: `${itemName} has been removed from your wardrobe.`,
            requireInteraction: false
          });
          break;
        case 'exists':
          chrome.notifications.create(`wardrobe-${action}-${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/128.png',
            title: '📁 Already in Wardrobe',
            message: `${itemName} is already saved in your wardrobe.`,
            requireInteraction: false
          });
          break;
      }
         }
   }

  // Export the notification function
  ns.storage.notifyWardrobeAction = notifyWardrobeAction;

  // Initialize the database when the module loads
  initDB().catch(console.error);

})(window); 