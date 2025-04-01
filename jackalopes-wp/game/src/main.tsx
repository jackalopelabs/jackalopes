import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupWPGameIntegration } from './utils/wpIntegration';

// Import types from shared file
import { JackalopesGameSettings, JackalopesGameOptions } from './types/wordpress';

/**
 * Jackalopes Game - WordPress Plugin Integration
 * 
 * This is the entry point for the WordPress plugin integration.
 * The game will be initialized when the WordPress shortcode is loaded.
 */

// Initialize WordPress integration
setupWPGameIntegration();

// Initialize the game when called from WordPress
export const initJackalopesGame = (containerId: string, options: JackalopesGameOptions = {}) => {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Jackalopes game container with ID "${containerId}" not found.`);
    return;
  }
  
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
  
  // Create React root and render the full game
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
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
};

// Expose the initialization function globally
window.initJackalopesGame = initJackalopesGame;

// If not in a WordPress environment (standalone development), initialize immediately
if (!window.jackalopesGameSettings && process.env.NODE_ENV === 'development') {
  const devContainer = document.getElementById('root');
  
  if (devContainer) {
    // Generate a session key if not exists
    const sessionKey = localStorage.getItem('jackalopes_session_key') || 'JACKALOPES-DEV';
    localStorage.setItem('jackalopes_session_key', sessionKey);
    
    // Simulated standalone initialization for development - use the full game App
    const root = ReactDOM.createRoot(devContainer);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    console.log('Jackalopes game initialized in development mode');
    console.log(`Session Key: ${sessionKey}`);
  }
} 