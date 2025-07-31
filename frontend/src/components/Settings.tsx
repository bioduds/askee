import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';

interface SettingsProps {
    nodeInfo: any;
}

const Settings: React.FC<SettingsProps> = ({ nodeInfo }) => {
    const [settings, setSettings] = useState({
        nodeEndpoint: 'http://localhost:8080',
        ollamaUrl: 'http://localhost:11434',
        autoDiscovery: true,
        healthCheckInterval: 10000,
        logLevel: 'info',
        maxConcurrentRequests: 10,
        requestTimeout: 30000,
        enableMetrics: true,
        enableCORS: true,
        allowedOrigins: 'http://localhost:3000'
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // This would save settings to the backend
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated save
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset all settings to default values?')) {
            setSettings({
                nodeEndpoint: 'http://localhost:8080',
                ollamaUrl: 'http://localhost:11434',
                autoDiscovery: true,
                healthCheckInterval: 10000,
                logLevel: 'info',
                maxConcurrentRequests: 10,
                requestTimeout: 30000,
                enableMetrics: true,
                enableCORS: true,
                allowedOrigins: 'http://localhost:3000'
            });
        }
    };

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <SettingsIcon className="h-6 w-6 text-blue-500" />
                        <h2 className="text-xl font-bold text-gray-900">Node Settings</h2>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={handleReset}
                            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <RefreshCw className="h-4 w-4" />
                            <span>Reset</span>
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            <span>{isSaving ? 'Saving...' : 'Save'}</span>
                        </button>
                    </div>
                </div>

                {/* Node Information */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Node Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Node ID</label>
                            <input
                                type="text"
                                value={nodeInfo?.id || 'Loading...'}
                                readOnly
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Version</label>
                            <input
                                type="text"
                                value="1.0.0"
                                readOnly
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                            />
                        </div>
                    </div>
                </div>

                {/* Connection Settings */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Settings</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Node Endpoint
                            </label>
                            <input
                                type="text"
                                value={settings.nodeEndpoint}
                                onChange={(e) => updateSetting('nodeEndpoint', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">The endpoint where this node can be reached by other nodes</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Ollama URL
                            </label>
                            <input
                                type="text"
                                value={settings.ollamaUrl}
                                onChange={(e) => updateSetting('ollamaUrl', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">URL to the local Ollama instance</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Allowed Origins (CORS)
                            </label>
                            <input
                                type="text"
                                value={settings.allowedOrigins}
                                onChange={(e) => updateSetting('allowedOrigins', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed origins for CORS</p>
                        </div>
                    </div>
                </div>

                {/* Performance Settings */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Concurrent Requests
                            </label>
                            <input
                                type="number"
                                value={settings.maxConcurrentRequests}
                                onChange={(e) => updateSetting('maxConcurrentRequests', parseInt(e.target.value))}
                                min="1"
                                max="100"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Request Timeout (ms)
                            </label>
                            <input
                                type="number"
                                value={settings.requestTimeout}
                                onChange={(e) => updateSetting('requestTimeout', parseInt(e.target.value))}
                                min="1000"
                                max="300000"
                                step="1000"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Health Check Interval (ms)
                            </label>
                            <input
                                type="number"
                                value={settings.healthCheckInterval}
                                onChange={(e) => updateSetting('healthCheckInterval', parseInt(e.target.value))}
                                min="5000"
                                max="60000"
                                step="1000"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Log Level
                            </label>
                            <select
                                value={settings.logLevel}
                                onChange={(e) => updateSetting('logLevel', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="error">Error</option>
                                <option value="warn">Warning</option>
                                <option value="info">Info</option>
                                <option value="debug">Debug</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Feature Toggles */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Auto Network Discovery</label>
                                <p className="text-xs text-gray-500">Automatically discover and connect to other nodes</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.autoDiscovery}
                                    onChange={(e) => updateSetting('autoDiscovery', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Enable Metrics</label>
                                <p className="text-xs text-gray-500">Collect and store performance metrics</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.enableMetrics}
                                    onChange={(e) => updateSetting('enableMetrics', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Enable CORS</label>
                                <p className="text-xs text-gray-500">Allow cross-origin requests from web browsers</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.enableCORS}
                                    onChange={(e) => updateSetting('enableCORS', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
                    <div className="space-y-3">
                        <button className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                            Clear All Chat History
                        </button>
                        <button className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                            Reset All Metrics
                        </button>
                        <button className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                            Leave Network
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
