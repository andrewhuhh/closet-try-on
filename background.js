 // Closet Try-On Extension Background Script

// Storage helpers using IndexedDB (compatible with content scripts)
const DB_NAME = 'ClosetTryOnDB';
const DB_VERSION = 1;
const STORE_NAME = 'storage';

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

async function storageGet(keys) {
  try {
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
}

async function storageSet(items) {
  try {
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
}

// Create context menu items when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToOutfit',
    title: 'Add to Wardrobe',
    contexts: ['image']
  });
  
  chrome.contextMenus.create({
    id: 'tryItOn',
    title: 'Try It On',
    contexts: ['image']
  });
});

// Helper function to extract website name from URL
function extractWebsiteName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix if present
  } catch (error) {
    console.warn('Failed to extract website name from URL:', url, error);
    return 'unknown website';
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToOutfit' && info.srcUrl) {
    // Store clothing image for later use with source information
    await storeClothingImage(info.srcUrl, {
      sourceUrl: tab.url,
      sourceTitle: tab.title,
      sourceFavicon: tab.favIconUrl
    });
    
    // Extract website name for notification
    const websiteName = extractWebsiteName(tab.url);
    
    // Show notification immediately with placeholder
    showNotification({
      title: 'Added to Wardrobe!',
      message: `From ${websiteName}`,
      type: 'success',
      icon: '👕',
      duration: 3000,
      actionText: 'View Wardrobe',
      actionType: 'view-wardrobe',
      imageUrl: null, // No image initially
      websiteName: websiteName
    });
    
    // Process image in background and update notification
    processImageForNotification(info.srcUrl);
  } 
  
  else if (info.menuItemId === 'tryItOn' && info.srcUrl) {
    // Always attempt to open popup when Try It On is clicked
    chrome.action.openPopup();
    
    // Check if user has avatar set up
    const { avatarGenerated } = await storageGet('avatarGenerated');
    
    if (!avatarGenerated) {
      // No avatar - show notification about setup requirement
      showNotification({
        title: 'Setup Required',
        message: 'Please set up your avatar first in the extension popup',
        type: 'warning',
        icon: '⚠️',
        duration: 5000,
        actionText: 'Setup Avatar',
        actionType: 'open-tab'
      });
      return;
    }
    
    // Generate try-on image
    await generateTryOnImage(info.srcUrl);
  }
});

// Store clothing image in storage (with compression)
async function storeClothingImage(imageUrl, sourceInfo = null) {
  try {
    const { clothingItems = [] } = await storageGet('clothingItems');
    
    // Check if this image URL is already in the wardrobe
    const isAlreadyInWardrobe = clothingItems.some(item => item.url === imageUrl);
    if (isAlreadyInWardrobe) {
      console.log('Item already exists in wardrobe, skipping duplicate:', imageUrl);
      
      // Send notification about duplicate
      if (chrome.notifications) {
        chrome.notifications.create(`wardrobe-exists-${Date.now()}`, {
          type: 'basic',
          iconUrl: 'icons/128.png',
          title: '📁 Already in Wardrobe',
          message: 'This item is already saved in your wardrobe',
          requireInteraction: false
        });
      }
      return;
    }
    
    // Convert external URL to compressed data URL for storage
    let processedImageUrl;
    try {
      // Fetch and compress the image
      const response = await fetch(imageUrl);
      if (response.ok) {
        const blob = await response.blob();
        const compressedBlob = await compressImageIfNeeded(blob);
        
        // Convert to data URL
        processedImageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(compressedBlob);
        });
      } else {
        // If fetch fails, store original URL
        processedImageUrl = imageUrl;
      }
    } catch (fetchError) {
      console.warn('Failed to compress clothing image, storing original URL:', fetchError);
      processedImageUrl = imageUrl;
    }
    
    // Double-check for duplicates with processed URL (extra safety)
    const isDuplicateProcessed = clothingItems.some(item => item.url === processedImageUrl);
    if (isDuplicateProcessed) {
      console.log('Processed item already exists in wardrobe, skipping duplicate:', processedImageUrl);
      
      // Send notification about duplicate
      if (chrome.notifications) {
        chrome.notifications.create(`wardrobe-exists-${Date.now()}`, {
          type: 'basic',
          iconUrl: 'icons/128.png',
          title: '📁 Already in Wardrobe',
          message: 'This item is already saved in your wardrobe',
          requireInteraction: false
        });
      }
      return;
    }
    
    // Create clothing item with source information
    const clothingItem = {
      url: processedImageUrl,
      addedAt: new Date().toISOString()
    };
    
    // Add source information if available
    if (sourceInfo) {
      clothingItem.source = {
        url: sourceInfo.sourceUrl,
        title: sourceInfo.sourceTitle,
        favicon: sourceInfo.sourceFavicon,
        imageUrl: imageUrl // Store original image URL for reference
      };
    }
    
    clothingItems.push(clothingItem);
    
    await storageSet({ clothingItems });
    
    console.log('Successfully added new item to wardrobe:', {
      url: processedImageUrl,
      hasSource: !!sourceInfo,
      totalItems: clothingItems.length
    });
    
  } catch (error) {
    console.error('Error storing clothing image:', error);
  }
}

