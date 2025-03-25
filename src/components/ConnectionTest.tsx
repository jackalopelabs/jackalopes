import React, { useEffect, useState, useRef } from 'react';
import { ConnectionManager } from '../network/ConnectionManager';

export const ConnectionTest: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'offline'>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState('ws://localhost:8082');
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
        setServerUrl('ws://staging.games.bonsai.so:8082');
        break;
      case 'staging-secure':
        setServerUrl('wss://staging.games.bonsai.so:8082');
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
    // Create and store the connection manager
    connectionManagerRef.current = new ConnectionManager(serverUrl);
    const connectionManager = connectionManagerRef.current;

    connectionManager.on('connected', () => {
      setConnectionStatus('connected');
      addLog('Connected to server');
    });

    connectionManager.on('disconnected', () => {
      // Only set to disconnected if not in offline mode
      if (connectionStatus !== 'offline') {
        setConnectionStatus('disconnected');
        addLog('Disconnected from server');
      }
    });

    connectionManager.on('initialized', (data) => {
      setPlayerId(data.id);
      
      // Check if we're in offline mode (player ID starts with 'offline-')
      if (data.id && data.id.startsWith('offline-')) {
        setConnectionStatus('offline');
        addLog(`Initialized in OFFLINE mode with ID: ${data.id}`);
      } else {
        addLog(`Initialized with player ID: ${data.id}`);
      }
    });
    
    connectionManager.on('server_unreachable', () => {
      setConnectionStatus('offline');
      addLog('Server unreachable. Switched to offline mode.');
    });

    connectionManager.on('latency_update', (newLatency) => {
      setLatency(newLatency);
    });

    connectionManager.on('message_received', (message) => {
      addLog(`Received: ${message.type}`);
    });

    connectionManager.on('message_sent', (message) => {
      addLog(`Sent: ${message.type}`);
    });

    // Connect when component mounts
    setConnectionStatus('connecting');
    connectionManager.connect();

    // Cleanup on unmount
    return () => {
      connectionManager.disconnect();
      connectionManagerRef.current = null;
    };
  }, [serverUrl]);

  const handleConnect = () => {
    setConnectionStatus('connecting');
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }
    connectionManagerRef.current = new ConnectionManager(serverUrl);
    connectionManagerRef.current.connect();
  };

  const handleDisconnect = () => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
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
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <button 
              onClick={() => setServerPreset('staging')} 
              className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
            >
              Staging (ws://)
            </button>
            <button 
              onClick={() => setServerPreset('staging-secure')}
              className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
            >
              Staging (wss://)
            </button>
            <button 
              onClick={() => setServerPreset('local')}
              className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
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