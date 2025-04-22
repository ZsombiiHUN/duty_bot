import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';
import prisma from '../db'; // Import shared Prisma client
import logger from '../utils/logger'; // Import logger
import { BUTTON_ID_DUTY_ON, BUTTON_ID_DUTY_OFF, BUTTON_ID_SHOW_TIME } from '../constants'; // Import constants


const DUTY_ROLE_ID = process.env.DUTY_ROLE_ID!; // Fallback if settings fail

/**
 * Command definition for the /szolgalat command.
 * Displays the main duty control panel with buttons.
 * Requires Administrator permission or the configured duty role from GuildSettings.
 */
export const data = new SlashCommandBuilder()
  .setName('szolgalat')
  .setDescription('Szolgálat kezelése')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Base permission, specific role check done in execute

/**
 * Executes the /szolgalat command.
 * Checks user permissions based on GuildSettings or fallback environment variable.
 * Displays the duty control panel embed with buttons.
 * @param {CommandInteraction} interaction - The command interaction object.
 */
export async function execute(interaction: CommandInteraction) { // Removed incorrect Promise<void> return type
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const guildId = interaction.guildId; // Get guildId for settings check

  // Fetch guild settings to get the specific duty role ID
  let requiredRoleId = DUTY_ROLE_ID; // Fallback to env var
  if (guildId) {
    try {
      const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
      if (settings?.dutyRoleId) {
        requiredRoleId = settings.dutyRoleId;
      } else {
         logger.info(`No specific dutyRoleId found in GuildSettings for guild ${guildId}, using fallback DUTY_ROLE_ID.`);
      }
    } catch (error) {
      logger.error(`Error fetching guild settings for permission check in /szolgalat:`, { error, guildId });
      // Proceed with fallback DUTY_ROLE_ID
    }
  } else {
     logger.warn(`Could not get guildId from interaction in /szolgalat command.`);
     // Cannot fetch settings, rely solely on fallback DUTY_ROLE_ID
  }

  // Permission check: Must have the required role OR be an Administrator
  // If requiredRoleId is null/undefined (env var not set and settings lookup failed/empty), only admin can use.
  if (!member?.permissions.has(PermissionFlagsBits.Administrator) && (!requiredRoleId || !member?.roles.cache.has(requiredRoleId))) {
    // --- Improved Permission Error Embed ---
    const errorEmbed = new EmbedBuilder()
      .setColor(0xED4245) // Discord's standard red
      .setTitle('🚫 Hozzáférés megtagadva')
      .setDescription('Nincs megfelelő jogosultságod (adminisztrátor vagy szolgálati szerep) a parancs használatához.')
      // Footer removed for brevity, the title/description is clear enough.
      .setTimestamp();

    return interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
  }

  // --- Improved Main Control Panel Embed ---
  const dutyEmbed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord's standard blurple
    .setTitle('⚙️ Szolgálati Irányítópult')
    .setDescription('Kezeld a szolgálati idődet az alábbi gombokkal:')
    .addFields(
        { name: '🟢 Szolgálat kezdése', value: 'Új szolgálati időszak indítása.', inline: true },
        { name: '🔴 Szolgálat befejezése', value: 'Aktív szolgálat lezárása.', inline: true },
        { name: '📊 Szolgálati idő', value: 'Saját statisztikák megtekintése.', inline: true } // Clarified this shows user stats
    )
    .setFooter({ text: 'Az idő rögzítése automatikus. Részletesebb statisztikák: /dutystats' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_ID_DUTY_ON) // Use constant
        .setLabel('🟢 Szolgálat kezdése')
        .setStyle(ButtonStyle.Success),
      
      new ButtonBuilder()
        .setCustomId(BUTTON_ID_DUTY_OFF) // Use constant
        .setLabel('🔴 Szolgálat befejezése')
        .setStyle(ButtonStyle.Danger),
        
      new ButtonBuilder()
        .setCustomId(BUTTON_ID_SHOW_TIME) // Use constant
        .setLabel('📊 Szolgálati idő')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.reply({
    embeds: [dutyEmbed],
    components: [row]
  });
}
