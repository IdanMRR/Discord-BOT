# Use Node.js 20 Alpine for smaller image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies for both backend and client
RUN npm ci --only=production && \
    npm ci --only=dev && \
    cd client && npm ci

# Copy source code
COPY . .

# Build backend and client
RUN npm run build && \
    cd client && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/build ./client/build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]