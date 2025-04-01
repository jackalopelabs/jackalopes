<?php
/**
 * Main plugin class.
 *
 * @package Jackalopes_WP
 */

namespace Jackalopes\WP;

/**
 * Plugin class for managing the main plugin functionality.
 */
class Plugin {
    /**
     * The single instance of this class.
     *
     * @var Plugin
     */
    private static $instance = null;
    
    /**
     * Get the singleton instance.
     *
     * @return Plugin
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
        // Setup AJAX actions
        add_action('wp_ajax_jackalopes_wp_server_status', [$this, 'server_status_ajax']);
        
        // Add REST API endpoints
        add_action('rest_api_init', [$this, 'register_rest_routes']);
    }
    
    /**
     * Server status AJAX handler.
     */
    public function server_status_ajax() {
        // Check nonce
        check_ajax_referer('jackalopes_wp_admin', 'nonce');
        
        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('You do not have permission to access this feature.', 'jackalopes-wp')]);
        }
        
        $server_status = 'unknown';
        $server_message = __('Unable to determine server status.', 'jackalopes-wp');
        
        // Check if Jackalopes Server plugin is active
        if (function_exists('jackalopes_server_get_status')) {
            $status_data = jackalopes_server_get_status();
            
            if (isset($status_data['running']) && $status_data['running']) {
                $server_status = 'running';
                $server_message = sprintf(
                    __('Server is running. %d connections active.', 'jackalopes-wp'),
                    $status_data['connections'] ?? 0
                );
            } else {
                $server_status = 'stopped';
                $server_message = __('Server is not running.', 'jackalopes-wp');
            }
        }
        
        wp_send_json_success([
            'status' => $server_status,
            'message' => $server_message,
        ]);
    }
    
    /**
     * Register REST API routes.
     */
    public function register_rest_routes() {
        register_rest_route('jackalopes-wp/v1', '/settings', [
            'methods' => 'GET',
            'callback' => [$this, 'get_settings_endpoint'],
            'permission_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
        
        register_rest_route('jackalopes-wp/v1', '/server-url', [
            'methods' => 'GET',
            'callback' => [$this, 'get_server_url_endpoint'],
            'permission_callback' => '__return_true', // Public endpoint
        ]);
    }
    
    /**
     * Settings endpoint callback.
     *
     * @param \WP_REST_Request $request REST request object.
     * @return \WP_REST_Response
     */
    public function get_settings_endpoint($request) {
        $options = get_option('jackalopes_wp_settings', []);
        
        // Filter out sensitive information
        $safe_options = [
            'default_height' => $options['default_height'] ?? '600px',
        ];
        
        return rest_ensure_response($safe_options);
    }
    
    /**
     * Server URL endpoint callback.
     *
     * @param \WP_REST_Request $request REST request object.
     * @return \WP_REST_Response
     */
    public function get_server_url_endpoint($request) {
        $server_url = jackalopes_wp_get_server_url();
        
        return rest_ensure_response([
            'server_url' => $server_url,
        ]);
    }
} 