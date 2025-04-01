<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package Jackalopes_WP
 */

// If uninstall not called from WordPress, exit.
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Delete options
delete_option('jackalopes_wp_settings');
delete_option('jackalopes_wp_version');

// Delete transients
delete_transient('jackalopes_wp_game_assets');

// For site options in Multisite
delete_site_option('jackalopes_wp_network_settings');

// Clear any cached data that has been removed
wp_cache_flush();

// Delete custom post types (if any)
// This will not be needed initially, but might be useful in the future
// $posts = get_posts(['post_type' => 'jackalopes_game', 'numberposts' => -1]);
// foreach ($posts as $post) {
//     wp_delete_post($post->ID, true);
// } 