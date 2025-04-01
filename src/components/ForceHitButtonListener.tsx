import { useEffect } from 'react';

interface ForceHitButtonListenerProps {
  connectionManager: any;
  playerCharacterInfo: {
    type: 'merc' | 'jackalope';
    thirdPerson: boolean;
  };
  setJackalopeShouldRespawn: (value: boolean) => void;
  setRespawnTriggered: (callback: (prev: number) => number) => void;
  respawnInProgress: React.MutableRefObject<boolean>;
}

/**
 * ForceHitButtonListener - A component that listens for the forceHitButton event
 * and handles respawn functionality specifically for direct button events
 */
const ForceHitButtonListener: React.FC<ForceHitButtonListenerProps> = ({
  connectionManager,
  playerCharacterInfo,
  setJackalopeShouldRespawn,
  setRespawnTriggered,
  respawnInProgress
}) => {
  useEffect(() => {
    // Only set up the listener if connection manager is available
    if (!connectionManager) return;
    
    // Handler for the direct forceHitButton event 
    const handleForceHitButton = (event: CustomEvent) => {
      console.log("🎯 ForceHitButtonListener: Event received directly", event.detail);
      
      // If we're a jackalope player, this should trigger a respawn regardless of target
      if (playerCharacterInfo.type === 'jackalope' && !respawnInProgress.current) {
        console.log("💡 ForceHitButtonListener: Triggering jackalope respawn via direct event");
        
        // Force respawn
        respawnInProgress.current = true;
        setJackalopeShouldRespawn(true);
        setRespawnTriggered(prev => prev + 1);
        
        // Extend spawn distance
        if (window.__extendJackalopeSpawnDistance) {
          window.__extendJackalopeSpawnDistance();
        }
        
        // Reset respawn flag after a delay
        setTimeout(() => {
          setJackalopeShouldRespawn(false);
          respawnInProgress.current = false;
        }, 2000);
      } else {
        console.log("👀 ForceHitButtonListener: Event ignored - not a jackalope or respawn in progress");
      }
    };
    
    // Add event listener
    window.addEventListener('forceHitButton', handleForceHitButton as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('forceHitButton', handleForceHitButton as EventListener);
    };
  }, [connectionManager, playerCharacterInfo.type, setJackalopeShouldRespawn, setRespawnTriggered, respawnInProgress]);
  
  // This component doesn't render anything
  return null;
};

export default ForceHitButtonListener; 