import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Chat from './components/Chat';
import NodeStatus from './components/NodeStatus';
import Network from './components/Network';
import Models from './components/Models';
import Settings from './components/Settings';
import { MessageCircle, Server, Network as NetworkIcon, Package, Settings as SettingsIcon, Activity } from 'lucide-react';
import './App.css';

const Navigation: React.FC = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: MessageCircle, label: 'Chat' },
        { path: '/node', icon: Server, label: 'Node Status' },
        { path: '/network', icon: NetworkIcon, label: 'Network' },
        { path: '/models', icon: Package, label: 'Models' },
        { path: '/settings', icon: SettingsIcon, label: 'Settings' },
    ];

    return (
        <nav className="bg-gray-800 text-white p-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Activity className="h-8 w-8 text-blue-400" />
                    <h1 className="text-xl font-bold">Askee AI Network</h1>
                </div>

                <div className="flex space-x-4">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <Link
                            key={path}
                            to={path}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${location.pathname === path
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
};

const App: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [nodeInfo, setNodeInfo] = useState<any>(null);

    useEffect(() => {
        // Check initial connection
        checkConnection();

        // Set up periodic health checks
        const interval = setInterval(checkConnection, 30000);

        return () => clearInterval(interval);
    }, []);

    const checkConnection = async () => {
        try {
            const response = await fetch('/health');
            const healthData = await response.json();
            setIsConnected(healthData.status === 'healthy');

            // Get node info
            const nodeResponse = await fetch('/api/node/info');
            const nodeData = await nodeResponse.json();
            setNodeInfo(nodeData);
        } catch (error) {
            console.error('Connection check failed:', error);
            setIsConnected(false);
        }
    };

    return (
        <Router>
            <div className="min-h-screen bg-gray-50">
                <Navigation />

                {/* Connection Status Banner */}
                {!isConnected && (
                    <div className="bg-red-500 text-white px-4 py-2 text-center">
                        <span className="font-medium">Disconnected from node</span>
                        <span className="ml-2 text-red-200">Attempting to reconnect...</span>
                    </div>
                )}

                <main className="container mx-auto px-4 py-8">
                    <Routes>
                        <Route path="/" element={<Chat nodeInfo={nodeInfo} />} />
                        <Route path="/node" element={<NodeStatus nodeInfo={nodeInfo} />} />
                        <Route path="/network" element={<Network />} />
                        <Route path="/models" element={<Models />} />
                        <Route path="/settings" element={<Settings nodeInfo={nodeInfo} />} />
                    </Routes>
                </main>

                {/* Footer */}
                <footer className="bg-gray-800 text-gray-400 py-4 mt-auto">
                    <div className="container mx-auto px-4 text-center">
                        <p>Askee AI Network v1.0.0 | Node ID: {nodeInfo?.id || 'Loading...'}</p>
                        <p className="text-sm mt-1">
                            Status: <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </p>
                    </div>
                </footer>
            </div>
        </Router>
    );
};

export default App;
