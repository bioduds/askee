# Use Node.js 20 LTS as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for cryptography
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY packages/ ./packages/

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S askee && \
    adduser -S askee -u 1001 -G askee

# Create directories for data persistence
RUN mkdir -p /app/data /app/logs && \
    chown -R askee:askee /app

# Switch to non-root user
USER askee

# Expose ports
# 8080: Main API server
# 8081: P2P network communication
# 8082: Discovery service
EXPOSE 8080 8081 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV ASKEE_DATA_DIR=/app/data
ENV ASKEE_LOG_DIR=/app/logs

# Start the application
CMD ["node", "dist/server.js"]
