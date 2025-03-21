import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// New interfaces for snapshot interpolation
interface PositionSnapshot {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  timestamp: number;
}

type RemotePlayerProps = {
  id: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number, number];
  updateRef?: (methods: { updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void }) => void;
};

export const RemotePlayer = ({ 
  id, 
  initialPosition, 
  initialRotation,
  updateRef
}: RemotePlayerProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Store target position/rotation for smooth interpolation
  const targetPosition = useRef(new THREE.Vector3(...initialPosition));
  const targetRotation = useRef(new THREE.Quaternion(...initialRotation));
  
  // Add snapshot buffer for interpolation
  const snapshots = useRef<PositionSnapshot[]>([]);
  // How far we interpolate behind the server time (ms)
  const interpolationDelay = useRef(100);
  const lastUpdateTime = useRef(Date.now());
  
  // Update the player mesh position/rotation with interpolation
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    
    const now = Date.now();
    const renderTime = now - interpolationDelay.current;
    
    // If we have at least 2 snapshots, interpolate between them
    if (snapshots.current.length >= 2) {
      let i = 0;
      // Find the first snapshot that is newer than render time
      for (; i < snapshots.current.length; i++) {
        if (snapshots.current[i].timestamp > renderTime) break;
      }
      
      // If we found a valid pair of snapshots
      if (i > 0 && i < snapshots.current.length) {
        const older = snapshots.current[i-1];
        const newer = snapshots.current[i];
        
        // Calculate interpolation factor (0-1)
        const timeDiff = newer.timestamp - older.timestamp;
        if (timeDiff > 0) {
          const t = (renderTime - older.timestamp) / timeDiff;
          
          // Interpolate position
          const newPosition = new THREE.Vector3().lerpVectors(
            older.position,
            newer.position,
            t
          );
          
          // Interpolate rotation
          const newRotation = new THREE.Quaternion().slerpQuaternions(
            older.rotation,
            newer.rotation,
            t
          );
          
          // Apply to mesh
          meshRef.current.position.copy(newPosition);
          meshRef.current.quaternion.copy(newRotation);
          
          // Clean up old snapshots
          if (snapshots.current.length > 10) {
            // Keep a few old ones for interpolation
            snapshots.current = snapshots.current.slice(i - 1);
          }
          
          // We've applied interpolated values, so return early
          return;
        }
      }
    }
    
    // Fallback to direct lerping if we don't have enough snapshots
    meshRef.current.position.lerp(targetPosition.current, 0.3);
    meshRef.current.quaternion.slerp(targetRotation.current, 0.3);
  });
  
  // Method to update target position/rotation
  const updateTransform = (position: [number, number, number], rotation: [number, number, number, number]) => {
    // Update immediate targets
    targetPosition.current.set(...position);
    targetRotation.current.set(...rotation);
    
    // Add to snapshots
    snapshots.current.push({
      position: new THREE.Vector3(...position),
      rotation: new THREE.Quaternion(...rotation),
      timestamp: Date.now()
    });
    
    // Keep the buffer from growing too large
    if (snapshots.current.length > 30) {
      snapshots.current.shift();
    }
    
    lastUpdateTime.current = Date.now();
  };

  // Expose the update method via ref
  useEffect(() => {
    if (updateRef) {
      updateRef({ updateTransform });
    }
  }, [updateRef]);
  
  return (
    <mesh ref={meshRef} position={initialPosition}>
      {/* Player model - a simple character made of boxes */}
      <group>
        {/* Body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 1.2, 0.3]} />
          <meshStandardMaterial color="red" />
        </mesh>
        
        {/* Head */}
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color="salmon" />
        </mesh>
        
        {/* Arms */}
        <mesh position={[0.4, 0.1, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.2]} />
          <meshStandardMaterial color="darkred" />
        </mesh>
        <mesh position={[-0.4, 0.1, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.2]} />
          <meshStandardMaterial color="darkred" />
        </mesh>
        
        {/* Legs */}
        <mesh position={[0.2, -0.8, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.2]} />
          <meshStandardMaterial color="maroon" />
        </mesh>
        <mesh position={[-0.2, -0.8, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.2]} />
          <meshStandardMaterial color="maroon" />
        </mesh>
      </group>
    </mesh>
  );
}; 