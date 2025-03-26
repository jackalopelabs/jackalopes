import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
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
export const RemotePlayer = React.memo(
  forwardRef<RemotePlayerMethods, RemotePlayerProps>(
    ({ id, initialPosition, initialRotation }, ref) => {
      const groupRef = useRef<THREE.Group>(null);
      const meshRef = useRef<THREE.Mesh>(null);
      // Only store position/rotation in refs to avoid state updates completely
      const positionRef = useRef<[number, number, number]>(initialPosition);
      const rotationRef = useRef<[number, number, number, number]>(initialRotation);
      
      // Target values for smoother interpolation
      const targetPosition = useRef<[number, number, number]>(initialPosition);
      const targetRotation = useRef<[number, number, number, number]>(initialRotation);
      
      // Track the last significant update for debugging
      const lastUpdateRef = useRef<number>(Date.now());
      
      // For rotation visualization, track which way the player is facing
      const directionRef = useRef(new THREE.Vector3(0, 0, -1));
      
      // Detect Safari browser
      const isSafari = useMemo(() => {
        const ua = navigator.userAgent.toLowerCase();
        return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1;
      }, []);
      
      // Create an interface for external updates - no state dependencies
      useImperativeHandle(ref, () => ({
        updateTransform: (newPosition: [number, number, number], newRotation: [number, number, number, number]) => {
          // Update target values without triggering state changes
          targetPosition.current = newPosition;
          
          // Normalize the new rotation quaternion
          const newQuat = new THREE.Quaternion(
            newRotation[0], newRotation[1], newRotation[2], newRotation[3]
          ).normalize();
          
          // Convert back to array
          const normalizedRotation: [number, number, number, number] = [
            newQuat.x, newQuat.y, newQuat.z, newQuat.w
          ];
          
          // Update target rotation with normalized values
          targetRotation.current = normalizedRotation;
          
          // For large position changes, update immediately (teleportation)
          const distance = Math.sqrt(
            Math.pow(positionRef.current[0] - newPosition[0], 2) +
            Math.pow(positionRef.current[1] - newPosition[1], 2) +
            Math.pow(positionRef.current[2] - newPosition[2], 2)
          );
          
          // Check for large rotation changes
          const currentQuat = new THREE.Quaternion(
            rotationRef.current[0], rotationRef.current[1], 
            rotationRef.current[2], rotationRef.current[3]
          );
          
          // Dot product close to -1 means nearly opposite rotation (180 degrees)
          const quatDot = currentQuat.dot(newQuat);
          const largeRotationChange = quatDot < 0.5; // Very large rotation difference
          
          // For big changes (>5 units) or large rotation shifts, teleport instantly
          if (distance > 5 || largeRotationChange) {
            positionRef.current = [...newPosition];
            rotationRef.current = [...normalizedRotation];
            lastUpdateRef.current = Date.now();
            
            // Force update group position immediately (outside of frame loop)
            if (groupRef.current) {
              groupRef.current.position.set(...newPosition);
              
              // Apply rotation to the group
              groupRef.current.quaternion.copy(newQuat);
            }
          }
        }
      }), []); // No dependencies for the ref to avoid recreating
      
      // Frame-by-frame interpolation for smooth movement
      useFrame((_state: RootState, delta: number) => {
        if (!groupRef.current) return;
        
        // Lerp speed - adjust for smoothness (higher = faster response)
        const lerpSpeed = 5; // Reduced from 8 for smoother movement
        const smoothingFactor = Math.min(1, delta * lerpSpeed);
        
        // Interpolate position (lerp)
        const newX = positionRef.current[0] + (targetPosition.current[0] - positionRef.current[0]) * smoothingFactor;
        const newY = positionRef.current[1] + (targetPosition.current[1] - positionRef.current[1]) * smoothingFactor;
        const newZ = positionRef.current[2] + (targetPosition.current[2] - positionRef.current[2]) * smoothingFactor;
        
        // Apply to group (not just mesh)
        groupRef.current.position.set(newX, newY, newZ);
        
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
        
        // Ensure quaternions are normalized properly (important for cross-browser compatibility)
        currentQuat.normalize();
        targetQuat.normalize();
        
        // Check if the quaternions represent significantly different rotations
        // Use dot product to measure difference - it's 1 when they're identical and -1 when they're opposite
        const quatDot = currentQuat.dot(targetQuat);
        const significantChange = quatDot < 0.99;
        
        // Apply only if quaternions are different - slower rotation for stability
        if (significantChange) {
          // Choose the shorter path for interpolation
          // If dot product is negative, negate one of the quaternions to avoid long path
          if (quatDot < 0) {
            targetQuat.set(-targetQuat.x, -targetQuat.y, -targetQuat.z, -targetQuat.w);
          }
          
          // Use a smaller factor for rotation to reduce spinning sensation
          // Safari may need a more gentle smoothing factor for stability
          const rotationSmoothingFactor = isSafari 
            ? Math.min(1, delta * 2.5) // Slightly faster for Safari to keep up
            : Math.min(1, delta * 2);  // Standard for other browsers
          
          // Use slerp with proper normalization
          currentQuat.slerp(targetQuat, rotationSmoothingFactor);
          currentQuat.normalize(); // Ensure result is normalized
          
          // Apply to group, not mesh
          groupRef.current.quaternion.copy(currentQuat);
          
          // Update ref without state changes
          rotationRef.current = [
            currentQuat.x,
            currentQuat.y,
            currentQuat.z,
            currentQuat.w
          ];
          
          // Update direction reference for visualization
          const forward = new THREE.Vector3(0, 0, -1);
          forward.applyQuaternion(currentQuat);
          directionRef.current.copy(forward);
        }
      });
      
      // Log when the player is mounted (only once per player)
      useEffect(() => {
        console.log(`Remote player ${id} mounted at position:`, initialPosition);
        
        return () => {
          console.log(`Remote player ${id} unmounted`);
        };
      }, [id]); // Only run on mount/unmount, dependent only on id
      
      // Generate a consistent color based on player ID
      const playerColor = useMemo(() => {
        // Simple hash function to get consistent color from ID
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Convert to RGB
        const r = (hash & 0xFF0000) >> 16;
        const g = (hash & 0x00FF00) >> 8;
        const b = hash & 0x0000FF;
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }, [id]);
      
      return (
        <group ref={groupRef} position={initialPosition}>
          {/* Player body - more recognizable character */}
          <group>
            {/* Player head */}
            <mesh position={[0, 1.7, 0]} castShadow>
              <sphereGeometry args={[0.4, 16, 16]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Player body */}
            <mesh position={[0, 0.9, 0]} castShadow>
              <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Player arm - left */}
            <mesh position={[-0.6, 0.9, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
              <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Player arm - right */}
            <mesh position={[0.6, 0.9, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
              <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Direction indicator (forward pointer) */}
            <mesh position={[0, 1.2, -0.5]} castShadow>
              <coneGeometry args={[0.2, 0.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            
            {/* Stable nametag container - attached to group instead of mesh */}
            <Html position={[0, 2.5, 0]} center sprite distanceFactor={15} 
                  occlude={false} zIndexRange={[0, 100]}>
              <div style={{
                color: 'white',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '5px 8px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                userSelect: 'none',
                textShadow: '0 0 2px black',
                fontWeight: 'bold',
                border: `1px solid ${playerColor}`
              }}>
                {id.substring(0, 8)}
              </div>
            </Html>
          </group>
        </group>
      );
    }
  ),
  // Custom comparison function for React.memo
  // Only re-render if player ID changes, ignore position/rotation changes
  (prevProps, nextProps) => {
    return prevProps.id === nextProps.id;
  }
); 