# Askee AI Network Architecture

## 🧠 Core Concept

Askee is a decentralized AI hosting network where users contribute computing resources by running AI models locally (via Ollama) and in return get access to a dynamically orchestrated collective intelligence that's far more powerful than their individual model.

## 🏗️ System Components

### 1. **Node (Docker + Ollama)**

- **Ollama Server**: Runs AI models locally in Docker container
- **Node Agent**: Handles network communication and orchestration
- **Resource Monitor**: Tracks available compute, memory, and model capabilities
- **Credit System**: Earns credits by serving requests, spends credits using network

### 2. **React Frontend (Browser)**

- **Node Dashboard**: Shows local node status, model info, earnings
- **AI Chat Interface**: Uses network-wide orchestrated AI responses
- **Network Explorer**: Browse available models and nodes
- **Settings**: Model selection, resource allocation, privacy controls

### 3. **Network Orchestrator**

- **Request Router**: Dynamically selects best nodes for each request
- **Load Balancer**: Distributes requests across available nodes
- **Model Matcher**: Routes requests to nodes with appropriate models
- **Quality Monitor**: Tracks response quality and node performance

## 🔄 User Flow

### **As a Host:**

1. Install Askee (Docker + Ollama setup)
2. Choose AI models to host (based on hardware capabilities)
3. Node starts serving the network
4. Earn credits for processing requests
5. Monitor earnings and usage via React dashboard

### **As a User:**

1. Open React chat interface in browser
2. Send messages/prompts
3. Orchestrator selects best nodes to handle request
4. Multiple nodes may collaborate for complex requests
5. Get enhanced responses powered by collective intelligence
6. Spend earned credits for premium features/priority

## 🎯 Benefits

### **For Contributors:**

- **Monetize idle compute**: Turn unused GPU/CPU into credits
- **Access better AI**: Use collective network superior to local model
- **Simple setup**: One-click Docker deployment
- **Fair compensation**: Credits based on actual contribution

### **For Users:**

- **Superior AI responses**: Combined intelligence of multiple models
- **Always available**: Network redundancy ensures uptime
- **Cost effective**: Pay only for what you use with credits
- **Privacy options**: Choose local-only or network modes

## 🛠️ Technical Stack

### **Node Stack:**

- **Docker**: Containerization and easy deployment
- **Ollama**: Local AI model serving
- **Node.js**: Network agent and API server
- **TypeScript**: Type-safe backend development

### **Frontend Stack:**

- **React**: Modern web interface
- **TypeScript**: Type-safe frontend development
- **WebSocket**: Real-time chat and node status
- **Tailwind CSS**: Responsive design

### **Network Stack:**

- **HTTP/WebSocket**: Communication protocols
- **JWT**: Authentication and session management
- **Credit System**: Economic incentives
- **Discovery Protocol**: Node finding and health monitoring

## 🚀 Development Phases

### **Phase 1: Core Node**

- Docker + Ollama setup
- Basic node agent with credit system
- Simple API for model serving

### **Phase 2: React Frontend**

- Node dashboard showing status and earnings
- Basic chat interface using local model
- Network discovery and connection

### **Phase 3: Network Orchestration**

- Dynamic request routing
- Multi-node collaboration
- Load balancing and quality monitoring

### **Phase 4: Advanced Features**

- Model fine-tuning rewards
- Privacy-preserving techniques
- Advanced orchestration strategies

This architecture transforms every user into both a contributor and beneficiary of collective AI intelligence!
