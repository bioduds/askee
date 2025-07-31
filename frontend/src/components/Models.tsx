import React, { useState, useEffect } from 'react';
import { Package, Download, Trash2, Plus, RefreshCw } from 'lucide-react';

interface Model {
    name: string;
    size?: number;
    digest?: string;
    modified_at?: string;
    source?: 'local' | 'network';
}

const Models: React.FC = () => {
    const [models, setModels] = useState<{ local: Model[]; network: Model[] }>({ local: [], network: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('');
    const [showPullDialog, setShowPullDialog] = useState(false);
    const [pullModelName, setPullModelName] = useState('');
    const [isPulling, setIsPulling] = useState(false);

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            setModels({
                local: data.local || [],
                network: data.network || []
            });
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const pullModel = async () => {
        if (!pullModelName.trim()) return;

        setIsPulling(true);
        try {
            const response = await fetch('/api/models/pull', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ modelName: pullModelName }),
            });

            const result = await response.json();

            if (result.success) {
                setShowPullDialog(false);
                setPullModelName('');
                fetchModels(); // Refresh the model list
            } else {
                alert(`Failed to pull model: ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to pull model:', error);
            alert('Failed to pull model. Please try again.');
        } finally {
            setIsPulling(false);
        }
    };

    const removeModel = async (modelName: string) => {
        if (!confirm(`Are you sure you want to remove ${modelName}?`)) return;

        try {
            const response = await fetch(`/api/models/${encodeURIComponent(modelName)}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (result.success) {
                fetchModels(); // Refresh the model list
            } else {
                alert(`Failed to remove model: ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to remove model:', error);
            alert('Failed to remove model. Please try again.');
        }
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString();
    };

    const suggestedModels = [
        'llama3.2:latest',
        'llama3.1:latest',
        'mistral:latest',
        'codellama:latest',
        'phi3:latest',
        'gemma2:latest'
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <Package className="h-6 w-6 text-blue-500" />
                        <h2 className="text-xl font-bold text-gray-900">AI Models</h2>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={fetchModels}
                            disabled={isLoading}
                            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>

                        <button
                            onClick={() => setShowPullDialog(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Pull Model</span>
                        </button>
                    </div>
                </div>

                {/* Model Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{models.local.length}</div>
                        <div className="text-sm text-gray-500">Local Models</div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">{models.network.length}</div>
                        <div className="text-sm text-gray-500">Network Models</div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-600">{models.local.length + models.network.length}</div>
                        <div className="text-sm text-gray-500">Total Available</div>
                    </div>
                </div>

                {/* Local Models */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Local Models</h3>

                    {models.local.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No local models installed</p>
                            <p className="text-sm">Pull a model to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {models.local.map((model) => (
                                <div key={model.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <Package className="h-5 w-5 text-blue-500" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">{model.name}</h4>
                                                <div className="flex space-x-4 text-sm text-gray-500">
                                                    <span>Size: {formatSize(model.size || 0)}</span>
                                                    <span>Modified: {formatDate(model.modified_at || '')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeModel(model.name)}
                                        className="flex items-center space-x-1 px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Remove</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Network Models */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Models</h3>

                    {models.network.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No network models available</p>
                            <p className="text-sm">Connect to other nodes to see their models</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {models.network.map((model) => (
                                <div key={model.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <Package className="h-5 w-5 text-green-500" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">{model.name}</h4>
                                                <p className="text-sm text-gray-500">Available on network</p>
                                            </div>
                                        </div>
                                    </div>

                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                        Network
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Pull Model Dialog */}
            {showPullDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pull New Model</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Model Name
                            </label>
                            <input
                                type="text"
                                value={pullModelName}
                                onChange={(e) => setPullModelName(e.target.value)}
                                placeholder="e.g., llama3.2:latest"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Suggested Models
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {suggestedModels.map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setPullModelName(model)}
                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowPullDialog(false);
                                    setPullModelName('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={pullModel}
                                disabled={!pullModelName.trim() || isPulling}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                            >
                                {isPulling ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        <span>Pulling...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4" />
                                        <span>Pull Model</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Models;
