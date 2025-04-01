import { useEffect, useState, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { OrbitControls, Stats } from '@react-three/drei';
import * as THREE from 'three';

// Import our components
import Environment from './components/Environment';
import Player from './components/Player';
import Ground from './components/Ground';

// Import utilities and hooks
import { useConnection, ConnectionStatus } from './hooks/useConnection';
import { getAssetPath } from './utils/assetLoader';
import { PlayerType } from './types/game';

// Define the props for the App component
interface AppProps {
  serverUrl: string;
  isFullscreen: boolean;
  isWordPress: boolean;
  assetsUrl: string;
}

/**
 * Main App component for the Jackalopes game
 */
export default function App({ serverUrl, isFullscreen, isWordPress, assetsUrl }: AppProps) {
  // Player type state (assigned by server)
  const [playerType, setPlayerType] = useState<PlayerType>('merc');
  
  // Camera type (first or third person)
  const [cameraType, setCameraType] = useState<'first-person' | 'third-person'>('third-person');
  
  // Stats display state
  const [showStats, setShowStats] = useState(false);
  
  // Game version
  const gameVersion = '1.0.0';
  
  // Generate a unique player ID if not already set
  const playerIdRef = useRef<string>(localStorage.getItem('jackalopes_player_id') || 
    `player_${Math.random().toString(36).substring(2, 9)}`);
  
  // Save player ID to localStorage
  useEffect(() => {
    localStorage.setItem('jackalopes_player_id', playerIdRef.current);
    
    // Initialize global game object
    if (typeof window !== 'undefined') {
      window.jackalopesGame = window.jackalopesGame || {};
      window.jackalopesGame.playerType = playerType;
      window.jackalopesGame.debugLevel = 1; // Default debug level
    }
    
    // Make game version available globally
    console.log(`Jackalopes Game v${gameVersion}`);
    
    // Determine player type based on connection order
    const getPlayerTypeFromIndex = () => {
      // Count existing players (simplified version)
      const playerCount = parseInt(localStorage.getItem('jackalopes_player_count') || '0');
      
      // Update player count
      localStorage.setItem('jackalopes_player_count', (playerCount + 1).toString());
      
      // Even indices are jackalopes, odd are mercs
      return playerCount % 2 === 0 ? 'jackalope' : 'merc';
    };
    
    // Set player type
    setPlayerType(getPlayerTypeFromIndex());
    
  }, []);
  
  // Set up connection to the WebSocket server
  const {
    status: connectionStatus,
    playerId,
    error: connectionError,
    connect,
    sendPlayerUpdate,
    sendShot
  } = useConnection(serverUrl, isWordPress, true, playerIdRef.current);
  
  // Use the asset URL for loading game assets
  const getGameAssetPath = (assetName: string): string => {
    return getAssetPath(assetName);
  };
  
  useEffect(() => {
    // Initialize connection to server here when ready
    console.log(`Trying to connect to server at ${serverUrl} as ${playerIdRef.current}`);
    
    // Set fullscreen mode if requested
    if (isFullscreen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    
    // Enable debug stats with key press
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        setShowStats(prev => !prev);
      }
      
      // Toggle camera type with C key
      if (e.key === 'c' || e.key === 'C') {
        setCameraType(prev => prev === 'first-person' ? 'third-person' : 'first-person');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      
      if (isFullscreen) {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
    };
  }, [serverUrl, isFullscreen]);
  
  // Send player position updates
  const updatePlayerPosition = (position: THREE.Vector3, rotation: THREE.Quaternion) => {
    if (connectionStatus === ConnectionStatus.Connected) {
      sendPlayerUpdate({
        position: [position.x, position.y, position.z],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        sequence: Date.now(),
        playerType,
        timestamp: Date.now()
      });
    }
  };
  
  // Handle shot
  const handleShot = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    const shotId = `shot_${playerIdRef.current}_${Date.now()}`;
    
    // Send shot to server
    if (connectionStatus === ConnectionStatus.Connected) {
      sendShot(
        shotId,
        [origin.x, origin.y, origin.z],
        [direction.x, direction.y, direction.z]
      );
    }
    
    // Log shot
    console.log(`Shot fired: ${shotId}`);
  };

  return (
    <div className="jackalopes-game">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 60 }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            {/* Environment and lighting */}
            <Environment />
            
            {/* Ground plane */}
            <Ground />
            
            {/* Player */}
            <Player 
              position={[0, 3, 0]} 
              color={playerType === 'merc' ? 'red' : 'blue'} 
            />
            
            {/* Debug tools */}
            {showStats && <Stats />}
            
            {/* Camera controls - only in third person mode */}
            {cameraType === 'third-person' && <OrbitControls makeDefault />}
          </Physics>
        </Suspense>
      </Canvas>
      
      <div className="jackalopes-ui">
        <div className={`jackalopes-status ${connectionStatus === ConnectionStatus.Connected ? 'connected' : 'disconnected'}`}>
          Server: {connectionStatus === ConnectionStatus.Connected ? 'Connected' : 
                  connectionStatus === ConnectionStatus.Connecting ? 'Connecting...' : 
                  connectionStatus === ConnectionStatus.Error ? 'Error' : 'Disconnected'}
          {connectionError && ` (${connectionError})`}
        </div>
        
        <div className="jackalopes-player-info">
          Player: {playerType} ({cameraType})
        </div>
        
        {isWordPress && (
          <div className="jackalopes-wordpress-notice">
            Running in WordPress mode
          </div>
        )}
        
        <div className="jackalopes-help">
          Press F3 to toggle stats | C to switch camera
        </div>
        
        <div className="jackalopes-version">
          v{gameVersion}
        </div>
      </div>
    </div>
  );
}

// Define window global for game properties
declare global {
  interface Window {
    jackalopesGame?: {
      playerType?: PlayerType;
      debugLevel?: number;
    };
  }
} 