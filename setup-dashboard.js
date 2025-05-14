const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ensureDashboardSetup } = require('./direct-db-access');

console.log('Setting up simplified Discord bot dashboard...');

// Create dashboard directory if it doesn't exist
const dashboardDir = path.join(__dirname, 'simple-dashboard');
if (!fs.existsSync(dashboardDir)) {
  fs.mkdirSync(dashboardDir, { recursive: true });
  console.log('Created dashboard directory');
}

// Create React app
try {
  console.log('Creating React app (this may take a few minutes)...');
  execSync('npx create-react-app simple-dashboard --template typescript', { 
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('Failed to create React app:', error);
  process.exit(1);
}

// Install necessary dependencies
try {
  console.log('Installing dependencies...');
  execSync('cd simple-dashboard && npm install react-router-dom styled-components', {
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Failed to install dependencies:', error);
  process.exit(1);
}

// Create .env file for the dashboard with the database path
const envContent = `
REACT_APP_DB_PATH=${path.join(__dirname, 'data', 'discord-bot.db')}
`;

fs.writeFileSync(path.join(dashboardDir, '.env'), envContent);
console.log('Created .env file with database configuration');

// Setup direct database access
ensureDashboardSetup();

console.log('Setup complete! Run npm run dashboard to start the dashboard.'); 