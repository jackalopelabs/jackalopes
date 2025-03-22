import React, { useEffect, useState } from 'react';
import { ConnectionManager } from '../network/ConnectionManager';

export const ConnectionTest: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080');

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().substr(11, 8);
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const connectionManager = new ConnectionManager(serverUrl);

    connectionManager.on('connected', () => {
      setConnectionStatus('connected');
      addLog('Connected to server');
    });

    connectionManager.on('disconnected', () => {
      setConnectionStatus('disconnected');
      addLog('Disconnected from server');
    });

    connectionManager.on('initialized', (data) => {
      setPlayerId(data.id);
      addLog(`Initialized with player ID: ${data.id}`);
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
    };
  }, [serverUrl]);

  const handleConnect = () => {
    setConnectionStatus('connecting');
    const connectionManager = new ConnectionManager(serverUrl);
    connectionManager.connect();
  };

  const handleDisconnect = () => {
    setConnectionStatus('disconnected');
    const connectionManager = new ConnectionManager(serverUrl);
    connectionManager.disconnect();
  };

  const handleTestShot = () => {
    const connectionManager = new ConnectionManager(serverUrl);
    connectionManager.sendShootEvent([0, 0, 0], [0, 0, 1]);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg shadow-lg max-w-md">
      <h2 className="text-lg font-bold mb-2">Connection Test</h2>
      
      <div className="mb-4">
        <label className="block text-sm mb-1">Server URL:</label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className="w-full bg-gray-700 text-white px-2 py-1 rounded"
        />
      </div>

      <div className="mb-4">
        <span className="inline-block w-3 h-3 rounded-full mr-2 bg-red-500"></span>
        Status: {connectionStatus}
      </div>

      {playerId && (
        <div className="mb-4">
          Player ID: {playerId}
        </div>
      )}

      <div className="mb-4">
        Latency: {latency}ms
      </div>

      <div className="flex gap-2 mb-4">
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
      </div>

      <div className="h-48 overflow-y-auto bg-gray-900 p-2 rounded text-sm">
        {logs.map((log, i) => (
          <div key={i} className="font-mono">{log}</div>
        ))}
      </div>
    </div>
  );
}; 