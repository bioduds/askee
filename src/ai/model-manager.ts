import type {
    AIModelSpec,
    NodeSystemSpec,
    DeployedModel,
    ModelDeploymentRequest,
    ModelDeploymentResponse,
    SeedNode
} from '../network/seed-types.js';
import type { CryptoManager } from '../crypto/crypto-manager.js';
import type { CreditManager } from '../core/credit-manager.js';

/**
 * AI Model Manager - Handles model deployment, capability matching, and inference routing
 */
export class AIModelManager {
    private crypto: CryptoManager;
    private credits: CreditManager;
    private modelCatalog: Map<string, AIModelSpec> = new Map();
    private deployedModels: Map<string, DeployedModel> = new Map();
    private nodeCapabilities: Map<string, NodeSystemSpec> = new Map();
    private deploymentQueue: ModelDeploymentRequest[] = [];

    constructor(crypto: CryptoManager, credits: CreditManager) {
        this.crypto = crypto;
        this.credits = credits;
        this.initializeModelCatalog();
    }

    /**
     * Initialize the model catalog with popular AI models
     */
    private initializeModelCatalog(): void {
        const models: AIModelSpec[] = [
            {
                modelId: 'llama-3.1-8b',
                name: 'Llama 3.1 8B',
                provider: 'meta',
                type: 'text',
                size: 16,
                requirements: {
                    minRAM: 20,
                    minGPU: 8,
                    minCPU: 4,
                    accelerator: 'cuda'
                },
                capabilities: ['text-generation', 'code', 'reasoning', 'math'],
                contextWindow: 128000,
                tokensPerSecond: 50
            },
            {
                modelId: 'phi-3-mini',
                name: 'Phi-3 Mini',
                provider: 'microsoft',
                type: 'text',
                size: 4,
                requirements: {
                    minRAM: 8,
                    minCPU: 2,
                    accelerator: 'cpu'
                },
                capabilities: ['text-generation', 'code', 'reasoning'],
                contextWindow: 32000,
                tokensPerSecond: 30
            },
            {
                modelId: 'gemma-2b',
                name: 'Gemma 2B',
                provider: 'google',
                type: 'text',
                size: 3,
                requirements: {
                    minRAM: 6,
                    minCPU: 2,
                    accelerator: 'cpu'
                },
                capabilities: ['text-generation', 'reasoning'],
                contextWindow: 8192,
                tokensPerSecond: 25
            },
            {
                modelId: 'stable-diffusion-xl',
                name: 'Stable Diffusion XL',
                provider: 'stability',
                type: 'image',
                size: 12,
                requirements: {
                    minRAM: 16,
                    minGPU: 6,
                    minCPU: 4,
                    accelerator: 'cuda'
                },
                capabilities: ['image-generation', 'text-to-image'],
                contextWindow: 77,
                tokensPerSecond: 1 // Images per second
            },
            {
                modelId: 'whisper-large-v3',
                name: 'Whisper Large V3',
                provider: 'openai',
                type: 'audio',
                size: 6,
                requirements: {
                    minRAM: 8,
                    minGPU: 4,
                    minCPU: 4,
                    accelerator: 'cuda'
                },
                capabilities: ['speech-to-text', 'audio-transcription'],
                contextWindow: 30000, // 30 seconds of audio
                tokensPerSecond: 100
            }
        ];

        models.forEach(model => {
            this.modelCatalog.set(model.modelId, model);
        });

        console.log(`📚 Initialized model catalog with ${models.length} AI models`);
    }

    /**
     * Check if a node can host a specific AI model
     */
    canNodeHostModel(nodeSpec: NodeSystemSpec, modelId: string): {
        canHost: boolean;
        reasons: string[];
        confidence: number; // 0-100
    } {
        const model = this.modelCatalog.get(modelId);
        if (!model) {
            return {
                canHost: false,
                reasons: ['Model not found in catalog'],
                confidence: 0
            };
        }

        const reasons: string[] = [];
        let confidence = 100;

        // Check RAM requirements
        if (nodeSpec.memory.available < model.requirements.minRAM) {
            reasons.push(`Insufficient RAM: needs ${model.requirements.minRAM}GB, has ${nodeSpec.memory.available}GB`);
            confidence -= 30;
        }

        // Check GPU requirements
        if (model.requirements.minGPU) {
            if (!nodeSpec.gpu) {
                reasons.push(`GPU required: needs ${model.requirements.minGPU}GB GPU memory`);
                confidence -= 40;
            } else if (nodeSpec.gpu.memory < model.requirements.minGPU) {
                reasons.push(`Insufficient GPU memory: needs ${model.requirements.minGPU}GB, has ${nodeSpec.gpu.memory}GB`);
                confidence -= 30;
            }
        }

        // Check CPU requirements
        if (nodeSpec.cpu.cores < model.requirements.minCPU) {
            reasons.push(`Insufficient CPU cores: needs ${model.requirements.minCPU}, has ${nodeSpec.cpu.cores}`);
            confidence -= 20;
        }

        // Check storage requirements
        if (nodeSpec.storage.available < model.size) {
            reasons.push(`Insufficient storage: needs ${model.size}GB, has ${nodeSpec.storage.available}GB`);
            confidence -= 25;
        }

        // Check accelerator compatibility
        if (model.requirements.accelerator && nodeSpec.gpu) {
            if (nodeSpec.gpu.accelerator !== model.requirements.accelerator) {
                reasons.push(`Accelerator mismatch: model prefers ${model.requirements.accelerator}, node has ${nodeSpec.gpu.accelerator}`);
                confidence -= 15;
            }
        }

        const canHost = confidence > 50 && reasons.length === 0;

        return {
            canHost,
            reasons,
            confidence: Math.max(0, confidence)
        };
    }

