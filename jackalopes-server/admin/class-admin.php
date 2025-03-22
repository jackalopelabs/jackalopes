<?php
/**
 * The admin-specific functionality of the plugin.
 *
 * @package    Jackalopes_Server
 * @subpackage Jackalopes_Server/admin
 */
class Jackalopes_Server_Admin {

    /**
     * Register the stylesheets for the admin area.
     *
     * @since    1.0.0
     */
    public function enqueue_styles() {
        wp_enqueue_style('jackalopes-server-admin', JACKALOPES_SERVER_PLUGIN_URL . 'admin/css/admin.css', array(), JACKALOPES_SERVER_VERSION, 'all');
    }

    /**
     * Register the JavaScript for the admin area.
     *
     * @since    1.0.0
     */
    public function enqueue_scripts() {
        wp_enqueue_script('jackalopes-server-admin', JACKALOPES_SERVER_PLUGIN_URL . 'admin/js/admin.js', array('jquery'), JACKALOPES_SERVER_VERSION, false);
        
        wp_localize_script('jackalopes-server-admin', 'jackalopesServerParams', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('jackalopes_server_nonce'),
        ));
    }

    /**
     * Add menu items to the WordPress admin.
     *
     * @since    1.0.0
     */
    public function add_admin_menu() {
        add_menu_page(
            __('Jackalopes Server', 'jackalopes-server'),
            __('Jackalopes', 'jackalopes-server'),
            'manage_options',
            'jackalopes-server',
            array($this, 'display_dashboard_page'),
            'dashicons-games',
            55
        );

        add_submenu_page(
            'jackalopes-server',
            __('Dashboard', 'jackalopes-server'),
            __('Dashboard', 'jackalopes-server'),
            'manage_options',
            'jackalopes-server',
            array($this, 'display_dashboard_page')
        );

        add_submenu_page(
            'jackalopes-server',
            __('Settings', 'jackalopes-server'),
            __('Settings', 'jackalopes-server'),
            'manage_options',
            'jackalopes-server-settings',
            array($this, 'display_settings_page')
        );

        add_submenu_page(
            'jackalopes-server',
            __('Game Sessions', 'jackalopes-server'),
            __('Game Sessions', 'jackalopes-server'),
            'manage_options',
            'jackalopes-server-sessions',
            array($this, 'display_sessions_page')
        );
    }

    /**
     * Register plugin settings.
     *
     * @since    1.0.0
     */
    public function register_settings() {
        register_setting('jackalopes_server_settings', 'jackalopes_server_port', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => '8080',
        ));

        register_setting('jackalopes_server_settings', 'jackalopes_server_max_connections', array(
            'type' => 'number',
            'sanitize_callback' => 'absint',
            'default' => 100,
        ));

        register_setting('jackalopes_server_settings', 'jackalopes_server_auto_start', array(
            'type' => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
            'default' => false,
        ));

        register_setting('jackalopes_server_settings', 'jackalopes_server_log_level', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => 'info',
        ));

        add_settings_section(
            'jackalopes_server_general_settings',
            __('Server Settings', 'jackalopes-server'),
            array($this, 'settings_section_callback'),
            'jackalopes-server-settings'
        );

        add_settings_field(
            'jackalopes_server_port',
            __('WebSocket Port', 'jackalopes-server'),
            array($this, 'port_field_callback'),
            'jackalopes-server-settings',
            'jackalopes_server_general_settings'
        );

        add_settings_field(
            'jackalopes_server_max_connections',
            __('Max Connections', 'jackalopes-server'),
            array($this, 'max_connections_field_callback'),
            'jackalopes-server-settings',
            'jackalopes_server_general_settings'
        );

        add_settings_field(
            'jackalopes_server_auto_start',
            __('Auto-Start Server', 'jackalopes-server'),
            array($this, 'auto_start_field_callback'),
            'jackalopes-server-settings',
            'jackalopes_server_general_settings'
        );

        add_settings_field(
            'jackalopes_server_log_level',
            __('Log Level', 'jackalopes-server'),
            array($this, 'log_level_field_callback'),
            'jackalopes-server-settings',
            'jackalopes_server_general_settings'
        );
    }

    /**
     * Settings section description.
     *
     * @since    1.0.0
     */
    public function settings_section_callback() {
        echo '<p>' . __('Configure the Jackalopes multiplayer server settings.', 'jackalopes-server') . '</p>';
    }

    /**
     * WebSocket port field.
     *
     * @since    1.0.0
     */
    public function port_field_callback() {
        $port = get_option('jackalopes_server_port', '8080');
        echo '<input type="text" name="jackalopes_server_port" value="' . esc_attr($port) . '" class="regular-text">';
        echo '<p class="description">' . __('The port the WebSocket server will listen on.', 'jackalopes-server') . '</p>';
    }

    /**
     * Max connections field.
     *
     * @since    1.0.0
     */
    public function max_connections_field_callback() {
        $max_connections = get_option('jackalopes_server_max_connections', '100');
        echo '<input type="number" name="jackalopes_server_max_connections" value="' . esc_attr($max_connections) . '" class="regular-text">';
        echo '<p class="description">' . __('Maximum number of simultaneous connections allowed.', 'jackalopes-server') . '</p>';
    }

    /**
     * Auto-start server field.
     *
     * @since    1.0.0
     */
    public function auto_start_field_callback() {
        $auto_start = get_option('jackalopes_server_auto_start', '0');
        echo '<input type="checkbox" name="jackalopes_server_auto_start" value="1" ' . checked('1', $auto_start, false) . '>';
        echo '<p class="description">' . __('Automatically start the WebSocket server when WordPress loads.', 'jackalopes-server') . '</p>';
    }

    /**
     * Log level field.
     *
     * @since    1.0.0
     */
    public function log_level_field_callback() {
        $log_level = get_option('jackalopes_server_log_level', 'info');
        $options = array(
            'debug' => __('Debug', 'jackalopes-server'),
            'info' => __('Info', 'jackalopes-server'),
            'warn' => __('Warning', 'jackalopes-server'),
            'error' => __('Error', 'jackalopes-server'),
        );

        echo '<select name="jackalopes_server_log_level">';
        foreach ($options as $value => $label) {
            echo '<option value="' . esc_attr($value) . '" ' . selected($log_level, $value, false) . '>' . esc_html($label) . '</option>';
        }
        echo '</select>';
        echo '<p class="description">' . __('Server logging level.', 'jackalopes-server') . '</p>';
    }

    /**
     * Display the dashboard page.
     *
     * @since    1.0.0
     */
    public function display_dashboard_page() {
        require_once JACKALOPES_SERVER_PLUGIN_DIR . 'admin/partials/dashboard.php';
    }

    /**
     * Display the settings page.
     *
     * @since    1.0.0
     */
    public function display_settings_page() {
        require_once JACKALOPES_SERVER_PLUGIN_DIR . 'admin/partials/settings.php';
    }

    /**
     * Display the game sessions page.
     *
     * @since    1.0.0
     */
    public function display_sessions_page() {
        require_once JACKALOPES_SERVER_PLUGIN_DIR . 'admin/partials/sessions.php';
    }
} 