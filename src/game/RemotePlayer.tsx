import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, RootState } from '@react-three/fiber';

// Interface for RemotePlayer props
export interface RemotePlayerProps {
  id: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number, number];
}

// Interface for the exposed methods
export interface RemotePlayerMethods {
  updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void;
}

// Remote Player Component
export const RemotePlayer = React.memo(forwardRef<RemotePlayerMethods, RemotePlayerProps>(
  ({ id, initialPosition, initialRotation }, ref) => {
    const meshRef = useRef<THREE.Mesh>(null);
    // Only store position/rotation in refs to avoid state updates completely
    const positionRef = useRef<[number, number, number]>(initialPosition);
    const rotationRef = useRef<[number, number, number, number]>(initialRotation);
    
    // Target values for smoother interpolation
    const targetPosition = useRef<[number, number, number]>(initialPosition);
    const targetRotation = useRef<[number, number, number, number]>(initialRotation);
    
    // Track the last significant update for debugging
    const lastUpdateRef = useRef<number>(Date.now());
    
    // Create an interface for external updates - no state dependencies
    useImperativeHandle(ref, () => ({
      updateTransform: (newPosition: [number, number, number], newRotation: [number, number, number, number]) => {
        // Update target values without triggering state changes
        targetPosition.current = newPosition;
        targetRotation.current = newRotation;
        
        // For large position changes, update immediately (teleportation)
        const distance = Math.sqrt(
          Math.pow(positionRef.current[0] - newPosition[0], 2) +
          Math.pow(positionRef.current[1] - newPosition[1], 2) +
          Math.pow(positionRef.current[2] - newPosition[2], 2)
        );
        
        // For big changes (>5 units), teleport instantly
        if (distance > 5) {
          positionRef.current = [...newPosition];
          rotationRef.current = [...newRotation];
          lastUpdateRef.current = Date.now();
          
          // Force update mesh position immediately (outside of frame loop)
          if (meshRef.current) {
            meshRef.current.position.set(...newPosition);
            meshRef.current.quaternion.set(...newRotation);
          }
        }
      }
    }), []); // No dependencies for the ref to avoid recreating
    
    // Frame-by-frame interpolation for smooth movement
    useFrame((_state: RootState, delta: number) => {
      if (!meshRef.current) return;
      
      // Lerp speed - adjust for smoothness (higher = faster response)
      const lerpSpeed = 8;
      const smoothingFactor = Math.min(1, delta * lerpSpeed);
      
      // Interpolate position (lerp)
      const newX = positionRef.current[0] + (targetPosition.current[0] - positionRef.current[0]) * smoothingFactor;
      const newY = positionRef.current[1] + (targetPosition.current[1] - positionRef.current[1]) * smoothingFactor;
      const newZ = positionRef.current[2] + (targetPosition.current[2] - positionRef.current[2]) * smoothingFactor;
      
      // Apply to mesh
      meshRef.current.position.set(newX, newY, newZ);
      
      // Update local ref without state changes
      positionRef.current = [newX, newY, newZ];
      
      // Interpolate rotation (slerp)
      const currentQuat = new THREE.Quaternion(
        rotationRef.current[0],
        rotationRef.current[1],
        rotationRef.current[2],
        rotationRef.current[3]
      );
      
      const targetQuat = new THREE.Quaternion(
        targetRotation.current[0],
        targetRotation.current[1],
        targetRotation.current[2],
        targetRotation.current[3]
      );
      
      // Apply only if quaternions are different
      if (!currentQuat.equals(targetQuat)) {
        currentQuat.slerp(targetQuat, smoothingFactor);
        meshRef.current.quaternion.copy(currentQuat);
        
        // Update ref without state changes
        rotationRef.current = [
          currentQuat.x,
          currentQuat.y,
          currentQuat.z,
          currentQuat.w
        ];
      }
    });
    
    // Log when the player is mounted (only once per player)
    useEffect(() => {
      console.log(`Remote player ${id} mounted at position:`, initialPosition);
      
      return () => {
        console.log(`Remote player ${id} unmounted`);
      };
    }, [id, initialPosition]); // Only run on mount/unmount and position ref
    
    return (
      <group>
        {/* Player body */}
        <mesh ref={meshRef} position={initialPosition} castShadow>
          {/* Player head */}
          <mesh position={[0, 1.7, 0]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color={"#ff48b2"} />
          </mesh>
          
          {/* Player body */}
          <mesh position={[0, 0.9, 0]}>
            <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
            <meshStandardMaterial color={"#30a2ff"} />
          </mesh>
          
          {/* Name tag */}
          <Html position={[0, 2.3, 0]} center sprite>
            <div style={{
              color: 'white',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '2px 5px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              fontSize: '12px',
              fontFamily: 'Arial, sans-serif',
              userSelect: 'none',
              textShadow: '0 0 2px black',
            }}>
              {id.substring(0, 8)}
            </div>
          </Html>
        </mesh>
      </group>
    );
  }
)); 