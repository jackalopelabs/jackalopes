/**
 * WordPress-related type definitions
 */

/**
 * WordPress integration types
 */

/**
 * WordPress game settings passed from the plugin
 */
export interface JackalopesGameSettings {
  ajaxUrl: string;
  pluginUrl: string;
  assetsUrl: string;
  serverUrl: string;
  debug: boolean;
  nonce: string;
  sessionKey: string;
}

/**
 * Game initialization options
 */
export interface JackalopesGameOptions {
  server?: string;
  fullscreen?: boolean;
  sessionKey?: string;
  debugMode?: boolean;
} 