import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { SimpleTree } from './SimpleTree'
import { TreeLoader } from './TreeLoader'
import { useRef, useMemo } from 'react'
import { MountainRange } from './Mountain'

type BoxDimensions = [width: number, height: number, depth: number]

// Inner platform boxes (existing)
const boxes = [
    { position: [10, 0, -10] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-10, 0, -10] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [30, 0, 10] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-30, 0, 10] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [0, 0, 30] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [20, 0, -30] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-20, 0, -30] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [40, 0, 40] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-40, 0, 40] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [40, 0, -40] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-40, 0, -40] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [15, 0, -35] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-15, 0, 35] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [25, 0, 25] as const, size: [4, 4, 4] as BoxDimensions },
    { position: [-25, 0, -25] as const, size: [4, 4, 4] as BoxDimensions }
]

// Create walls
const createWallSegments = () => {
    const wallHeight = 8;
    const wallThickness = 2;
    const mapSize = 60; // Size of the inner area
    const doorWidth = 10; // Width of doorway openings
    const doorHeight = 6; // Height of doorway openings
    const segments = [];
    
    // Wall colors
    const wallColor = '#555555';
    
    // Create a continuous wall with 4 openings (N, S, E, W)
    
    // North wall (left segment)
    segments.push({
        position: [-mapSize/4 - doorWidth/2, wallHeight/2, -mapSize/2] as const,
        size: [mapSize/2 - doorWidth/2, wallHeight, wallThickness] as BoxDimensions,
        color: wallColor
    });
    
    // North wall (right segment)
    segments.push({
        position: [mapSize/4 + doorWidth/2, wallHeight/2, -mapSize/2] as const,
        size: [mapSize/2 - doorWidth/2, wallHeight, wallThickness] as BoxDimensions,
        color: wallColor
    });
    
    // South wall (left segment)
    segments.push({
        position: [-mapSize/4 - doorWidth/2, wallHeight/2, mapSize/2] as const,
        size: [mapSize/2 - doorWidth/2, wallHeight, wallThickness] as BoxDimensions,
        color: wallColor
    });
    
    // South wall (right segment)
    segments.push({
        position: [mapSize/4 + doorWidth/2, wallHeight/2, mapSize/2] as const,
        size: [mapSize/2 - doorWidth/2, wallHeight, wallThickness] as BoxDimensions,
        color: wallColor
    });
    
    // East wall (top segment)
    segments.push({
        position: [mapSize/2, wallHeight/2, -mapSize/4 - doorWidth/2] as const,
        size: [wallThickness, wallHeight, mapSize/2 - doorWidth/2] as BoxDimensions,
        color: wallColor
    });
    
    // East wall (bottom segment)
    segments.push({
        position: [mapSize/2, wallHeight/2, mapSize/4 + doorWidth/2] as const,
        size: [wallThickness, wallHeight, mapSize/2 - doorWidth/2] as BoxDimensions,
        color: wallColor
    });
    
    // West wall (top segment)
    segments.push({
        position: [-mapSize/2, wallHeight/2, -mapSize/4 - doorWidth/2] as const,
        size: [wallThickness, wallHeight, mapSize/2 - doorWidth/2] as BoxDimensions,
        color: wallColor
    });
    
    // West wall (bottom segment)
    segments.push({
        position: [-mapSize/2, wallHeight/2, mapSize/4 + doorWidth/2] as const,
        size: [wallThickness, wallHeight, mapSize/2 - doorWidth/2] as BoxDimensions,
        color: wallColor
    });
    
    // Add lintels (top bars) above each doorway
    
    // North doorway lintel
    segments.push({
        position: [0, doorHeight + (wallHeight-doorHeight)/2, -mapSize/2] as const,
        size: [doorWidth, wallHeight-doorHeight, wallThickness] as BoxDimensions,
        color: wallColor
    });
    
    // South doorway lintel
    segments.push({
        position: [0, doorHeight + (wallHeight-doorHeight)/2, mapSize/2] as const,
        size: [doorWidth, wallHeight-doorHeight, wallThickness] as BoxDimensions,
        color: wallColor
    });
    
    // East doorway lintel
    segments.push({
        position: [mapSize/2, doorHeight + (wallHeight-doorHeight)/2, 0] as const,
        size: [wallThickness, wallHeight-doorHeight, doorWidth] as BoxDimensions,
        color: wallColor
    });
    
    // West doorway lintel
    segments.push({
        position: [-mapSize/2, doorHeight + (wallHeight-doorHeight)/2, 0] as const,
        size: [wallThickness, wallHeight-doorHeight, doorWidth] as BoxDimensions,
        color: wallColor
    });
    
    // Add door frames (vertical posts) for more definition
    const frameWidth = 1;
    const frameColor = '#444444';
    
    // North door frames
    segments.push({
        position: [-doorWidth/2 - frameWidth/2, wallHeight/2, -mapSize/2] as const,
        size: [frameWidth, wallHeight, wallThickness*1.5] as BoxDimensions,
        color: frameColor
    });
    segments.push({
        position: [doorWidth/2 + frameWidth/2, wallHeight/2, -mapSize/2] as const,
        size: [frameWidth, wallHeight, wallThickness*1.5] as BoxDimensions,
        color: frameColor
    });
    
    // South door frames
    segments.push({
        position: [-doorWidth/2 - frameWidth/2, wallHeight/2, mapSize/2] as const,
        size: [frameWidth, wallHeight, wallThickness*1.5] as BoxDimensions,
        color: frameColor
    });
    segments.push({
        position: [doorWidth/2 + frameWidth/2, wallHeight/2, mapSize/2] as const,
        size: [frameWidth, wallHeight, wallThickness*1.5] as BoxDimensions,
        color: frameColor
    });
    
    // East door frames
    segments.push({
        position: [mapSize/2, wallHeight/2, -doorWidth/2 - frameWidth/2] as const,
        size: [wallThickness*1.5, wallHeight, frameWidth] as BoxDimensions,
        color: frameColor
    });
    segments.push({
        position: [mapSize/2, wallHeight/2, doorWidth/2 + frameWidth/2] as const,
        size: [wallThickness*1.5, wallHeight, frameWidth] as BoxDimensions,
        color: frameColor
    });
    
    // West door frames
    segments.push({
        position: [-mapSize/2, wallHeight/2, -doorWidth/2 - frameWidth/2] as const,
        size: [wallThickness*1.5, wallHeight, frameWidth] as BoxDimensions,
        color: frameColor
    });
    segments.push({
        position: [-mapSize/2, wallHeight/2, doorWidth/2 + frameWidth/2] as const,
        size: [wallThickness*1.5, wallHeight, frameWidth] as BoxDimensions,
        color: frameColor
    });
    
    return segments;
};

