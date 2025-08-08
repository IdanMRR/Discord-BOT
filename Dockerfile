# Multi-stage build for optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production && \
    cd client && npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build:prod && \
    cd client && npm run build

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S discord-bot -u 1001

# Copy built application
COPY --from=builder --chown=discord-bot:nodejs /app/dist ./dist
COPY --from=builder --chown=discord-bot:nodejs /app/client/build ./client/build
COPY --from=builder --chown=discord-bot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=discord-bot:nodejs /app/package*.json ./

# Create data and logs directories
RUN mkdir -p /app/data /app/logs && \
    chown -R discord-bot:nodejs /app

# Switch to non-root user
USER discord-bot

# Expose ports
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Start the application
CMD ["npm", "run", "start:prod"]