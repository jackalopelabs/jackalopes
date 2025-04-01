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
        'jackalopes-game-styles',
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
    wp_enqueue_style('jackalopes-game-styles');
    
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

/**
 * Handle direct asset requests and redirect them to the correct location
 * This is added to handle cases where the game tries to load assets from /src/assets
 */
function jackalopes_wp_handle_asset_paths() {
    // Check if the request is for a missing asset in src/assets/characters
    if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/src/assets/characters/') !== false) {
        $requested_file = basename($_SERVER['REQUEST_URI']);
        $correct_path = JACKALOPES_WP_PLUGIN_URL . 'game/dist/assets/characters/' . $requested_file;
        
        // Redirect to the correct asset path
        wp_redirect($correct_path);
        exit;
    }
    
    // Check for background.png in the root
    if (isset($_SERVER['REQUEST_URI']) && basename($_SERVER['REQUEST_URI']) === 'background.png') {
        $correct_path = JACKALOPES_WP_PLUGIN_URL . 'game/dist/assets/background.png';
        
        // Redirect to the correct asset path
        wp_redirect($correct_path);
        exit;
    }
}
add_action('template_redirect', 'jackalopes_wp_handle_asset_paths');

/**
 * Register custom rewrite rules to handle direct asset requests
 */
function jackalopes_wp_register_rewrites() {
    // Add rewrite rules for common asset paths
    add_rewrite_rule(
        '^src/assets/characters/([^/]+)$',
        'index.php?jackalopes_asset=characters/$1',
        'top'
    );
    
    add_rewrite_rule(
        '^background\.png$',
        'index.php?jackalopes_asset=background.png',
        'top'
    );
}
add_action('init', 'jackalopes_wp_register_rewrites');

/**
 * Add query vars for asset handling
 */
function jackalopes_wp_query_vars($vars) {
    $vars[] = 'jackalopes_asset';
    return $vars;
}
add_filter('query_vars', 'jackalopes_wp_query_vars');

/**
 * Handle asset requests through query vars
 */
function jackalopes_wp_handle_asset_requests() {
    global $wp_query;
    
    if (isset($wp_query->query_vars['jackalopes_asset'])) {
        $asset_path = $wp_query->query_vars['jackalopes_asset'];
        $file_path = JACKALOPES_WP_PLUGIN_DIR . 'game/dist/assets/' . $asset_path;
        
        if (file_exists($file_path)) {
            // Set appropriate content type
            $ext = pathinfo($file_path, PATHINFO_EXTENSION);
            switch ($ext) {
                case 'glb':
                case 'gltf':
                    header('Content-Type: model/gltf+json');
                    break;
                case 'png':
                    header('Content-Type: image/png');
                    break;
                case 'jpg':
                case 'jpeg':
                    header('Content-Type: image/jpeg');
                    break;
                default:
                    header('Content-Type: application/octet-stream');
            }
            
            // Output file contents
            readfile($file_path);
            exit;
        }
    }
}
add_action('parse_request', 'jackalopes_wp_handle_asset_requests'); 