import React, { useCallback } from 'react';
import JackalopeRegistry from '../game/JackalopeRegistry';

/**
 * ForceHitButton - A debug button for mercs to force hit a jackalope
 * 
 * This component renders a button that, when clicked, will force a hit on
 * the first jackalope found in the registry.
 */
const ForceHitButton: React.FC = () => {
    // Handler for button click
    const handleClick = useCallback(() => {
        console.log("🎯 Force Hit Button Pressed");
        
        // Get all registered jackalopes
        const jackalopes = JackalopeRegistry.getAllJackalopes();
        
        if (jackalopes.length > 0) {
            // Pick the first jackalope (or could pick random)
            const jackalope = jackalopes[0];
            console.log(`🎯 Force hitting jackalope: ${jackalope.id}`);
            
            // For maximum reliability, set global flags first
            window.__jackalopeRespawnTarget = jackalope.id;
            window.__jackalopeRespawnTrigger = 'force-hit-button';
            window.__jackalopeRespawnTimestamp = Date.now();
            
            // Use the registry's hit function
            const success = JackalopeRegistry.forceHitJackalope(jackalope.id);
            
            // Show success message
            if (success) {
                alert(`🎯 Hit triggered on Jackalope ${jackalope.id.substring(0, 6)}...`);
            }
        } else {
            console.log("⚠️ No jackalopes found in registry");
            
            // Manually attempt to create a jackalope ID to hit
            const fallbackJackalopeId = `manual-jackalope-${Date.now()}`;
            console.log(`🎯 No jackalopes in registry, trying fallback ID: ${fallbackJackalopeId}`);
            
            // Set global flags for maximum reliability
            window.__jackalopeRespawnTarget = fallbackJackalopeId;
            window.__jackalopeRespawnTrigger = 'force-hit-button';
            window.__jackalopeRespawnTimestamp = Date.now();
            
            // Use the registry's hit function with the fallback ID
            const success = JackalopeRegistry.forceHitJackalope(fallbackJackalopeId);
            
            if (success) {
                alert(`🎯 Hit triggered on fallback Jackalope ${fallbackJackalopeId.substring(0, 8)}...`);
            } else {
                alert("⚠️ No jackalopes found to hit! Make sure there's another player using a Jackalope.");
            }
        }
        
        // Also dispatch a direct force hit event to ensure all systems get notified
        window.dispatchEvent(new CustomEvent('forceHitButton', {
            detail: {
                timestamp: Date.now(),
                trigger: 'force-hit-button'
            },
            bubbles: true
        }));
        
    }, []);
    
    return (
        <button 
            id="force-hit-btn"
            onClick={handleClick}
            style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                padding: '10px 15px',
                background: 'rgba(255, 50, 50, 0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                zIndex: 1000
            }}
        >
            FORCE HIT
        </button>
    );
};

export default ForceHitButton; 