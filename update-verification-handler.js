const fs = require('fs');
const path = require('path');

// Path to the verification handler file
const filePath = path.join(__dirname, 'src', 'handlers', 'verification', 'verification-handler.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Add the import for interaction utils if not already present
if (!content.includes("import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';")) {
  content = content.replace(
    "import { \n  ButtonInteraction,",
    "import { \n  ButtonInteraction,"
  );
  
  content = content.replace(
    "} from 'discord.js';",
    "} from 'discord.js';\nimport { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';"
  );
}

// Replace all ephemeral: true with the utility function
content = content.replace(
  /await interaction\.reply\(\{\s*content: ['"]([^'"]+)['"](,\s*components: \[[^\]]+\])?,\s*ephemeral: true\s*\}\);/g,
  "await replyEphemeral(interaction, {\n        content: '$1'$2\n      });"
);

// Replace all ephemeral: true in update calls
content = content.replace(
  /await interaction\.update\(\{\s*content: ['"]([^'"]+)['"](,\s*components: \[[^\]]+\])?,\s*ephemeral: true\s*\}\);/g,
  "await interaction.update(convertEphemeralToFlags({\n        content: '$1'$2\n      }));"
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content);

console.log('Successfully updated verification-handler.ts to use proper ephemeral message handling');
