import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  Collection, 
  Interaction, 
  ChatInputCommandInteraction, 
  ButtonInteraction,
  SlashCommandBuilder, // Added for Command interface
  SlashCommandSubcommandsOnlyBuilder // Added for Command interface
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { handleDutyOn, handleDutyOff, handleShowTime } from './components/dutyButtons';
import { handleSignup as handleDutyshiftSignup, handleCancel as handleDutyshiftCancel } from './components/dutyshiftButtons'; // Import the dutyshift handlers
import { checkLongDutySessions } from './commands/dutyalarm';
import * as Constants from './constants';
import logger from './utils/logger'; // Import the logger

dotenv.config();

// --- Environment Variable Checks ---
const { DISCORD_TOKEN, DUTY_ROLE_ID, ALLOWED_SERVER_IDS } = process.env;

if (!DISCORD_TOKEN) {
  logger.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}
if (!DUTY_ROLE_ID) {
  logger.error('DUTY_ROLE_ID environment variable is not set. Please set it in your .env file.');
  process.exit(1);
}
// Note: ALLOWED_SERVER_IDS check happens below where it's used.
// --- End Environment Variable Checks ---


// Define a more specific Command interface
interface Command {
    // Use a union type for different command structures
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">; 
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    // Optional handlers for specific interactions like buttons (keep as is)
    handleSignup?: (interaction: ButtonInteraction, shiftId: number) => Promise<void>;
    handleCancel?: (interaction: ButtonInteraction, shiftId: number) => Promise<void>;
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Create a collection for commands using the defined interface
client.commands = new Collection<string, Command>();

// Parse allowed server IDs from environment variable
const allowServerIds = ALLOWED_SERVER_IDS || '*'; // Use the checked variable
const allowAllServers = allowServerIds === '*';
const allowedServerIdsSet = new Set(
  allowServerIds !== '*' ? allowServerIds.split(',').map(id => id.trim()) : []
);

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    // Assuming the required file exports an object conforming to Command interface
    const command = require(filePath) as Command; 
    
    // Set the command (Removed the explicit check as per feedback)
    // It's assumed based on the 'as Command' assertion and project structure 
    // that valid commands will have 'data' and 'execute'.
    // Runtime errors might occur here if a command file is malformed.
    client.commands.set(command.data.name, command); 

  } catch (error) {
     logger.error(`Failed to load command at ${filePath}:`, { error });
     // Optionally add a warning if data/execute are missing after loading, 
     // but avoiding the check that TS flags.
     // const loadedCommand = require(filePath);
     // if (!loadedCommand.data || !loadedCommand.execute) {
     //    console.warn(`[WARNING] Loaded command at ${filePath} might be missing 'data' or 'execute'.`);
     // }
  }
}

// --- Button Handler Setup ---
// Define the handler function type
type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

// Map for static button IDs
const staticButtonHandlers = new Map<string, ButtonHandler>();
staticButtonHandlers.set(Constants.BUTTON_ID_DUTY_ON, handleDutyOn);
staticButtonHandlers.set(Constants.BUTTON_ID_DUTY_OFF, handleDutyOff);
staticButtonHandlers.set(Constants.BUTTON_ID_SHOW_TIME, handleShowTime);

// --- Dynamic Button Handler Setup ---
// Define the dynamic handler function type (takes interaction and the ID part)
type DynamicButtonHandler = (interaction: ButtonInteraction, id: string) => Promise<void>;

// Map for dynamic button prefixes
const dynamicButtonHandlers = new Map<string, DynamicButtonHandler>();

// Handler for dutyshift signup
dynamicButtonHandlers.set(Constants.BUTTON_PREFIX_DUTYSHIFT_SIGNUP, async (interaction, id) => {
    const shiftId = parseInt(id);
    if (isNaN(shiftId)) {
        logger.warn(`Could not parse shiftId from customId: ${interaction.customId}`);
        await interaction.reply({ content: 'Error processing signup (invalid ID).', ephemeral: true });
        return;
    }
    // Directly call the imported handler function
    await handleDutyshiftSignup(interaction, shiftId);
});

