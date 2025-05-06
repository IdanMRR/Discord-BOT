const fs = require('fs');
const path = require('path');

// Path to the verification handler file
const filePath = path.join(__dirname, 'src', 'handlers', 'verification', 'verification-handler.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix the CAPTCHA verification handler
const captchaVerificationFix = `async function handleCaptchaVerification(
  interaction: ButtonInteraction,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // First, defer the reply in case we need to send a regular message instead of showing a modal
    await interaction.deferReply({ ephemeral: true }).catch(error => {
      logError('Verification', \`Error deferring reply in CAPTCHA verification: \${error}\`);
    });
    
    try {
      // Generate a simple CAPTCHA (6 random alphanumeric characters)
      const captchaChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let captchaText = '';
      for (let i = 0; i < 6; i++) {
        captchaText += captchaChars.charAt(Math.floor(Math.random() * captchaChars.length));
      }
      
      // Create a modal for the CAPTCHA
      const modal = new ModalBuilder()
        .setCustomId(\`captcha_verification_\${interaction.guildId}\`)
        .setTitle('CAPTCHA Verification');
      
      // Add a text input for the CAPTCHA
      const captchaInput = new TextInputBuilder()
        .setCustomId('captcha_input')
        .setLabel(\`Enter the code: \${captchaText}\`)
        .setPlaceholder('Enter the code shown above')
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setRequired(true);
      
      const actionRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(captchaInput);
      
      modal.addComponents(actionRow);
      
      // Store the CAPTCHA text for verification
      const attemptKey = \`\${interaction.guildId}-\${interaction.user.id}\`;
      verificationAttempts.set(attemptKey, {
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        questionId: captchaText,
        attempts: 0,
        timeout: setTimeout(() => {
          verificationAttempts.delete(attemptKey);
        }, (settings.timeout_minutes || 10) * 60 * 1000)
      });
      
      // Delete the deferred reply before showing the modal
      await interaction.deleteReply().catch(error => {
        logError('Verification', \`Error deleting reply before showing modal: \${error}\`);
      });
      
      // Show the modal
      await interaction.showModal(modal);
      
      logInfo('Verification', \`Successfully showed CAPTCHA modal to user \${interaction.user.tag}\`);
      return true;
    } catch (modalError) {
      logError('Verification', \`Error showing CAPTCHA modal: \${modalError}\`);
      
      // Clean up the verification attempt
      const attemptKey = \`\${interaction.guildId}-\${interaction.user.id}\`;
      if (verificationAttempts.has(attemptKey)) {
        const attempt = verificationAttempts.get(attemptKey);
        if (attempt?.timeout) clearTimeout(attempt.timeout);
        verificationAttempts.delete(attemptKey);
      }
      
      // Send an error message
      await interaction.editReply({
        content: 'There was an error with the verification system. Please try again in a few moments.'
      }).catch(() => {
        // If editing fails, try to follow up
        interaction.followUp({
          content: 'There was an error with the verification system. Please try again in a few moments.',
          ephemeral: true
        }).catch(error => {
          logError('Verification', \`Error sending error message: \${error}\`);
        });
      });
      
      return false;
    }
  } catch (error) {
    logError('Verification', \`Error handling CAPTCHA verification: \${error}\`);
    return false;
  }
}`;

// 2. Fix the CAPTCHA modal submission handler
const captchaModalSubmitFix = `export async function handleCaptchaModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  // Immediately defer the reply to give us time to process
  await interaction.deferReply({ ephemeral: true }).catch(error => {
    logError('Verification', \`Error deferring reply in CAPTCHA modal submission: \${error}\`);
  });
  
  try {
    const { guildId, user } = interaction;
    
    if (!guildId) {
      await interaction.editReply({
        content: 'This command can only be used in a server.'
      });
      return false;
    }
    
    // Get verification settings
    const settings = await getVerificationSettings(guildId);
    
    if (!settings || !settings.enabled) {
      await interaction.editReply({
        content: 'Verification is not enabled on this server.'
      });
      return false;
    }
    
    // Get the verification attempt
    const attemptKey = \`\${guildId}-\${user.id}\`;
    const attempt = verificationAttempts.get(attemptKey);
    
    if (!attempt) {
      await interaction.editReply({
        content: 'Your verification attempt has expired. Please try again.'
      });
      return false;
    }
    
    // Get the input from the modal
    const captchaInput = interaction.fields.getTextInputValue('captcha_input');
    
    // Check if the input matches the CAPTCHA
    if (captchaInput.toUpperCase() !== attempt.questionId) {
      // Increment the attempt counter
      attempt.attempts++;
      
      // If too many failed attempts, fail the verification
      if (attempt.attempts >= 3) {
        // Clear the timeout
        if (attempt.timeout) clearTimeout(attempt.timeout);
        
        // Remove the attempt
        verificationAttempts.delete(attemptKey);
        
        // Log the failed verification
        await logVerificationAttempt(interaction, settings, false);
        
        await interaction.editReply({
          content: 'Too many failed attempts. Please try again later.'
        });
        
        return false;
      }
      
      await interaction.editReply({
        content: \`Incorrect code. Please try again. You have \${3 - attempt.attempts} attempts remaining.\`
      });
      
      return false;
    }
    
    // Clear the timeout
    if (attempt.timeout) clearTimeout(attempt.timeout);
    
    // Remove the attempt
    verificationAttempts.delete(attemptKey);
    
    // Assign the verification role
    await assignVerificationRole(interaction, settings);
    
    await interaction.editReply({
      content: 'You have been verified! Welcome to the server.'
    });
    
    return true;
  } catch (error) {
    logError('Verification', \`Error handling CAPTCHA modal submit: \${error}\`);
    
    try {
      await interaction.editReply({
        content: 'An error occurred during verification. Please try again later or contact a server administrator.'
      });
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}`;

// Replace the functions in the file
content = content.replace(
  /async function handleCaptchaVerification\([^}]*\}/s,
  captchaVerificationFix
);

content = content.replace(
  /export async function handleCaptchaModalSubmit\([^}]*\}/s,
  captchaModalSubmitFix
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content);

console.log('Successfully updated verification-handler.ts with fixes for CAPTCHA verification');
