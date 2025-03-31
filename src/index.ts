import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { handleDutyOn, handleDutyOff, handleShowTime } from './components/dutyButtons';
import { checkLongDutySessions } from './commands/dutyalarm';

dotenv.config();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Create a collection for commands
client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Event handlers
client.once(Events.ClientReady, () => {
  console.log('Bot is online!');
  
  // Set up interval for checking long duty sessions (every 5 minutes)
  setInterval(() => {
    checkLongDutySessions(client);
  }, 5 * 60 * 1000);
});

client.on(Events.InteractionCreate, async interaction => {
  // Handle button interactions
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;
      
      // Handle duty buttons
      if (customId === 'duty_on') {
        await handleDutyOn(interaction);
      } else if (customId === 'duty_off') {
        await handleDutyOff(interaction);
      } else if (customId === 'show_time') {
        await handleShowTime(interaction);
      } 
      // Handle dutyshift buttons
      else if (customId.startsWith('dutyshift_signup_')) {
        const shiftId = parseInt(customId.split('_')[2]);
        if (!isNaN(shiftId)) {
          const dutyshiftCommand = client.commands.get('dutyshift');
          await dutyshiftCommand.handleSignup(interaction, shiftId);
        }
      } else if (customId.startsWith('dutyshift_cancel_')) {
        const shiftId = parseInt(customId.split('_')[2]);
        if (!isNaN(shiftId)) {
          const dutyshiftCommand = client.commands.get('dutyshift');
          await dutyshiftCommand.handleCancel(interaction, shiftId);
        }
      } else {
        console.log(`Unknown button: ${customId}`);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'There was an error while processing this button interaction!',
        ephemeral: true
      });
    }
    return;
  }

  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch(console.error);

// Declare type for command collection
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, any>;
  }
}
