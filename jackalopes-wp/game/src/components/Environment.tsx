import React from 'react';
import { useThree } from '@react-three/fiber';
import { Environment as DreiEnvironment, Grid } from '@react-three/drei';
import * as THREE from 'three';

// A simple environment component that adds lighting and a grid to the scene
export const Environment: React.FC = () => {
  const { scene } = useThree();
  
  // Set a simple background color
  scene.background = new THREE.Color('#1e1e2f');
  
  return (
    <>
      {/* Ambient light for basic illumination */}
      <ambientLight intensity={0.3} />
      
      {/* Main directional light with shadows */}
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024} 
      />
      
      {/* Fill light from the opposite side */}
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      
      {/* Ground grid for reference */}
      <Grid 
        position={[0, -0.01, 0]} 
        args={[100, 100]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#6f6f6f" 
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={50}
      />
      
      {/* Environment map for realistic reflections */}
      <DreiEnvironment preset="city" />
    </>
  );
};

export default Environment; 