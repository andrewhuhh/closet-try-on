(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.storage = ns.storage || {};

  // Storage helpers (callback-based for maximal compatibility)
  ns.storage.get = function(keys) {
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
  };

  ns.storage.set = function(items) {
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
  ns.storage.clear = function() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          const err = chrome.runtime?.lastError;
          if (err) return reject(err);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  };

  // Get storage usage information
  ns.storage.getBytesInUse = function(keys = null) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.getBytesInUse(keys, (bytesInUse) => {
          const err = chrome.runtime?.lastError;
          if (err) return reject(err);
          resolve(bytesInUse);
        });
      } catch (e) {
        reject(e);
      }
    });
  };
})(window); 