// Generate try-on image using Gemini API (supports multiple clothing items)
async function generateTryOnImage(clothingImageUrl, options = {}) {
  // Set generation status to loading
  await storageSet({ generationInProgress: true, generationStartTime: new Date().toISOString() });
  
  // Notify popup about generation status change
  notifyPopupGenerationStatus(true);
  
  // Timeout configuration (5 minutes)
  const GENERATION_TIMEOUT = 5 * 60 * 1000;
  
  try {
    // Wrap the generation logic in a timeout promise race
    await Promise.race([
      generateTryOnImageInternal(clothingImageUrl, options),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Generation timeout: Process took longer than 5 minutes'));
        }, GENERATION_TIMEOUT);
      })
    ]);
  } catch (error) {
    console.error('Error generating try-on image:', error);
    
    // Clear generation status on error
    await storageSet({ generationInProgress: false, generationStartTime: null });
    
    // Notify popup about generation status change
    notifyPopupGenerationStatus(false);
    
    // Handle timeout specifically
    if (error.message && error.message.includes('Generation timeout')) {
      showNotification({
        title: 'Generation Timeout',
        message: 'Try-on generation timed out. Please try again with smaller images or check your network connection.',
        type: 'error',
        icon: '⏰',
        duration: 8000,
        actionText: 'Open Extension',
        actionType: 'open-tab'
      });
      return;
    }
    
    // Handle other errors (existing error handling logic)
    let title = 'Generation Failed';
    let message = 'Failed to generate try-on image. Please try again.';
    
    if (error.message) {
      if (error.message.includes('Resource::kQuotaBytes quota exceeded') || error.message.includes('quotaBytes')) {
        title = 'Image Too Large';
        message = 'Image file size exceeds API limits. Try using smaller, lower resolution images.';
      } else if (error.message.includes('429')) {
        title = 'API Quota Exceeded';
        message = 'API quota exceeded. Please check your billing or try again later.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        title = 'API Key Error';
        message = 'Invalid or expired API key. Please update your API key in the extension.';
      } else if (error.message.includes('Network error') || error.message.includes('fetch')) {
        title = 'Network Error';
        message = 'Network error. Please check your internet connection and try again.';
      }
    }
    
    showNotification({
      title: title,
      message: message,
      type: 'error',
      icon: '❌',
      duration: 8000,
      actionText: 'Open Extension',
      actionType: 'open-tab'
    });
  }
}