    /**
     * Find the best model for a node's capabilities
     */
    findBestModelForNode(
        nodeSpec: NodeSystemSpec,
        preferredType?: 'text' | 'image' | 'audio' | 'multimodal'
    ): {
        modelId: string;
        confidence: number;
        reasoning: string;
    } | null {
        let bestModel: { modelId: string; confidence: number; reasoning: string } | null = null;

        for (const [modelId, model] of this.modelCatalog) {
            // Skip if type preference doesn't match
            if (preferredType && model.type !== preferredType) {
                continue;
            }

            const compatibility = this.canNodeHostModel(nodeSpec, modelId);

            if (compatibility.canHost && compatibility.confidence > (bestModel?.confidence || 0)) {
                bestModel = {
                    modelId,
                    confidence: compatibility.confidence,
                    reasoning: `Best fit for hardware specs: ${compatibility.confidence}% compatibility`
                };
            }
        }

        return bestModel;
    }

    /**
     * Deploy a model to a specific node
     */
    async deployModelToNode(request: ModelDeploymentRequest): Promise<ModelDeploymentResponse> {
        const model = this.modelCatalog.get(request.modelId);
        if (!model) {
            return {
                success: false,
                creditCost: 0,
                error: 'Model not found in catalog'
            };
        }

        const nodeSpec = this.nodeCapabilities.get(request.nodeId);
        if (!nodeSpec) {
            return {
                success: false,
                creditCost: 0,
                error: 'Node specifications not available'
            };
        }

        const compatibility = this.canNodeHostModel(nodeSpec, request.modelId);
        if (!compatibility.canHost) {
            return {
                success: false,
                creditCost: 0,
                error: `Cannot deploy model: ${compatibility.reasons.join(', ')}`
            };
        }

        // Calculate deployment cost based on model size and priority
        const baseCost = model.size * 10; // 10 credits per GB
        const priorityMultiplier = request.priority === 'high' ? 2 : request.priority === 'medium' ? 1.5 : 1;
        const creditCost = Math.ceil(baseCost * priorityMultiplier);

        // Check if requester can afford deployment
        if (request.creditBudget && creditCost > request.creditBudget) {
            return {
                success: false,
                creditCost,
                error: `Deployment cost (${creditCost} credits) exceeds budget (${request.creditBudget} credits)`
            };
        }

        // Simulate deployment process
        const deploymentTime = this.estimateDeploymentTime(model, nodeSpec);

        // In a real implementation, this would trigger actual model download and loading
        console.log(`🚀 Deploying ${model.name} to node ${request.nodeId}`);
        console.log(`   Estimated deployment time: ${deploymentTime} seconds`);
        console.log(`   Credit cost: ${creditCost} credits`);

        // Create deployed model record
        const deployedModel: DeployedModel = {
            modelId: request.modelId,
            status: 'downloading',
            deployedAt: new Date(),
            lastUsed: new Date(),
            usageCount: 0,
            healthScore: 100,
            endpoint: `https://node-${request.nodeId}.askee.network/models/${request.modelId}`
        };

        this.deployedModels.set(`${request.nodeId}:${request.modelId}`, deployedModel);

        // Simulate deployment completion after a delay
        setTimeout(() => {
            deployedModel.status = 'ready';
            console.log(`✅ Model ${model.name} deployed successfully on node ${request.nodeId}`);
        }, 1000);

        return {
            success: true,
            modelEndpoint: deployedModel.endpoint,
            estimatedDeploymentTime: deploymentTime,
            creditCost
        };
    }

    /**
     * Estimate deployment time based on model size and node capabilities
     */
    private estimateDeploymentTime(model: AIModelSpec, nodeSpec: NodeSystemSpec): number {
        // Base time: 1 minute per GB over 100 Mbps network
        const downloadTime = (model.size * 1024) / (nodeSpec.network.bandwidth / 8); // Convert to MB/s

        // Loading time depends on storage type and CPU
        const loadingTime = nodeSpec.storage.type === 'nvme' ? 30 :
            nodeSpec.storage.type === 'ssd' ? 60 : 120;

        return Math.ceil(downloadTime + loadingTime);
    }

    /**
     * Get available models for a node type
     */
    getAvailableModelsForNode(nodeSpec: NodeSystemSpec): string[] {
        const availableModels: string[] = [];

        for (const [modelId] of this.modelCatalog) {
            const compatibility = this.canNodeHostModel(nodeSpec, modelId);
            if (compatibility.canHost) {
                availableModels.push(modelId);
            }
        }

        return availableModels;
    }

