import React, { useRef, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Import assets from centralized asset index
import { JackalopeModelPath } from '../assets'

// This component will handle the jackalope character - static model for now
export const JackalopeModel = ({ 
  animation = 'idle', // Keep parameter for future animation support
  visible = true, 
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  scale = [1, 1, 1] as [number, number, number]
}: {
  animation?: string;
  visible?: boolean;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number] | THREE.Euler;
  scale?: [number, number, number];
}) => {
  // Load jackalope model from the assets 
  const group = useRef<THREE.Group>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  
  // Add smooth position interpolation
  const targetPosition = useRef(new THREE.Vector3());
  const currentPosition = useRef(new THREE.Vector3());
  const isInitialized = useRef(false);
  
  // Try loading the model with error handling
  const { scene } = useGLTF(JackalopeModelPath);
  
  // Log model loading success or failure
  useEffect(() => {
    if (scene) {
      console.log('Successfully loaded jackalope model:', scene);
    } else {
      setModelError('Failed to load jackalope model: scene is undefined');
    }
  }, [scene]);
  
  // Convert position and rotation to proper format
  const finalPosition = position instanceof THREE.Vector3 
    ? [position.x, position.y, position.z] as [number, number, number]
    : position;
    
  const finalRotation = rotation instanceof THREE.Euler
    ? [rotation.x, rotation.y, rotation.z] as [number, number, number] 
    : rotation;
  
  // TESTING - immediately apply position without any interpolation system
  useEffect(() => {
    if (group.current) {
      const [x, y, z] = finalPosition;
      // Log position occasionally for debugging
      if (Math.random() < 0.01) {
        console.log(`[MODEL] Directly setting position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
      }
      // Apply position directly
      group.current.position.set(x, y, z);
    }
  }, [finalPosition]);
  
  /*
  // Disable smooth interpolation for testing
  useFrame((_, delta) => {
    if (!group.current || !isInitialized.current) return;
    
    // Find a better balance between smoothness and responsiveness
    // Too high (0.95) causes visual jitter, too low (0.15) causes delay
    const lerpFactor = Math.min(30.0 * delta, 0.35); 
    
    // Interpolate current position towards target position
    currentPosition.current.lerp(targetPosition.current, lerpFactor);
    
    // Apply interpolated position to the model
    group.current.position.copy(currentPosition.current);
  });
  */
  
  // If there was an error loading the model, render a geometric bunny placeholder
  if (modelError || !scene) {
    return (
      <group 
        ref={group} 
        visible={visible} 
        // We'll use useFrame to handle position for smooth movement
        rotation={finalRotation}
        scale={scale}
      >
        {/* Geometric bunny fallback */}
        {/* Body */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.4, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Head */}
        <mesh position={[0, 0.8, 0.2]} castShadow>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Ears - left */}
        <mesh position={[-0.1, 1.1, 0.2]} rotation={[0.2, 0, -0.1]} castShadow>
          <capsuleGeometry args={[0.03, 0.4, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Ears - right */}
        <mesh position={[0.1, 1.1, 0.2]} rotation={[0.2, 0, 0.1]} castShadow>
          <capsuleGeometry args={[0.03, 0.4, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Tiny antlers - left */}
        <mesh position={[-0.1, 1, 0.3]} rotation={[0.4, 0, -0.5]} castShadow>
          <cylinderGeometry args={[0.01, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        
        {/* Tiny antlers - right */}
        <mesh position={[0.1, 1, 0.3]} rotation={[0.4, 0, 0.5]} castShadow>
          <cylinderGeometry args={[0.01, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        
        {/* Front legs */}
        <mesh position={[-0.15, 0.15, 0.1]} rotation={[0.3, 0, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.15, 0.15, 0.1]} rotation={[0.3, 0, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Back legs */}
        <mesh position={[-0.15, 0.15, -0.2]} rotation={[-0.3, 0, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.3, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.15, 0.15, -0.2]} rotation={[-0.3, 0, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.3, 4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Tail */}
        <mesh position={[0, 0.3, -0.35]} castShadow>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[-0.12, 0.85, 0.4]} castShadow>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
        <mesh position={[0.12, 0.85, 0.4]} castShadow>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  }
  
  // Return the actual model if loaded successfully
  return (
    <group 
      ref={group} 
      visible={visible} 
      // We'll use useFrame to handle position for smooth movement
      rotation={finalRotation}
      scale={scale}
    >
      <primitive object={scene} />
    </group>
  )
}

// Try preloading with error handling
try {
  useGLTF.preload(JackalopeModelPath);
  console.log('Preloaded jackalope model');
} catch (err) {
  const error = err as Error;
  console.error('Error preloading jackalope model:', error.message);
} 

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