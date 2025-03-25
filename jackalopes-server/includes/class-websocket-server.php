<?php
/**
 * The WebSocket server implementation.
 *
 * Handles WebSocket connections and game state communication.
 *
 * @since      1.0.0
 * @package    Jackalopes_Server
 * @subpackage Jackalopes_Server/includes
 */
class Jackalopes_Server_WebSocket {

    /**
     * Server status - whether it's running or not
     *
     * @since    1.0.0
     * @access   private
     * @var      bool    $running    Server running status
     */
    private $running = false;
    
    /**
     * Server process ID
     *
     * @since    1.0.0
     * @access   private
     * @var      int    $pid    Server process ID
     */
    private $pid = null;
    
    /**
     * Server start time
     *
     * @since    1.0.0
     * @access   private
     * @var      int    $start_time    Server start time (timestamp)
     */
    private $start_time = null;
    
    /**
     * Path to the server script
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $server_script    Path to the server script
     */
    private $server_script;
    
    /**
     * Path to the PID file
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $pid_file    Path to the PID file
     */
    private $pid_file;
    
    /**
     * Path to the server log file
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $log_file    Path to the server log file
     */
    private $log_file;
    
    /**
     * Constructor
     */
    public function __construct() {
        $this->server_script = JACKALOPES_SERVER_PLUGIN_DIR . 'server.js';
        $this->pid_file = JACKALOPES_SERVER_PLUGIN_DIR . 'server.pid';
        $this->log_file = JACKALOPES_SERVER_PLUGIN_DIR . 'server.log';
        
        // Check if server is already running
        $this->check_status();
    }
    
    /**
     * Start the WebSocket server
     *
     * @since    1.0.0
     * @return   bool    True if server started successfully, false otherwise
     */
    public function start() {
        if ($this->running) {
            return true; // Server already running
        }
        
        // Get server configuration
        $port = get_option('jackalopes_server_port', '8082');
        
        // Empty log file
        file_put_contents($this->log_file, '');
        
        // Check if server.js exists
        if (!file_exists($this->server_script)) {
            $this->log_message('Error: server.js not found in plugin directory.');
            return false;
        }
        
        // Check if Node.js is available
        if (!$this->check_nodejs()) {
            return false;
        }
        
        // Update .env file with correct port
        $this->update_env_file('SERVER_PORT', $port);
        
        // Start the Node.js server process using nohup to keep it running
        $command = sprintf(
            'cd %s && SERVER_PORT=%s nohup node %s > %s 2>&1 & echo $! > %s',
            escapeshellarg(JACKALOPES_SERVER_PLUGIN_DIR),
            escapeshellarg($port),
            escapeshellarg($this->server_script),
            escapeshellarg($this->log_file),
            escapeshellarg($this->pid_file)
        );
        
        $this->log_message('Executing command: ' . $command);
        
        exec($command, $output, $return_var);
        
        if ($return_var !== 0) {
            $this->log_message('Error: Command failed with return code ' . $return_var);
            if (!empty($output)) {
                $this->log_message('Command output: ' . implode("\n", $output));
            }
            return false;
        }
        
        // Wait a moment for the server to start
        sleep(2);
        
        // Check if server started successfully
        $this->check_status();
        
        if ($this->running) {
            $this->log_message('Server started on port ' . $port . ' with PID ' . $this->pid);
            return true;
        } else {
            $this->log_message('Failed to start server. Check server.log for details.');
            return false;
        }
    }
    
    /**
     * Stop the WebSocket server
     *
     * @since    1.0.0
     * @return   bool    True if server stopped successfully, false otherwise
     */
    public function stop() {
        if (!$this->running) {
            return true; // Server not running
        }
        
        // Send SIGTERM to the server process
        if (function_exists('posix_kill')) {
            posix_kill($this->pid, 15); // SIGTERM
        } else {
            exec('kill ' . (int)$this->pid);
        }
        
        // Wait a moment for the server to stop
        sleep(1);
        
        // Remove PID file
        if (file_exists($this->pid_file)) {
            unlink($this->pid_file);
        }
        
        $this->running = false;
        $this->pid = null;
        $this->start_time = null;
        
        $this->log_message('Server stopped');
        
        return true;
    }
    
    /**
     * Restart the WebSocket server
     *
     * @since    1.0.0
     * @return   bool    True if server restarted successfully, false otherwise
     */
    public function restart() {
        $this->stop();
        return $this->start();
    }
    
