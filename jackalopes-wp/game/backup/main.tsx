import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Jackalopes Game - WordPress Plugin Integration
 * 
 * This is the entry point for the WordPress plugin integration.
 * The game will be initialized when the WordPress shortcode is loaded.
 */

// Import types from shared file
import { JackalopesGameSettings, JackalopesGameOptions } from './types/wordpress';

// Import ConnectionManager class type from utils to properly type the global
import { ConnectionManager } from './utils/connectionManager';

// Define the global interface for window object
declare global {
  interface Window {
    initJackalopesGame: (containerId: string, options?: JackalopesGameOptions) => void;
    jackalopesGameSettings?: JackalopesGameSettings;
    __setGraphicsQuality?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
    __shotBroadcast?: ((shot: any) => any) | undefined;
    __setDebugLevel?: (level: number) => void;
    __toggleNetworkLogs?: (verbose: boolean) => string;
    connectionManager?: ConnectionManager;
    __networkManager?: {
      sendRespawnRequest: (playerId: string, spawnPosition?: [number, number, number]) => void;
    };
    jackalopesGame?: {
      playerType?: 'merc' | 'jackalope';
      debugLevel?: number;
    };
  }
}

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
}

// Initialize the game when called from WordPress
window.initJackalopesGame = (containerId: string, options: JackalopesGameOptions = {}) => {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Jackalopes game container with ID "${containerId}" not found.`);
    return;
  }
  
  // Initialize debug helpers
  setupDebugHelpers();
  
  // Get WordPress settings if available
  const wpSettings: JackalopesGameSettings = window.jackalopesGameSettings || {
    ajaxUrl: '',
    pluginUrl: '',
    assetsUrl: '',
    serverUrl: '',
    debug: false,
    nonce: '',
    sessionKey: 'JACKALOPES-DEFAULT'
  };
  
  // Merge options with WordPress settings
  const serverUrl = options.server || wpSettings.serverUrl || 'ws://localhost:8082';
  const isFullscreen = options.fullscreen || false;
  const sessionKey = options.sessionKey || wpSettings.sessionKey || 'JACKALOPES-DEFAULT';
  
  // Store sessionKey in localStorage for cross-browser communication
  localStorage.setItem('jackalopes_session_key', sessionKey);
  
  // Remove loading UI
  const loadingElement = container.querySelector('.jackalopes-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
  
  // Create React root and render the game
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App 
        serverUrl={serverUrl}
        isFullscreen={isFullscreen}
        isWordPress={true}
        assetsUrl={wpSettings.assetsUrl}
      />
    </React.StrictMode>
  );
  
  // Set fullscreen mode if requested
  if (isFullscreen) {
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '9999';
  }
  
  console.log(`Jackalopes game initialized in container "${containerId}"`);
  console.log(`Server URL: ${serverUrl}`);
  console.log(`Session Key: ${sessionKey}`);
  console.log(`Fullscreen: ${isFullscreen}`);
};

// If not in a WordPress environment (standalone development), initialize immediately
if (!window.jackalopesGameSettings && process.env.NODE_ENV === 'development') {
  // Set up debug helpers for standalone mode too
  setupDebugHelpers();
  
  const devContainer = document.getElementById('root');
  
  if (devContainer) {
    // Generate a session key if not exists
    const sessionKey = localStorage.getItem('jackalopes_session_key') || 'JACKALOPES-DEV';
    localStorage.setItem('jackalopes_session_key', sessionKey);
    
    // Simulated standalone initialization for development
    const root = ReactDOM.createRoot(devContainer);
    root.render(
      <React.StrictMode>
        <App 
          serverUrl="ws://localhost:8082"
          isFullscreen={false}
          isWordPress={false}
          assetsUrl="./assets/"
        />
      </React.StrictMode>
    );
    
    console.log('Jackalopes game initialized in development mode');
    console.log(`Session Key: ${sessionKey}`);
  }
} 