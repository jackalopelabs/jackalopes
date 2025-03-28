import React, { useRef, useEffect, useState } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

// Import assets from centralized asset index
import { MercModelPath, AnimationNames } from '../assets'

// This component will handle the merc character with embedded animations
export const MercModel = ({ 
  animation = 'walk', 
  visible = true, 
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number]
}: {
  animation?: string;
  visible?: boolean;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number] | THREE.Euler;
}) => {
  // Load merc model from the assets with animations
  const group = useRef<THREE.Group>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  
  // Try loading the model with error handling
  const { scene, animations } = useGLTF(MercModelPath);
  
  // Use drei's useAnimations to handle the animation system
  const { actions, mixer } = useAnimations(animations, scene);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  
  // Log model loading success
  useEffect(() => {
    if (scene) {
      console.log('Successfully loaded merc model:', scene);
      
      if (animations && animations.length > 0) {
        console.log('Model has embedded animations:', animations.map(a => a.name).join(', '));
      } else {
        console.warn('No animations found in the model');
      }
    } else {
      setModelError('Failed to load model: scene is undefined');
    }
  }, [scene, animations]);
  
  // Handle animation changes
  useEffect(() => {
    if (!mixer || !actions) return;
    
    // Stop all current animations
    Object.values(actions).forEach(action => {
      if (action) action.fadeOut(0.2);
    });
    
    // Find the requested animation by name
    if (animation && actions[animation]) {
      console.log(`Playing animation: ${animation}`);
      actions[animation]?.reset().fadeIn(0.2).play();
      setCurrentAnimation(animation);
    } else {
      console.warn(`Animation "${animation}" not found`);
      
      // Try to find a default animation
      const availableAnimations = Object.keys(actions);
      if (availableAnimations.length > 0) {
        const defaultAnim = availableAnimations[0];
        console.log(`Using default animation: ${defaultAnim}`);
        actions[defaultAnim]?.reset().fadeIn(0.2).play();
        setCurrentAnimation(defaultAnim);
      }
    }
  }, [animation, actions, mixer]);
  
  // Convert position and rotation to proper format
  const finalPosition = position instanceof THREE.Vector3 
    ? [position.x, position.y, position.z] as [number, number, number]
    : position;
    
  const finalRotation = rotation instanceof THREE.Euler
    ? [rotation.x, rotation.y, rotation.z] as [number, number, number] 
    : rotation;
  
  // If there was an error loading the model, render a placeholder with error message
  if (modelError) {
    return (
      <group 
        ref={group} 
        visible={visible} 
        position={finalPosition}
        rotation={finalRotation}
      >
        <mesh>
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="red" />
        </mesh>
        <group position={[0, 2.5, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="red" />
          </mesh>
        </group>
      </group>
    );
  }
  
  return (
    <group 
      ref={group} 
      visible={visible} 
      position={finalPosition}
      rotation={finalRotation}
    >
      <primitive object={scene} />
      {!currentAnimation && (
        <group position={[0, 3, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="yellow" />
          </mesh>
        </group>
      )}
    </group>
  )
}

// Try preloading with error handling
try {
  useGLTF.preload(MercModelPath);
  console.log('Preloaded merc model');
} catch (err) {
  const error = err as Error;
  console.error('Error preloading merc model:', error.message);
} 