// Global type declarations for window properties
interface Window {
  __setGraphicsQuality?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
  __shotBroadcast?: ((shot: any) => any) | undefined;
  __setDebugLevel?: (level: number) => void;
  __playMercShot?: () => void;
  __playerShots?: Record<string, () => boolean>;
  __triggerShot?: (id?: string) => string;
  __jackalopeRespawnTarget?: string;
  __jackalopeRespawnTrigger?: string;
  __jackalopeRespawnTimestamp?: number;
  __knownJackalopes?: Record<string, {
    lastSeen: number;
    position: [number, number, number];
  }>;
  __forceTriggerJackalopeHit?: (jackalopeId: string) => boolean;
  __debugTriggerRespawn?: (jackalopeId?: string) => void;
  setupDebugRespawn?: () => string;
  respawnMe?: () => string;
  
  jackalopesGame?: {
    playerType?: 'merc' | 'jackalope';
    levaPanelState?: 'open' | 'closed';
    flashlightOn?: boolean;
    debugLevel?: number;
  };
  
  playerPositionTracker?: {
    updatePosition: (newPos: THREE.Vector3) => void;
  };
}

// Add colored console functionality
interface Console {
  debug: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
  info: (message?: any, ...optionalParams: any[]) => void;
} 