// Internal generation function (extracted from the main function)
async function generateTryOnImageInternal(clothingImageUrl, options = {}) {
  try {
    // Get stored data
    const { apiKey, avatars, selectedAvatarIndex = 0 } = await storageGet(['apiKey', 'avatars', 'selectedAvatarIndex']);
    
    if (!apiKey) {
      // Clear generation status on early return
      await storageSet({ generationInProgress: false, generationStartTime: null });
      notifyPopupGenerationStatus(false);
      showNotification({
        title: 'API Key Required',
        message: 'Please set your Gemini API key in the extension popup',
        type: 'warning',
        icon: '🔑',
        duration: 5000,
        actionText: 'Setup API Key',
        actionType: 'open-tab'
      });
      chrome.action.openPopup();
      return;
    }
    
    if (!avatars || avatars.length === 0) {
      // Clear generation status on early return
      await storageSet({ generationInProgress: false, generationStartTime: null });
      notifyPopupGenerationStatus(false);
      showNotification({
        title: 'Avatar Required',
        message: 'Please generate your avatar first in the extension popup',
        type: 'warning',
        icon: '👤',
        duration: 5000,
        actionText: 'Create Avatar',
        actionType: 'open-tab'
      });
      chrome.action.openPopup();
      return;
    }
    
    // Use the selected avatar if available, with better error handling
    const validAvatarIndex = Math.min(Math.max(selectedAvatarIndex || 0, 0), avatars.length - 1);
    const selectedAvatar = avatars[validAvatarIndex];
    
    if (!selectedAvatar || !selectedAvatar.url) {
      // Clear generation status on early return
      await storageSet({ generationInProgress: false, generationStartTime: null });
      notifyPopupGenerationStatus(false);
      showNotification({
        title: 'Avatar Error',
        message: 'Selected avatar is invalid. Please check your avatar settings',
        type: 'error',
        icon: '⚠️',
        duration: 5000,
        actionText: 'Fix Avatar',
        actionType: 'open-tab'
      });
      chrome.action.openPopup();
      return;
    }
    
    const baseImageUrl = selectedAvatar.url;
    
    // Convert images to base64
    const baseImageData = await imageUrlToBase64(baseImageUrl);
    
    // Handle multiple clothing images
    const clothingUrls = Array.isArray(clothingImageUrl) ? clothingImageUrl : [clothingImageUrl];
    const clothingImageData = await Promise.all(
      clothingUrls.map(url => imageUrlToBase64(url))
    );
    
    // Generate try-on image using Gemini API
    const generatedImageUrl = await callGeminiAPI(baseImageData, clothingImageData, apiKey, options);
    
    // Store the generated image with avatar info
    await storeGeneratedOutfit(generatedImageUrl, clothingUrls, selectedAvatar);
    
    // Clear generation status
    await storageSet({ generationInProgress: false, generationStartTime: null });
    
    // Notify popup about generation status change
    notifyPopupGenerationStatus(false);
    
    // Show success notification with option to view
    showNotification({
      title: 'Outfit Ready!',
      message: `Virtual try-on ready using ${selectedAvatar.pose} avatar`,
      type: 'success',
      icon: '👕',
      duration: 4000,
      actionText: 'View Result',
      actionType: 'view-outfits'
    });
    
    // Open popup to show result and switch to outfits tab
    chrome.action.openPopup();
    
    // Send a message to switch to outfits tab after generation
    try {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'switchToOutfits'
        });
      }, 100);
    } catch (error) {
      console.log('Popup may not be ready yet, tab switch will happen on popup load');
    }
  } catch (error) {
    // Re-throw error to be handled by the main function
    throw error;
  }
}

// Helper function to notify popup about generation status changes
function notifyPopupGenerationStatus(inProgress, startTime = null) {
  try {
    chrome.runtime.sendMessage({
      action: 'generationStatusChanged',
      inProgress: inProgress,
      startTime: startTime || (inProgress ? new Date().toISOString() : null)
    });
  } catch (error) {
    // Popup might not be open, that's fine
    console.log('Could not notify popup (popup may be closed):', error.message);
  }
}

// Convert image URL to base64
async function imageUrlToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const blob = await response.blob();
    
    // Compress image if it's too large
    const compressedBlob = await compressImageIfNeeded(blob);
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:image/... prefix
      reader.readAsDataURL(compressedBlob);
    });
  } catch (err) {
    console.error('CORS/image fetch error:', err);
    throw err;
  }
}

