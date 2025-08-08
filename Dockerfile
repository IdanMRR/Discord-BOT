# Use Node 18 which is more stable
FROM node:18

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies and build everything
RUN npm install --force && \
    cd client && npm install --force && \
    cd .. && \
    npm run build && \
    cd client && npm run build

# Expose port
EXPOSE 3001

# Start the app
CMD ["node", "dist/index.js"]