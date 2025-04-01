/**
 * WordPress-related type definitions
 */

/**
 * WordPress settings interface for Jackalopes game
 */
export interface JackalopesGameSettings {
  ajaxUrl: string;
  pluginUrl: string;
  assetsUrl: string;
  serverUrl: string;
  debug: boolean;
  nonce: string;
  sessionKey?: string;
}

/**
 * Game options for WordPress shortcode
 */
export interface JackalopesGameOptions {
  fullscreen?: boolean;
  server?: string;
  playerType?: 'merc' | 'jackalope';
  sessionKey?: string;
} 