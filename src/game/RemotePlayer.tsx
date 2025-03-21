import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  
  // Update the player mesh position/rotation with interpolation
  useFrame((_, delta) => {
    if (meshRef.current) {
      // Smoothly interpolate position
      meshRef.current.position.lerp(targetPosition.current, 0.3);
      
      // Smoothly interpolate rotation
      meshRef.current.quaternion.slerp(targetRotation.current, 0.3);
    }
  });
  
  // Method to update target position/rotation
  const updateTransform = (position: [number, number, number], rotation: [number, number, number, number]) => {
    targetPosition.current.set(...position);
    targetRotation.current.set(...rotation);
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