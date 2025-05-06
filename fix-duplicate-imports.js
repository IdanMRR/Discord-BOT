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

// Function to fix duplicate MessageFlags imports in a file
function fixDuplicateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix duplicate MessageFlags import from discord.js
  const duplicateDiscordJsRegex = /import\s*{([^}]*MessageFlags[^}]*MessageFlags[^}]*)}\s*from\s*['"]discord\.js['"];/;
  if (duplicateDiscordJsRegex.test(content)) {
    const match = content.match(duplicateDiscordJsRegex);
    if (match) {
      const imports = match[1].split(',').map(part => part.trim());
      // Remove duplicate imports
      const uniqueImports = Array.from(new Set(imports)).filter(imp => imp !== '');
      // Create new import statement
      const newImport = `import { ${uniqueImports.join(', ')} } from 'discord.js';`;
      content = content.replace(match[0], newImport);
      modified = true;
      console.log(`[FIX] ${filePath}: Fixed duplicate MessageFlags in discord.js import`);
    }
  }
  
  // If we still need MessageFlags, now remove any duplicate import from interaction-utils
  const duplicateUtilsRegex = /import\s*{([^}]*MessageFlags[^}]*)}\s*from\s*['"]\.\.\/\.\.\/utils\/interaction-utils['"];/;
  if (duplicateUtilsRegex.test(content)) {
    const match = content.match(duplicateUtilsRegex);
    if (match) {
      // If there's already a MessageFlags from discord.js, remove it from interaction-utils
      if (content.includes('import {') && content.includes('MessageFlags') && content.includes('} from \'discord.js\';')) {
        const imports = match[1].split(',').map(part => part.trim());
        // Remove MessageFlags from imports
        const filteredImports = imports.filter(imp => !imp.includes('MessageFlags'));
        
        if (filteredImports.length > 0) {
          // Create new import statement without MessageFlags
          const newImport = `import { ${filteredImports.join(', ')} } from '../../utils/interaction-utils';`;
          content = content.replace(match[0], newImport);
        } else {
          // If there are no imports left, remove the whole import statement
          content = content.replace(match[0], '');
        }
        
        modified = true;
        console.log(`[FIX] ${filePath}: Removed MessageFlags from interaction-utils import (already in discord.js)`);
      }
    }
  }
  
  // Save changes if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SUCCESS] ${filePath}: Fixed duplicate imports`);
    return true;
  }
  
  return false;
}

// Main function
function main() {
  console.log('Starting to fix duplicate MessageFlags imports...');
  
  // Find all TypeScript files
  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  // Fix duplicate imports in all files
  let fixedCount = 0;
  
  tsFiles.forEach(filePath => {
    if (fixDuplicateImports(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\nSummary: Fixed duplicate imports in ${fixedCount} files`);
}

main();
