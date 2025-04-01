<?php
/**
 * Admin-specific functionality.
 *
 * @package Jackalopes_WP
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

/**
 * Register the admin menu.
 */
function jackalopes_wp_register_admin_menu() {
    add_menu_page(
        __('Jackalopes Game', 'jackalopes-wp'),
        __('Jackalopes', 'jackalopes-wp'),
        'manage_options',
        'jackalopes-wp',
        'jackalopes_wp_admin_page',
        'dashicons-games',
        30
    );
    
    add_submenu_page(
        'jackalopes-wp',
        __('Settings', 'jackalopes-wp'),
        __('Settings', 'jackalopes-wp'),
        'manage_options',
        'jackalopes-wp-settings',
        'jackalopes_wp_settings_page'
    );
}
add_action('admin_menu', 'jackalopes_wp_register_admin_menu');

/**
 * Register admin settings.
 */
function jackalopes_wp_register_settings() {
    // Register a new setting for Jackalopes options
    register_setting('jackalopes_wp_options', 'jackalopes_wp_settings');
    
    // Register a settings section
    add_settings_section(
        'jackalopes_wp_general_section',
        __('General Settings', 'jackalopes-wp'),
        'jackalopes_wp_general_section_callback',
        'jackalopes_wp_settings'
    );
    
    // Register settings fields
    add_settings_field(
        'jackalopes_wp_server_url',
        __('WebSocket Server URL', 'jackalopes-wp'),
        'jackalopes_wp_server_url_callback',
        'jackalopes_wp_settings',
        'jackalopes_wp_general_section'
    );
    
    add_settings_field(
        'jackalopes_wp_default_height',
        __('Default Game Height', 'jackalopes-wp'),
        'jackalopes_wp_default_height_callback',
        'jackalopes_wp_settings',
        'jackalopes_wp_general_section'
    );
}
add_action('admin_init', 'jackalopes_wp_register_settings');

/**
 * General section callback.
 */
function jackalopes_wp_general_section_callback() {
    echo '<p>' . __('Configure the general settings for the Jackalopes game.', 'jackalopes-wp') . '</p>';
}

/**
 * Server URL field callback.
 */
function jackalopes_wp_server_url_callback() {
    $options = get_option('jackalopes_wp_settings');
    $server_url = isset($options['server_url']) ? esc_url($options['server_url']) : '';
    
    echo '<input type="text" id="jackalopes_wp_server_url" name="jackalopes_wp_settings[server_url]" value="' . $server_url . '" class="regular-text" />';
    echo '<p class="description">' . __('The WebSocket server URL for multiplayer functionality. Leave empty to use default.', 'jackalopes-wp') . '</p>';
    
    // Check if Jackalopes Server plugin is active
    if (function_exists('jackalopes_server_get_websocket_url')) {
        echo '<p class="description">' . __('Jackalopes Server plugin detected. The server URL will be provided automatically.', 'jackalopes-wp') . '</p>';
    }
}

/**
 * Default height field callback.
 */
function jackalopes_wp_default_height_callback() {
    $options = get_option('jackalopes_wp_settings');
    $default_height = isset($options['default_height']) ? esc_attr($options['default_height']) : '600px';
    
    echo '<input type="text" id="jackalopes_wp_default_height" name="jackalopes_wp_settings[default_height]" value="' . $default_height . '" class="regular-text" />';
    echo '<p class="description">' . __('The default height for the game container.', 'jackalopes-wp') . '</p>';
}

/**
 * Render the main admin page.
 */
function jackalopes_wp_admin_page() {
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        
        <div class="jackalopes-admin-content">
            <div class="jackalopes-admin-section">
                <h2><?php _e('Jackalopes Game Plugin', 'jackalopes-wp'); ?></h2>
                <p><?php _e('Welcome to the Jackalopes game plugin for WordPress. Use the [jackalopes] shortcode to embed the game in any post or page.', 'jackalopes-wp'); ?></p>
                
                <h3><?php _e('Shortcode Usage', 'jackalopes-wp'); ?></h3>
                <p><code>[jackalopes]</code> - <?php _e('Basic usage with default settings', 'jackalopes-wp'); ?></p>
                <p><code>[jackalopes width="800px" height="500px" fullscreen="true"]</code> - <?php _e('Custom dimensions with fullscreen option', 'jackalopes-wp'); ?></p>
                
                <h3><?php _e('Server Status', 'jackalopes-wp'); ?></h3>
                <?php jackalopes_wp_display_server_status(); ?>
            </div>
        </div>
    </div>
    <?php
}

/**
 * Render the settings page.
 */
function jackalopes_wp_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        
        <form method="post" action="options.php">
            <?php
            settings_fields('jackalopes_wp_options');
            do_settings_sections('jackalopes_wp_settings');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}

/**
 * Display the server status.
 */
function jackalopes_wp_display_server_status() {
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
    
    ?>
    <div class="jackalopes-server-status jackalopes-server-<?php echo esc_attr($server_status); ?>">
        <span class="status-indicator"></span>
        <span class="status-message"><?php echo esc_html($server_message); ?></span>
        
        <?php if (function_exists('jackalopes_server_get_dashboard_url')): ?>
            <a href="<?php echo esc_url(jackalopes_server_get_dashboard_url()); ?>" class="button">
                <?php _e('Manage Server', 'jackalopes-wp'); ?>
            </a>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * Enqueue admin styles and scripts.
 */
function jackalopes_wp_enqueue_admin_assets($hook) {
    // Only load on plugin pages
    if (strpos($hook, 'jackalopes-wp') === false) {
        return;
    }
    
    wp_enqueue_style(
        'jackalopes-wp-admin',
        JACKALOPES_WP_PLUGIN_URL . 'admin/css/admin.css',
        [],
        JACKALOPES_WP_VERSION
    );
    
    wp_enqueue_script(
        'jackalopes-wp-admin',
        JACKALOPES_WP_PLUGIN_URL . 'admin/js/admin.js',
        ['jquery'],
        JACKALOPES_WP_VERSION,
        true
    );
}
add_action('admin_enqueue_scripts', 'jackalopes_wp_enqueue_admin_assets'); 