    /**
     * Register a node's system specifications
     */
    registerNodeCapabilities(nodeId: string, spec: NodeSystemSpec): void {
        this.nodeCapabilities.set(nodeId, spec);

        const availableModels = this.getAvailableModelsForNode(spec);
        console.log(`📋 Node ${nodeId} can host ${availableModels.length} models: ${availableModels.join(', ')}`);
    }

    /**
     * Get model catalog
     */
    getModelCatalog(): AIModelSpec[] {
        return Array.from(this.modelCatalog.values());
    }

    /**
     * Get deployed models status
     */
    getDeployedModels(): DeployedModel[] {
        return Array.from(this.deployedModels.values());
    }

    /**
     * Find nodes that can host a specific model
     */
    findNodesForModel(modelId: string): Array<{
        nodeId: string;
        confidence: number;
        estimatedDeploymentTime: number;
    }> {
        const model = this.modelCatalog.get(modelId);
        if (!model) {
            return [];
        }

        const compatibleNodes: Array<{
            nodeId: string;
            confidence: number;
            estimatedDeploymentTime: number;
        }> = [];

        for (const [nodeId, nodeSpec] of this.nodeCapabilities) {
            const compatibility = this.canNodeHostModel(nodeSpec, modelId);
            if (compatibility.canHost) {
                compatibleNodes.push({
                    nodeId,
                    confidence: compatibility.confidence,
                    estimatedDeploymentTime: this.estimateDeploymentTime(model, nodeSpec)
                });
            }
        }

        // Sort by confidence (highest first) then by deployment time (lowest first)
        return compatibleNodes.sort((a, b) => {
            if (a.confidence !== b.confidence) {
                return b.confidence - a.confidence;
            }
            return a.estimatedDeploymentTime - b.estimatedDeploymentTime;
        });
    }

    /**
     * Auto-deploy optimal models to nodes based on their capabilities
     */
    async autoDeployModels(seedNodes: SeedNode[]): Promise<void> {
        console.log('\n🤖 Auto-deploying optimal AI models to nodes...\n');

        for (const node of seedNodes) {
            console.log(`\n--- Node ${node.id} (${node.region}) ---`);

            // Register node capabilities
            this.registerNodeCapabilities(node.id, node.systemSpec);

            // Find best models for different types
            const textModel = this.findBestModelForNode(node.systemSpec, 'text');
            const imageModel = this.findBestModelForNode(node.systemSpec, 'image');
            const audioModel = this.findBestModelForNode(node.systemSpec, 'audio');

            const deployments: Promise<ModelDeploymentResponse>[] = [];

            // Deploy text model (highest priority)
            if (textModel && textModel.confidence > 70) {
                console.log(`  📝 Deploying text model: ${textModel.modelId} (${textModel.confidence}% confidence)`);
                deployments.push(this.deployModelToNode({
                    nodeId: node.id,
                    modelId: textModel.modelId,
                    priority: 'high',
                    requesterPublicKey: this.crypto.getPublicKeyHex()
                }));
            }

            // Deploy image model if node has good GPU
            if (imageModel && imageModel.confidence > 60 && node.systemSpec.gpu) {
                console.log(`  🎨 Deploying image model: ${imageModel.modelId} (${imageModel.confidence}% confidence)`);
                deployments.push(this.deployModelToNode({
                    nodeId: node.id,
                    modelId: imageModel.modelId,
                    priority: 'medium',
                    requesterPublicKey: this.crypto.getPublicKeyHex()
                }));
            }

            // Deploy audio model if space permits
            if (audioModel && audioModel.confidence > 50 && deployments.length < node.aiCapabilities.maxConcurrentModels) {
                console.log(`  🎵 Deploying audio model: ${audioModel.modelId} (${audioModel.confidence}% confidence)`);
                deployments.push(this.deployModelToNode({
                    nodeId: node.id,
                    modelId: audioModel.modelId,
                    priority: 'low',
                    requesterPublicKey: this.crypto.getPublicKeyHex()
                }));
            }

            // Wait for all deployments to complete
            if (deployments.length > 0) {
                const results = await Promise.all(deployments);
                const successful = results.filter(r => r.success).length;
                console.log(`  ✅ Successfully deployed ${successful}/${deployments.length} models`);

                // Update node's deployed models
                const modelIds = [textModel?.modelId, imageModel?.modelId, audioModel?.modelId].filter(Boolean);
                results.forEach((result, index) => {
                    if (result.success && result.modelEndpoint && modelIds[index]) {
                        node.aiCapabilities.deployedModels.push({
                            modelId: modelIds[index]!,
                            status: 'ready',
                            deployedAt: new Date(),
                            lastUsed: new Date(),
                            usageCount: 0,
                            healthScore: 100,
                            endpoint: result.modelEndpoint
                        });
                    }
                });
            } else {
                console.log(`  ⚠️  No compatible models found for this node`);
            }
        }

        console.log('\n🎉 Auto-deployment completed!');
    }
}
