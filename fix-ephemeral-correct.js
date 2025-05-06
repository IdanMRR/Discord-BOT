const fs = require('fs');
const path = require('path');

// Root directory for the project
const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');

// Function to recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to fix ephemeral deprecation warnings in a file
function fixEphemeralInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Step 1: Fix any MessageFlags.EPHEMERAL (incorrect) to MessageFlags.Ephemeral (correct)
  if (content.includes('MessageFlags.EPHEMERAL')) {
    content = content.replace(/MessageFlags\.EPHEMERAL/g, 'MessageFlags.Ephemeral');
    modified = true;
    console.log(`[FIX] ${filePath}: Fixed MessageFlags.EPHEMERAL to MessageFlags.Ephemeral`);
  }
  
  // Step 2: Add imports for MessageFlags if needed
  if ((content.includes('flags: MessageFlags.') || content.includes('flags = MessageFlags.')) && 
      !content.includes('import { MessageFlags }') && 
      !content.includes('import * as discord')) {
    
    // Check for discord.js import
    if (content.includes('import {') && content.includes('} from \'discord.js\';')) {
      // Add MessageFlags to existing discord.js import
      content = content.replace(/import\s*{([^}]*)}\s*from\s*['"]discord\.js['"];/, (match, imports) => {
        return `import { ${imports.trim()}, MessageFlags } from 'discord.js';`;
      });
      modified = true;
      console.log(`[FIX] ${filePath}: Added MessageFlags to discord.js import`);
    } else {
      // Add a new import for MessageFlags
      const firstImport = content.indexOf('import');
      if (firstImport !== -1) {
        const importEnd = content.indexOf(';', firstImport) + 1;
        const newImport = '\nimport { MessageFlags } from \'discord.js\';';
        content = content.substring(0, importEnd) + newImport + content.substring(importEnd);
        modified = true;
        console.log(`[FIX] ${filePath}: Added new import for MessageFlags from discord.js`);
      }
    }
  }
  
  // Step 3: Fix any remaining ephemeral: true instances
  // Pattern: interaction.reply({ ..., ephemeral: true })
  const replyPattern = /(\w+)\.reply\(\s*{([^}]*)ephemeral:\s*true([^}]*)}\s*\)/g;
  content = content.replace(replyPattern, (match, interaction, before, after) => {
    modified = true;
    return `${interaction}.reply({ ${before}flags: MessageFlags.Ephemeral${after} })`;
  });
  
  // Pattern: interaction.deferReply({ ephemeral: true })
  const deferPattern = /(\w+)\.deferReply\(\s*{\s*ephemeral:\s*true\s*}\s*\)/g;
  content = content.replace(deferPattern, (match, interaction) => {
    modified = true;
    return `${interaction}.deferReply({ flags: MessageFlags.Ephemeral })`;
  });
  
  // Pattern: ephemeral: true in object literals that aren't inside utility functions
  content = content.replace(/(\s*ephemeral:\s*true\s*,|\s*,\s*ephemeral:\s*true|\s*ephemeral:\s*true\s*(?=\}))/g, (match, capture) => {
    if (content.substring(content.indexOf(match) - 50, content.indexOf(match)).includes('convertEphemeralToFlags') ||
        content.substring(content.indexOf(match) - 50, content.indexOf(match)).includes('Helper function')) {
      return match; // Don't replace within helper functions
    }
    modified = true;
    return match.replace(/ephemeral:\s*true/, 'flags: MessageFlags.Ephemeral');
  });
  
  // Save changes if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SUCCESS] ${filePath}: Fixed ephemeral deprecation warnings`);
    return true;
  }
  
  return false;
}

// Main function
function main() {
  console.log('Starting to fix ephemeral deprecation warnings with CORRECT flags...');
  
  // Find all TypeScript files
  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  // Fix ephemeral deprecation warnings in all files
  let fixedCount = 0;
  
  tsFiles.forEach(filePath => {
    if (fixEphemeralInFile(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\nSummary: Fixed ephemeral deprecation warnings in ${fixedCount} files`);
}

main();
