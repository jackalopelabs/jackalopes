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
export const RemotePlayer = React.memo(forwardRef<RemotePlayerMethods, RemotePlayerProps>(
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
          
          // Force update group position immediately (outside of frame loop)
          if (groupRef.current) {
            groupRef.current.position.set(...newPosition);
            
            // Apply rotation to the group
            const quaternion = new THREE.Quaternion(
              newRotation[0], newRotation[1], newRotation[2], newRotation[3]
            );
            groupRef.current.quaternion.copy(quaternion);
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
      
      // Apply only if quaternions are different - slower rotation for stability
      if (!currentQuat.equals(targetQuat)) {
        // Use a smaller factor for rotation to reduce spinning sensation
        const rotationSmoothingFactor = Math.min(1, delta * 3); // Even smoother rotation
        currentQuat.slerp(targetQuat, rotationSmoothingFactor);
        
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
    }, [id, initialPosition]); // Only run on mount/unmount and position ref
    
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
)); 