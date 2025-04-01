// Add this in the sphere-tool.tsx file where collision handling happens
// Look for the SPECIAL HANDLING FOR JACKALOPE COLLISIONS section

// SPECIAL HANDLING FOR JACKALOPE COLLISIONS
if (isJackalopeCollision) {
    console.log("⚡ JACKALOPE HIT - DIRECT COLLISION DETECTED ⚡");
    
    // Mark as stuck immediately to prevent multiple collision handling
    setStuck(true);
    stuckRef.current = true;
    
    try {
        // Get the jackalope ID with improved extraction
        let jackalopeId = targetUserData?.jackalopeId || 
                          targetUserData?.playerId || 
                          parentUserData?.jackalopeId || 
                          parentUserData?.playerId;
                          
        // If we still don't have an ID, try extracting from name
        if (!jackalopeId && targetName) {
            if (targetName.includes('-')) {
                const parts = targetName.split('-');
                jackalopeId = parts[parts.length - 1];
            }
        }
        
        // Send a direct hit event to trigger respawn
        if (jackalopeId) {
            console.log(`🎯 DIRECT HIT ON JACKALOPE: ${jackalopeId}`);
            
            // Try through ConnectionManager
            if (window.connectionManager) {
                window.connectionManager.sendJackalopeHitEvent(jackalopeId);
            }
            
            // Also dispatch direct event
            window.dispatchEvent(new CustomEvent('jackalopeHit', {
                detail: {
                    hitPlayerId: jackalopeId,
                    sourcePlayerId: 'projectile-source', // or any other source ID
                    timestamp: Date.now()
                }
            }));
            
            // Dispatch hit visual event for effects
            window.dispatchEvent(new CustomEvent('jackalopeHitVisual', {
                detail: {
                    position: new THREE.Vector3(jackalopePos.x, jackalopePos.y, jackalopePos.z),
                    jackalopeId: jackalopeId
                }
            }));
            
            // Play hit sound effect
            if (window.__playJackalopeHitSound) {
                window.__playJackalopeHitSound();
            }
        }
        
        // Continue with normal attachment logic...
        // ... existing code for getting jackalope position and attaching fireball
    } catch (error) {
        console.error("ERROR IN JACKALOPE HIT HANDLER:", error);
    }
} 