import axios from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

export interface OllamaModel {
    name: string;
    size: number;
    digest: string;
    modified_at: string;
    details?: {
        format: string;
        family: string;
        families: string[];
        parameter_size: string;
        quantization_level: string;
    };
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface GenerateRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    options?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
        num_predict?: number;
    };
}

export interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    options?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
    };
}

export class OllamaService {
    private baseUrl: string;
    private timeout: number;
    private isAvailable: boolean = false;

    constructor() {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '30000');
    }

    async initialize(): Promise<void> {
        try {
            await this.checkHealth();
            this.isAvailable = true;
            logger.info('Ollama service initialized successfully');
        } catch (error) {
            logger.warn('Ollama service not available:', error);
            this.isAvailable = false;
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/version`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async getAvailableModels(): Promise<OllamaModel[]> {
        if (!this.isAvailable) {
            return [];
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: this.timeout
            });

            return response.data.models || [];
        } catch (error) {
            logger.error('Failed to get available models:', error);
            return [];
        }
    }

    async generateResponse(prompt: string, model?: string): Promise<string> {
        if (!this.isAvailable) {
            throw new Error('Ollama service not available');
        }

        const selectedModel = model || await this.getDefaultModel();
        if (!selectedModel) {
            throw new Error('No models available');
        }

        try {
            const request: GenerateRequest = {
                model: selectedModel,
                prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 2048
                }
            };

            const response = await axios.post(`${this.baseUrl}/api/generate`, request, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.response || 'No response generated';
        } catch (error) {
            logger.error('Failed to generate response:', error);
            throw new Error(`Failed to generate response: ${error}`);
        }
    }

    async chatCompletion(messages: ChatMessage[], model?: string): Promise<string> {
        if (!this.isAvailable) {
            throw new Error('Ollama service not available');
        }

        const selectedModel = model || await this.getDefaultModel();
        if (!selectedModel) {
            throw new Error('No models available');
        }

        try {
            const request: ChatRequest = {
                model: selectedModel,
                messages,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            };

            const response = await axios.post(`${this.baseUrl}/api/chat`, request, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.message?.content || 'No response generated';
        } catch (error) {
            logger.error('Failed to complete chat:', error);
            throw new Error(`Failed to complete chat: ${error}`);
        }
    }

    async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
        if (!this.isAvailable) {
            throw new Error('Ollama service not available');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/api/pull`, {
                name: modelName
            }, {
                timeout: 300000, // 5 minutes for model download
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                message: `Model ${modelName} pulled successfully`
            };
        } catch (error) {
            logger.error('Failed to pull model:', error);
            return {
                success: false,
                message: `Failed to pull model ${modelName}: ${error}`
            };
        }
    }

    async removeModel(modelName: string): Promise<{ success: boolean; message: string }> {
        if (!this.isAvailable) {
            throw new Error('Ollama service not available');
        }

        try {
            await axios.delete(`${this.baseUrl}/api/delete`, {
                data: { name: modelName },
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                message: `Model ${modelName} removed successfully`
            };
        } catch (error) {
            logger.error('Failed to remove model:', error);
            return {
                success: false,
                message: `Failed to remove model ${modelName}: ${error}`
            };
        }
    }

    async getModelInfo(modelName: string): Promise<any> {
        if (!this.isAvailable) {
            return null;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/api/show`, {
                name: modelName
            }, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to get model info:', error);
            return null;
        }
    }

    private async getDefaultModel(): Promise<string | null> {
        const models = await this.getAvailableModels();
        if (models.length === 0) {
            return null;
        }

        // Prefer llama models, then any available model
        const preferredOrder = ['llama3.2', 'llama3.1', 'llama3', 'llama2', 'mistral', 'codellama'];

        for (const preferred of preferredOrder) {
            const found = models.find(m => m.name.toLowerCase().includes(preferred));
            if (found) {
                return found.name;
            }
        }

        // Return first available model
        return models[0].name;
    }

    async suggestModels(): Promise<string[]> {
        return [
            'llama3.2:latest',
            'llama3.1:latest',
            'mistral:latest',
            'codellama:latest',
            'phi3:latest',
            'gemma2:latest'
        ];
    }

    public isServiceAvailable(): boolean {
        return this.isAvailable;
    }

    async getSystemInfo(): Promise<any> {
        if (!this.isAvailable) {
            return null;
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/version`, {
                timeout: this.timeout
            });

            return {
                version: response.data.version,
                status: 'running',
                models_count: (await this.getAvailableModels()).length
            };
        } catch (error) {
            logger.error('Failed to get system info:', error);
            return null;
        }
    }
}
