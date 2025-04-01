<?php
/**
 * Game management class.
 *
 * @package Jackalopes_WP
 */

namespace Jackalopes\WP;

/**
 * Game class for managing game-specific functionality.
 */
class Game {
    /**
     * The single instance of this class.
     *
     * @var Game
     */
    private static $instance = null;
    
    /**
     * Get the singleton instance.
     *
     * @return Game
     */
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        
        return self::$instance;
    }
    
    /**
     * Constructor.
     */
    private function __construct() {
        $this->setup_hooks();
    }
    
    /**
     * Setup hooks.
     */
    private function setup_hooks() {
        // No specific hooks yet
    }
    
    /**
     * Get game configuration.
     *
     * @return array Game configuration.
     */
    public function get_config() {
        $options = get_option('jackalopes_wp_settings', []);
        
        return [
            'server_url' => jackalopes_wp_get_server_url(),
            'default_height' => $options['default_height'] ?? '600px',
        ];
    }
    
    /**
     * Check if multiplayer is available.
     *
     * @return bool True if multiplayer is available, false otherwise.
     */
    public function is_multiplayer_available() {
        // Check if the server plugin is active
        if (function_exists('jackalopes_server_is_running')) {
            return jackalopes_server_is_running();
        }
        
        // Check if a custom server URL is set
        $options = get_option('jackalopes_wp_settings', []);
        return !empty($options['server_url']);
    }
    
    /**
     * Get the asset URL for a game asset.
     *
     * @param string $asset_path The asset path relative to the game assets directory.
     * @return string The full URL to the asset.
     */
    public function get_asset_url($asset_path) {
        return JACKALOPES_WP_PLUGIN_URL . 'game/dist/assets/' . ltrim($asset_path, '/');
    }
} 