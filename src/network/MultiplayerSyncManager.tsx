// MultiplayerSyncManager.tsx
// Ensures entities are consistently represented between systems

import React, { useEffect, useState, useRef } from 'react';
import { ConnectionManager } from './ConnectionManager';
import entityStateObserver from './EntityStateObserver';
import { RemotePlayer } from '../game/RemotePlayer';
import { log, DEBUG_LEVELS, isDebugEnabled } from '../utils/debugUtils';

interface MultiplayerSyncManagerProps {
  connectionManager: ConnectionManager;
}

/**
 * MultiplayerSyncManager ensures consistent entity representation 
 * across the network, sound, and visual systems
 */
export const MultiplayerSyncManager: React.FC<MultiplayerSyncManagerProps> = ({ 
  connectionManager 
}) => {
  // Track remote players
  const [remoteEntities, setRemoteEntities] = useState<Record<string, any>>({});
  const networkEventHandlersSet = useRef(false);
  const entityEventHandlersSet = useRef(false);
  
  // Set up network event listeners
  useEffect(() => {
    if (!connectionManager || networkEventHandlersSet.current) return;
    
    console.log('🔄 MultiplayerSyncManager: Setting up network event handlers');
    
    // When a player joins, ensure they're in the EntityStateObserver
    const handlePlayerJoined = (data: any) => {
      console.log('🔄 Player joined event received:', data);
      
      // Make sure it's not our own player
      if (data.id === connectionManager.getPlayerId()) {
        console.log('Ignoring join event for local player');
        return;
      }
      
      // Get the player type from the connection data
      const playerType = data.state?.playerType || data.playerType || 'unknown';
      
      // Determine player type using a more consistent approach
      let finalPlayerType: 'merc' | 'jackalope' = 'merc';
      
      if (playerType !== 'unknown' && (playerType === 'merc' || playerType === 'jackalope')) {
        // Use the explicitly provided type if valid
        finalPlayerType = playerType as 'merc' | 'jackalope';
        console.log(`🔄 Using explicitly provided player type: ${finalPlayerType}`);
      } else {
        // Fall back to player index parity (even = jackalope, odd = merc)
        // Use player ID hash for consistent assignment across sessions
        let playerIndex = 0;
        try {
          // Use a simple hash of the player ID
          const idSum = data.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
          playerIndex = idSum % 10; // Keep it to single digit for simplicity
        } catch (e) {
          console.error('Error generating player index from ID:', e);
        }
        
        finalPlayerType = playerIndex % 2 === 0 ? 'jackalope' : 'merc';
        console.log(`🔄 Assigned player type ${finalPlayerType} based on ID hash: ${playerIndex}`);
      }
      
      // Register the entity in the EntityStateObserver
      entityStateObserver.updateEntity({
        id: data.id,
        type: finalPlayerType,
        position: data.state?.position || [0, 1, 0],
        rotation: data.state?.rotation || 0,
        isMoving: false,
        isRunning: false,
        isShooting: false,
        health: 100
      });
      
      // Update our local state to trigger rendering
      setRemoteEntities(prev => {
        // Skip if entity already exists with the same type
        if (prev[data.id] && prev[data.id].type === finalPlayerType) {
          return prev;
        }
        
        return {
          ...prev,
          [data.id]: {
            id: data.id,
            type: finalPlayerType,
            position: data.state?.position || [0, 1, 0],
            rotation: data.state?.rotation || 0
          }
        };
      });
    };
    
    // When a player updates their state, update EntityStateObserver
    const handlePlayerUpdate = (data: any) => {
      // Skip updates from ourselves
      if (data.id === connectionManager.getPlayerId()) {
        return;
      }
      
      // Get the player type from the update data or defaults
      const playerType = data.playerType || data.state?.playerType;
      
      // We need at least a position to update
      if (data.position) {
        // Update the EntityStateObserver
        entityStateObserver.updateEntity({
          id: data.id,
          // Only include type if explicitly provided
          ...(playerType ? { type: playerType as 'merc' | 'jackalope' } : {}),
          position: data.position,
          rotation: data.rotation || 0,
          // Detect movement by position change
          isMoving: data.state?.velocity ? (
            Math.abs(data.state.velocity[0]) > 0.01 || 
            Math.abs(data.state.velocity[2]) > 0.01
          ) : undefined,
          // Detect running by velocity magnitude
          isRunning: data.state?.velocity ? (
            Math.sqrt(
              data.state.velocity[0] * data.state.velocity[0] + 
              data.state.velocity[2] * data.state.velocity[2]
            ) > 0.2
          ) : undefined
        });
      }
    };
    
    // When a player leaves, remove them from EntityStateObserver
    const handlePlayerLeft = (data: any) => {
      if (data.id) {
        // Remove from EntityStateObserver
        entityStateObserver.removeEntity(data.id);
        
        // Update our local state to remove the entity
        setRemoteEntities(prev => {
          const newEntities = { ...prev };
          delete newEntities[data.id];
          return newEntities;
        });
      }
    };
    
    // When a game event occurs, process it
    const handleGameEvent = (event: any) => {
      // Only handle shooting events for now
      if (event.event_type === 'player_shoot' || 
          event.type === 'player_shoot') {
        
        const playerId = event.player_id || event.player;
        
        // Skip our own shots
        if (playerId === connectionManager.getPlayerId()) {
          return;
        }
        
        console.log('🔄 Processing remote shot event:', event);
        
        // Ensure we have this player in EntityStateObserver
        const origin = event.origin || [0, 1, 0];
        const direction = event.direction || [1, 0, 0];
        
        // Get the player type for proper shot sound
        const playerType = event.playerType || 'merc';
        
        // Check if entity exists, create if needed
        const existingEntity = entityStateObserver.getEntity(playerId);
        if (!existingEntity) {
          // Register a new entity with the shot information
          entityStateObserver.updateEntity({
            id: playerId,
            type: playerType as 'merc' | 'jackalope',
            position: origin,
            rotation: 0,
            isMoving: false,
            isRunning: false,
            isShooting: true, 
            health: 100
          });
          
          console.log(`🔄 Created new entity for shooter: ${playerId} (${playerType})`);
        } else {
          // Record the shot in EntityStateObserver
          entityStateObserver.recordShot(playerId, origin, direction);
        }
      }
    };
    
    // Register event handlers
    connectionManager.on('player_joined', handlePlayerJoined);
    connectionManager.on('player_update', handlePlayerUpdate);
    connectionManager.on('player_left', handlePlayerLeft);
    connectionManager.on('game_event', handleGameEvent);
    
    // Set flag to prevent duplicate event registration
    networkEventHandlersSet.current = true;
    
    // Clean up on unmount
    return () => {
      if (connectionManager) {
        connectionManager.off('player_joined', handlePlayerJoined);
        connectionManager.off('player_update', handlePlayerUpdate);
        connectionManager.off('player_left', handlePlayerLeft);
        connectionManager.off('game_event', handleGameEvent);
      }
      networkEventHandlersSet.current = false;
    };
  }, [connectionManager]);
  
  // Set up entity event listeners
  useEffect(() => {
    if (entityEventHandlersSet.current) return;
    
    // When a new entity is added, add it to our local state
    const handleEntityAdded = (entity: any) => {
      console.log('🔄 Entity added from EntityStateObserver:', entity);
      
      // Skip our own entity
      if (entity.id === connectionManager?.getPlayerId()) {
        return;
      }
      
      // Update our local state to include this entity
      setRemoteEntities(prev => {
        // Skip if entity already exists with the same type
        if (prev[entity.id] && prev[entity.id].type === entity.type) {
          return prev;
        }
        
        return {
          ...prev,
          [entity.id]: {
            id: entity.id,
            type: entity.type,
            position: entity.position,
            rotation: entity.rotation
          }
        };
      });
    };
    
    // When an entity is removed, remove it from our local state
    const handleEntityRemoved = (entity: any) => {
      // Skip our own entity
      if (entity.id === connectionManager?.getPlayerId()) {
        return;
      }
      
      // Update our local state to remove the entity
      setRemoteEntities(prev => {
        const newEntities = { ...prev };
        delete newEntities[entity.id];
        return newEntities;
      });
    };
    
    // Register event handlers
    entityStateObserver.on('entityAdded', handleEntityAdded);
    entityStateObserver.on('entityRemoved', handleEntityRemoved);
    
    // Set flag to prevent duplicate event registration
    entityEventHandlersSet.current = true;
    
    // Clean up on unmount
    return () => {
      entityStateObserver.off('entityAdded', handleEntityAdded);
      entityStateObserver.off('entityRemoved', handleEntityRemoved);
      entityEventHandlersSet.current = false;
    };
  }, [connectionManager]);
  
  // Initialize local player in EntityStateObserver
  useEffect(() => {
    if (!connectionManager) return;
    
    // Get local player ID and type
    const playerId = connectionManager.getPlayerId();
    const playerType = connectionManager.getAssignedPlayerType();
    
    // Register the local player with EntityStateObserver
    if (playerId) {
      console.log(`🔄 Registering local player: ${playerId} (${playerType})`);
      
      entityStateObserver.setLocalPlayerId(playerId);
      entityStateObserver.updateEntity({
        id: playerId,
        type: playerType,
        position: [0, 1, 0], // Default position
        rotation: 0,
        isMoving: false,
        isRunning: false,
        isShooting: false,
        health: 100
      });
    }
  }, [connectionManager?.getPlayerId()]);
  
  // Log remote entities for debugging
  useEffect(() => {
    if (Object.keys(remoteEntities).length > 0 && isDebugEnabled(DEBUG_LEVELS.INFO)) {
      log.debug('Remote entities in MultiplayerSyncManager:', remoteEntities);
    }
  }, [remoteEntities]);
  
  // We don't need to render anything directly - this is just a sync manager
  return null;
};

export default MultiplayerSyncManager; 