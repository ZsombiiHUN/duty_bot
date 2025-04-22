import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// --- Environment Variable Checks ---
const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error('[ERROR] Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('[ERROR] Missing CLIENT_ID environment variable.');
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
  const cmd = command.default ?? command; // Use .default if it exists

  if ('data' in cmd) {
    commands.push(cmd.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" property.`);
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands globally.`);

    // Deploy globally so all servers get all commands
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(`Successfully reloaded ${commands.length} application (/) commands globally.`);
  } catch (error) {
    console.error(`Error refreshing application (/) commands globally:`, error);
    // Exit with error code to indicate failure
    process.exit(1); 
  }
})();
