<?php
/**
 * Asset loading functionality.
 *
 * @package Jackalopes_WP
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

/**
 * Register all assets.
 */
function jackalopes_wp_register_assets() {
    // Register main game styles
    wp_register_style(
        'jackalopes-game',
        JACKALOPES_WP_PLUGIN_URL . 'game/dist/assets/main.css',
        [],
        JACKALOPES_WP_VERSION
    );
    
    // Register main game script
    wp_register_script(
        'jackalopes-game',
        JACKALOPES_WP_PLUGIN_URL . 'game/dist/assets/main.js',
        [],
        JACKALOPES_WP_VERSION,
        true
    );
    
    // Add script attributes for module type
    add_filter('script_loader_tag', function($tag, $handle) {
        if ('jackalopes-game' === $handle) {
            return str_replace('<script ', '<script type="module" ', $tag);
        }
        return $tag;
    }, 10, 2);
    
    // Add dynamic game settings
    wp_localize_script(
        'jackalopes-game',
        'jackalopesGameSettings',
        [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'pluginUrl' => JACKALOPES_WP_PLUGIN_URL,
            'assetsUrl' => JACKALOPES_WP_PLUGIN_URL . 'game/dist/assets/',
            'serverUrl' => jackalopes_wp_get_server_url(),
            'debug' => WP_DEBUG,
            'nonce' => wp_create_nonce('jackalopes_game_nonce'),
        ]
    );
}

/**
 * Enqueue game-specific assets.
 */
function jackalopes_wp_enqueue_game_assets() {
    // Enqueue main game styles
    wp_enqueue_style('jackalopes-game');
    
    // Enqueue main game script
    wp_enqueue_script('jackalopes-game');
    
    // Enqueue any additional dependencies
    // wp_enqueue_script('three-js');
}

/**
 * Get the WebSocket server URL.
 * 
 * This function checks if the Jackalopes Server plugin is active
 * and retrieves its configured server URL. If not available,
 * it falls back to a default URL.
 * 
 * @return string The WebSocket server URL.
 */
function jackalopes_wp_get_server_url() {
    // Check if Jackalopes Server plugin is active
    if (function_exists('jackalopes_server_get_websocket_url')) {
        return jackalopes_server_get_websocket_url();
    }
    
    // Fall back to default or configured URL
    $server_url = get_option('jackalopes_wp_server_url', '');
    
    if (empty($server_url)) {
        // Use default URL based on current site
        $server_url = 'ws://' . parse_url(home_url(), PHP_URL_HOST) . '/websocket/';
    }
    
    return $server_url;
} 