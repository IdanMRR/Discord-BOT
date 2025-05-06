#!/bin/bash

# Display a header
echo "====================================="
echo "Discord Bot Runner"
echo "====================================="

# Function to handle errors
handle_error() {
  echo "Error: $1"
  echo "Exiting..."
  exit 1
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  handle_error "npm is not installed. Please install Node.js and npm first."
fi

# Build the project
echo "Building the project..."
npm run build
if [ $? -ne 0 ]; then
  handle_error "Build failed. Please fix the errors and try again."
fi

echo "Build successful!"
echo "====================================="

# Start the bot
echo "Starting the Discord bot..."
npm start

# Exit with the same code as npm start
exit $?
