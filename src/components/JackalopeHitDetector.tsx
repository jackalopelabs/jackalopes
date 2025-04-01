import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * JackalopeHitDetector
 * 
 * This component detects collisions between Merc projectiles and Jackalope players.
 * When a collision is detected, it sends a hit event through the ConnectionManager.
 */
export const JackalopeHitDetector = () => {
    const { scene } = useThree();
    const frameCount = useRef(0);
    const lastDetectionTime = useRef(0);
    const detectionInterval = 100; // milliseconds between detection checks
    
    // Function to find projectiles in the scene
    const findProjectiles = () => {
        const projectiles: {
            id: string,
            position: THREE.Vector3,
            createdByLocalPlayer: boolean
        }[] = [];
        
        let spheresFound = 0;
        let confirmProjectiles = 0;
        
        scene.traverse((object) => {
            // Look for projectiles (spheres) in the scene using multiple detection methods
            const isSphere = 
                (object.userData && (
                    object.userData.isFireball || 
                    object.userData.isSphere || 
                    object.userData.isProjectile
                )) ||
                (object.name && (
                    object.name.toLowerCase().includes('sphere') ||
                    object.name.toLowerCase().includes('projectile') ||
                    object.name.toLowerCase().includes('fireball')
                ));
            
            if (isSphere) {
                spheresFound++;
                
                // Consider all spheres created by local player unless explicitly marked otherwise
                // This ensures we detect more potential collisions
                const createdByLocalPlayer = object.userData?.createdByLocalPlayer !== false;
                
                // Add to list if it has a position
                if (object.position) {
                    confirmProjectiles++;
                    
                    projectiles.push({
                        id: object.name || object.uuid,
                        position: object.position.clone(),
                        createdByLocalPlayer
                    });
                    
                    // Log occasionally for debugging
                    if (frameCount.current % 120 === 0 && projectiles.length > 0) {
                        console.log(`🔴 Found projectile: ID=${object.name || object.uuid}, Position=${object.position.x.toFixed(2)},${object.position.y.toFixed(2)},${object.position.z.toFixed(2)}`);
                    }
                }
            }
        });
        
        // Log debugging info occasionally
        if (frameCount.current % 60 === 0) {
            console.log(`💥 Projectile scan: Found ${spheresFound} sphere objects, ${confirmProjectiles} with positions`);
        }
        
        return projectiles;
    };
    
    // Function to find remote Jackalope players in the scene
    const findRemoteJackalopes = () => {
        const jackalopes: {
            id: string,
            position: THREE.Vector3,
            object: THREE.Object3D
        }[] = [];
        
        // Debug counter for scanning
        let objectsScanned = 0;
        let potentialJackalopes = 0;
        let detailedLogging = false; // Toggle for more verbose logging
        
        // Force more detailed logging once every ~5 seconds
        if (frameCount.current % 150 === 0) {
            detailedLogging = true;
            console.log("🔍 DETAILED JACKALOPE SCAN - Hunting for jackalope objects...");
        }
        
        scene.traverse((object) => {
            objectsScanned++;
            
            // Check name first - this is the most reliable indicator
            const name = object.name?.toLowerCase() || '';
            const containsJackalope = name.includes('jackalope');
            
            // If this object has any reference to jackalope in the name or userData, log it
            if ((containsJackalope || 
                (object.userData && object.userData.isJackalope) ||
                (object.userData && object.userData.playerType === 'jackalope')) && 
                detailedLogging) {
                
                console.log(`🐰 FOUND POTENTIAL JACKALOPE: "${name}"`, {
                    position: object.position,
                    userData: object.userData,
                    parent: object.parent?.name,
                    parentUserData: object.parent?.userData
                });
            }
            
            // More exhaustive checks to find Jackalope players
            if (object.userData) {
                // Check for various ways a Jackalope might be identified
                const isJackalope = 
                    containsJackalope ||
                    object.userData.isJackalope === true || 
                    object.userData.playerType === 'jackalope' ||
                    (object.parent?.userData?.isJackalope === true) ||
                    (object.parent?.userData?.playerType === 'jackalope');
                
                // If this looks like a Jackalope, add it to potential jackalopes
                if (isJackalope) {
                    potentialJackalopes++;
                    
                    // Try multiple ways to get the player ID
                    let playerId = object.userData.playerId || 
                                  object.userData.id || 
                                  (object.parent && object.parent.userData && object.parent.userData.playerId);
                    
                    // If no ID is found but this is definitely a jackalope, create a fallback ID
                    if (!playerId && isJackalope) {
                        // Try to extract from name if possible
                        if (name.includes('-')) {
                            const parts = name.split('-');
                            playerId = parts[parts.length - 1];
                        } else {
                            // Use a consistent fallback ID for this jackalope by hashing its position
                            // This ensures the same jackalope always gets the same ID
                            const posHash = `${Math.round(object.position.x)}-${Math.round(object.position.y)}-${Math.round(object.position.z)}`;
                            playerId = `unknown-jackalope-${posHash}`;
                        }
                    }
                    
                    if (playerId) {
                        // Only add once for each unique jackalope ID 
                        if (!jackalopes.some(j => j.id === playerId)) {
                            jackalopes.push({
                                id: playerId,
                                position: object.position.clone(),
                                object
                            });
                            
                            // Add extra debug info with more frequency
                            if (detailedLogging || frameCount.current % 60 === 0) {
                                console.log(`🐰 Found Jackalope: ID=${playerId}, Position=${object.position.x.toFixed(2)},${object.position.y.toFixed(2)},${object.position.z.toFixed(2)}`);
                            }
                        }
                    }
                }
            }
        });
        
        // Print debug info about what we found on longer intervals
        if (frameCount.current % 60 === 0) {
            console.log(`🔍 Scene scanning: Checked ${objectsScanned} objects, found ${potentialJackalopes} potential Jackalopes, confirmed ${jackalopes.length} with IDs`);
            
            // If we found jackalopes, ensure they are registered globally
            if (jackalopes.length > 0) {
                console.log("🐰 Registered jackalopes:", jackalopes.map(j => j.id).join(', '));
                
                // Register jackalopes to a global registry for targeting
                if (!window.__knownJackalopes) {
                    window.__knownJackalopes = {};
                }
                
                // Update the global registry with all found jackalopes
                jackalopes.forEach(j => {
                    window.__knownJackalopes![j.id] = {
                        lastSeen: Date.now(),
                        position: [j.position.x, j.position.y, j.position.z]
                    };
                });
            }
        }
        
        return jackalopes;
    };
    
    // Check for collisions between projectiles and Jackalopes
    const checkCollisions = () => {
        const now = Date.now();
        if (now - lastDetectionTime.current < detectionInterval) {
            return; // Don't check too frequently
        }
        
        lastDetectionTime.current = now;
        frameCount.current++;
        
        // Find all relevant objects
        const projectiles = findProjectiles();
        const jackalopes = findRemoteJackalopes();
        
        // No need to continue if there are no projectiles or jackalopes
        if (projectiles.length === 0 || jackalopes.length === 0) {
            return;
        }
        
        // Debug info
        if (frameCount.current % 60 === 0) { // Every ~2 seconds at 30fps
            console.log(`🎯 Hit check: Testing ${projectiles.length} projectiles against ${jackalopes.length} jackalopes`);
        }
        
        // Check for collisions
        for (const projectile of projectiles) {
            for (const jackalope of jackalopes) {
                // Calculate distance between projectile and jackalope
                const distance = projectile.position.distanceTo(jackalope.position);
                
                // If distance is less than a threshold, consider it a hit
                const hitThreshold = 3.0; // Increased from 2.0 to make hits more generous
                
                if (distance < hitThreshold) {
                    // Add detailed debug logging
                    console.log(`🎯 HIT DETECTED! Distance: ${distance.toFixed(2)}, Threshold: ${hitThreshold}
                    Projectile: ${projectile.id} at (${projectile.position.x.toFixed(2)}, ${projectile.position.y.toFixed(2)}, ${projectile.position.z.toFixed(2)})
                    Jackalope: ${jackalope.id} at (${jackalope.position.x.toFixed(2)}, ${jackalope.position.y.toFixed(2)}, ${jackalope.position.z.toFixed(2)})`);
                    
                    // Send hit event through ConnectionManager
                    if (window.connectionManager) {
                        console.log(`🎯 Sending jackalope hit event via ConnectionManager: ${jackalope.id}`);
                        window.connectionManager.sendJackalopeHitEvent(jackalope.id);
                        
                        // Also dispatch a local event for visual/audio effects
                        window.dispatchEvent(new CustomEvent('jackalopeHitVisual', {
                            detail: {
                                position: jackalope.position,
                                jackalopeId: jackalope.id
                            }
                        }));
                        
                        // Play hit sound if available
                        if (window.__playJackalopeHitSound) {
                            window.__playJackalopeHitSound();
                        }
                        
                        // Direct hit event - not relying only on ConnectionManager
                        console.log(`🎯 Dispatching direct jackalopeHit event`);
                        window.dispatchEvent(new CustomEvent('jackalopeHit', {
                            detail: {
                                hitPlayerId: jackalope.id,
                                sourcePlayerId: 'local-player', // Since we don't have the actual source ID
                                timestamp: Date.now()
                            }
                        }));
                    } else {
                        console.warn("ConnectionManager not available, sending direct hit event only");
                        // Even without ConnectionManager, dispatch the event directly
                        window.dispatchEvent(new CustomEvent('jackalopeHit', {
                            detail: {
                                hitPlayerId: jackalope.id,
                                sourcePlayerId: 'local-player',
                                timestamp: Date.now()
                            }
                        }));
                    }
                    
                    // Don't continue checking this projectile - it has hit something
                    break;
                }
            }
        }
    };
    
    // Run detection on each frame
    useFrame(() => {
        frameCount.current += 1;
        checkCollisions();
    });
    
    // Return null as this is a utility component
    return null;
};

export default JackalopeHitDetector; 