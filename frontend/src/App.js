import React, { useState, useEffect } from 'react';
import './App.css';

// Simple icon components since lucide-react isn't available
const ServerIcon = () => <span>🖥️</span>;
const ChatIcon = () => <span>💬</span>;
const NetworkIcon = () => <span>🌐</span>;
const PackageIcon = () => <span>📦</span>;
const SettingsIcon = () => <span>⚙️</span>;

function App() {
    const [currentView, setCurrentView] = useState('chat');
    const [nodeInfo, setNodeInfo] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', content: 'Hello! I\'m your AI assistant running on the Askee network. How can I help you today?', timestamp: new Date() }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 30000);
        return () => clearInterval(interval);
    }, []);

    const checkConnection = async () => {
        try {
            const response = await fetch('/health');
            const healthData = await response.json();
            setIsConnected(healthData.status === 'healthy');

            const nodeResponse = await fetch('/api/node/info');
            const nodeData = await nodeResponse.json();
            setNodeInfo(nodeData);
        } catch (error) {
            console.error('Connection check failed:', error);
            setIsConnected(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();

        if (!inputMessage.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: inputMessage.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    conversationId: 'default'
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            const assistantMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                model: data.model
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);

            const errorMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderChat = () => (
        <div className="chat-container">
            <h2><ChatIcon /> AI Chat</h2>
            <div className="messages">
                {messages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                        <div className="message-content">
                            <div className="content">{message.content}</div>
                            <div className="timestamp">
                                {message.timestamp.toLocaleTimeString()}
                                {message.model && ` • ${message.model}`}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="message assistant">
                        <div className="message-content">
                            <div className="content">Thinking...</div>
                        </div>
                    </div>
                )}
            </div>
            <form onSubmit={sendMessage} className="message-form">
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                />
                <button type="submit" disabled={!inputMessage.trim() || isLoading}>
                    Send
                </button>
            </form>
        </div>
    );

    const renderNodeStatus = () => (
        <div className="node-status">
            <h2><ServerIcon /> Node Status</h2>
            <div className="status-grid">
                <div className="status-card">
                    <h3>Node ID</h3>
                    <p>{nodeInfo?.id || 'Loading...'}</p>
                </div>
                <div className="status-card">
                    <h3>Status</h3>
                    <p className={isConnected ? 'connected' : 'disconnected'}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </p>
                </div>
                <div className="status-card">
                    <h3>Version</h3>
                    <p>1.0.0</p>
                </div>
                <div className="status-card">
                    <h3>Models</h3>
                    <p>{nodeInfo?.capabilities?.length || 0} available</p>
                </div>
            </div>
        </div>
    );

    const renderNetwork = () => (
        <div className="network-view">
            <h2><NetworkIcon /> Network</h2>
            <p>Network discovery and node management will be implemented here.</p>
        </div>
    );

    const renderModels = () => (
        <div className="models-view">
            <h2><PackageIcon /> Models</h2>
            <p>Model management interface will be implemented here.</p>
        </div>
    );

    const renderSettings = () => (
        <div className="settings-view">
            <h2><SettingsIcon /> Settings</h2>
            <p>Configuration options will be implemented here.</p>
        </div>
    );

    const renderCurrentView = () => {
        switch (currentView) {
            case 'chat': return renderChat();
            case 'node': return renderNodeStatus();
            case 'network': return renderNetwork();
            case 'models': return renderModels();
            case 'settings': return renderSettings();
            default: return renderChat();
        }
    };

    return (
        <div className="App">
            <nav className="navbar">
                <div className="nav-brand">
                    <h1>Askee AI Network</h1>
                </div>
                <div className="nav-links">
                    {[
                        { id: 'chat', label: 'Chat', icon: ChatIcon },
                        { id: 'node', label: 'Node', icon: ServerIcon },
                        { id: 'network', label: 'Network', icon: NetworkIcon },
                        { id: 'models', label: 'Models', icon: PackageIcon },
                        { id: 'settings', label: 'Settings', icon: SettingsIcon }
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            className={`nav-link ${currentView === id ? 'active' : ''}`}
                            onClick={() => setCurrentView(id)}
                        >
                            <Icon /> {label}
                        </button>
                    ))}
                </div>
            </nav>

            {!isConnected && (
                <div className="connection-banner">
                    Disconnected from node - Attempting to reconnect...
                </div>
            )}

            <main className="main-content">
                {renderCurrentView()}
            </main>

            <footer className="footer">
                <p>
                    Askee AI Network v1.0.0 | Node: {nodeInfo?.id || 'Loading...'} |
                    Status: <span className={isConnected ? 'connected' : 'disconnected'}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </p>
            </footer>
        </div>
    );
}

export default App;
