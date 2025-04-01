import * as THREE from 'three';

// Type for a registered jackalope
export interface RegisteredJackalope {
    id: string;
    lastSeen: number;
    position: [number, number, number];
}

// Initialize the global registry if it doesn't exist
if (typeof window !== 'undefined' && !window.__knownJackalopes) {
    window.__knownJackalopes = {};
}

/**
 * JackalopeRegistry - Utility to manage jackalope tracking
 * 
 * This centralizes all functionality related to tracking jackalopes in the scene
 * and provides helper methods for finding and targeting jackalopes.
 */
export class JackalopeRegistry {
    /**
     * Register a jackalope in the global registry
     */
    static registerJackalope(id: string, position: THREE.Vector3): void {
        if (!window.__knownJackalopes) {
            window.__knownJackalopes = {};
        }
        
        window.__knownJackalopes[id] = {
            lastSeen: Date.now(),
            position: [position.x, position.y, position.z]
        };
    }
    
    /**
     * Register multiple jackalopes at once
     */
    static registerMany(jackalopes: {id: string, position: THREE.Vector3}[]): void {
        jackalopes.forEach(jackalope => {
            this.registerJackalope(jackalope.id, jackalope.position);
        });
        
        // Occasionally log registry status for debugging
        if (Math.random() < 0.01) {
            this.logRegistryStatus();
        }
    }
    
    /**
     * Find all jackalopes in a scene
     */
    static findJackalopesInScene(scene: THREE.Scene): {id: string, position: THREE.Vector3}[] {
        const foundJackalopes: {id: string, position: THREE.Vector3}[] = [];
        
        scene.traverse((object: THREE.Object3D) => {
            // Check for jackalope indicators
            const isJackalope = 
                (object.name && (object.name.toLowerCase().includes('jackalope') || object.name.toLowerCase() === 'jackalope')) ||
                (object.userData && object.userData.isJackalope) ||
                (object.userData && object.userData.jackalopeId) ||
                (object.userData && object.userData.playerType === 'jackalope') ||
                // Check parent for jackalope indicators
                (object.parent && object.parent.name && object.parent.name.toLowerCase().includes('jackalope')) ||
                (object.parent && object.parent.userData && object.parent.userData.isJackalope);
            
            if (isJackalope) {
                // Extract ID using multiple methods
                let id = 
                    (object.userData && object.userData.jackalopeId) || 
                    (object.userData && object.userData.playerId) ||
                    (object.parent && object.parent.userData && object.parent.userData.jackalopeId) ||
                    (object.parent && object.parent.userData && object.parent.userData.playerId);
                
                // If we still don't have an ID but have a name with format name-id
                if (!id && object.name && object.name.includes('-')) {
                    const parts = object.name.split('-');
                    id = parts[parts.length - 1];
                }
                
                // If we have an ID, add to found jackalopes
                if (id) {
                    const position = new THREE.Vector3();
                    object.getWorldPosition(position);
                    
                    // Only add if not already added with this ID
                    if (!foundJackalopes.some(j => j.id === id)) {
                        foundJackalopes.push({
                            id,
                            position
                        });
                    }
                }
            }
        });
        
        return foundJackalopes;
    }
    
    /**
     * Gets a jackalope by ID
     */
    static getJackalope(id: string): RegisteredJackalope | null {
        if (!window.__knownJackalopes) {
            return null;
        }
        
        return window.__knownJackalopes[id] 
            ? { id, ...window.__knownJackalopes[id] }
            : null;
    }
    
    /**
     * Gets all registered jackalopes
     */
    static getAllJackalopes(): RegisteredJackalope[] {
        if (!window.__knownJackalopes) {
            return [];
        }
        
        return Object.entries(window.__knownJackalopes).map(([id, data]) => ({
            id,
            ...data
        }));
    }
    
    /**
     * Get the number of registered jackalopes
     */
    static getCount(): number {
        if (!window.__knownJackalopes) {
            return 0;
        }
        
        return Object.keys(window.__knownJackalopes).length;
    }
    
    /**
     * Force a hit on a jackalope by ID
     */
    static forceHitJackalope(id: string): boolean {
        console.log(`🎯 JackalopeRegistry: Forcing hit on jackalope ${id}`);
        
        if (window.__forceTriggerJackalopeHit) {
            return window.__forceTriggerJackalopeHit(id);
        } else {
            // Fallback if force function is not available
            console.log(`🎯 JackalopeRegistry: Using fallback hit method for ${id}`);
            window.__jackalopeRespawnTarget = id;
            
            // Dispatch direct event with consistent sourcePlayerId for better handling
            window.dispatchEvent(new CustomEvent('jackalopeHit', {
                detail: {
                    hitPlayerId: id,
                    sourcePlayerId: 'force-hit-button',
                    timestamp: Date.now()
                }
            }));
            
            return true;
        }
    }
    
    /**
     * Clean old entries from the registry
     */
    static cleanRegistry(maxAgeMs: number = 10000): void {
        if (!window.__knownJackalopes) {
            return;
        }
        
        const now = Date.now();
        const toRemove: string[] = [];
        
        // Find old entries
        Object.entries(window.__knownJackalopes).forEach(([id, data]) => {
            if (now - data.lastSeen > maxAgeMs) {
                toRemove.push(id);
            }
        });
        
        // Remove old entries
        toRemove.forEach(id => {
            if (window.__knownJackalopes) {
                delete window.__knownJackalopes[id];
            }
        });
        
        if (toRemove.length > 0) {
            console.log(`🧹 Cleaned ${toRemove.length} old jackalopes from registry`);
        }
    }
    
    /**
     * Log the current registry status
     */
    static logRegistryStatus(): void {
        const count = this.getCount();
        console.log(`📋 Jackalope Registry Status: ${count} jackalopes registered`);
        
        if (count > 0) {
            const jackalopes = this.getAllJackalopes();
            console.log(`   First jackalope: ${jackalopes[0].id} at position [${jackalopes[0].position.join(', ')}]`);
        }
    }
}

// Export a singleton instance
export default JackalopeRegistry; 