export function Platforms() {
    // Platform colors
    const platformColor = new THREE.Color('#757575');
    const outsideFloorColor = new THREE.Color('#3A5F3A'); // Green-grey for outside floor
    
    // Define map dimensions
    const mapSize = 60; // Size of the inner area
    
    // Define outside floor dimensions - increased for more terrain
    const outsideFloorSize = 400; // Larger outdoor area (was 250)
    const outsideFloorThickness = 1;
    const outsideFloorY = -0.5; // Slightly lower than the interior
    
    // Parameters for low poly terrain
    const terrainSegments = 50; // Number of segments in the terrain grid
    const terrainMaxHeight = 6; // Maximum height of terrain features
    const terrainNoiseScale = 0.02; // Scale of the noise function
    
    // Create a low poly terrain with hills and valleys
    const terrainGeometry = useMemo(() => {
        const geometry = new THREE.PlaneGeometry(
            outsideFloorSize, 
            outsideFloorSize, 
            terrainSegments, 
            terrainSegments
        );
        
        // Add some hills and valleys with a simple noise function
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            
            // Skip vertices near the center (keep playable area flat)
            const distFromCenter = Math.sqrt(x * x + z * z);
            if (distFromCenter < mapSize) {
                continue;
            }
            
            // Apply height based on simplex-like noise (using sine functions for simplicity)
            const nx = x * terrainNoiseScale;
            const nz = z * terrainNoiseScale;
            
            // Create several layers of noise for more interesting terrain
            let height = 0;
            height += Math.sin(nx) * Math.cos(nz) * 0.5;
            height += Math.sin(nx * 2.1) * Math.cos(nz * 1.7) * 0.25;
            height += Math.sin(nx * 4.2) * Math.cos(nz * 3.1) * 0.125;
            
            // Apply a distance-based falloff to make terrain more pronounced further from center
            const falloff = Math.min(1.0, (distFromCenter - mapSize) / 80);
            
            // Apply height to the vertex
            positions[i + 1] = height * terrainMaxHeight * falloff;
        }
        
        // Update normals
        geometry.computeVertexNormals();
        return geometry;
    }, [outsideFloorSize, terrainSegments, terrainMaxHeight, terrainNoiseScale, mapSize]);
    
    // Create a grid shader material
    const floorGridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color('#324D32') }, // Darker green
            color2: { value: new THREE.Color('#3E5F3E') }, // Lighter green
            gridSize: { value: 5.0 },
            gridLineWidth: { value: 0.1 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float gridSize;
            uniform float gridLineWidth;
            varying vec2 vUv;
            
            void main() {
                vec2 scaledUv = vUv * ${outsideFloorSize.toFixed(1)};
                vec2 grid = abs(fract(scaledUv / gridSize - 0.5) - 0.5) / fwidth(scaledUv / gridSize);
                float line = min(grid.x, grid.y);
                
                float gridMask = 1.0 - min(line, 1.0);
                gridMask = smoothstep(0.0, gridLineWidth, gridMask);
                
                vec3 baseColor = mix(color1, color2, gridMask);
                
                // Add some noise/variation to the base floor
                float noise = fract(sin(dot(floor(scaledUv), vec2(12.9898, 78.233))) * 43758.5453);
                baseColor = mix(baseColor, baseColor * (0.9 + 0.1 * noise), 0.2);
                
                gl_FragColor = vec4(baseColor, 1.0);
            }
        `,
        side: THREE.DoubleSide
    });
    
    return (
        <group>
            {/* Main platform boxes with trees */}
            {boxes.map(({ position, size }, index) => (
                <RigidBody 
                    key={index}
                    type="fixed" 
                    position={position}
                    colliders="cuboid"
                    friction={0.1}
                    restitution={0}
                >
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={size} />
                        <meshStandardMaterial 
                            color={platformColor}
                            side={THREE.DoubleSide}
                            roughness={0.65}
                            metalness={0.05}
                            envMapIntensity={0.8}
                            dithering={true}
                        />
                    </mesh>
                    
                    {/* Add a tree on top of each block */}
                    <TreeLoader 
                        position={[0, size[1] / 2, 0]}
                        scale={1.5}
                        treeType="tree"  // Only use actual trees on blocks
                    />
                </RigidBody>
            ))}
            
            {/* Low poly terrain outside - replace the flat floor */}
            <RigidBody
                type="fixed"
                position={[0, outsideFloorY, 0]}
                colliders="hull"  // Use hull for better performance with terrain
                friction={0.2}
                restitution={0}
            >
                <mesh geometry={terrainGeometry} receiveShadow rotation={[-Math.PI/2, 0, 0]}>
                    <primitive object={floorGridMaterial} attach="material" />
                </mesh>
            </RigidBody>
            
            {/* Wall segments with doorway openings */}
            {createWallSegments().map((segment, index) => (
                <RigidBody
                    key={`wall-${index}`}
                    type="fixed"
                    position={segment.position}
                    colliders="cuboid"
                    friction={0.1}
                    restitution={0}
                >
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={segment.size} />
                        <meshStandardMaterial
                            color={segment.color}
                            side={THREE.DoubleSide}
                            roughness={0.7}
                            metalness={0.2}
                        />
                    </mesh>
                </RigidBody>
            ))}
            
            {/* Path decorations - lanterns and stone formations */}
            {[
                [-5, 0, -mapSize/2 - 10], [5, 0, -mapSize/2 - 10], // North path
                [-5, 0, mapSize/2 + 10], [5, 0, mapSize/2 + 10], // South path
                [mapSize/2 + 10, 0, -5], [mapSize/2 + 10, 0, 5], // East path
                [-mapSize/2 - 10, 0, -5], [-mapSize/2 - 10, 0, 5], // West path
            ].map((position, idx) => (
                <RigidBody
                    key={`path-decor-${idx}`}
                    type="fixed"
                    position={position as [number, number, number]}
                    colliders="cuboid"
                >
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[1.5, 1.5, 1.5]} />
                        <meshStandardMaterial
                            color="#8B5A2B" // Brown stone color
                            roughness={0.7}
                            metalness={0.05}
                            envMapIntensity={0.7}
                            dithering={true}
                        />
                    </mesh>
                </RigidBody>
            ))}
            
            {/* Terrain features - rock formations and hills */}
            {[
                // North feature
                { position: [0, -0.5, -90], scale: 3.0, height: 10 },
                // East feature
                { position: [90, -0.5, 0], scale: 2.5, height: 8 },
                // South feature
                { position: [0, -0.5, 90], scale: 3.0, height: 10 },
                // West feature
                { position: [-90, -0.5, 0], scale: 2.5, height: 8 },
                // Random smaller hills
                { position: [45, -0.5, -45], scale: 1.8, height: 5 },
                { position: [-45, -0.5, 45], scale: 1.8, height: 5 },
                { position: [-45, -0.5, -45], scale: 1.8, height: 5 },
                { position: [45, -0.5, 45], scale: 1.8, height: 5 },
            ].map((feature, idx) => (
                <RigidBody
                    key={`terrain-feature-${idx}`}
                    type="fixed"
                    position={feature.position as [number, number, number]}
                    colliders="hull"
                >
                    <mesh castShadow receiveShadow>
                        <coneGeometry args={[feature.scale * 10, feature.height, 8]} />
                        <meshStandardMaterial
                            color="#3A5F3A"
                            roughness={0.8}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </RigidBody>
            ))}
            
            {/* Add more outside trees, widely distributed across the terrain */}
            {[
                // Original tree positions
                [-25, 0, -70], [25, 0, -70], // North area
                [-25, 0, 70], [25, 0, 70], // South area
                [70, 0, -25], [70, 0, 25], // East area
                [-70, 0, -25], [-70, 0, 25], // West area
                [-100, 0, -100], [100, 0, -100], [-100, 0, 100], [100, 0, 100], // Corners
                [-70, 0, -40], [70, 0, -40], [-70, 0, 40], [70, 0, 40], // Random positions
                
                // Additional trees further out in the terrain
                [-120, 0, -80], [120, 0, -80], [-120, 0, 80], [120, 0, 80],
                [-80, 0, -120], [80, 0, -120], [-80, 0, 120], [80, 0, 120],
                [-150, 0, -50], [150, 0, -50], [-150, 0, 50], [150, 0, 50],
                [-50, 0, -150], [50, 0, -150], [-50, 0, 150], [50, 0, 150],
                [-180, 0, -180], [180, 0, -180], [-180, 0, 180], [180, 0, 180],
                [-140, 0, -60], [140, 0, -60], [-140, 0, 60], [140, 0, 60],
                [-60, 0, -140], [60, 0, -140], [-60, 0, 140], [60, 0, 140],
            ].map((position, idx) => (
                <TreeLoader
                    key={`outside-tree-${idx}`}
                    position={position as [number, number, number]}
                    scale={0.6 + Math.sin(idx * 0.1) * 0.2} // Varied scales
                    treeType="tree" // Use only trees for these positions
                />
            ))}
            
            {/* Add more rocks throughout the terrain */}
            {[
                // Original rock positions
                [-35, 0, -60], [35, 0, -60], // North area
                [-35, 0, 60], [35, 0, 60], // South area
                [60, 0, -35], [60, 0, 35], // East area
                [-60, 0, -35], [-60, 0, 35], // West area
                [-90, 0, -90], [90, 0, -90], [-90, 0, 90], [90, 0, 90], // Corners
                [-50, 0, -30], [50, 0, -30], [-50, 0, 30], [50, 0, 30], // Random positions
                
                // Additional rocks scattered through the extended terrain
                [-110, 0, -45], [110, 0, -45], [-110, 0, 45], [110, 0, 45],
                [-45, 0, -110], [45, 0, -110], [-45, 0, 110], [45, 0, 110],
                [-130, 0, -65], [130, 0, -65], [-130, 0, 65], [130, 0, 65],
                [-65, 0, -130], [65, 0, -130], [-65, 0, 130], [65, 0, 130],
                [-170, 0, -90], [170, 0, -90], [-170, 0, 90], [170, 0, 90],
                [-90, 0, -170], [90, 0, -170], [-90, 0, 170], [90, 0, 170],
                [-80, 0, -40], [80, 0, -40], [-80, 0, 40], [80, 0, 40],
                [-40, 0, -80], [40, 0, -80], [-40, 0, 80], [40, 0, 80],
            ].map((position, idx) => (
                <TreeLoader
                    key={`rock-${idx}`}
                    position={position as [number, number, number]}
                    scale={0.7 + Math.cos(idx * 0.2) * 0.3} // Varied scales
                    treeType="rock" // Use only rocks for these positions
                />
            ))}
            
            {/* Add plants and bushes - original plus more for extended terrain */}
            {[
                // Original plant positions
                [-45, 0, -65], [45, 0, -65], [-15, 0, -55], [15, 0, -55], // North area
                [-45, 0, 65], [45, 0, 65], [-15, 0, 55], [15, 0, 55], // South area
                [65, 0, -45], [65, 0, 45], [55, 0, -15], [55, 0, 15], // East area
                [-65, 0, -45], [-65, 0, 45], [-55, 0, -15], [-55, 0, 15], // West area
                [-80, 0, -80], [80, 0, -80], [-80, 0, 80], [80, 0, 80], // Near corners
                [-40, 0, -20], [40, 0, -20], [-40, 0, 20], [40, 0, 20], // Random positions
                [-30, 0, -50], [30, 0, -50], [-30, 0, 50], [30, 0, 50], // More random positions
                
                // Additional plant positions for extended terrain
                [-95, 0, -75], [95, 0, -75], [-95, 0, 75], [95, 0, 75],
                [-75, 0, -95], [75, 0, -95], [-75, 0, 95], [75, 0, 95],
                [-120, 0, -55], [120, 0, -55], [-120, 0, 55], [120, 0, 55],
                [-55, 0, -120], [55, 0, -120], [-55, 0, 120], [55, 0, 120],
                [-160, 0, -75], [160, 0, -75], [-160, 0, 75], [160, 0, 75],
                [-75, 0, -160], [75, 0, -160], [-75, 0, 160], [75, 0, 160],
                [-140, 0, -140], [140, 0, -140], [-140, 0, 140], [140, 0, 140],
                [-85, 0, -35], [85, 0, -35], [-85, 0, 35], [85, 0, 35],
                [-35, 0, -85], [35, 0, -85], [-35, 0, 85], [35, 0, 85],
            ].map((position, idx) => (
                <TreeLoader
                    key={`plant-${idx}`}
                    position={position as [number, number, number]}
                    scale={0.5 + Math.sin(idx * 0.3) * 0.2} // Varied scales
                    treeType={idx % 3 === 0 ? "plant" : idx % 3 === 1 ? "bush" : "rock"} // Mix of plant types
                />
            ))}

            {/* Add mountain ranges around the map boundary to create a natural barrier */}
            
            {/* North mountain range */}
            <MountainRange 
                position={[0, 0, -150]}
                count={8}
                spread={200}
                baseScale={1.5}
                scaleVariation={0.4}
                heightVariation={0.5}
            />
            
            {/* Northeast mountains */}
            <MountainRange 
                position={[130, 0, -130]}
                count={4}
                spread={80}
                baseScale={1.3}
                scaleVariation={0.3}
                heightVariation={0.4}
            />
            
            {/* East mountain range */}
            <MountainRange 
                position={[150, 0, 0]}
                count={6}
                spread={160}
                baseScale={1.4}
                scaleVariation={0.35}
                heightVariation={0.45}
            />
            
            {/* Southeast mountains */}
            <MountainRange 
                position={[130, 0, 130]}
                count={4}
                spread={70}
                baseScale={1.2}
                scaleVariation={0.3}
                heightVariation={0.4}
            />
            
            {/* South mountain range */}
            <MountainRange 
                position={[0, 0, 150]}
                count={8}
                spread={200}
                baseScale={1.5}
                scaleVariation={0.4}
                heightVariation={0.5}
            />
            
            {/* Southwest mountains */}
            <MountainRange 
                position={[-130, 0, 130]}
                count={4}
                spread={80}
                baseScale={1.3}
                scaleVariation={0.3}
                heightVariation={0.4}
            />
            
            {/* West mountain range */}
            <MountainRange 
                position={[-150, 0, 0]}
                count={6}
                spread={160}
                baseScale={1.4}
                scaleVariation={0.35}
                heightVariation={0.45}
            />
            
            {/* Northwest mountains */}
            <MountainRange 
                position={[-130, 0, -130]}
                count={4}
                spread={70}
                baseScale={1.2}
                scaleVariation={0.3}
                heightVariation={0.4}
            />
        </group>
    )
}