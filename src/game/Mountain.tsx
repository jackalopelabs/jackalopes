import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';

interface MountainProps {
  position: [number, number, number];
  scale?: number;
  height?: number;
  width?: number;
  depth?: number;
  color?: string;
  snowCoverage?: number;
  roughness?: number;
  seed?: number;
}

export const Mountain: React.FC<MountainProps> = ({
  position,
  scale = 1,
  height = 30,
  width = 20,
  depth = 20,
  color = '#5D4037',
  snowCoverage = 0.5,
  roughness = 0.8,
  seed = Math.random() * 1000
}) => {
  // Create a deterministic random function based on seed
  const random = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };

  // Generate mountain geometry
  const { geometry, snowGeometry } = useMemo(() => {
    try {
      // Create mountain base shape
      const baseGeometry = new THREE.BufferGeometry();
      
      // Generate mountain shape with peaks and valleys
      const vertices = [];
      const indices = [];
      
      // Parameters for the mountain generation
      const segmentsWidth = 5;
      const segmentsDepth = 5;
      
      // Create vertices grid with randomized heights
      for (let z = 0; z <= segmentsDepth; z++) {
        for (let x = 0; x <= segmentsWidth; x++) {
          // Calculate normalized position (0 to 1)
          const nx = x / segmentsWidth;
          const nz = z / segmentsDepth;
          
          // Calculate radial distance from center (0 to 1)
          const dx = nx - 0.5;
          const dz = nz - 0.5;
          const distFromCenter = Math.sqrt(dx * dx + dz * dz) * 2;
          
          // Create height falloff from center to edge (mountain shape)
          let h = Math.max(0, 1 - distFromCenter);
          
          // Add noise to the height
          const noiseAmount = 0.4;
          h += (random(x * 100 + z) - 0.5) * noiseAmount * h;
          
          // Apply height
          const y = h * height;
          
          // Position the vertex in 3D space
          vertices.push(
            (nx - 0.5) * width,  // X
            y,                   // Y
            (nz - 0.5) * depth   // Z
          );
        }
      }
      
      // Create triangles
      for (let z = 0; z < segmentsDepth; z++) {
        for (let x = 0; x < segmentsWidth; x++) {
          const a = x + z * (segmentsWidth + 1);
          const b = x + 1 + z * (segmentsWidth + 1);
          const c = x + (z + 1) * (segmentsWidth + 1);
          const d = x + 1 + (z + 1) * (segmentsWidth + 1);
          
          // Add two triangles to make a quad
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
      
      // Add attributes to geometry
      baseGeometry.setIndex(indices);
      baseGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      baseGeometry.computeVertexNormals();
      
      // Create snow-capped version
      const snowGeometry = baseGeometry.clone();
      
      // Filter vertices for snow (only use vertices above a certain height)
      const positions = baseGeometry.attributes.position.array;
      const snowIndices = [];
      
      // Determine snow height threshold based on snowCoverage
      const maxHeight = Math.max(...Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 1]));
      const snowThreshold = maxHeight * (1 - snowCoverage);
      
      // Build indices for snow-covered areas
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];
        
        const yA = positions[a * 3 + 1];
        const yB = positions[b * 3 + 1];
        const yC = positions[c * 3 + 1];
        
        // If all vertices of the triangle are above snow threshold
        if (yA > snowThreshold && yB > snowThreshold && yC > snowThreshold) {
          snowIndices.push(a, b, c);
        }
      }
      
      snowGeometry.setIndex(snowIndices);
      
      return { geometry: baseGeometry, snowGeometry };
    } catch (error) {
      console.error("Error generating mountain geometry:", error);
      // Return simple fallback geometries if there's an error
      const fallbackGeometry = new THREE.BoxGeometry(width, height / 2, depth);
      const fallbackSnowGeometry = new THREE.BoxGeometry(width * 0.8, height / 4, depth * 0.8);
      return { geometry: fallbackGeometry, snowGeometry: fallbackSnowGeometry };
    }
  }, [width, depth, height, seed, snowCoverage]);
  
  // Create materials
  const mountainMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      flatShading: true,
      side: THREE.DoubleSide
    });
  }, [color, roughness]);
  
  const snowMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFFFFF'),
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide
    });
  }, []);
  
  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      <group scale={[scale, scale, scale]}>
        {/* Main mountain */}
        <mesh geometry={geometry} material={mountainMaterial} castShadow receiveShadow />
        
        {/* Snow cap */}
        <mesh geometry={snowGeometry} material={snowMaterial} castShadow receiveShadow />
      </group>
    </RigidBody>
  );
};

// Create a mountain range (multiple mountains in a line)
interface MountainRangeProps {
  position: [number, number, number];
  count?: number;
  spread?: number;
  baseScale?: number;
  scaleVariation?: number;
  heightVariation?: number;
}

export const MountainRange: React.FC<MountainRangeProps> = ({
  position,
  count = 5,
  spread = 20,
  baseScale = 1,
  scaleVariation = 0.3,
  heightVariation = 0.4
}) => {
  // Generate deterministic mountains
  const mountains = useMemo(() => {
    const result = [];
    
    for (let i = 0; i < count; i++) {
      // Create mountain parameters
      const offset = (i / (count - 1) - 0.5) * spread;
      const seed = position[0] * 1000 + position[2] * 100 + i;
      const random = (x: number) => Math.sin(seed * x) * 10000 % 1;
      
      // Calculate random variations
      const scale = baseScale * (1 - scaleVariation / 2 + random(0.1) * scaleVariation);
      const height = 30 * (1 - heightVariation / 2 + random(0.2) * heightVariation);
      const snowCoverage = 0.4 + random(0.3) * 0.2;
      const posX = position[0] + offset + (random(0.4) - 0.5) * (spread / count);
      const posZ = position[2] + (random(0.5) - 0.5) * (spread / 4);
      
      result.push(
        <Mountain 
          key={`mountain-${i}-${seed}`}
          position={[posX, position[1], posZ]}
          scale={scale}
          height={height}
          width={20 + random(0.6) * 10}
          depth={20 + random(0.7) * 10}
          color={`rgb(${93 + random(0.8) * 20}, ${64 + random(0.9) * 15}, ${55 + random(1.0) * 10})`}
          snowCoverage={snowCoverage}
          roughness={0.7 + random(1.1) * 0.2}
          seed={seed}
        />
      );
    }
    
    return result;
  }, [position, count, spread, baseScale, scaleVariation, heightVariation]);

  return <>{mountains}</>;
}; 