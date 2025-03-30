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
export const MercModelPath = 'src/assets/characters/merc.glb';
export const JackalopeModelPath = 'src/assets/characters/jackalope.glb';
export const FpsArmsModelPath = '/fps.glb'; // FPS arms model is still in public directory

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
  Trees: {
    SimpleTree: 'src/assets/environment/simple-tree.glb', // For future use with actual 3D models
    // Lowpoly tree models
    LowpolyTrees: [
      // All lowpoly nature assets (without snow models)
      'src/assets/environment/lowpoly_nature/BirchTree_1.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_2.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_3.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_4.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_5.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_Dead_1.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_Dead_2.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_Dead_3.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_Dead_4.gltf',
      'src/assets/environment/lowpoly_nature/BirchTree_Dead_5.gltf',
      'src/assets/environment/lowpoly_nature/BushBerries_1.gltf',
      'src/assets/environment/lowpoly_nature/BushBerries_2.gltf',
      'src/assets/environment/lowpoly_nature/Bush_1.gltf',
      'src/assets/environment/lowpoly_nature/Bush_2.gltf',
      'src/assets/environment/lowpoly_nature/CactusFlowers_1.gltf',
      'src/assets/environment/lowpoly_nature/CactusFlowers_2.gltf',
      'src/assets/environment/lowpoly_nature/CactusFlowers_3.gltf',
      'src/assets/environment/lowpoly_nature/CactusFlowers_4.gltf',
      'src/assets/environment/lowpoly_nature/CactusFlowers_5.gltf',
      'src/assets/environment/lowpoly_nature/Cactus_1.gltf',
      'src/assets/environment/lowpoly_nature/Cactus_2.gltf',
      'src/assets/environment/lowpoly_nature/Cactus_3.gltf',
      'src/assets/environment/lowpoly_nature/Cactus_4.gltf',
      'src/assets/environment/lowpoly_nature/Cactus_5.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_1.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_2.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_3.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_4.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_5.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_Dead_1.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_Dead_2.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_Dead_3.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_Dead_4.gltf',
      'src/assets/environment/lowpoly_nature/CommonTree_Dead_5.gltf',
      'src/assets/environment/lowpoly_nature/Corn_1.gltf',
      'src/assets/environment/lowpoly_nature/Corn_2.gltf',
      'src/assets/environment/lowpoly_nature/Flowers.gltf',
      'src/assets/environment/lowpoly_nature/Grass_1.gltf',
      'src/assets/environment/lowpoly_nature/Grass_2.gltf',
      'src/assets/environment/lowpoly_nature/Grass_3.gltf',
      'src/assets/environment/lowpoly_nature/Lilypad.gltf',
      'src/assets/environment/lowpoly_nature/PalmTree_1.gltf',
      'src/assets/environment/lowpoly_nature/PalmTree_2.gltf',
      'src/assets/environment/lowpoly_nature/PalmTree_3.gltf',
      'src/assets/environment/lowpoly_nature/PalmTree_4.gltf',
      'src/assets/environment/lowpoly_nature/PineTree_1.gltf',
      'src/assets/environment/lowpoly_nature/PineTree_2.gltf',
      'src/assets/environment/lowpoly_nature/PineTree_3.gltf',
      'src/assets/environment/lowpoly_nature/PineTree_4.gltf',
      'src/assets/environment/lowpoly_nature/PineTree_5.gltf',
      'src/assets/environment/lowpoly_nature/Plant_1.gltf',
      'src/assets/environment/lowpoly_nature/Plant_2.gltf',
      'src/assets/environment/lowpoly_nature/Plant_3.gltf',
      'src/assets/environment/lowpoly_nature/Plant_4.gltf',
      'src/assets/environment/lowpoly_nature/Plant_5.gltf',
      'src/assets/environment/lowpoly_nature/Rock_1.gltf',
      'src/assets/environment/lowpoly_nature/Rock_2.gltf',
      'src/assets/environment/lowpoly_nature/Rock_3.gltf',
      'src/assets/environment/lowpoly_nature/Rock_4.gltf',
      'src/assets/environment/lowpoly_nature/Rock_5.gltf',
      'src/assets/environment/lowpoly_nature/Rock_6.gltf',
      'src/assets/environment/lowpoly_nature/Rock_7.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_1.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_2.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_3.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_4.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_5.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_6.gltf',
      'src/assets/environment/lowpoly_nature/Rock_Moss_7.gltf',
      'src/assets/environment/lowpoly_nature/TreeStump.gltf',
      'src/assets/environment/lowpoly_nature/TreeStump_Moss.gltf',
      'src/assets/environment/lowpoly_nature/Wheat.gltf',
      'src/assets/environment/lowpoly_nature/Willow_1.gltf',
      'src/assets/environment/lowpoly_nature/Willow_2.gltf',
      'src/assets/environment/lowpoly_nature/Willow_3.gltf',
      'src/assets/environment/lowpoly_nature/Willow_4.gltf',
      'src/assets/environment/lowpoly_nature/Willow_5.gltf',
      'src/assets/environment/lowpoly_nature/Willow_Dead_1.gltf',
      'src/assets/environment/lowpoly_nature/Willow_Dead_2.gltf',
      'src/assets/environment/lowpoly_nature/Willow_Dead_3.gltf',
      'src/assets/environment/lowpoly_nature/Willow_Dead_4.gltf',
      'src/assets/environment/lowpoly_nature/Willow_Dead_5.gltf',
      'src/assets/environment/lowpoly_nature/WoodLog.gltf',
      'src/assets/environment/lowpoly_nature/WoodLog_Moss.gltf'
    ]
  }
};

// Sound Assets
export const Sounds = {
  // Footstep sounds
  Footsteps: {
    // Use correct paths without a leading slash
    MercWalking: 'src/assets/audio/merc-walking.ogg',
    MercRunning: 'src/assets/audio/merc-running.ogg',
  },
  // Weapon sounds
  Weapons: {
    MercShot: 'src/assets/audio/merc-shot.ogg',
  }
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