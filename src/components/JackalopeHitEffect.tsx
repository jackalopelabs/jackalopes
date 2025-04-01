import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type HitEffectProps = {
    position: THREE.Vector3,
    color?: string
}

/**
 * Component to render a hit effect at a specific position
 */
export const HitEffect = ({ position, color = '#00aaff' }: HitEffectProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const startTime = useRef(Date.now());
    const duration = 500; // Effect duration in milliseconds
    const [visible, setVisible] = useState(true);
    
    // Create particles
    const count = 20; // Number of particles
    const particles = useRef<THREE.Vector3[]>([]);
    const particleSpeeds = useRef<THREE.Vector3[]>([]);
    
    // Initialize particles in random directions
    useEffect(() => {
        particles.current = [];
        particleSpeeds.current = [];
        
        for (let i = 0; i < count; i++) {
            // Random direction
            const direction = new THREE.Vector3(
                Math.random() * 2 - 1, // -1 to 1
                Math.random() * 2 - 0.5, // Upward bias: -0.5 to 1.5
                Math.random() * 2 - 1
            ).normalize();
            
            // Random speed
            const speed = 0.05 + Math.random() * 0.1;
            const velocity = direction.clone().multiplyScalar(speed);
            
            // Add particle at center position
            particles.current.push(new THREE.Vector3(0, 0, 0));
            particleSpeeds.current.push(velocity);
        }
    }, []);
    
    // Animate particles
    useFrame(() => {
        if (!groupRef.current) return;
        
        // Calculate progress (0 to 1)
        const elapsed = Date.now() - startTime.current;
        const progress = Math.min(elapsed / duration, 1);
        
        // Update particle positions
        particles.current.forEach((particle, i) => {
            // Update position based on velocity
            particle.add(particleSpeeds.current[i]);
            
            // Add gravity effect
            particleSpeeds.current[i].y -= 0.002;
            
            // Fade out based on progress
            const opacity = 1 - progress;
            
            // Decrease size as they move outward
            const scale = 1 - progress * 0.8;
            
            // Update particle mesh if we were to use individual meshes
            // But we'll use a points system instead for better performance
        });
        
        // When finished, hide the effect
        if (progress >= 1 && visible) {
            setVisible(false);
        }
    });
    
    // Position the effect at the hit location
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(position);
        }
    }, [position]);
    
    if (!visible) return null;
    
    return (
        <group ref={groupRef}>
            {/* Burst effect */}
            <mesh scale={[1 + Math.random() * 0.5, 1 + Math.random() * 0.5, 1 + Math.random() * 0.5]}>
                <sphereGeometry args={[0.5, 8, 8]} />
                <meshBasicMaterial 
                    color={color} 
                    transparent={true} 
                    opacity={0.7}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            
            {/* Particles */}
            <points>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={particles.current.length}
                        array={new Float32Array(particles.current.flatMap(p => [p.x, p.y, p.z]))}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.2}
                    color={color}
                    transparent={true}
                    opacity={0.8}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </group>
    );
};

/**
 * Component to listen for hit events and show effects
 */
export const JackalopeHitEffects = () => {
    const [hitEffects, setHitEffects] = useState<{id: string, position: THREE.Vector3, timestamp: number}[]>([]);
    
    // Listen for hit events
    useEffect(() => {
        const handleHitVisual = (event: CustomEvent) => {
            const { position, jackalopeId } = event.detail;
            console.log('Hit visual event received:', position, jackalopeId);
            
            // Add new hit effect
            setHitEffects(prev => [
                ...prev, 
                {
                    id: `hit-${Date.now()}-${Math.random()}`,
                    position: new THREE.Vector3(position.x, position.y, position.z),
                    timestamp: Date.now()
                }
            ]);
        };
        
        window.addEventListener('jackalopeHitVisual', handleHitVisual as EventListener);
        
        return () => {
            window.removeEventListener('jackalopeHitVisual', handleHitVisual as EventListener);
        };
    }, []);
    
    // Clean up old effects
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            setHitEffects(prev => prev.filter(effect => now - effect.timestamp < 1000)); // Remove effects older than 1 second
        }, 1000);
        
        return () => clearInterval(cleanup);
    }, []);
    
    // Render all current hit effects
    return (
        <>
            {hitEffects.map(effect => (
                <HitEffect 
                    key={effect.id} 
                    position={effect.position}
                    color="#00aaff" // Blue color for jackalope hits
                />
            ))}
        </>
    );
};

export default JackalopeHitEffects; 