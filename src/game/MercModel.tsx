import React, { useRef } from 'react'
import * as THREE from 'three'

// Simple Merc character model using basic THREE.js geometry
export const MercModel = ({ 
  visible = true, 
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  scale = [1, 1, 1] as [number, number, number]
}: {
  animation?: string; // Keep parameter for compatibility
  visible?: boolean;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number] | THREE.Euler;
  scale?: [number, number, number];
}) => {
  const group = useRef<THREE.Group>(null);
  
  // Determine final position and rotation format
  const finalPosition = position instanceof THREE.Vector3 
    ? [position.x, position.y, position.z] as [number, number, number]
    : position;
    
  const finalRotation = rotation instanceof THREE.Euler
    ? [rotation.x, rotation.y, rotation.z] as [number, number, number] 
    : rotation;
  
  return (
    <group 
      ref={group} 
      visible={visible}
      name="merc"
      position={finalPosition}
      rotation={finalRotation}
      scale={scale}
    >
      {/* Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.7, 1.6, 0.5]} />
        <meshStandardMaterial color="#CD5C5C" /> {/* Red color for merc */}
      </mesh>
      
      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 1.0, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#CD5C5C" />
      </mesh>
      
      {/* Helmet/Hat */}
      <mesh castShadow position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.15]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
      
      {/* Arms */}
      <mesh castShadow receiveShadow position={[0.45, 0.6, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#A52A2A" />
      </mesh>
      
      <mesh castShadow receiveShadow position={[-0.45, 0.6, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#A52A2A" />
      </mesh>
      
      {/* Legs */}
      <mesh castShadow receiveShadow position={[0.2, -0.6, 0]}>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#A52A2A" />
      </mesh>
      
      <mesh castShadow receiveShadow position={[-0.2, -0.6, 0]}>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#A52A2A" />
      </mesh>
    </group>
  );
}; 