(function(global){
  const ns = global.CTO = global.CTO || {};
  ns.image = ns.image || {};

  ns.image.convertToJPEG = async function convertToJPEG(dataUrl, quality = 0.9) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegDataUrl);
      };
      img.src = dataUrl;
    });
  };

  ns.image.compressToBase64JPEG = async function compressToBase64JPEG(file, options) {
    const { maxDimension = 1200, targetMaxBytes = 1200000, quality = 0.85, minQuality = 0.5 } = options || {};
    const dataUrl = await ns.image.readFileAsDataURL(file);
    const image = await ns.image.loadImageFromDataURL(dataUrl);
    const { width, height } = ns.image.getScaledDimensions(image.width, image.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(image, 0, 0, width, height);
    let currentQuality = quality;
    let blob = await ns.image.canvasToBlob(canvas, 'image/jpeg', currentQuality);
    while (blob && blob.size > targetMaxBytes && currentQuality > minQuality) {
      currentQuality = Math.max(minQuality, currentQuality - 0.1);
      blob = await ns.image.canvasToBlob(canvas, 'image/jpeg', currentQuality);
    }
    if (!blob) {
      const err = new Error('Compression failed');
      err.userMessage = 'Image compression failed. Try different photos.';
      throw err;
    }
    const base64Data = await ns.image.blobToBase64Data(blob);
    return base64Data;
  };

  ns.image.readFileAsDataURL = function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  };

  ns.image.loadImageFromDataURL = function loadImageFromDataURL(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  };

  ns.image.getScaledDimensions = function getScaledDimensions(origW, origH, maxDim) {
    if (origW <= maxDim && origH <= maxDim) return { width: origW, height: origH };
    const scale = origW > origH ? maxDim / origW : maxDim / origH;
    return { width: Math.round(origW * scale), height: Math.round(origH * scale) };
  };

  ns.image.canvasToBlob = function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, quality);
    });
  };

  ns.image.blobToBase64Data = function blobToBase64Data(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = String(result).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  };

  ns.image.imageUrlToBase64 = async function imageUrlToBase64(imageUrl) {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type });
    const compressionOptions = { maxDimension: 1024, targetMaxBytes: 100000, quality: 0.6, minQuality: 0.4 };
    const compressedBase64 = await ns.image.compressToBase64JPEG(file, compressionOptions);
    return compressedBase64;
  };
})(window); 