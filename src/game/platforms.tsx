import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { SimpleTree } from './SimpleTree'

type BoxDimensions = [width: number, height: number, depth: number]

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

export function Platforms() {
    // Replace texture with solid color
    // const texture = useTexture('/final-texture.png')
    // texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    
    // Platform color
    const platformColor = new THREE.Color('#757575')

    return (
        <group>
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
                            roughness={0.8}
                            metalness={0.1}
                        />
                    </mesh>
                    
                    {/* Add a tree on top of each block */}
                    <SimpleTree 
                        position={[0, size[1] / 2, 0]}
                        scale={0.25}
                        trunkHeight={5}
                        trunkRadius={0.6}
                        leavesRadius={2.5}
                        // Randomize tree colors slightly for variety
                        trunkColor={`hsl(25, ${45 + Math.random() * 20}%, ${20 + Math.random() * 10}%)`}
                        leavesColor={`hsl(${100 + Math.random() * 40}, 60%, ${30 + Math.random() * 15}%)`}
                    />
                </RigidBody>
            ))}
        </group>
    )
}