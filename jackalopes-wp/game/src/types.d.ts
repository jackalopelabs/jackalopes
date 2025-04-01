import { JackalopesGameSettings, JackalopesGameOptions } from './types/wordpress';
import { ConnectionManager } from './utils/connectionManager';
import { Vector3, Object3D, Event } from 'three';

// Global type declarations for window properties
interface Window {
  __setGraphicsQuality?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
  __shotBroadcast?: ((shot: any) => any) | undefined;
  __setDebugLevel?: (level: number) => void;
  __playMercShot?: () => void;
  __playerShots?: Record<string, () => boolean>;
  __triggerShot?: (id?: string) => string;
  __toggleNetworkLogs?: (verbose: boolean) => string;
  connectionManager?: any;
  __networkManager?: {
    sendRespawnRequest: (playerId: string, spawnPosition?: [number, number, number]) => void;
  };
  
  jackalopesGame?: {
    playerType?: 'merc' | 'jackalope';
    levaPanelState?: 'open' | 'closed';
    flashlightOn?: boolean;
    debugLevel?: number;
    spawnManager?: {
      baseSpawnX: number;
      currentSpawnX: number;
      stepSize: number;
      minX: number;
      getNextSpawnPoint: () => [number, number, number];
      resetSpawnPoints: () => [number, number, number];
      getSpawnPoint: () => [number, number, number];
    };
  };
  
  playerPositionTracker?: {
    updatePosition: (newPos: THREE.Vector3) => void;
  };
  
  __lastHitJackalope?: string;
}

// Add colored console functionality
interface Console {
  debug: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
  info: (message?: any, ...optionalParams: any[]) => void;
}

declare global {
  interface Window {
    initJackalopesGame: (containerId: string, options?: JackalopesGameOptions) => void;
    jackalopesGameSettings?: JackalopesGameSettings;
    __setGraphicsQuality?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
    __shotBroadcast?: ((shot: any) => any) | undefined;
    __setDebugLevel?: (level: number) => void;
    __toggleNetworkLogs?: (verbose: boolean) => string;
    connectionManager?: any;
    __networkManager?: {
      sendRespawnRequest: (playerId: string, spawnPosition?: [number, number, number]) => void;
    };
    __playMercShot?: () => void;
    __playJackalopeHitSound?: () => void;
    __playMercHitSound?: () => void;
    __jackalopeAttachmentHandlers?: Record<string, (projectileData: {id: string, position: Vector3}) => boolean>;
    __createExplosionEffect?: (position: Vector3, color: string, particleCount: number, radius: number) => void;
    __disableStabilizationFor?: Record<string, boolean>;
    __jackalopeHitHandlers?: Record<string, (projectileId: string, shooterId: string) => boolean>;
    __createSpawnEffect?: (position: Vector3, color: string, particleCount: number, radius: number) => void;
    __lastHitJackalope?: string;
    __processedShots?: Set<string>;
    __fallbackModels?: Record<string, Object3D<Event>>;
    __debugScene?: any;
    __fixModels?: () => void;
    __initializeFallbackModels?: () => void;
    jackalopesGame?: {
      playerType?: 'merc' | 'jackalope';
      levaPanelState?: 'open' | 'closed';
      flashlightOn?: boolean;
      debugLevel?: number;
      spawnManager?: {
        baseSpawnX: number;
        currentSpawnX: number;
        stepSize: number;
        minX: number;
        getNextSpawnPoint: () => [number, number, number];
        resetSpawnPoints: () => [number, number, number];
        getSpawnPoint: () => [number, number, number];
      };
    };
    playerPositionTracker?: {
      updatePosition: (newPos: Vector3) => void;
    };
    __entityStateObserver?: any;
  }
} 