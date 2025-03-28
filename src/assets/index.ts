/**
 * Asset Import Index
 * Centralized place to manage all asset imports
 * 
 * This approach allows us to:
 * 1. Import assets from a single place
 * 2. Easily see what assets are available
 * 3. Handle asset loading with proper error boundaries
 * 4. Let Vite optimize the assets during builds
 */

// Character Models
export const MercModelPath = 'src/assets/characters/merc-walk.glb';

// Animations embedded in models
export const AnimationNames = {
  Merc: {
    Walk: 'walk', // animation clip name inside the GLB
    Idle: 'idle',
    Run: 'run',
    Jump: 'jump',
    Shoot: 'shoot',
  }
};

// Legacy separate animation files - keep for backward compatibility
export const Animations = {
  // Merc animations
  Merc: {
    Walk: 'src/assets/characters/animations/walk.fbx',
    Idle: 'src/assets/characters/animations/idle.fbx',
    Run: 'src/assets/characters/animations/run.fbx',
    Jump: 'src/assets/characters/animations/jump.fbx',
    Shoot: 'src/assets/characters/animations/shoot.fbx',
  },
  // Add other character animations here
};

// Environment Assets
export const Environment = {
  // Add environment assets here
};

// Sound Assets
export const Sounds = {
  // Add sound assets here
};

// Helper function to check if assets exist
export const checkAssetExists = async (assetPath: string): Promise<boolean> => {
  try {
    const response = await fetch(assetPath);
    return response.ok;
  } catch (error) {
    console.error(`Error checking asset: ${assetPath}`, error);
    return false;
  }
};

/**
 * Usage Example:
 * 
 * import { MercModelPath, Animations } from '../assets';
 * 
 * // Load model
 * const { scene } = useGLTF(MercModelPath);
 * 
 * // Load animation
 * fbxLoader.load(Animations.Merc.Walk, (fbx) => {
 *   // Animation loaded successfully
 * });
 */ 