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
  // If running in WordPress, use the assets URL from WordPress settings
  if (window.jackalopesGameSettings?.assetsUrl) {
    return `${window.jackalopesGameSettings.assetsUrl}${path}`;
  }
  
  // In development mode, use the relative path
  return `./assets/${path}`;
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

export default {
  getAssetPath,
  preloadImage,
  preloadAudio,
  getTypedAssetPath,
  AssetType
}; 