    /**
     * Check if the server is running
     *
     * @since    1.0.0
     * @return   bool    True if server is running, false otherwise
     */
    public function check_status() {
        if (file_exists($this->pid_file)) {
            $pid = (int)file_get_contents($this->pid_file);
            
            // Check if process is running
            if (function_exists('posix_kill')) {
                $running = posix_kill($pid, 0);
            } else {
                exec('ps -p ' . $pid . ' > /dev/null 2>&1', $output, $result);
                $running = ($result === 0);
            }
            
            if ($running) {
                $this->running = true;
                $this->pid = $pid;
                
                // Get server start time from file modification time if not already set
                if ($this->start_time === null) {
                    $this->start_time = filemtime($this->pid_file);
                }
                
                return true;
            }
        }
        
        // Server not running
        $this->running = false;
        $this->pid = null;
        $this->start_time = null;
        
        return false;
    }
    
    /**
     * Get server status information
     *
     * @since    1.0.0
     * @return   array    Server status information
     */
    public function get_status() {
        $this->check_status();
        
        $status = array(
            'running' => $this->running,
            'pid' => $this->pid,
            'uptime' => null,
            'connections' => 0,
            'sessions' => count(Jackalopes_Server_Database::get_active_sessions()),
        );
        
        if ($this->running && $this->start_time !== null) {
            $uptime_seconds = time() - $this->start_time;
            $status['uptime'] = $this->format_uptime($uptime_seconds);
        }
        
        // Get active connections count from server log or status file if available
        if ($this->running) {
            $connections = $this->get_active_connections();
            $status['connections'] = $connections;
        }
        
        return $status;
    }
    
    /**
     * Format uptime as a human-readable string
     *
     * @since    1.0.0
     * @param    int       $seconds    Uptime in seconds
     * @return   string                Formatted uptime string
     */
    private function format_uptime($seconds) {
        $days = floor($seconds / 86400);
        $seconds %= 86400;
        
        $hours = floor($seconds / 3600);
        $seconds %= 3600;
        
        $minutes = floor($seconds / 60);
        $seconds %= 60;
        
        $uptime = '';
        
        if ($days > 0) {
            $uptime .= $days . ' day' . ($days > 1 ? 's' : '') . ', ';
        }
        
        $uptime .= sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds);
        
