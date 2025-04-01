/**
 * Asset loader utility for Jackalopes game
 * 
 * This utility handles asset paths in both WordPress and standalone environments.
 */

/**
 * Get the correct asset path based on environment
 * 
 * @param path - The asset path relative to assets directory
 * @returns The full path to the asset
 */
export const getAssetPath = (path: string): string => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Debug logs to help troubleshoot path resolution
  console.log(`[ASSET] Original path: ${path}`);
  
  // If running in WordPress, use the assets URL from WordPress settings
  if (window.jackalopesGameSettings?.assetsUrl) {
    // Handle WordPress mode
    const wpUrl = window.jackalopesGameSettings.assetsUrl;
    
    // Fix double "assets" in the path
    let finalPath = cleanPath;
    if (finalPath.startsWith('assets/') && wpUrl.includes('/assets/')) {
      finalPath = finalPath.substring(7); // Remove the leading "assets/"
    }

    const fullPath = `${wpUrl}${finalPath}`;
    console.log(`[ASSET] WordPress path resolved: ${fullPath}`);
    return fullPath;
  }
  
  // In development mode, use the relative path
  // Handle different path formats from the original game
  if (cleanPath.startsWith('assets/')) {
    return `./${cleanPath}`;
  }
  
  const devPath = `./assets/${cleanPath}`;
  console.log(`[ASSET] Development path resolved: ${devPath}`);
  return devPath;
};

/**
 * Resolve a model path for use in both WordPress and standalone environments
 * 
 * @param modelPath - Original model path from standalone game
 * @returns Properly resolved path for current environment
 */
export const resolveModelPath = (modelPath: string): string => {
  // Extract just the filename if it's a full path
  const filename = modelPath.split('/').pop() || modelPath;
  
  // Resolve based on environment
  return getAssetPath(`models/${filename}`);
};

/**
 * Check if an asset exists at the specified path
 * 
 * @param path - The asset path to check
 * @returns A promise that resolves to true if the asset exists
 */
export const checkAssetExists = (path: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', getAssetPath(path), true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        resolve(xhr.status === 200);
      }
    };
    xhr.send();
  });
};

/**
 * Preload an image asset
 * 
 * @param path - The asset path relative to assets directory
 * @returns A promise that resolves when the image is loaded
 */
export const preloadImage = (path: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = getAssetPath(path);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
  });
};

/**
 * Preload an audio asset
 * 
 * @param path - The asset path relative to assets directory
 * @returns A promise that resolves when the audio is loaded
 */
export const preloadAudio = (path: string): Promise<HTMLAudioElement> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = getAssetPath(path);
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = () => reject(new Error(`Failed to load audio: ${path}`));
  });
};

/**
 * Asset types for the Jackalopes game
 */
export enum AssetType {
  Model = 'models',
  Texture = 'textures',
  Sound = 'sounds',
  Image = 'images'
}

/**
 * Get the full path for a specific asset type
 * 
 * @param type - The type of asset
 * @param filename - The filename of the asset
 * @returns The full path to the asset
 */
export const getTypedAssetPath = (type: AssetType, filename: string): string => {
  return getAssetPath(`${type}/${filename}`);
};

// Create a test function to verify asset loading
export const testAssetLoading = (path: string): void => {
  console.log(`Testing asset path: ${path}`);
  console.log(`Resolved path: ${getAssetPath(path)}`);
  
  checkAssetExists(path)
    .then(exists => console.log(`Asset exists: ${exists}`))
    .catch(err => console.error(`Error checking asset: ${err}`));
};

export default {
  getAssetPath,
  resolveModelPath,
  preloadImage,
  preloadAudio,
  getTypedAssetPath,
  checkAssetExists,
  testAssetLoading,
  AssetType
}; 