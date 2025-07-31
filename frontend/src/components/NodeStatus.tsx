import React, { useState, useEffect } from 'react';
import { Server, Activity, Clock, Cpu, HardDrive, Wifi } from 'lucide-react';

interface NodeStatusProps {
    nodeInfo: any;
}

const NodeStatus: React.FC<NodeStatusProps> = ({ nodeInfo }) => {
    const [healthStatus, setHealthStatus] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);

    useEffect(() => {
        fetchHealthStatus();
        fetchMetrics();

        const interval = setInterval(() => {
            fetchHealthStatus();
            fetchMetrics();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const fetchHealthStatus = async () => {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            setHealthStatus(data);
        } catch (error) {
            console.error('Failed to fetch health status:', error);
        }
    };

    const fetchMetrics = async () => {
        try {
            const response = await fetch('/api/metrics');
            const data = await response.json();
            setMetrics(data);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    };

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        return `${days}d ${hours}h ${minutes}m`;
    };

    const formatBytes = (bytes: number) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <Server className="h-6 w-6 text-blue-500" />
                    <h2 className="text-xl font-bold text-gray-900">Node Status</h2>
                </div>

                {/* Node Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Activity className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium text-gray-500">Status</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                            {healthStatus?.status || 'Unknown'}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Clock className="h-5 w-5 text-blue-500" />
                            <span className="text-sm font-medium text-gray-500">Uptime</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                            {healthStatus ? formatUptime(healthStatus.uptime) : '--'}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Wifi className="h-5 w-5 text-purple-500" />
                            <span className="text-sm font-medium text-gray-500">Node ID</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900 truncate">
                            {nodeInfo?.id || 'Loading...'}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Server className="h-5 w-5 text-orange-500" />
                            <span className="text-sm font-medium text-gray-500">Version</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                            {healthStatus?.version || 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* Resource Usage */}
                {healthStatus?.resources && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <Cpu className="h-5 w-5 text-blue-500" />
                                    <span className="text-sm font-medium text-gray-500">CPU Usage</span>
                                </div>
                                <span className="text-sm font-semibold">
                                    {Math.round(healthStatus.resources.cpu.usage)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(healthStatus.resources.cpu.usage, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <Activity className="h-5 w-5 text-green-500" />
                                    <span className="text-sm font-medium text-gray-500">Memory</span>
                                </div>
                                <span className="text-sm font-semibold">
                                    {Math.round(healthStatus.resources.memory.usage)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(healthStatus.resources.memory.usage, 100)}%` }}
                                ></div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {formatBytes(healthStatus.resources.memory.used)} / {formatBytes(healthStatus.resources.memory.total)}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <HardDrive className="h-5 w-5 text-purple-500" />
                                    <span className="text-sm font-medium text-gray-500">Disk</span>
                                </div>
                                <span className="text-sm font-semibold">
                                    {Math.round(healthStatus.resources.disk.usage)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-purple-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(healthStatus.resources.disk.usage, 100)}%` }}
                                ></div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {formatBytes(healthStatus.resources.disk.used)} / {formatBytes(healthStatus.resources.disk.total)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Services Status */}
            {healthStatus?.services && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Services</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(healthStatus.services).map(([service, status]) => (
                            <div key={service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700 capitalize">{service}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {status ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Request Metrics */}
            {metrics?.requests && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Metrics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{metrics.requests.total}</div>
                            <div className="text-sm text-gray-500">Total Requests</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{metrics.requests.successful}</div>
                            <div className="text-sm text-gray-500">Successful</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{metrics.requests.failed}</div>
                            <div className="text-sm text-gray-500">Failed</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                                {Math.round(metrics.requests.avgResponseTime)}ms
                            </div>
                            <div className="text-sm text-gray-500">Avg Response</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NodeStatus;
