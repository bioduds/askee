import React, { useState, useEffect } from 'react';
import { Network as NetworkIcon, Users, Globe, Activity } from 'lucide-react';

const Network: React.FC = () => {
    const [networkStatus, setNetworkStatus] = useState<any>(null);
    const [nodes, setNodes] = useState<any[]>([]);

    useEffect(() => {
        fetchNetworkStatus();
        fetchNodes();

        const interval = setInterval(() => {
            fetchNetworkStatus();
            fetchNodes();
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    const fetchNetworkStatus = async () => {
        try {
            const response = await fetch('/api/network/status');
            const data = await response.json();
            setNetworkStatus(data);
        } catch (error) {
            console.error('Failed to fetch network status:', error);
        }
    };

    const fetchNodes = async () => {
        try {
            // This would be implemented in the backend
            const mockNodes = [
                {
                    id: 'node-001',
                    endpoint: 'http://localhost:8080',
                    status: 'online',
                    capabilities: ['llama3.2:latest', 'mistral:latest'],
                    load: 25,
                    lastSeen: new Date()
                },
                {
                    id: 'node-002',
                    endpoint: 'http://192.168.1.100:8080',
                    status: 'online',
                    capabilities: ['codellama:latest', 'phi3:latest'],
                    load: 60,
                    lastSeen: new Date()
                }
            ];
            setNodes(mockNodes);
        } catch (error) {
            console.error('Failed to fetch nodes:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'text-green-600 bg-green-100';
            case 'offline': return 'text-red-600 bg-red-100';
            case 'busy': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getLoadColor = (load: number) => {
        if (load < 30) return 'bg-green-500';
        if (load < 70) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <NetworkIcon className="h-6 w-6 text-blue-500" />
                    <h2 className="text-xl font-bold text-gray-900">Network Overview</h2>
                </div>

                {/* Network Stats */}
                {networkStatus && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{networkStatus.totalNodes}</div>
                            <div className="text-sm text-gray-500">Total Nodes</div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{networkStatus.onlineNodes}</div>
                            <div className="text-sm text-gray-500">Online Nodes</div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <Globe className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{networkStatus.totalModels}</div>
                            <div className="text-sm text-gray-500">Available Models</div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <NetworkIcon className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">
                                {Math.round(networkStatus.networkLoad)}%
                            </div>
                            <div className="text-sm text-gray-500">Network Load</div>
                        </div>
                    </div>
                )}

                {/* Network Load Visualization */}
                {networkStatus && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Network Load</span>
                            <span className="text-sm text-gray-500">{Math.round(networkStatus.networkLoad)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className={`h-3 rounded-full ${getLoadColor(networkStatus.networkLoad)}`}
                                style={{ width: `${Math.min(networkStatus.networkLoad, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Node List */}
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Nodes</h3>

                {nodes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <NetworkIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No network nodes discovered yet</p>
                        <p className="text-sm">Node discovery is running in the background</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {nodes.map((node) => (
                            <div key={node.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-shrink-0">
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">{node.id}</h4>
                                            <p className="text-sm text-gray-500">{node.endpoint}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}>
                                            {node.status}
                                        </span>
                                        <div className="text-right">
                                            <div className="text-sm font-medium text-gray-900">{node.load}%</div>
                                            <div className="text-xs text-gray-500">Load</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="text-sm text-gray-600 mb-1">Load</div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${getLoadColor(node.load)}`}
                                                style={{ width: `${Math.min(node.load, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="ml-4">
                                        <div className="text-sm text-gray-600 mb-1">Models ({node.capabilities.length})</div>
                                        <div className="flex flex-wrap gap-1">
                                            {node.capabilities.slice(0, 3).map((model: string, index: number) => (
                                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                    {model.split(':')[0]}
                                                </span>
                                            ))}
                                            {node.capabilities.length > 3 && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                    +{node.capabilities.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Network;