// Process image for notification and update it when ready
async function processImageForNotification(imageUrl) {
  try {
    // Try to convert to data URL to avoid CORS issues
    const response = await fetch(imageUrl);
    if (response.ok) {
      const blob = await response.blob();
      // Use a smaller compression for notifications
      const compressedBlob = await compressImageForNotification(blob);
      const notificationImageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(compressedBlob);
      });
      
      // Update the notification with the processed image
      updateNotificationImage(notificationImageUrl);
    }
  } catch (error) {
    console.warn('Failed to process image for notification:', error);
    // Could potentially update with original URL as fallback
    // updateNotificationImage(imageUrl);
  }
}

// Update notification image if popup is in notification mode
async function updateNotificationImage(imageUrl) {
  try {
    // Send message to popup to update image
    chrome.runtime.sendMessage({
      action: 'updateNotificationImage',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.log('Could not update notification image (popup may be closed):', error);
  }
}

// Compress image for notifications (smaller and faster)
async function compressImageForNotification(blob) {
  const MAX_SIZE_KB = 100; // Much smaller for notifications
  const MAX_DIMENSION = 200; // Small thumbnail size for notifications
  
  // Always compress for notifications to ensure fast loading
  return new Promise((resolve, reject) => {
    try {
      // Create an offscreen canvas for background script context
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext('2d');
      
      createImageBitmap(blob).then(imageBitmap => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = imageBitmap;
        const aspectRatio = width / height;
        
        // Always resize for notifications
        if (width > height) {
          width = MAX_DIMENSION;
          height = width / aspectRatio;
        } else {
          height = MAX_DIMENSION;
          width = height * aspectRatio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Fill with white background to remove any transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Draw and compress aggressively for notifications
        ctx.drawImage(imageBitmap, 0, 0, width, height);
        canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 }).then(resolve);
      }).catch(reject);
      
    } catch (error) {
      // Fallback: return original blob if compression fails
      console.warn('Notification image compression failed, using original:', error);
      resolve(blob);
    }
  });
}

// Compress image if it exceeds size limits and convert to JPEG
async function compressImageIfNeeded(blob) {
  const MAX_SIZE_MB = 8; // More aggressive limit for API requests
  const MAX_DIMENSION = 1024; // Maximum width or height
  
  // Always convert to JPEG to avoid transparency issues
  const shouldCompress = blob.size > MAX_SIZE_MB * 1024 * 1024;
  const isPNG = blob.type === 'image/png';
  
  if (!shouldCompress && !isPNG) {
    return blob; // No compression or conversion needed
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Create an offscreen canvas for background script context
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext('2d');
      
      createImageBitmap(blob).then(imageBitmap => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = imageBitmap;
        const aspectRatio = width / height;
        
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            width = MAX_DIMENSION;
            height = width / aspectRatio;
          } else {
            height = MAX_DIMENSION;
            width = height * aspectRatio;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Fill with white background to remove any transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Draw and compress
        ctx.drawImage(imageBitmap, 0, 0, width, height);
        canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 }).then(resolve);
      }).catch(reject);
      
    } catch (error) {
      // Fallback: return original blob if compression fails
      console.warn('Image compression failed, using original:', error);
      resolve(blob);
    }
  });
}

