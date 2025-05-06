const fs = require('fs');
const path = require('path');

// Files that need MessageFlags import fixed
const filesToFix = [
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/admin/faq-manager.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/admin/member-events-setup.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/admin/roles-setup.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/admin/rules-manager.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/admin/server-cleanup.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/admin/server-setup.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/utility/help.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/commands/utility/language.ts',
  '/Users/idanmr/Documents/VSC Projects/Discord BOT/src/handlers/utility/help-handler.ts'
];

// Function to add MessageFlags import to a file
function addMessageFlagsImport(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if the file already has MessageFlags import
  if (content.includes('MessageFlags') && !content.includes('import {') && !content.includes('MessageFlags') && !content.includes('} from \'discord.js\';')) {
    // First try to add to existing discord.js import
    const discordImportRegex = /import\s*{([^}]*)}\s*from\s*['"]discord\.js['"];/;
    if (discordImportRegex.test(content)) {
      const match = content.match(discordImportRegex);
      if (match) {
        const imports = match[1].split(',').map(part => part.trim());
        if (!imports.includes('MessageFlags')) {
          imports.push('MessageFlags');
          const newImport = `import { ${imports.join(', ')} } from 'discord.js';`;
          content = content.replace(match[0], newImport);
          modified = true;
          console.log(`[FIX] ${filePath}: Added MessageFlags to existing discord.js import`);
        }
      }
    } else {
      // Add new import for MessageFlags at the top of the file
      content = `import { MessageFlags } from 'discord.js';\n${content}`;
      modified = true;
      console.log(`[FIX] ${filePath}: Added new MessageFlags import from discord.js`);
    }
  }
  
  // Save changes if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SUCCESS] ${filePath}: Fixed MessageFlags import`);
    return true;
  } else {
    console.log(`[INFO] ${filePath}: No changes needed or could not determine fix automatically`);
    
    // Special handling for files we know need fixing
    if (filePath.includes('member-events-setup.ts')) {
      // For member-events-setup.ts, let's manually add the import
      if (!content.includes('import { MessageFlags }')) {
        // Add MessageFlags to the existing discord.js import
        content = content.replace(
          /import {\s*SlashCommandBuilder,\s*CommandInteraction,\s*ChannelType,\s*TextChannel\s*} from 'discord.js';/,
          `import { SlashCommandBuilder, CommandInteraction, ChannelType, TextChannel, MessageFlags } from 'discord.js';`
        );
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[MANUAL FIX] ${filePath}: Added MessageFlags to discord.js import`);
        return true;
      }
    }
    
    return false;
  }
}

// Main function
function main() {
  console.log('Starting to fix missing MessageFlags imports...');
  
  // Fix MessageFlags imports in specified files
  let fixedCount = 0;
  
  filesToFix.forEach(filePath => {
    if (addMessageFlagsImport(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\nSummary: Fixed MessageFlags imports in ${fixedCount} files`);
}

main();
