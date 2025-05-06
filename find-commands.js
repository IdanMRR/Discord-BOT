const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, 'src', 'commands');

// Function to scan directories recursively
function findCommands(directory) {
  const results = [];
  const items = fs.readdirSync(directory);
  
  for (const item of items) {
    const fullPath = path.join(directory, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively scan subdirectories
      results.push(...findCommands(fullPath));
    } else if (stat.isFile() && item.endsWith('.ts')) {
      // Read ts files and check their content
      const content = fs.readFileSync(fullPath, 'utf8');
      const commandName = content.match(/\.setName\(['"]([^'"]+)['"]\)/);
      
      if (commandName) {
        results.push({
          name: commandName[1],
          path: fullPath
        });
      }
    }
  }
  
  return results;
}

// Find all commands
const commands = findCommands(commandsDir);

// Filter for the commands we're looking for
const targetCommands = commands.filter(cmd => 
  cmd.name === 'ping' || cmd.name === 'test' || cmd.name === 'ticket'
);

console.log('Found commands to remove:');
for (const cmd of targetCommands) {
  console.log(`Command: ${cmd.name}, File: ${cmd.path}`);
}