// Generate dynamic prompt for clothing try-on
function generateTryOnPrompt(options = {}) {
  const {
    element1 = 'person (body, face, hairstyle, skin tone, and pose)',
    element2 = 'clothing item',
    elements2 = null, // Array of multiple clothing items
    finalScene = 'realistic photograph showing the person wearing the new clothing item with proper fit, natural draping, and realistic shadows',
    background = 'clean, neutral background',
    style = 'high-quality, photorealistic result that looks like a professional fashion photograph',
    multipleItems = false
  } = options;
  
  // Handle multiple clothing items
  let clothingDescription;
  if (elements2 && Array.isArray(elements2) && elements2.length > 0) {
    if (elements2.length === 1) {
      clothingDescription = elements2[0];
    } else if (elements2.length === 2) {
      clothingDescription = `${elements2[0]} and ${elements2[1]}`;
    } else {
      const lastItem = elements2[elements2.length - 1];
      const otherItems = elements2.slice(0, -1).join(', ');
      clothingDescription = `${otherItems}, and ${lastItem}`;
    }
  } else {
    clothingDescription = element2;
  }
  
  // Adjust final scene description for multiple items
  let sceneDescription = finalScene;
  if (elements2 && elements2.length > 1) {
    sceneDescription = `realistic photograph showing the person wearing the new clothing items with proper fit, natural draping, and realistic shadows. Ensure all clothing items work well together as a cohesive outfit`;
  }
  
  // Handle multiple source images
  let sourceDescription;
  if (multipleItems) {
    sourceDescription = `Take the ${element1} from the first image and combine it with the ${clothingDescription} from the subsequent images`;
  } else {
    sourceDescription = `Take the ${element1} from image 1 and place it with the ${clothingDescription} from image 2`;
  }
  
  return `Create a new image by combining the elements from the provided images. ${sourceDescription}. The final image should be a ${sceneDescription}. Maintain the person's original body proportions, facial features, and skin tone. 

CRITICAL CLOTHING REPLACEMENT INSTRUCTIONS:
- Completely remove and replace any existing clothing that conflicts with the new clothing items
- If applying a skirt, dress, or shorts: completely remove any existing pants/shorts/bottoms from the base image
- If applying pants or jeans: completely remove any existing shorts/bottoms from the base image  
- If applying a top/shirt/blouse: completely remove any existing shirts/tops from the base image
- If applying a dress: remove both existing tops and bottoms from the base image
- If applying outerwear (jacket, coat, blazer): layer it properly over existing clothing without removing the base garments
- Ensure no parts of conflicting garments are visible underneath or around the edges of new clothing
- Pay special attention to leg area when applying bottoms - no original shorts/pants should show through

IMAGE SPECIFICATIONS:
- Generate the image in portrait orientation with dimensions 768 pixels wide by 1152 pixels tall
- Use JPEG format for the output image
- Ensure high quality and clarity at these specific dimensions

Ensure proper fit, natural draping, realistic shadows, and seamless integration. The person should appear to be naturally wearing only the new clothing items (plus any appropriate undergarments). Use a ${background}. Generate a ${style}.`;
}

// Helper function for creating multi-item try-on prompts
function createMultiItemPrompt(clothingItems, options = {}) {
  return generateTryOnPrompt({
    ...options,
    elements2: clothingItems,
    multipleItems: clothingItems.length > 1
  });
}

// Example usage scenarios:
// Single item: generateTryOnPrompt()
// Multiple items: createMultiItemPrompt(['red sweater', 'blue jeans', 'white sneakers'])
// Custom elements: generateTryOnPrompt({ elements2: ['formal blazer', 'dress pants'], multipleItems: true })

// Helper function for multi-item try-on generation
async function generateMultiItemTryOn(clothingUrls, clothingDescriptions = []) {
  if (!Array.isArray(clothingUrls) || clothingUrls.length === 0) {
    throw new Error('clothingUrls must be a non-empty array');
  }
  
  const options = {
    clothingItems: clothingDescriptions.length > 0 ? clothingDescriptions : 
      clothingUrls.map((_, index) => `clothing item ${index + 1}`),
    promptOptions: {
      multipleItems: clothingUrls.length > 1
    }
  };
  
  return await generateTryOnImage(clothingUrls, options);
}

