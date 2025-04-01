import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// This is the entry point for the WordPress plugin integration
// The game will be initialized when the WordPress shortcode is loaded

// Expose the initialization function for WordPress
interface JackalopesGameOptions {
  fullscreen?: boolean;
  server?: string;
}

declare global {
  interface Window {
    initJackalopesGame: (containerId: string, options?: JackalopesGameOptions) => void;
    jackalopesGameSettings?: {
      ajaxUrl: string;
      pluginUrl: string;
      assetsUrl: string;
      serverUrl: string;
      debug: boolean;
      nonce: string;
    };
  }
}

// Initialize the game when called from WordPress
window.initJackalopesGame = (containerId: string, options: JackalopesGameOptions = {}) => {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Jackalopes game container with ID "${containerId}" not found.`);
    return;
  }
  
  // Get WordPress settings if available
  const wpSettings = window.jackalopesGameSettings || {};
  
  // Merge options with WordPress settings
  const serverUrl = options.server || wpSettings.serverUrl || 'ws://localhost:8082';
  const isFullscreen = options.fullscreen || false;
  
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
        assetsUrl={wpSettings.assetsUrl || ''}
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
  console.log(`Fullscreen: ${isFullscreen}`);
};

// If not in a WordPress environment (standalone development), initialize immediately
if (!window.jackalopesGameSettings && process.env.NODE_ENV === 'development') {
  const devContainer = document.getElementById('root');
  
  if (devContainer) {
    // Simulated standalone initialization for development
    const root = ReactDOM.createRoot(devContainer);
    root.render(
      <React.StrictMode>
        <App 
          serverUrl="ws://localhost:8082"
          isFullscreen={false}
          isWordPress={false}
          assetsUrl=""
        />
      </React.StrictMode>
    );
  }
} 