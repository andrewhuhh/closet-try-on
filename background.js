 // Closet Try-On Extension Background Script

// Storage helpers (callback-based)
function storageGet(keys) {
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
}

function storageSet(items) {
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToOutfit' && info.srcUrl) {
    // Store clothing image for later use with source information
    await storeClothingImage(info.srcUrl, {
      sourceUrl: tab.url,
      sourceTitle: tab.title,
      sourceFavicon: tab.favIconUrl
    });
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Clothing Added',
      message: 'Clothing item added to your outfit collection!'
    });
  } 
  
  else if (info.menuItemId === 'tryItOn' && info.srcUrl) {
    // Always attempt to open popup when Try It On is clicked
    chrome.action.openPopup();
    
    // Check if user has avatar set up
    const { avatarGenerated } = await storageGet('avatarGenerated');
    
    if (!avatarGenerated) {
      // No avatar - show notification about setup requirement
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Setup Required',
        message: 'Please set up your avatar first in the extension popup.'
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
  } catch (error) {
    console.error('Error storing clothing image:', error);
  }
}

// Generate try-on image using Gemini API (supports multiple clothing items)
async function generateTryOnImage(clothingImageUrl, options = {}) {
  // Set generation status to loading
  await storageSet({ generationInProgress: true, generationStartTime: new Date().toISOString() });
  
  try {
    // Get stored data
    const { apiKey, avatars, selectedAvatarIndex = 0 } = await storageGet(['apiKey', 'avatars', 'selectedAvatarIndex']);
    
    if (!apiKey) {
      // Clear generation status on early return
      await storageSet({ generationInProgress: false, generationStartTime: null });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'API Key Required',
        message: 'Please set your Gemini API key in the extension popup.'
      });
      chrome.action.openPopup();
      return;
    }
    
    if (!avatars || avatars.length === 0) {
      // Clear generation status on early return
      await storageSet({ generationInProgress: false, generationStartTime: null });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Avatar Required',
        message: 'Please generate your avatar first in the extension popup.'
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
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Avatar Error',
        message: 'Selected avatar is invalid. Please check your avatar settings.'
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
    
    // Show success notification with option to view
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Try-On Complete!',
      message: `Virtual try-on ready using ${selectedAvatar.pose} avatar. Click to view!`,
      buttons: [{ title: 'View Result' }]
    });
    
    // Open popup to show result
    chrome.action.openPopup();
    
  } catch (error) {
    console.error('Error generating try-on image:', error);
    
    // Clear generation status on error
    await storageSet({ generationInProgress: false, generationStartTime: null });
    
    // Handle different types of errors
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
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: message
    });
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

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // View Result button clicked
    chrome.action.openPopup();
  }
});