        return $uptime;
    }
    
    /**
     * Get the number of active connections from the server
     *
     * @since    1.0.0
     * @return   int    Number of active connections
     */
    private function get_active_connections() {
        // In a production environment, this would query the WebSocket server
        // For now, just return a placeholder count from the database
        
        global $wpdb;
        $table_players = $wpdb->prefix . 'jackalopes_players';
        
        // Count players that have been active in the last 5 minutes
        $active_time = date('Y-m-d H:i:s', time() - 300); // 5 minutes ago
        
        return (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_players 
             WHERE last_active > %s",
            $active_time
        ));
    }
    
    /**
     * Log a message to the server log file
     *
     * @since    1.0.0
     * @param    string    $message    Message to log
     */
    private function log_message($message) {
        $timestamp = date('Y-m-d H:i:s');
        $log_entry = "[$timestamp] $message\n";
        
        file_put_contents(
            JACKALOPES_SERVER_PLUGIN_DIR . 'plugin.log',
            $log_entry,
            FILE_APPEND
        );
    }
    
    /**
     * Install Composer dependencies
     *
     * @since    1.0.0
     */
    private function install_dependencies() {
        // Create composer.json if it doesn't exist
        $composer_json = JACKALOPES_SERVER_PLUGIN_DIR . 'composer.json';
        if (!file_exists($composer_json)) {
            $composer_content = json_encode(array(
                'name' => 'jackalopes/server',
                'description' => 'Jackalopes Multiplayer Server',
                'type' => 'wordpress-plugin',
                'require' => array(
                    'cboden/ratchet' => '^0.4.3',
                ),
                'autoload' => array(
                    'psr-4' => array(
                        'Jackalopes\\Server\\' => 'includes/server/'
                    ),
                ),
            ), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            
            file_put_contents($composer_json, $composer_content);
        }
        
        // Run composer install
        $current_dir = getcwd();
        chdir(JACKALOPES_SERVER_PLUGIN_DIR);
        exec('composer install --no-dev');
        chdir($current_dir);
    }
    
    /**
     * Create the WebSocket server script
     *
     * @since    1.0.0
     */
    private function create_server_script() {
        $script_content = <<<'PHP'
<?php
/**
 * WebSocket Server implementation using Ratchet
 *
 * @package    Jackalopes_Server
 */

// Initialize WordPress
$wp_load_path = realpath(dirname(__FILE__) . '/../../../wp-load.php');
require_once $wp_load_path;

// Load Composer dependencies
require_once JACKALOPES_SERVER_PLUGIN_DIR . 'vendor/autoload.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\ConnectionInterface;
use Ratchet\MessageComponentInterface;

/**
 * Jackalopes WebSocket Server Component
 */
class JackalopesServerComponent implements MessageComponentInterface {
    protected $clients;
    protected $sessions = [];
    protected $playerToSession = [];
    
    public function __construct() {
        $this->clients = new \SplObjectStorage;
        
        // Log server startup
        $this->log('WebSocket server started');
    }
    
    /**
     * Handle new connections
     */
    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        $conn->playerData = null;
        $conn->sessionId = null;
        
        $this->log('New connection: ' . $conn->resourceId);
        
        // Send welcome message with server info
        $conn->send(json_encode([
            'type' => 'welcome',
            'server' => 'Jackalopes WebSocket Server',
            'version' => JACKALOPES_SERVER_VERSION,
            'timestamp' => time(),
        ]));
    }
    
    /**
     * Handle incoming messages
     */
    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        
        // Handle malformed messages
        if (!is_array($data) || !isset($data['type'])) {
            $from->send(json_encode([
                'type' => 'error',
                'message' => 'Invalid message format'
            ]));
            return;
        }
        
        $this->log('Message received: ' . $data['type']);
        
        switch ($data['type']) {
            case 'auth':
                $this->handleAuth($from, $data);
                break;
                
            case 'join_session':
                $this->handleJoinSession($from, $data);
                break;
                
            case 'player_update':
                $this->handlePlayerUpdate($from, $data);
                break;
                
            case 'game_event':
                $this->handleGameEvent($from, $data);
                break;
                
            case 'chat':
                $this->handleChat($from, $data);
                break;
                
            case 'leave_session':
                $this->handleLeaveSession($from);
                break;
                
            default:
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Unknown message type: ' . $data['type']
                ]));
                break;
        }
    }
    
    /**
     * Handle authentication requests
     */
    private function handleAuth(ConnectionInterface $client, $data) {
        // In a production environment, this would validate against WordPress users
        // For now, just accept the player name
        
        if (!isset($data['playerName'])) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'Missing playerName in auth request'
            ]));
            return;
        }
        
        $playerName = sanitize_text_field($data['playerName']);
        
        // Create player data
        $client->playerData = [
            'id' => uniqid('player_'),
            'name' => $playerName,
            'authenticated' => true,
        ];
        
        $client->send(json_encode([
            'type' => 'auth_success',
            'player' => $client->playerData,
        ]));
        
        $this->log('Player authenticated: ' . $playerName);
    }
    
    /**
     * Handle session join requests
     */
    private function handleJoinSession(ConnectionInterface $client, $data) {
        if (!$client->playerData) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'You must authenticate before joining a session'
            ]));
            return;
        }
        
        // Check if session key is provided
        if (isset($data['sessionKey'])) {
            $sessionKey = $data['sessionKey'];
            
            // Check if session exists in database
            global $wpdb;
            $table_sessions = $wpdb->prefix . 'jackalopes_sessions';
            $session = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM $table_sessions WHERE session_key = %s AND status = 'active'",
                $sessionKey
            ));
            
            if (!$session) {
                $client->send(json_encode([
                    'type' => 'error',
                    'message' => 'Session not found or not active'
                ]));
                return;
            }
            
            $sessionId = $session->id;
        } else {
            // No session key, create a new session
            $result = Jackalopes_Server_Database::create_session();
            
            if (!$result['success']) {
                $client->send(json_encode([
                    'type' => 'error',
                    'message' => $result['message']
                ]));
                return;
            }
            
            $sessionId = $result['session']['id'];
            $sessionKey = $result['session']['session_key'];
        }
        
        // Register player in the session
        $playerId = $client->playerData['id'];
        $playerName = $client->playerData['name'];
        
        // Add player to database
        $result = Jackalopes_Server_Database::add_player($sessionId, $playerName);
        
        if (!$result['success']) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => $result['message']
            ]));
            return;
        }
        
        // Associate client with session
        $client->sessionId = $sessionId;
        $client->playerData['dbId'] = $result['player']['id'];
        
        // Initialize session tracking if needed
        if (!isset($this->sessions[$sessionId])) {
            $this->sessions[$sessionId] = [
                'players' => []
            ];
        }
        
        // Add player to session
        $this->sessions[$sessionId]['players'][$playerId] = $client;
        $this->playerToSession[$playerId] = $sessionId;
        
        // Send success message to client
        $client->send(json_encode([
            'type' => 'join_success',
            'session' => [
                'id' => $sessionId,
                'key' => $sessionKey,
            ],
            'player' => $client->playerData,
        ]));
        
        // Notify other players in session
        $this->broadcastToSession($sessionId, [
            'type' => 'player_joined',
            'player' => [
                'id' => $playerId,
                'name' => $playerName,
            ]
        ], $client);
        
        $this->log('Player joined session: ' . $playerName . ' -> ' . $sessionId);
    }
    
    /**
     * Handle player update messages
     */
    private function handlePlayerUpdate(ConnectionInterface $client, $data) {
        if (!$client->playerData || !$client->sessionId) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'You must join a session before sending updates'
            ]));
            return;
        }
        
        $sessionId = $client->sessionId;
        $playerId = $client->playerData['id'];
        
        // Update last activity timestamp
        Jackalopes_Server_Database::update_player_activity($client->playerData['dbId']);
        
        // Validate update data
        if (!isset($data['state'])) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'Missing state in player_update'
            ]));
            return;
        }
        
        // Forward update to other players in session
        $this->broadcastToSession($sessionId, [
            'type' => 'player_update',
            'player' => $playerId,
            'state' => $data['state'],
            'timestamp' => time(),
        ], $client);
    }
    
    /**
     * Handle game events
     */
    private function handleGameEvent(ConnectionInterface $client, $data) {
        if (!$client->playerData || !$client->sessionId) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'You must join a session before sending game events'
            ]));
            return;
        }
        
        $sessionId = $client->sessionId;
        $playerId = $client->playerData['id'];
        
        // Validate event data
        if (!isset($data['event'])) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'Missing event in game_event'
            ]));
            return;
        }
        
        // Add player and timestamp information
        $event = $data['event'];
        $event['player'] = $playerId;
        $event['timestamp'] = time();
        
        // Forward event to all players in session (including sender)
        $this->broadcastToSession($sessionId, [
            'type' => 'game_event',
            'event' => $event,
        ]);
        
        // For specific important events, save to database
        if (isset($event['type']) && $event['type'] === 'shot') {
            $this->logGameEvent($sessionId, 'shot', $playerId, $event);
        }
    }
    
    /**
     * Handle chat messages
     */
    private function handleChat(ConnectionInterface $client, $data) {
        if (!$client->playerData || !$client->sessionId) {
            $client->send(json_encode([
                'type' => 'error',
                'message' => 'You must join a session before sending chat messages'
            ]));
            return;
        }
        
        $sessionId = $client->sessionId;
        $playerId = $client->playerData['id'];
        $playerName = $client->playerData['name'];
        
        // Validate message
        if (!isset($data['message']) || trim($data['message']) === '') {
            return;
        }
        
        $message = sanitize_text_field($data['message']);
        
        // Forward message to all players in session
        $this->broadcastToSession($sessionId, [
            'type' => 'chat',
            'player' => $playerId,
            'playerName' => $playerName,
            'message' => $message,
            'timestamp' => time(),
        ]);
    }
    
    /**
     * Handle session leave requests
     */
    private function handleLeaveSession(ConnectionInterface $client) {
        if (!$client->playerData || !$client->sessionId) {
            return;
        }
        
        $sessionId = $client->sessionId;
        $playerId = $client->playerData['id'];
        $playerName = $client->playerData['name'];
        
        // Remove player from session tracking
        if (isset($this->sessions[$sessionId]['players'][$playerId])) {
            unset($this->sessions[$sessionId]['players'][$playerId]);
        }
        
        if (isset($this->playerToSession[$playerId])) {
            unset($this->playerToSession[$playerId]);
        }
        
        // Notify other players
        $this->broadcastToSession($sessionId, [
            'type' => 'player_left',
            'player' => $playerId,
            'playerName' => $playerName,
        ]);
        
        // Reset session data
        $client->sessionId = null;
        
        $this->log('Player left session: ' . $playerName . ' -> ' . $sessionId);
    }
    
    /**
     * Handle closed connections
     */
    public function onClose(ConnectionInterface $conn) {
        // Handle session leave if applicable
        if ($conn->playerData && $conn->sessionId) {
            $this->handleLeaveSession($conn);
        }
        
        // Remove from clients list
        $this->clients->detach($conn);
        
        $this->log('Connection closed: ' . $conn->resourceId);
    }
    
    /**
     * Handle connection errors
     */
    public function onError(ConnectionInterface $conn, \Exception $e) {
        $this->log('Error: ' . $e->getMessage());
        
        $conn->close();
    }
    
    /**
     * Broadcast a message to all players in a session
     */
    private function broadcastToSession($sessionId, $message, $exclude = null) {
        if (!isset($this->sessions[$sessionId])) {
            return;
        }
        
        $encoded = json_encode($message);
        
        foreach ($this->sessions[$sessionId]['players'] as $playerId => $client) {
            if ($exclude !== null && $client === $exclude) {
                continue;
            }
            
            $client->send($encoded);
        }
    }
    
    /**
     * Log game events to the database
     */
    private function logGameEvent($sessionId, $eventType, $playerId, $eventData) {
        // For now, just log to the plugin log
        $this->log("Game event: $eventType by $playerId in session $sessionId");
        
        // In a production environment, this would save to the database
        // Jackalopes_Server_Database::save_event($sessionId, $eventType, $playerId, json_encode($eventData));
    }
    
    /**
     * Log a message
     */
    private function log($message) {
        $timestamp = date('Y-m-d H:i:s');
        $log_entry = "[$timestamp] $message\n";
        
        file_put_contents(
            JACKALOPES_SERVER_PLUGIN_DIR . 'server.log',
            $log_entry,
            FILE_APPEND
        );
    }
    
    /**
     * Update .env file with a key-value pair
     *
     * @since    1.0.0
     * @param    string    $key      Environment variable key
     * @param    string    $value    Environment variable value
     */
    private function update_env_file($key, $value) {
        $env_file = JACKALOPES_SERVER_PLUGIN_DIR . '.env';
        
        if (!file_exists($env_file)) {
            // If .env file doesn't exist, create it
            $env_content = "# Server settings\n$key=$value\n";
            file_put_contents($env_file, $env_content);
            return;
        }
        
        // Read the current .env file
        $env_content = file_get_contents($env_file);
        
        // Check if the key already exists
        if (preg_match("/^$key=.*$/m", $env_content)) {
            // Replace the existing key-value pair
            $env_content = preg_replace("/^$key=.*$/m", "$key=$value", $env_content);
        } else {
            // Add the key-value pair at the end of the file
            $env_content .= "\n$key=$value\n";
        }
        
        // Write the updated content back to the file
        file_put_contents($env_file, $env_content);
    }
    
    /**
     * Check if Node.js is available on the system
     *
     * @since    1.0.0
     * @return   bool    True if Node.js is available, false otherwise
     */
    private function check_nodejs() {
        // Try in plugin directory first (for local Node.js installation)
        $nodejs_paths = [
            // Check node in the plugin directory (for custom installations)
            JACKALOPES_SERVER_PLUGIN_DIR . 'node_modules/.bin/node',
            // Check system default paths
            'node',
            '/usr/bin/node',
            '/usr/local/bin/node',
            '/opt/homebrew/bin/node',
            // Add more paths as needed
        ];
        
        foreach ($nodejs_paths as $node_path) {
            $test_command = sprintf('%s -v', escapeshellcmd($node_path));
            exec($test_command . ' 2>&1', $output, $return_var);
            
            if ($return_var === 0 && !empty($output) && strpos($output[0], 'v') === 0) {
                $this->log_message('Found Node.js: ' . $output[0] . ' at ' . $node_path);
                return true;
            }
        }
        
        $this->log_message('Error: Node.js not found. Please ensure Node.js is installed and available in PATH.');
        
        // Additional diagnostic information
        exec('which node 2>&1', $which_output, $which_return);
        if ($which_return === 0) {
            $this->log_message('Node.js found at: ' . $which_output[0]);
            
            // Test if we can execute it
            exec($which_output[0] . ' -v 2>&1', $node_output, $node_return);
            if ($node_return === 0) {
                $this->log_message('Node.js version: ' . $node_output[0]);
            } else {
                $this->log_message('Error executing Node.js: ' . implode("\n", $node_output));
            }
        } else {
            $this->log_message('Node.js not found in PATH. Error: ' . implode("\n", $which_output));
        }
        
        return false;
    }
}
PHP;

        // Write the script to a file
        $script_path = JACKALOPES_SERVER_PLUGIN_DIR . 'server.php';
        file_put_contents($script_path, $script_content);
        
        return $script_path;
    }
}