import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// --- Environment Variable Checks ---
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error('[ERROR] Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('[ERROR] Missing CLIENT_ID environment variable.');
  process.exit(1);
}
// Validate GUILD_ID format (basic check for numeric string)
const snowflakeRegex = /^\d+$/;
if (!GUILD_ID || !snowflakeRegex.test(GUILD_ID)) {
  console.error(`[ERROR] Invalid or missing GUILD_ID environment variable: "${GUILD_ID}". It must be a valid Discord Snowflake ID.`);
  process.exit(1);
}
// --- End Environment Variable Checks ---

const commands = [];

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

// Grab the SlashCommandBuilder.toJSON() output of each command's data
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" property.`);
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands for guild ${GUILD_ID}.`);

    // Deploy to specific guild for immediate testing
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`Successfully reloaded ${commands.length} application (/) commands for guild ${GUILD_ID}.`);
  } catch (error) {
    console.error(`Error refreshing application (/) commands for guild ${GUILD_ID}:`, error);
    // Exit with error code to indicate failure
    process.exit(1); 
  }
})();
