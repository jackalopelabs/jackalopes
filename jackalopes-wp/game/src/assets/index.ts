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

// Import WordPress-specific asset utilities
import { getAssetPath, resolveModelPath, checkAssetExists as checkAsset } from '../utils/assetLoader';

// Update fallback model definitions with proper path resolution
export const FallbackModelBasePath = 'fallbacks';
export const FallbackMercPath = resolveModelPath(`${FallbackModelBasePath}/merc-fallback.glb`);
export const FallbackJackalopePath = resolveModelPath(`${FallbackModelBasePath}/jackalope-fallback.glb`);

// Add fallback model paths as a backup strategy - resolve for WordPress
export const FpsArmsModelPath = getAssetPath('fps.glb'); // FPS arms model is still in public directory

// Animations embedded in models
export const AnimationNames = {
  Merc: {
    Walk: 'walk', // animation clip name inside the GLB
    Idle: 'idle',
    Run: 'run',
    Jump: 'jump',
    Shoot: 'shoot',
  },
  Jackalope: {
    Idle: 'idle',
    Walk: 'walk',
    Run: 'run',
    Jump: 'jump'
  }
};

// Legacy separate animation files - keep for backward compatibility
export const Animations = {
  // Merc animations
  Merc: {
    Walk: getAssetPath('assets/characters/animations/walk.fbx'),
    Idle: getAssetPath('assets/characters/animations/idle.fbx'),
    Run: getAssetPath('assets/characters/animations/run.fbx'),
    Jump: getAssetPath('assets/characters/animations/jump.fbx'),
    Shoot: getAssetPath('assets/characters/animations/shoot.fbx'),
  },
  // Add other character animations here
};

// Environment Assets - convert all paths to use getAssetPath
export const Environment = {
  // Add environment assets here
  Trees: {
    SimpleTree: getAssetPath('assets/environment/simple-tree.glb'), // For future use with actual 3D models
    // Lowpoly tree models
    LowpolyTrees: [
      // First few trees with properly resolved paths
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_2.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_3.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_4.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_5.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_Dead_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_Dead_2.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_Dead_3.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_Dead_4.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/BirchTree_Dead_5.gltf'),
      // Continuing with properly resolved paths - a few representative items
      getAssetPath('assets/environment/lowpoly_nature/Bush_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/Bush_2.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/CommonTree_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/Rock_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/Rock_2.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/PalmTree_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/PineTree_1.gltf'),
      getAssetPath('assets/environment/lowpoly_nature/Grass_1.gltf'),
      // You can add more environment assets here as needed
    ]
  }
};

// Helper function to determine the best audio format for the browser
const getAudioPath = (oggPath: string, mp3Path: string): string => {
  // Check if running in Safari or iOS WebKit
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                   /iPad|iPhone|iPod/.test(navigator.userAgent);
  // Return the resolved path based on browser
  return isSafari ? getAssetPath(mp3Path) : getAssetPath(oggPath);
};

// Sound Assets
export const Sounds = {
  // Footstep sounds
  Footsteps: {
    // Use correctly resolved paths
    MercWalking: {
      ogg: 'assets/audio/merc-walking.ogg',
      mp3: 'assets/audio/merc-walking.mp3',
      get path() { return getAudioPath(this.ogg, this.mp3); }
    },
    MercRunning: {
      ogg: 'assets/audio/merc-running.ogg',
      mp3: 'assets/audio/merc-running.mp3',
      get path() { return getAudioPath(this.ogg, this.mp3); }
    },
  },
  // Weapon sounds
  Weapons: {
    MercShot: {
      ogg: 'assets/audio/merc-shot.ogg',
      mp3: 'assets/audio/merc-shot.mp3',
      get path() { return getAudioPath(this.ogg, this.mp3); }
    },
  }
};

// Export the checkAssetExists function from assetLoader
export const checkAssetExists = checkAsset;

// Function to determine the best model path to use
export const resolveBestModelPath = (characterType: 'merc' | 'jackalope') => {
  // Default paths 
  const defaultPath = characterType === 'merc' ? MercModelPath : JackalopeModelPath;
  
  // Use in-memory models when possible
  if (typeof window !== 'undefined' && 
      window.hasOwnProperty('__fallbackModels') && 
      window.__fallbackModels && 
      window.__fallbackModels[characterType === 'merc' ? 'red' : 'blue']) {
    console.log(`Using in-memory model for ${characterType}`);
    return defaultPath; // Return default path, but code will actually use the in-memory model
  }
  
  // Fall back to default path
  return defaultPath;
};

// Character Models - using proper GLB models with resolved paths
export const MercModelPath = getAssetPath('assets/characters/merc.glb');
export const JackalopeModelPath = getAssetPath('assets/characters/jackalope.glb');

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