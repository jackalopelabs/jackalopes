import { useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { OrbitControls, Stats } from '@react-three/drei';

// Import our components
import Environment from './components/Environment';
import Player from './components/Player';
import Ground from './components/Ground';

// Define the props for the App component
interface AppProps {
  serverUrl: string;
  isFullscreen: boolean;
  isWordPress: boolean;
  assetsUrl: string;
}

// Main App component
export default function App({ serverUrl, isFullscreen, isWordPress, assetsUrl }: AppProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Use the asset URL for loading game assets
  const getAssetPath = (assetName: string): string => {
    return `${assetsUrl}${assetName}`;
  };
  
  useEffect(() => {
    // Initialize connection to server here when ready
    console.log(`Trying to connect to server at ${serverUrl}`);
    
    // Simulate successful connection for now
    const timer = setTimeout(() => {
      setIsConnected(true);
      console.log('Connected to server!');
    }, 1000);
    
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
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      
      if (isFullscreen) {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
    };
  }, [serverUrl, isFullscreen]);

  return (
    <div className="jackalopes-game">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            {/* Environment and lighting */}
            <Environment />
            
            {/* Ground plane */}
            <Ground />
            
            {/* Player */}
            <Player position={[0, 3, 0]} color="blue" />
            
            {/* Debug tools */}
            {showStats && <Stats />}
            
            {/* Camera controls */}
            <OrbitControls makeDefault />
          </Physics>
        </Suspense>
      </Canvas>
      
      <div className="jackalopes-ui">
        <div className={`jackalopes-status ${isConnected ? 'connected' : 'disconnected'}`}>
          Server: {isConnected ? 'Connected' : 'Connecting...'}
        </div>
        
        {isWordPress && (
          <div className="jackalopes-wordpress-notice">
            Running in WordPress mode
          </div>
        )}
        
        <div className="jackalopes-help">
          Press F3 to toggle stats
        </div>
      </div>
    </div>
  );
} 