import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface PlayerProps {
  position?: [number, number, number];
  color?: string;
}

// A simple player component that uses Rapier physics
export const Player: React.FC<PlayerProps> = ({ 
  position = [0, 1, 0], 
  color = 'blue' 
}) => {
  // Reference to the mesh for animations
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Simple animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.5;
    }
  });
  
  return (
    <RigidBody 
      position={position}
      mass={1}
      colliders="cuboid"
      friction={0.1}
    >
      <mesh castShadow receiveShadow>
        <mesh ref={meshRef} position={[0, 0, 0.25]}>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial color="red" />
        </mesh>
        <boxGeometry args={[0.5, 1, 0.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
};

export default Player; 