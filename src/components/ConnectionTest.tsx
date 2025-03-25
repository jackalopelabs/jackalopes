import React, { useEffect, useState, useRef } from 'react';
import { ConnectionManager } from '../network/ConnectionManager';

interface ConnectionTestProps {
  sharedConnectionManager?: ConnectionManager;
}

export const ConnectionTest: React.FC<ConnectionTestProps> = ({ sharedConnectionManager }) => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'offline'>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState('ws://staging.games.bonsai.so/websocket/');
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const [expanded, setExpanded] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().substr(11, 8);
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  // Function to set up common server URLs
  const setServerPreset = (preset: string) => {
    switch (preset) {
      case 'staging':
        setServerUrl('ws://staging.games.bonsai.so/websocket/');
        break;
      case 'staging-secure':
        setServerUrl('wss://staging.games.bonsai.so/websocket/');
        break;
      case 'local':
        setServerUrl('ws://localhost:8082');
        break;
      case 'offline':
        // Special case - go to offline mode immediately
        if (connectionManagerRef.current) {
          connectionManagerRef.current.forceReady();
          setConnectionStatus('offline');
          addLog('Switched to offline mode');
        }
        break;
    }
  };

  useEffect(() => {
    // Use the shared connection manager if provided, otherwise create a new one
    if (sharedConnectionManager) {
      connectionManagerRef.current = sharedConnectionManager;
      
      // Check current connection state
      if (sharedConnectionManager.isReadyToSend()) {
        if (sharedConnectionManager.isPlayerConnected()) {
          setConnectionStatus('connected');
          setPlayerId(sharedConnectionManager.getPlayerId() || null);
        } else {
          setConnectionStatus('offline');
          setPlayerId(sharedConnectionManager.getPlayerId() || null);
        }
      } else {
        setConnectionStatus('disconnected');
      }
      
      addLog(`Using shared connection manager (URL: ${sharedConnectionManager.getServerUrl()})`);
    } else {
      // Create and store the connection manager
      connectionManagerRef.current = new ConnectionManager(serverUrl);
      addLog(`Created new connection manager with URL: ${serverUrl}`);
      
      // Connect when component mounts with a new manager
      setConnectionStatus('connecting');
      connectionManagerRef.current.connect();
    }

    const connectionManager = connectionManagerRef.current;

    // Set up event listeners
    const handleConnected = () => {
      setConnectionStatus('connected');
      addLog('Connected to server');
    };

    const handleDisconnected = () => {
      // Only set to disconnected if not in offline mode
      if (connectionStatus !== 'offline') {
        setConnectionStatus('disconnected');
        addLog('Disconnected from server');
      }
    };

    const handleInitialized = (data: any) => {
      setPlayerId(data.id);
      
      // Check if we're in offline mode (player ID starts with 'offline-')
      if (data.id && data.id.startsWith('offline-')) {
        setConnectionStatus('offline');
        addLog(`Initialized in OFFLINE mode with ID: ${data.id}`);
      } else {
        addLog(`Initialized with player ID: ${data.id}`);
      }
    };
    
    const handleServerUnreachable = () => {
      setConnectionStatus('offline');
      addLog('Server unreachable. Switched to offline mode.');
    };

    const handleLatencyUpdate = (newLatency: number) => {
      setLatency(newLatency);
    };

    const handleMessageReceived = (message: any) => {
      addLog(`Received: ${message.type}`);
    };

    const handleMessageSent = (message: any) => {
      addLog(`Sent: ${message.type}`);
    };

    // Add event listeners
    connectionManager.on('connected', handleConnected);
    connectionManager.on('disconnected', handleDisconnected);
    connectionManager.on('initialized', handleInitialized);
    connectionManager.on('server_unreachable', handleServerUnreachable);
    connectionManager.on('latency_update', handleLatencyUpdate);
    connectionManager.on('message_received', handleMessageReceived);
    connectionManager.on('message_sent', handleMessageSent);

    // Cleanup on unmount
    return () => {
      // Remove event listeners
      connectionManager.off('connected', handleConnected);
      connectionManager.off('disconnected', handleDisconnected);
      connectionManager.off('initialized', handleInitialized);
      connectionManager.off('server_unreachable', handleServerUnreachable);
      connectionManager.off('latency_update', handleLatencyUpdate);
      connectionManager.off('message_received', handleMessageReceived);
      connectionManager.off('message_sent', handleMessageSent);
      
      // Only disconnect if we created our own manager
      if (!sharedConnectionManager) {
        connectionManager.disconnect();
        connectionManagerRef.current = null;
      }
    };
  }, [serverUrl, sharedConnectionManager]);

  const handleConnect = () => {
    if (connectionManagerRef.current) {
      setConnectionStatus('connecting');
      
      // Only create a new connection manager if we're not using a shared one
      if (!sharedConnectionManager) {
        connectionManagerRef.current.disconnect();
        connectionManagerRef.current = new ConnectionManager(serverUrl);
      }
      
      connectionManagerRef.current.connect();
      addLog(`Connecting to ${serverUrl}...`);
    }
  };

  const handleDisconnect = () => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
      addLog('Manually disconnected');
    }
    setConnectionStatus('disconnected');
  };

  const handleTestShot = () => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.sendShootEvent([0, 0, 0], [0, 0, 1]);
      addLog('Test shot sent');
    } else {
      addLog('Cannot send test shot: no connection manager');
    }
  };

  const handleForceOfflineMode = () => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.forceReady();
      setConnectionStatus('offline');
      addLog('Forced offline mode');
    } else {
      addLog('Cannot force offline mode: no connection manager');
    }
  };

  const handleGetConnectionState = () => {
    if (connectionManagerRef.current) {
      const isReady = connectionManagerRef.current.isReadyToSend();
      const playerId = connectionManagerRef.current.getPlayerId();
      const socketState = connectionManagerRef.current.getSocketState();
      
      addLog(`Connection State: ready=${isReady}, playerID=${playerId}, socket=${socketState}`);
    } else {
      addLog('Cannot get state: no connection manager');
    }
  };

  // Get status color based on connection status
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'offline': return 'bg-purple-500';
      case 'disconnected': 
      default: return 'bg-red-500';
    }
  };

  // Get status label with emoji
  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢 Connected';
      case 'connecting': return '🟠 Connecting...';
      case 'offline': return '🟣 Offline Mode';
      case 'disconnected': 
      default: return '🔴 Disconnected';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg shadow-lg max-w-md z-50">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold">Connection Test</h2>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      
      {expanded && (
        <div className="mb-4">
          <label className="block text-sm mb-1">Server URL:</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="w-full bg-gray-700 text-white px-2 py-1 rounded mb-2"
            disabled={!!sharedConnectionManager}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <button 
              onClick={() => setServerPreset('staging')} 
              className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
              disabled={!!sharedConnectionManager}
            >
              Staging (ws://)
            </button>
            <button 
              onClick={() => setServerPreset('staging-secure')}
              className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
              disabled={!!sharedConnectionManager}
            >
              Staging (wss://)
            </button>
            <button 
              onClick={() => setServerPreset('local')}
              className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
              disabled={!!sharedConnectionManager}
            >
              Local
            </button>
            <button 
              onClick={() => setServerPreset('offline')}
              className={`${connectionStatus === 'offline' ? 'bg-purple-800' : 'bg-purple-700'} px-2 py-1 rounded hover:bg-purple-600`}
            >
              Offline Mode
            </button>
          </div>
          {sharedConnectionManager && (
            <div className="mt-2 text-xs text-yellow-300">
              ⚠️ Using shared connection manager - URL changes disabled
            </div>
          )}
        </div>
      )}

      <div className="mb-4 p-2 rounded" style={{ backgroundColor: connectionStatus === 'offline' ? 'rgba(147, 51, 234, 0.2)' : 'transparent' }}>
        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}></span>
        <span className="font-medium">{getStatusLabel()}</span>
        {playerId && <span className="ml-2 text-gray-300 text-sm"> | ID: {playerId.substring(0, 10)}...</span>}
        <span className="ml-2 text-gray-300 text-sm"> | Latency: {latency}ms</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <button
          onClick={handleConnect}
          className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
        >
          Connect
        </button>
        <button
          onClick={handleDisconnect}
          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
        >
          Disconnect
        </button>
        <button
          onClick={handleTestShot}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
        >
          Test Shot
        </button>
        <button
          onClick={handleForceOfflineMode}
          className={`${connectionStatus === 'offline' ? 'bg-purple-800 opacity-70' : 'bg-purple-600 hover:bg-purple-700'} px-3 py-1 rounded`}
          disabled={connectionStatus === 'offline'}
        >
          Force Offline
        </button>
        <button
          onClick={handleGetConnectionState}
          className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
        >
          Debug State
        </button>
      </div>

      {expanded && (
        <div className="h-48 overflow-y-auto bg-gray-900 p-2 rounded text-sm">
          {logs.map((log, i) => (
            <div key={i} className="font-mono whitespace-normal break-words">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}; 