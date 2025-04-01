import { ConnectionManager } from './connectionManager';
import { JackalopesGameSettings, JackalopesGameOptions } from '../types/wordpress';

/**
 * Jackalopes Game - WordPress Plugin Integration Utilities
 * 
 * This module provides integration functions for the WordPress plugin.
 */

/**
 * Initialize debug features
 */
function setupDebugHelpers() {
  // Set debug level function
  window.__setDebugLevel = (level: number) => {
    if (window.jackalopesGame) {
      window.jackalopesGame.debugLevel = level;
    }
    console.log(`Debug level set to ${level}`);
    return `Debug level set to ${level}`;
  };
  
  // Set graphics quality function
  window.__setGraphicsQuality = (quality: 'auto' | 'high' | 'medium' | 'low') => {
    console.log(`Graphics quality set to ${quality}`);
    return quality;
  };
  
  // Network logging toggle
  window.__toggleNetworkLogs = (verbose: boolean) => {
    console.log(`Network logs ${verbose ? 'enabled' : 'disabled'}`);
    return `Network logs ${verbose ? 'enabled' : 'disabled'}`;
  };
  
  // Make respawn function available globally
  window.__networkManager = {
    sendRespawnRequest: (playerId: string, spawnPosition?: [number, number, number]) => {
      if (window.connectionManager?.sendRespawnRequest) {
        window.connectionManager.sendRespawnRequest(playerId, spawnPosition);
      }
    }
  };
  
  // Initialize full game objects
  if (!window.jackalopesGame) {
    window.jackalopesGame = {
      playerType: 'merc',
      debugLevel: 1,
      levaPanelState: 'closed',
      flashlightOn: false,
      spawnManager: {
        baseSpawnX: -100,
        currentSpawnX: -100,
        stepSize: 50,
        minX: -500,
        getNextSpawnPoint: function(): [number, number, number] {
          this.currentSpawnX = Math.max(this.minX, this.currentSpawnX - this.stepSize);
          console.log(`🐰 [SpawnManager] Next spawn at X: ${this.currentSpawnX}`);
          return [this.currentSpawnX, 3, 10];
        },
        resetSpawnPoints: function() {
          console.log(`🐰 [SpawnManager] Resetting spawn positions to base X: ${this.baseSpawnX}`);
          this.currentSpawnX = this.baseSpawnX;
          return [this.currentSpawnX, 3, 10];
        },
        getSpawnPoint: function(): [number, number, number] {
          return [this.currentSpawnX, 3, 10];
        }
      }
    };
  }
  
  // Initialize processed shots set to prevent duplicates
  if (!window.__processedShots) {
    window.__processedShots = new Set<string>();
  }
}

/**
 * Setup WordPress game integration
 */
export function setupWPGameIntegration() {
  // Initialize debug helpers
  setupDebugHelpers();
  
  console.log('WordPress integration setup complete');
} 