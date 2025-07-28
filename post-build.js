const fs = require('fs');
const path = require('path');

console.log('Running post-build tasks...');

// Ensure dist/api/data directory exists
const dataDir = path.join(__dirname, 'dist', 'api', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created dist/api/data directory');
}

// Copy simple-dashboard.js
try {
  fs.copyFileSync(
    path.join(__dirname, 'src', 'api', 'simple-dashboard.js'),
    path.join(__dirname, 'dist', 'api', 'simple-dashboard.js')
  );
  console.log('✅ Copied simple-dashboard.js');
} catch (error) {
  console.error('❌ Failed to copy simple-dashboard.js:', error.message);
}

// Copy database file from correct location (data/discord-bot.db)
try {
  const sourcePath = path.join(__dirname, 'data', 'discord-bot.db');
  const destPath = path.join(__dirname, 'dist', 'api', 'data', 'discord-bot.db');
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log('✅ Copied discord-bot.db from data/ directory');
  } else {
    console.log('⚠️ Source database not found at data/discord-bot.db');
  }
} catch (error) {
  console.error('❌ Failed to copy discord-bot.db:', error.message);
}

console.log('Post-build tasks completed!'); 