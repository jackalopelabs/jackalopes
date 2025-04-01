/**
 * Jackalopes WP Plugin Admin Scripts
 */

(function($) {
    'use strict';
    
    $(document).ready(function() {
        // Initialize admin functionality
        initJackalopesAdmin();
    });
    
    /**
     * Initialize admin functionality
     */
    function initJackalopesAdmin() {
        // Check server status periodically
        if ($('.jackalopes-server-status').length) {
            // Refresh server status every 30 seconds
            setInterval(refreshServerStatus, 30000);
        }
    }
    
    /**
     * Refresh server status via AJAX
     */
    function refreshServerStatus() {
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'jackalopes_wp_server_status',
                nonce: jackalopesWpAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    var $status = $('.jackalopes-server-status');
                    
                    // Remove all status classes
                    $status.removeClass('jackalopes-server-running jackalopes-server-stopped jackalopes-server-unknown');
                    
                    // Add appropriate class
                    $status.addClass('jackalopes-server-' + response.data.status);
                    
                    // Update message
                    $('.status-message').text(response.data.message);
                }
            }
        });
    }
    
})(jQuery); 