import React, { useRef } from 'react'
import * as THREE from 'three'

// Simple Jackalope character model using basic THREE.js geometry
export const JackalopeModel = ({ 
  visible = true, 
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  scale = [1, 1, 1] as [number, number, number]
}: {
  animation?: string; // Keep parameter for compatibility
  visible?: boolean;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number] | THREE.Euler;
  scale?: [number, number, number];
}) => {
  const group = useRef<THREE.Group>(null);
  
  // Determine final position and rotation format
  const finalPosition = position instanceof THREE.Vector3 
    ? [position.x, position.y, position.z] as [number, number, number]
    : position;
    
  const finalRotation = rotation instanceof THREE.Euler
    ? [rotation.x, rotation.y, rotation.z] as [number, number, number] 
    : rotation;
  
  return (
    <group 
      ref={group} 
      visible={visible}
      name="jackalope"
      position={finalPosition}
      rotation={finalRotation}
      scale={scale}
    >
      {/* Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.6, 1.6, 0.4]} />
        <meshStandardMaterial color="#6495ED" /> {/* Blue color for jackalope */}
      </mesh>
      
      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 1.0, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#6495ED" />
      </mesh>
      
      {/* Ears/Antlers - characteristic of a jackalope */}
      <mesh castShadow position={[0.15, 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4]} />
        <meshStandardMaterial color="#4169E1" />
      </mesh>
      
      <mesh castShadow position={[-0.15, 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4]} />
        <meshStandardMaterial color="#4169E1" />
      </mesh>
      
      {/* Arms */}
      <mesh castShadow receiveShadow position={[0.4, 0.6, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#4682B4" />
      </mesh>
      
      <mesh castShadow receiveShadow position={[-0.4, 0.6, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#4682B4" />
      </mesh>
      
      {/* Legs */}
      <mesh castShadow receiveShadow position={[0.2, -0.6, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#4682B4" />
      </mesh>
      
      <mesh castShadow receiveShadow position={[-0.2, -0.6, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#4682B4" />
      </mesh>
    </group>
  );
};

/*
 * ANIMATION SUPPORT - COMMENTED OUT FOR FUTURE USE
 * 
 * To enable animations:
 * 1. Import useAnimations from '@react-three/drei'
 * 2. Uncomment the animation-related code below and in the component
 * 3. Add animations to the jackalope.glb model
 */

/*
import { useAnimations } from '@react-three/drei'

// In the component:
const { scene, animations } = useGLTF(JackalopeModelPath);
const { actions, mixer } = useAnimations(animations, scene);
const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);

// Handle animation changes
useEffect(() => {
  if (!mixer || !actions) return;
  
  // Log the requested animation
  console.log(`Jackalope animation requested: "${animation}"`);
  console.log(`Available jackalope actions:`, Object.keys(actions));
  
  // Handle animations directly based on name
  // Special handling for idle - always use 'idle' animation
  if (animation === 'idle') {
    if (actions['idle']) {
      console.log(`Playing exact jackalope idle animation`);
      const idleAction = actions['idle'];
      
      // Check if already playing this animation
      if (currentAnimation !== 'idle') {
        // If walk is currently playing, fade it out
        if (actions['walk'] && actions['walk'].isRunning()) {
          // Longer fade for smoother transition (0.5s)
          actions['walk'].fadeOut(0.5);
        }
        
        // Start idle with fade-in
        idleAction.reset().fadeIn(0.5).play();
        idleAction.timeScale = 1.0;
        setCurrentAnimation('idle');
      } else {
        // Already playing idle, just ensure it's active
        if (!idleAction.isRunning()) {
          idleAction.reset().fadeIn(0.3).play();
          idleAction.timeScale = 1.0;
        }
      }
    } else {
      console.warn('Idle animation not found for jackalope');
    }
  } 
  // For walk animation
  else if (animation === 'walk') {
    // ... similar handling for walk
  }
  // For run animation 
  else if (animation === 'run') {
    // ... similar handling for run
  }
}, [animation, actions, mixer]);
*/ 