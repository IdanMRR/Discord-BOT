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
  
  // Check if the file imports from 'interaction-utils.ts'
  const hasInteractionUtilsImport = content.includes("from '../../utils/interaction-utils'");
  const hasMessageFlagsImport = content.includes('MessageFlags');
  
  // Add import if needed but missing
  if (content.includes('ephemeral: true') && !hasInteractionUtilsImport) {
    console.log(`[WARNING] ${filePath}: Uses ephemeral: true but does not import from interaction-utils`);
    // We'll only log a warning, as blindly adding imports could cause issues
  }
  
  // Add MessageFlags import if not already present but needed
  if (content.includes('ephemeral: true') && hasInteractionUtilsImport && !hasMessageFlagsImport) {
    const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\.\/\.\.\/utils\/interaction-utils['"];/;
    const importMatch = content.match(importRegex);
    
    if (importMatch) {
      const newImport = `import { ${importMatch[1]}, MessageFlags } from '../../utils/interaction-utils';`;
      content = content.replace(importRegex, newImport);
      modified = true;
      console.log(`[INFO] ${filePath}: Added MessageFlags import`);
    }
  }
  
  // Fix common patterns for ephemeral messages
  
  // Pattern 1: interaction.reply({ ..., ephemeral: true })
  const replyPattern = /(\w+)\.reply\(\s*{([^}]*)ephemeral:\s*true([^}]*)}\s*\)/g;
  content = content.replace(replyPattern, (match, interaction, before, after) => {
    modified = true;
    return `${interaction}.reply({ ${before}flags: MessageFlags.EPHEMERAL${after} })`;
  });
  
  // Pattern 2: interaction.deferReply({ ephemeral: true })
  const deferPattern = /(\w+)\.deferReply\(\s*{\s*ephemeral:\s*true\s*}\s*\)/g;
  content = content.replace(deferPattern, (match, interaction) => {
    modified = true;
    return `${interaction}.deferReply({ flags: MessageFlags.EPHEMERAL })`;
  });
  
  // Pattern 3: ephemeral: true in an object
  const objPattern = /{\s*([^}]*)ephemeral:\s*true([^}]*)\s*}/g;
  content = content.replace(objPattern, (match, before, after) => {
    // Don't replace if it's already inside a convertEphemeralToFlags call
    if (match.includes("convertEphemeralToFlags") || 
        match.includes("// Helper function") || 
        match.includes("* Helper function")) {
      return match;
    }
    modified = true;
    return `{ ${before}flags: MessageFlags.EPHEMERAL${after} }`;
  });
  
  // Save changes
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SUCCESS] ${filePath}: Fixed ephemeral deprecation warnings`);
    return true;
  }
  
  return false;
}

// Main function
function main() {
  console.log('Starting to fix ephemeral deprecation warnings...');
  
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
