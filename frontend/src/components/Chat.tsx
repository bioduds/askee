import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader } from 'lucide-react';

interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    model?: string;
}

interface ChatProps {
    nodeInfo: any;
}

const Chat: React.FC<ChatProps> = ({ nodeInfo }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>('auto');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadAvailableModels();
        // Add welcome message
        setMessages([{
            id: '1',
            content: 'Hello! I\'m your AI assistant running on the Askee network. How can I help you today?',
            role: 'assistant',
            timestamp: new Date()
        }]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadAvailableModels = async () => {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();

            const allModels = [...(data.local || []), ...(data.network || [])];
            setAvailableModels(['auto', ...allModels]);
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputMessage.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputMessage.trim(),
            role: 'user',
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
                    model: selectedModel === 'auto' ? undefined : selectedModel,
                    conversationId: 'default' // TODO: Implement proper conversation management
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: data.response,
                role: 'assistant',
                timestamp: new Date(),
                model: data.model
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                role: 'assistant',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([{
            id: '1',
            content: 'Hello! I\'m your AI assistant running on the Askee network. How can I help you today?',
            role: 'assistant',
            timestamp: new Date()
        }]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-lg shadow-lg">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <Bot className="h-6 w-6 text-blue-500" />
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">AI Chat</h2>
                        <p className="text-sm text-gray-500">
                            Connected to {availableModels.length - 1} model(s)
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {availableModels.map(model => (
                            <option key={model} value={model}>
                                {model === 'auto' ? 'Auto Select' : model}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={clearChat}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`flex max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-900'
                                }`}
                        >
                            <div className="flex items-start space-x-2">
                                {message.role === 'assistant' && (
                                    <Bot className="h-5 w-5 mt-0.5 text-gray-500 flex-shrink-0" />
                                )}
                                {message.role === 'user' && (
                                    <User className="h-5 w-5 mt-0.5 text-white flex-shrink-0" />
                                )}

                                <div className="flex-1">
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                    <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                                        }`}>
                                        {message.timestamp.toLocaleTimeString()}
                                        {message.model && ` • ${message.model}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg">
                            <Loader className="h-4 w-4 animate-spin text-gray-500" />
                            <span className="text-gray-500">Thinking...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!inputMessage.trim() || isLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>
                        Press Enter to send
                    </span>
                    <span>
                        Model: {selectedModel === 'auto' ? 'Auto Select' : selectedModel}
                    </span>
                </div>
            </form>
        </div>
    );
};

export default Chat;
