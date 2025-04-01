import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import JackalopeRegistry from '../game/JackalopeRegistry';

/**
 * Base detector that works with a provided scene - can be used outside of Canvas
 */
export const JackalopeHitDetectorBase = (props: { 
  enabled: boolean, 
  scene: THREE.Scene 
}) => {
    const { scene } = props;
    const frameCount = useRef(0);
    const lastDetectionTime = useRef(0);
    const detectionInterval = 100; // milliseconds between detection checks
    
    // Function to find projectiles in the scene
    const findProjectiles = () => {
        const projectiles: { id: string, position: THREE.Vector3, object: THREE.Object3D }[] = [];
        
        scene.traverse((object) => {
            // Look for objects with specific metadata indicating they are projectiles
            if (object.userData?.isSphereProjectile || 
                (object.name && object.name.includes('sphere-projectile'))) {
                
                const position = new THREE.Vector3();
                object.getWorldPosition(position);
                
                projectiles.push({
                    id: object.uuid,
                    position,
                    object
                });
            }
        });
        
        return projectiles;
    };
    
    // Function to scan for Jackalopes, detect collisions, and update registry
    const checkCollisions = () => {
        // Current timestamp for this detection cycle
        const now = Date.now();
        
        // Only check at the specified interval
        if (now - lastDetectionTime.current < detectionInterval) {
            return;
        }
        
        lastDetectionTime.current = now;
        frameCount.current++;
        
        // Find projectiles
        const projectiles = findProjectiles();
        
        // If we have projectiles, search for jackalopes to check for collisions
        if (projectiles.length > 0) {
            // Use our centralized registry to find jackalopes
            const jackalopes = JackalopeRegistry.findJackalopesInScene(scene);
            
            // Update the registry with all found jackalopes
            JackalopeRegistry.registerMany(jackalopes);
            
            // Check for collisions between projectiles and jackalopes
            let collisionDetected = false;
            
            // For each projectile, check against all jackalopes
            projectiles.forEach(projectile => {
                jackalopes.forEach(jackalope => {
                    // Calculate distance between projectile and jackalope
                    const distance = projectile.position.distanceTo(jackalope.position);
                    
                    // Define hit threshold - increased for better detection
                    const hitThreshold = 2.5; // Spheres are about 1 unit, jackalopes about 2 units
                    
                    // If distance is within threshold, we have a hit
                    if (distance < hitThreshold) {
                        collisionDetected = true;
                        console.log(`💥 HIT DETECTED! Projectile ${projectile.id} hit jackalope ${jackalope.id} at distance ${distance.toFixed(2)}`);
                        
                        // Force a hit using our registry's hit function
                        JackalopeRegistry.forceHitJackalope(jackalope.id);
                    }
                });
            });
            
            // Log detection stats occasionally
            if (frameCount.current % 100 === 0 || collisionDetected) {
                console.log(`🔍 JackalopeHitDetector: Found ${projectiles.length} projectiles and ${jackalopes.length} jackalopes.`);
            }
        }
        
        // Periodically clean old registry entries
        if (frameCount.current % 100 === 0) {
            JackalopeRegistry.cleanRegistry();
            if (Math.random() < 0.1) {
                JackalopeRegistry.logRegistryStatus();
            }
        }
    };
    
    // Run collision detection on each frame
    useEffect(() => {
        if (!props.enabled || !scene) return;
        
        const unsubscribe = THREE.MathUtils.generateUUID();
        
        const handleFrame = () => {
            checkCollisions();
        };
        
        // Subscribe to render loop
        const renderLoop = () => {
            handleFrame();
            return requestAnimationFrame(renderLoop);
        };
        
        const handle = renderLoop();
        
        return () => {
            cancelAnimationFrame(handle);
        };
    }, [props.enabled, scene]);
    
    // Add a more aggressive Jackalope scene scanner
    useEffect(() => {
        // Only run if the component is enabled
        if (!props.enabled || !scene) return;
        
        // Check for jackalopes at a higher frequency than collision detection
        const jackalopeScanner = setInterval(() => {
            const foundJackalopes = JackalopeRegistry.findJackalopesInScene(scene);
            
            // Update the global registry with all found jackalopes
            if (foundJackalopes.length > 0) {
                // Log occasionally for debugging
                if (Math.random() < 0.02) {
                    console.log(`🔍 Aggressive scene scan found ${foundJackalopes.length} jackalopes`);
                }
                
                // Register in global registry
                JackalopeRegistry.registerMany(foundJackalopes);
            }
        }, 200); // Run 5 times per second
        
        return () => {
            clearInterval(jackalopeScanner);
        };
    }, [props.enabled, scene]);
    
    // Return null as this is a utility component
    return null;
};

/**
 * JackalopeHitDetector - For use INSIDE a Canvas component
 * Uses useThree to get the scene
 */
export const JackalopeHitDetector = (props: { enabled: boolean }) => {
    const { scene } = useThree();
    return <JackalopeHitDetectorBase {...props} scene={scene} />;
};

/**
 * GlobalJackalopeRegistry - For use OUTSIDE a Canvas component
 * Gets scene via document.querySelector
 */
export const GlobalJackalopeRegistry = (props: { enabled: boolean }) => {
    // Reference to hold the scene once found
    const sceneRef = useRef<THREE.Scene | null>(null);
    
    // Find the scene on mount and when enabled changes
    useEffect(() => {
        if (!props.enabled) return;
        
        // Function to try and find the scene
        const findScene = () => {
            try {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    const r3f = (canvas as any).__r3f;
                    if (r3f && r3f.scene) {
                        sceneRef.current = r3f.scene;
                        console.log('Found Three.js scene for GlobalJackalopeRegistry');
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error('Error finding Three.js scene:', error);
                return false;
            }
        };
        
        // Try to find scene immediately
        if (!findScene()) {
            // If not found, try a few more times with increasing delays
            const attempts = [100, 300, 600, 1000, 2000];
            attempts.forEach((delay, index) => {
                setTimeout(() => {
                    if (!sceneRef.current) {
                        const found = findScene();
                        console.log(`Scene find attempt ${index + 1}: ${found ? 'SUCCESS' : 'FAILED'}`);
                    }
                }, delay);
            });
        }
        
        // Schedule registry cleaning
        const cleanInterval = setInterval(() => {
            JackalopeRegistry.cleanRegistry();
        }, 5000);
        
        return () => {
            clearInterval(cleanInterval);
        };
    }, [props.enabled]);
    
    // Run a scheduled registry scan if needed
    useEffect(() => {
        if (!props.enabled || !sceneRef.current) return;
        
        const scanInterval = setInterval(() => {
            if (sceneRef.current) {
                const jackalopes = JackalopeRegistry.findJackalopesInScene(sceneRef.current);
                if (jackalopes.length > 0) {
                    JackalopeRegistry.registerMany(jackalopes);
                    if (Math.random() < 0.05) {
                        console.log(`GlobalJackalopeRegistry found ${jackalopes.length} jackalopes`);
                    }
                }
            }
        }, 500);
        
        return () => {
            clearInterval(scanInterval);
        };
    }, [props.enabled, sceneRef.current]);
    
    return sceneRef.current ? 
        <JackalopeHitDetectorBase enabled={props.enabled} scene={sceneRef.current} /> : 
        null;
};

export default JackalopeHitDetector; 