import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { SimpleTree } from './SimpleTree'
import { TreeLoader } from './TreeLoader'
import { useRef } from 'react'

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
    
    // Define outside floor dimensions
    const outsideFloorSize = 250; // Large outdoor area
    const outsideFloorThickness = 1;
    const outsideFloorY = -0.5; // Slightly lower than the interior
    
    // Create grid pattern for outside floor
    const gridMaterial = useRef<THREE.ShaderMaterial>(null);
    
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
            
            {/* Outside floor with grid material */}
            <RigidBody
                type="fixed"
                position={[0, outsideFloorY, 0]}
                colliders="cuboid"
                friction={0.2}
                restitution={0}
            >
                <mesh receiveShadow rotation={[Math.PI/2, 0, 0]}>
                    <planeGeometry args={[outsideFloorSize, outsideFloorSize, 1, 1]} />
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
            
            {/* Add some outside trees in each direction but positioned away from paths */}
            {[
                [-25, 0, -70], [25, 0, -70], // North area
                [-25, 0, 70], [25, 0, 70], // South area
                [70, 0, -25], [70, 0, 25], // East area
                [-70, 0, -25], [-70, 0, 25], // West area
                [-100, 0, -100], [100, 0, -100], [-100, 0, 100], [100, 0, 100], // Corners
                [-70, 0, -40], [70, 0, -40], [-70, 0, 40], [70, 0, 40] // Random positions
            ].map((position, idx) => (
                <TreeLoader
                    key={`outside-tree-${idx}`}
                    position={position as [number, number, number]}
                    scale={0.6}
                    treeType="tree" // Use only trees for these positions
                />
            ))}
            
            {/* Add some rocks around the landscape */}
            {[
                [-35, 0, -60], [35, 0, -60], // North area
                [-35, 0, 60], [35, 0, 60], // South area
                [60, 0, -35], [60, 0, 35], // East area
                [-60, 0, -35], [-60, 0, 35], // West area
                [-90, 0, -90], [90, 0, -90], [-90, 0, 90], [90, 0, 90], // Corners
                [-50, 0, -30], [50, 0, -30], [-50, 0, 30], [50, 0, 30] // Random positions
            ].map((position, idx) => (
                <TreeLoader
                    key={`rock-${idx}`}
                    position={position as [number, number, number]}
                    scale={0.7}
                    treeType="rock" // Use only rocks for these positions
                />
            ))}
            
            {/* Add some plants and bushes for ground cover */}
            {[
                [-45, 0, -65], [45, 0, -65], [-15, 0, -55], [15, 0, -55], // North area
                [-45, 0, 65], [45, 0, 65], [-15, 0, 55], [15, 0, 55], // South area
                [65, 0, -45], [65, 0, 45], [55, 0, -15], [55, 0, 15], // East area
                [-65, 0, -45], [-65, 0, 45], [-55, 0, -15], [-55, 0, 15], // West area
                [-80, 0, -80], [80, 0, -80], [-80, 0, 80], [80, 0, 80], // Near corners
                [-40, 0, -20], [40, 0, -20], [-40, 0, 20], [40, 0, 20], // Random positions
                [-30, 0, -50], [30, 0, -50], [-30, 0, 50], [30, 0, 50] // More random positions
            ].map((position, idx) => (
                <TreeLoader
                    key={`plant-${idx}`}
                    position={position as [number, number, number]}
                    scale={0.5}
                    treeType={idx % 2 === 0 ? "plant" : "bush"} // Alternate between plants and bushes
                />
            ))}
        </group>
    )
}