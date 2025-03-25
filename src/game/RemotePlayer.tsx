import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

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
export const RemotePlayer = forwardRef<RemotePlayerMethods, RemotePlayerProps>(
  ({ id, initialPosition, initialRotation }, ref) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [position, setPosition] = useState<[number, number, number]>(initialPosition);
    const [rotation, setRotation] = useState<[number, number, number, number]>(initialRotation);
    
    // Create an interface for external updates
    useImperativeHandle(ref, () => ({
      updateTransform: (newPosition: [number, number, number], newRotation: [number, number, number, number]) => {
        setPosition(newPosition);
        setRotation(newRotation);
      }
    }), []);
    
    // Update mesh when position/rotation changes
    useEffect(() => {
      if (meshRef.current) {
        meshRef.current.position.set(...position);
        
        // Convert quaternion to Euler rotation
        const quaternion = new THREE.Quaternion(...rotation);
        meshRef.current.quaternion.copy(quaternion);
      }
    }, [position, rotation]);
    
    // Log when the player is mounted
    useEffect(() => {
      console.log(`Remote player ${id} mounted at position:`, position);
      
      return () => {
        console.log(`Remote player ${id} unmounted`);
      };
    }, [id, position]);
    
    return (
      <group>
        {/* Player body */}
        <mesh ref={meshRef} position={position} castShadow>
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
); 