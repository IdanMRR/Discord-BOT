#!/bin/bash

# Production Deployment Script for Discord Bot & Dashboard
set -e

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="your-domain.com"
USER="ubuntu"
APP_DIR="/opt/discord-bot"
BACKUP_DIR="/opt/backups/discord-bot"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found!"
    print_warning "Please create .env.production with your production configuration"
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed or not in PATH"
    exit 1
fi

print_status "Building production images..."

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down || true

# Build new images
print_status "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

print_status "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check if services are running
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    print_success "Services are running successfully!"
else
    print_error "Some services failed to start"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Display running services
print_status "Current service status:"
docker-compose -f docker-compose.prod.yml ps

print_success "Deployment completed successfully!"
print_status "Dashboard: https://$DOMAIN"
print_status "API: https://$DOMAIN/api"

echo ""
print_status "To monitor logs, run:"
echo "docker-compose -f docker-compose.prod.yml logs -f"

print_status "To stop services, run:"
echo "docker-compose -f docker-compose.prod.yml down"