// Call Gemini API for image generation
async function callGeminiAPI(baseImageData, clothingImageData, apiKey, options = {}) {
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
  
  // Handle multiple clothing images
  const clothingImages = Array.isArray(clothingImageData) ? clothingImageData : [clothingImageData];
  const { clothingItems = [], promptOptions = {} } = options;
  
  // Generate appropriate prompt based on number of items
  const prompt = clothingItems.length > 0 
    ? createMultiItemPrompt(clothingItems, promptOptions)
    : generateTryOnPrompt(promptOptions);
  
  // Build the request parts array with base image and all clothing images
  const requestParts = [
    {
      text: prompt
    },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: baseImageData
      }
    }
  ];
  
  // Add all clothing images
  clothingImages.forEach(imageData => {
    requestParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageData
      }
    });
  });
  
  const requestBody = {
    contents: [
      {
        parts: requestParts
      }
    ],
    generationConfig: {
      responseModalities: ['image']
    }
  };
  
  const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let errorMessage = `API request failed: ${response.status}`;
    
    // Parse error details for better user messages
    try {
      const errorData = JSON.parse(text);
      if (errorData.error) {
        if (errorData.error.message?.includes('Resource::kQuotaBytes quota exceeded') || 
            errorData.error.message?.includes('quotaBytes')) {
          errorMessage = 'Resource::kQuotaBytes quota exceeded';
        } else if (errorData.error.code === 429) {
          errorMessage = 'API quota exceeded. Please check your billing or try again later.';
        } else if (errorData.error.code === 401 || errorData.error.code === 403) {
          errorMessage = 'Invalid or expired API key. Please update your API key.';
        } else if (errorData.error.code === 400 && errorData.error.message?.includes('API key not valid')) {
          errorMessage = 'Invalid API key. Please check your key and try again.';
        }
      }
    } catch (e) {
      // Keep original error message if parsing fails
      errorMessage += ` ${text}`;
    }
    
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  
  // Extract generated image from response
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const generatedImage = parts.find(part => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/'));
  if (!generatedImage) {
    throw new Error('No image generated in response');
  }
  
  // Always use JPEG format to avoid transparency issues
  const base64 = generatedImage.inlineData.data || '';
  return `data:image/jpeg;base64,${base64}`;
}

// Store generated outfit (supports multiple clothing items)
async function storeGeneratedOutfit(generatedImageUrl, originalClothingUrls, usedAvatar) {
  const { generatedOutfits = [] } = await storageGet('generatedOutfits');
  
  // Ensure originalClothingUrls is always an array
  const clothingUrls = Array.isArray(originalClothingUrls) ? originalClothingUrls : [originalClothingUrls];
  
  generatedOutfits.push({
    generatedImage: generatedImageUrl,
    originalClothing: clothingUrls.length === 1 ? clothingUrls[0] : clothingUrls, // Backward compatibility
    clothingItems: clothingUrls, // New field for multiple items
    itemCount: clothingUrls.length,
    usedAvatar: {
      pose: usedAvatar.pose,
      createdAt: usedAvatar.createdAt
    },
    createdAt: new Date().toISOString()
  });
  
  await storageSet({ generatedOutfits });
}

// The popup-based notification system handles all notification interactions
// No need for separate notification event handlers

// Notification management using popup system
async function showNotification(data) {
  console.log('showNotification called with:', data);
  
  try {
    // Store notification data for the popup to pick up
    await chrome.storage.local.set({ notificationData: data });
    
    // Open popup in notification mode
    console.log('Opening popup in notification mode...');
    chrome.action.openPopup();
    
    console.log('Notification popup opened');

  } catch (error) {
    console.error('Error creating notification popup:', error);
    
    // Fallback to simple browser notification if popup fails
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: data.title || 'Try-it-on',
        message: data.message || 'Notification'
      });
    } catch (fallbackError) {
      console.error('Fallback notification also failed:', fallbackError);
    }
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    // Open the popup when keyboard shortcut is pressed
    chrome.action.openPopup();
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle generation status requests
  if (message.action === 'getGenerationStatus') {
    storageGet(['generationInProgress', 'generationStartTime']).then(result => {
      sendResponse({
        inProgress: result.generationInProgress || false,
        startTime: result.generationStartTime || null
      });
    }).catch(error => {
      console.error('Error getting generation status:', error);
      sendResponse({ inProgress: false, startTime: null });
    });
    return true; // Keep message port open for async response
  }

  // Handle notification requests
  if (message.action === 'showNotification') {
    showNotification(message.data);
    sendResponse({ success: true });
    return true;
  }

  // Handle test notification requests (for development/testing)
  if (message.action === 'testNotification') {
    console.log('Test notification requested');
    showNotification({
      title: 'Test Notification',
      message: 'This is a test notification from the background script!',
      type: 'info',
      duration: 5000,
      actionText: 'Open Extension',
      actionType: 'open-tab'
    });
    sendResponse({ success: true });
    return true;
  }
});
