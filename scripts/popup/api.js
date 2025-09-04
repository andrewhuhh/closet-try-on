(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.api = ns.api || {};

  ns.api.validateApiKey = async function validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
      return { valid: false, message: 'Please enter an API key' };
    }
    try {
      const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hello' }] }] })
      });
      if (testResponse.ok) {
        return { valid: true, message: 'API key is valid and working' };
      } else {
        const errorText = await testResponse.text();
        let errorMessage = `API key validation failed: ${testResponse.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            if (errorData.error.code === 400 && errorData.error.message?.includes('API key not valid')) {
              errorMessage = 'Invalid API key. Please check your key and try again.';
            } else if (errorData.error.code === 429) {
              errorMessage = 'API quota exceeded. Please check your billing or try again later.';
            } else if (errorData.error.code === 403) {
              errorMessage = 'API key does not have permission to access this service.';
            }
          }
        } catch (_) {}
        return { valid: false, message: errorMessage };
      }
    } catch (error) {
      console.error('Error validating API key:', error);
      return { valid: false, message: 'Network error while validating API key. Please check your connection.' };
    }
  };

  ns.api.callAvatarGenerationAPI = async function callAvatarGenerationAPI(photoDataArray, getApiKey) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
    const { apiKey } = await getApiKey('apiKey');
    const contents = [
      {
        role: 'user',
        parts: [
          { text: 'Generate 4 realistic avatar images of this person in neutral clothing on a white background. Use the provided photos to capture identity, face, hairstyle, body type, and skin tone. Dress in plain white/grey T-shirt, black/grey/neutral shorts (not long pants), neutral shoes if visible. The shorts should be mid-thigh length for optimal outfit layering. Output 4 separate images: 1) Neutral front-facing standing, 2) Front-facing open stance, 3) Three-quarter angle, 4) Side profile. Each should be high-resolution and realistic.\n\nIMAGE SPECIFICATIONS:\n- Generate images in portrait orientation with dimensions 768 pixels wide by 1152 pixels tall\n- Use JPEG format for the output images\n- Ensure high quality and clarity at these specific dimensions' },
          ...photoDataArray.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } }))
        ]
      }
    ];
    const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { responseModalities: ['text', 'image'] } })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let errorMessage = `API request failed: ${response.status} ${text}`;
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          if (errorData.error.code === 429) errorMessage = 'API quota exceeded. Please check your billing or try again later.';
          else if (errorData.error.code === 401 || errorData.error.code === 403) errorMessage = 'Invalid API key. Please update your API key.';
        }
      } catch (_) {}
      throw new Error(errorMessage);
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const generatedImages = parts
      .filter(part => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/'))
      .map(part => {
        const mime = part.inlineData.mimeType || 'image/png';
        const base64 = part.inlineData.data || '';
        return `data:${mime};base64,${base64}`;
      });
    
    // Create avatar objects for successful generations
    const jpegAvatars = await Promise.all(
      generatedImages.map(async (dataUrl, index) => {
        const jpegDataUrl = await global.CTO.image.convertToJPEG(dataUrl);
        return { url: jpegDataUrl, pose: ['front-neutral', 'front-open', 'three-quarter', 'side-profile'][index] || 'front-neutral', createdAt: new Date().toISOString() };
      })
    );
    
    // Create placeholders for missing avatars
    const poseNames = ['front-neutral', 'front-open', 'three-quarter', 'side-profile'];
    const poseLabels = ['Neutral front-facing', 'Front-facing open stance', 'Three-quarter angle', 'Side profile'];
    const allAvatars = [];
    
    for (let i = 0; i < 4; i++) {
      if (i < jpegAvatars.length) {
        allAvatars.push(jpegAvatars[i]);
      } else {
        allAvatars.push({
          url: null,
          pose: poseNames[i],
          poseLabel: poseLabels[i],
          failed: true,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    return {
      avatars: allAvatars,
      successCount: jpegAvatars.length,
      totalRequested: 4,
      partialSuccess: jpegAvatars.length > 0 && jpegAvatars.length < 4
    };
  };

  ns.api.callMultiItemTryOnAPI = async function callMultiItemTryOnAPI(baseImageData, clothingDataArray, apiKey, sizePreference = 'fit') {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
    
    // Create size-specific instruction based on preference
    const sizeInstruction = sizePreference === 'retain' 
      ? 'Maintain the original proportions and sizing of the clothing items as they appear in the reference images. Do not resize the clothing to fit the person - keep the garments at their natural dimensions and proportions.'
      : 'Resize and adjust the clothing items to properly fit the person\'s body size, proportions, and measurements. Ensure the garments fit naturally and appropriately on the person\'s frame.';
    
    const contents = [
      {
        role: 'user',
        parts: [
          { text: `Remove existing clothing from the base image and dress the person in the provided clothing items. Layer the clothes naturally and ensure realistic fit, drape, and alignment. The first image is the person, followed by ${clothingDataArray.length} clothing items to be worn together. Preserve the person's face, hairstyle, body type, and skin tone. Use a plain white background. Generate a high-resolution, realistic photo result.\n\nSIZE FITTING INSTRUCTION:\n${sizeInstruction}\n\nIMAGE SPECIFICATIONS:\n- Generate the image in portrait orientation with dimensions 768 pixels wide by 1152 pixels tall\n- Use JPEG format for the output image\n- Ensure high quality and clarity at these specific dimensions` },
          { inlineData: { mimeType: 'image/jpeg', data: baseImageData } },
          ...clothingDataArray.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } }))
        ]
      }
    ];
    const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { responseModalities: ['text', 'image'] } })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let errorMessage = `API request failed: ${response.status}`;
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          if (errorData.error.code === 429) errorMessage = 'API quota exceeded. Please check your billing or try again later.';
          else if (errorData.error.code === 401 || errorData.error.code === 403) errorMessage = 'Invalid or expired API key. Please update your API key.';
          else if (errorData.error.code === 400 && errorData.error.message?.includes('API key not valid')) errorMessage = 'Invalid API key. Please check your key and try again.';
        }
      } catch (_) { errorMessage += ` ${text}`; }
      throw new Error(errorMessage);
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const generatedImage = parts.find(part => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/'));
    if (!generatedImage) throw new Error('No image generated in response');
    const mime = generatedImage.inlineData.mimeType || 'image/png';
    const base64 = generatedImage.inlineData.data || '';
    return `data:${mime};base64,${base64}`;
  };
})(window); 