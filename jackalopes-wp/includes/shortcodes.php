<?php
/**
 * Shortcode-related functionality.
 *
 * @package Jackalopes_WP
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

/**
 * Register all shortcodes.
 */
function jackalopes_wp_register_shortcodes() {
    add_shortcode('jackalopes', 'jackalopes_wp_game_shortcode');
}

/**
 * Shortcode callback for [jackalopes] shortcode.
 *
 * @param array $atts Shortcode attributes.
 * @return string Shortcode output.
 */
function jackalopes_wp_game_shortcode($atts = []) {
    // Parse attributes
    $atts = shortcode_atts(
        [
            'width' => '100%',
            'height' => '600px',
            'fullscreen' => 'false',
            'server' => '', // Optional server URL override
        ],
        $atts,
        'jackalopes'
    );

    // Enqueue required scripts and styles
    jackalopes_wp_enqueue_game_assets();
    
    // Generate a unique ID for this game instance
    $game_id = 'jackalopes-game-' . uniqid();
    
    // Start output buffering
    ob_start();
    
    // Game container HTML
    ?>
    <div id="<?php echo esc_attr($game_id); ?>" 
         class="jackalopes-game-container" 
         data-fullscreen="<?php echo esc_attr($atts['fullscreen']); ?>"
         data-server="<?php echo esc_attr($atts['server']); ?>"
         style="width: <?php echo esc_attr($atts['width']); ?>; height: <?php echo esc_attr($atts['height']); ?>;">
        <div class="jackalopes-loading">
            <div class="jackalopes-loading-spinner"></div>
            <div class="jackalopes-loading-message">Loading Jackalopes...</div>
        </div>
    </div>
    <script>
        // Wait for the module to be fully loaded
        setTimeout(function() {
            // Initialize the game when the DOM is fully loaded
            if (typeof window.initJackalopesGame === 'function') {
                window.initJackalopesGame('<?php echo esc_js($game_id); ?>', {
                    fullscreen: <?php echo $atts['fullscreen'] === 'true' ? 'true' : 'false'; ?>,
                    server: '<?php echo esc_js($atts['server']); ?>'
                });
            } else {
                console.error('Jackalopes game initialization function not found. Make sure all assets are properly loaded.');
            }
        }, 100);
    </script>
    <?php
    
    // Return the buffered content
    return ob_get_clean();
} 