import React, { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Environment } from '../assets'

export const TreeLoader = ({ 
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  treeIndex = -1,
}: {
  position?: [number, number, number];
  scale?: number;
  treeIndex?: number;
}) => {
  // Generate a stable random index for this tree based on its position
  const stableTreeIndex = useMemo(() => {
    if (treeIndex >= 0) return treeIndex % Environment.Trees.LowpolyTrees.length;
    
    // Create a deterministic hash from the position
    const positionHash = position[0] * 10000 + position[1] * 1000 + position[2] * 100;
    const hashValue = Math.abs(Math.sin(positionHash) * 10000);
    return Math.floor(hashValue % Environment.Trees.LowpolyTrees.length);
  }, [position, treeIndex]);
  
  // Get the model path for the selected tree
  const modelPath = Environment.Trees.LowpolyTrees[stableTreeIndex];
  
  // Load the model
  const { scene } = useGLTF(modelPath);
  
  // Clone the scene to avoid reference issues
  const modelScene = useMemo(() => scene.clone(), [scene]);
  
  return (
    <group position={position} scale={scale}>
      <primitive object={modelScene} />
    </group>
  );
}

// Preload all tree models to prevent loading glitches
Environment.Trees.LowpolyTrees.forEach(path => {
  useGLTF.preload(path);
}); 