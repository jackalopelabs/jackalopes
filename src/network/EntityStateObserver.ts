// EntityStateObserver.ts
// A centralized system to ensure consistency across character models, sounds, and events

import { EventEmitter } from 'events';
import * as THREE from 'three';

export interface EntityState {
  id: string;
  type: 'merc' | 'jackalope';
  position: [number, number, number];
  rotation: number | [number, number, number, number];
  isMoving: boolean;
  isRunning: boolean;
  isShooting: boolean;
  health: number;
  lastUpdate: number;
  [key: string]: any; // Add index signature to allow string key access
}

// Add global declaration for debugging
declare global {
  interface Window {
    __entityStateObserver?: EntityStateObserver;
  }
}

class EntityStateObserver extends EventEmitter {
  private entities: Record<string, EntityState> = {};
  private localPlayerId: string | null = null;
  private debug: boolean = false;
  
  constructor() {
    super();
    // Register global instance for debugging
    if (typeof window !== 'undefined') {
      window.__entityStateObserver = this;
    }
    console.log('📝 EntityStateObserver initialized');
  }
  
  /**
   * Set the local player ID to distinguish local from remote entities
   */
  setLocalPlayerId(id: string) {
    this.localPlayerId = id;
    console.log(`📝 EntityStateObserver: Local player ID set to ${id}`);
  }
  
  /**
   * Enable/disable debug mode for more verbose logging
   */
  setDebug(enabled: boolean) {
    this.debug = enabled;
    if (enabled) console.log('📝 EntityStateObserver: Debug mode enabled');
  }

  /**
   * Normalize rotation data to a standard format
   * This helps handle different rotation formats from the server
   */
  private normalizeRotation(rotation: number | [number, number, number, number]): number {
    if (typeof rotation === 'number') {
      // Already a yaw angle in radians
      return rotation;
    }
    
    try {
      // It's a quaternion, convert to Euler angles
      const quaternion = new THREE.Quaternion(
        rotation[0], rotation[1], rotation[2], rotation[3]
      );
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
      
      // Return just the Y component (yaw angle) as that's what most of our systems use
      return euler.y;
    } catch (error) {
      console.warn('📝 Error normalizing rotation:', error);
      return 0; // Default rotation
    }
  }

  /**
   * Register a new entity or update an existing one
   */
  updateEntity(state: Partial<EntityState> & { id: string }): void {
    const existingEntity = this.entities[state.id];
    
    // Normalize rotation if provided
    if (state.rotation !== undefined) {
      state.rotation = this.normalizeRotation(state.rotation);
    }
    
    // Initialize if this is a new entity
    if (!existingEntity) {
      this.entities[state.id] = {
        id: state.id,
        type: state.type || 'merc', // Default to merc
        position: state.position || [0, 0, 0],
        rotation: state.rotation || 0,
        isMoving: state.isMoving || false,
        isRunning: state.isRunning || false,
        isShooting: state.isShooting || false,
        health: state.health || 100,
        lastUpdate: Date.now()
      };
      
      if (this.debug) {
        console.log(`📝 Entity registered: ${state.id} (${this.entities[state.id].type})`);
      }
      
      // Emit new entity event
      this.emit('entityAdded', this.entities[state.id]);
      return;
    }
    
    // Never change entity type once set
    const updatedState = { 
      ...existingEntity,
      ...state,
      // Preserve the original type, never override
      type: existingEntity.type,
      lastUpdate: Date.now()
    };
    
    // Track what changed for targeted events
    const changes: string[] = [];
    for (const [key, value] of Object.entries(state)) {
      if (key !== 'id' && key !== 'lastUpdate' && JSON.stringify(existingEntity[key]) !== JSON.stringify(value)) {
        changes.push(key);
      }
    }
    
    // Update the entity
    this.entities[state.id] = updatedState;
    
    // Emit change event with the list of changes
    if (changes.length > 0) {
      if (this.debug) {
        console.log(`📝 Entity ${state.id} updated:`, changes.join(', '));
      }
      this.emit('entityChanged', updatedState, changes);
      
      // Also emit specific events for particular changes
      if (changes.includes('isShooting') && updatedState.isShooting) {
        this.emit('entityShot', updatedState);
      }
      if (changes.includes('isMoving') || changes.includes('isRunning')) {
        this.emit('entityMoved', updatedState);
      }
      if (changes.includes('health')) {
        this.emit('entityHealthChanged', updatedState);
      }
    }
  }
  
  /**
   * Record a shooting event for an entity
   */
  recordShot(entityId: string, origin: [number, number, number], direction: [number, number, number]): void {
    const entity = this.entities[entityId];
    if (!entity) {
      console.warn(`📝 Cannot record shot: Entity ${entityId} not found`);
      return;
    }
    
    // Update entity state
    this.updateEntity({
      id: entityId,
      isShooting: true,
      // Reset after 300ms
      lastUpdate: Date.now()
    });
    
    // Emit shot event with directional data
    this.emit('entityShot', {
      ...entity,
      shotOrigin: origin,
      shotDirection: direction,
      timestamp: Date.now()
    });
    
    // Reset shooting state after 300ms
    setTimeout(() => {
      this.updateEntity({
        id: entityId,
        isShooting: false
      });
    }, 300);
  }
  
  /**
   * Get an entity by ID
   */
  getEntity(id: string): EntityState | null {
    return this.entities[id] || null;
  }
  
  /**
   * Get all entities
   */
  getAllEntities(): Record<string, EntityState> {
    return { ...this.entities };
  }
  
  /**
   * Get local player entity
   */
  getLocalEntity(): EntityState | null {
    return this.localPlayerId ? this.entities[this.localPlayerId] || null : null;
  }
  
  /**
   * Remove an entity
   */
  removeEntity(id: string): void {
    if (this.entities[id]) {
      const entity = this.entities[id];
      delete this.entities[id];
      this.emit('entityRemoved', entity);
      if (this.debug) {
        console.log(`📝 Entity removed: ${id}`);
      }
    }
  }
  
  /**
   * Get fixed character type for player index
   * This ensures consistent character type assignment based on player index
   */
  getCharacterTypeForPlayerIndex(index: number): 'merc' | 'jackalope' {
    // Even indexes (0, 2, 4) are jackalope players
    // Odd indexes (1, 3, 5) are merc players
    return index % 2 === 0 ? 'jackalope' : 'merc';
  }
}

// Create a singleton instance
export const entityStateObserver = new EntityStateObserver();

// Export the singleton instance
export default entityStateObserver; 