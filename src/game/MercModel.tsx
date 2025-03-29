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
        console.log('Model has embedded animations:');
        animations.forEach((anim, i) => {
          console.log(`  ${i+1}. "${anim.name}" (duration: ${anim.duration.toFixed(2)}s)`);
        });
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
    
    // Log the requested animation
    console.log(`Animation requested: "${animation}"`);
    console.log(`Available actions:`, Object.keys(actions));
    
    // Don't stop all animations immediately - instead use crossfade
    // mixer.stopAllAction();
    
    // Handle animations directly based on name
    // Special handling for idle - always use 'idle' animation
    if (animation === 'idle') {
      if (actions['idle']) {
        console.log(`Playing exact idle animation directly`);
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
        console.warn('Idle animation not found');
      }
    } 
    // For walk animation
    else if (animation === 'walk') {
      if (actions['walk']) {
        console.log(`Playing exact walk animation directly`);
        const walkAction = actions['walk'];
        
        // Check if already playing this animation
        if (currentAnimation !== 'walk') {
          // If idle is currently playing, fade it out
          if (actions['idle'] && actions['idle'].isRunning()) {
            // Longer fade for smoother transition (0.5s)
            actions['idle'].fadeOut(0.5);
          }
          
          // Start walk with fade-in
          walkAction.reset().fadeIn(0.5).play();
          walkAction.timeScale = 1.0;
          setCurrentAnimation('walk');
        } else {
          // Already playing walk, just ensure it's active
          if (!walkAction.isRunning()) {
            walkAction.reset().fadeIn(0.3).play();
            walkAction.timeScale = 1.0;
          }
        }
      } else {
        console.warn('Walk animation not found');
      }
    }
    // For run animation - speed up the walk animation
    else if (animation === 'run') {
      if (actions['walk']) {
        console.log(`Using walk animation for running (sped up)`);
        const runAction = actions['walk'];
        
        // Check if already playing walk animation
        if (currentAnimation !== 'run') {
          // If idle is playing, fade it out
          if (actions['idle'] && actions['idle'].isRunning()) {
            actions['idle'].fadeOut(0.5);
          }
          
          // Start run with fade-in
          runAction.reset().fadeIn(0.5).play();
          runAction.timeScale = 1.5; // Speed up for running
          setCurrentAnimation('run')
        } else {
          // Already playing run/walk, just ensure it's at the right speed
          if (runAction.isRunning() && runAction.timeScale !== 1.5) {
            runAction.timeScale = 1.5;
          } else if (!runAction.isRunning()) {
            runAction.reset().fadeIn(0.3).play();
            runAction.timeScale = 1.5;
          }
        }
      } else {
        console.warn('Walk animation not found for running');
      }
    }
    // Fallback to any available animation
    else {
      console.warn(`Animation "${animation}" not found, available:`, Object.keys(actions));
      
      // Try to use idle if available
      if (actions['idle']) {
        console.log(`Falling back to idle animation`);
        const idleAction = actions['idle'];
        if (idleAction) {
          idleAction.reset().fadeIn(0.3).play();
          setCurrentAnimation('idle');
        }
      } 
      // Otherwise use the first available
      else if (Object.keys(actions).length > 0) {
        const defaultAnim = Object.keys(actions)[0];
        console.log(`Falling back to first animation: ${defaultAnim}`);
        const defaultAction = actions[defaultAnim];
        if (defaultAction) {
          defaultAction.reset().fadeIn(0.3).play();
          setCurrentAnimation(defaultAnim);
        }
      }
    }

    // Log the actual state of animations after setting
    setTimeout(() => {
      // Check which animations are actually active
      if (mixer && actions) {
        console.log(`Animation state after change:`, {
          idle: actions['idle']?.isRunning() || false,
          walk: actions['walk']?.isRunning() || false,
          currentAnimation
        });
      }
    }, 100);
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