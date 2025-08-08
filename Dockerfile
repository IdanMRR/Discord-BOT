# Use Node.js 20 Alpine for smaller image
FROM node:20-alpine AS builder

# Install Python and build tools for native dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json ./

# Install backend dependencies (using install instead of ci)
RUN npm install

# Copy client package files
COPY client/package.json ./client/
COPY client/package-lock.json ./client/

# Install client dependencies
RUN cd client && npm install

# Copy all source code
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