// Handler for dutyshift cancel
dynamicButtonHandlers.set(Constants.BUTTON_PREFIX_DUTYSHIFT_CANCEL, async (interaction, id) => {
    const shiftId = parseInt(id);
    if (isNaN(shiftId)) {
        logger.warn(`Could not parse shiftId from customId: ${interaction.customId}`);
        await interaction.reply({ content: 'Error processing cancellation (invalid ID).', ephemeral: true });
        return;
    }
    // Directly call the imported handler function
    await handleDutyshiftCancel(interaction, shiftId);
});
// --- End Button Handler Setup ---


// Event handlers
client.once(Events.ClientReady, () => {
  logger.info('Bot is online!');
  
  // Set up interval for checking long duty sessions (every 5 minutes)
  setInterval(() => {
    checkLongDutySessions(client);
  }, 5 * 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => { // Add Interaction type
  // Check if the interaction is from an allowed server
  const guildId = interaction.guildId;
  if (guildId && !allowAllServers && !allowedServerIdsSet.has(guildId)) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: 'Ez a bot nem engedélyezett ezen a szerveren.',
        ephemeral: true
      });
    }
    return;
  }

  // Handle button interactions (Refactored)
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;

      // 1. Check static handlers
      const staticHandler = staticButtonHandlers.get(customId);
      if (staticHandler) {
        await staticHandler(interaction);
        return; // Static handler found and executed
      }

      // 2. Check dynamic handlers (iterate through prefix map)
      for (const [prefix, dynamicHandler] of dynamicButtonHandlers.entries()) {
        if (customId.startsWith(prefix)) {
          const idPart = customId.substring(prefix.length);
          await dynamicHandler(interaction, idPart);
          return; // Dynamic handler found and executed
        }
      }

      // 3. Handle unrecognized buttons
      logger.info(`Unhandled button interaction: ${customId}`);
      // Optionally inform the user
      // await interaction.reply({ content: 'This button is not recognized or is no longer active.', ephemeral: true });

    } catch (error) {
      logger.error(`Error handling button interaction with customId "${interaction.customId}":`, { error }); // Added customId context
      // Avoid replying if interaction already replied/deferred (though less likely in button handlers)
      if (!interaction.replied && !interaction.deferred) {
          try {
              await interaction.reply({
                  content: 'There was an error while processing this button interaction!',
                  ephemeral: true
              });
          } catch (replyError) {
              logger.error('Error sending error reply for button interaction:', { replyError });
          }
      } else {
           try {
              await interaction.followUp({
                  content: 'There was an error while processing this button interaction!',
                  ephemeral: true
              });
           } catch (followUpError) {
               logger.error('Error sending error followUp for button interaction:', { followUpError });
           }
      }
    }
    // No return here, as other interaction types might follow (though unlikely if it was a button)
    // The returns within the specific handlers ensure we don't fall through.
  }

  // Handle slash commands
  if (interaction.isChatInputCommand()) { // Type guard narrows interaction type
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      // Optionally reply to the user
      // if (interaction.isRepliable()) {
      //    await interaction.reply({ content: `Command '${interaction.commandName}' not found.`, ephemeral: true });
      // }
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command "${interaction.commandName}":`, { error }); // Ensured commandName is quoted
      if (interaction.replied || interaction.deferred) {
        try {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } catch (followUpError) {
            logger.error(`Error sending followUp error for command "${interaction.commandName}":`, { followUpError }); // Ensured commandName is quoted
        }
      } else {
        try {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        } catch (replyError) {
            logger.error(`Error sending reply error for command "${interaction.commandName}":`, { replyError }); // Ensured commandName is quoted
        }
      }
    }
  }
  // Add handlers for other interaction types here (e.g., Select Menus, Modals)
});

// Login to Discord
client.login(DISCORD_TOKEN).catch(error => logger.error('Failed to login to Discord:', { error })); // Use checked variable

// Declare type for command collection using the interface
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>; // Use Command interface
  }
}
