import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType
  // ButtonInteraction removed as it's unused
} from 'discord.js';
// import { PrismaClient } from '@prisma/client'; // Removed local instance import
import prisma from '../db'; // Import shared Prisma client
import { handleSignup as handleSignupButton, handleCancel as handleCancelButton } from '../components/dutyshiftButtons'; // Import handlers
import { formatDateTime, parseDateTime } from '../utils/dateTimeUtils'; // Import shared date formatters and parsers

// const prisma = new PrismaClient(); // Removed local instance creation

/**
 * Command definition for the /beosztas command.
 * Handles creation, listing, viewing, signing up, canceling, and deleting duty shifts.
 * Permissions vary by subcommand (Admin for create/delete, Duty Role/Admin for others).
 */
export const data = new SlashCommandBuilder()
  .setName('beosztas')
  .setDescription('Szolgálati beosztások kezelése, jelentkezés, lemondás.')
  .setDMPermission(false)
  .addSubcommand(subcommand => 
    subcommand
      .setName('create')
      .setDescription('Új szolgálati beosztás létrehozása')
      .addStringOption(option => 
        option
          .setName('title')
          .setDescription('Beosztás címe')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('start_time')
          .setDescription('Kezdés időpontja (YYYY-MM-DD HH:MM)')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('end_time')
          .setDescription('Befejezés időpontja (YYYY-MM-DD HH:MM)')
          .setRequired(true)
      )
      .addIntegerOption(option => 
        option
          .setName('max_users')
          .setDescription('Maximális résztvevők száma')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('list')
      .setDescription('Elérhető beosztások listázása')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('view')
      .setDescription('Beosztás részleteinek megtekintése')
      .addIntegerOption(option => 
        option
          .setName('shift_id')
          .setDescription('Beosztás azonosítója')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('signup')
      .setDescription('Jelentkezés szolgálati beosztásra')
      .addIntegerOption(option => 
        option
          .setName('shift_id')
          .setDescription('Beosztás azonosítója')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('cancel')
      .setDescription('Jelentkezés visszavonása')
      .addIntegerOption(option => 
        option
          .setName('shift_id')
          .setDescription('Beosztás azonosítója')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('delete')
      .setDescription('Beosztás törlése (csak admin)')
      .addIntegerOption(option => 
        option
          .setName('shift_id')
          .setDescription('Beosztás azonosítója')
          .setRequired(true)
      )
      .addBooleanOption(option => 
        option
          .setName('confirm')
          .setDescription('Megerősítés')
          .setRequired(true)
      )
  );

/**
 * Executes the /beosztas command based on the chosen subcommand.
 * Handles shift creation, listing, viewing, signup, cancellation, and deletion.
 * Checks permissions based on subcommand and GuildSettings.
 * @param {ChatInputCommandInteraction} interaction - The command interaction object.
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  // Get settings to check for duty role requirement
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });

  if (settings?.dutyRoleId) {
    const member = interaction.guild?.members.cache.get(userId);
    if (!member?.roles.cache.has(settings.dutyRoleId) && !member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Nincs jogosultságod használni ezt a parancsot!',
        ephemeral: true
      });
    }
  }

  if (subcommand === 'create') {
    // Check if user has admin permissions
    const member = interaction.guild?.members.cache.get(userId);
    if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Csak adminisztrátorok hozhatnak létre beosztásokat!',
        ephemeral: true
      });
    }
    
    const title = interaction.options.getString('title')!;
    const startTimeStr = interaction.options.getString('start_time')!;
    const endTimeStr = interaction.options.getString('end_time')!;
    const maxUsers = interaction.options.getInteger('max_users') || 1;
    
    // Parse date strings
    let startTime: Date;
    let endTime: Date;
    
    try {
      startTime = parseDateTime(startTimeStr);
      endTime = parseDateTime(endTimeStr);
    } catch (error) {
      return interaction.reply({
        content: 'Érvénytelen dátum/idő formátum. Használd a YYYY-MM-DD HH:MM formátumot.',
        ephemeral: true
      });
    }
    
    // Validate dates
    if (startTime <= new Date()) {
      return interaction.reply({
        content: 'A kezdés időpontja nem lehet korábbi, mint a jelenlegi idő.',
        ephemeral: true
      });
    }
    
    if (startTime >= endTime) {
      return interaction.reply({
        content: 'A kezdés időpontja nem lehet későbbi, mint a befejezés időpontja.',
        ephemeral: true
      });
    }
    
    // Create shift
    const shift = await prisma.shift.create({
      data: {
        guildId,
        title,
        startTime,
        endTime,
        maxUsers,
        createdBy: userId
      }
    });
    
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Create signup button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`dutyshift_signup_${shift.id}`)
          .setLabel('Jelentkezés')
          .setStyle(ButtonStyle.Primary)
      );
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Új szolgálati beosztás létrehozva')
      .setDescription(
        `**${title}**\n\n` +
        `Időpont: ${formatDateTime(startTime)} - ${formatDateTime(endTime)}\n` +
        `Időtartam: ${durationHours}ó ${durationMinutes}p\n` +
        `Létszám: 0/${maxUsers}\n\n` +
        `Jelentkezéshez használd a gombot vagy a \`/beosztas signup\` parancsot az azonosítóval: **${shift.id}**`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
  else if (subcommand === 'list') {
    // Get all future shifts for this guild
    const now = new Date();
    
    const shifts = await prisma.shift.findMany({
      where: {
        guildId,
        startTime: {
          gte: now
        }
      },
      orderBy: {
        startTime: 'asc'
      },
      include: {
        signups: true
      }
    });
    
    if (shifts.length === 0) {
      return interaction.reply({
        content: 'Jelenleg nincs elérhető szolgálati beosztás.',
        ephemeral: true
      });
    }
    
    let description = 'Elérhető szolgálati beosztások:\n\n';
    
    shifts.forEach(shift => {
      const durationMs = shift.endTime.getTime() - shift.startTime.getTime();
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Check if the user is signed up
      const isSignedUp = shift.signups.some(signup => signup.userId === userId);
      
      description += `**${shift.id}. ${shift.title}**\n` +
        `Időpont: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}\n` +
        `Időtartam: ${durationHours}ó ${durationMinutes}p\n` +
        `Létszám: ${shift.signups.length}/${shift.maxUsers}\n` +
        `${isSignedUp ? '✅ Jelentkeztél erre a beosztásra' : ''}\n\n`;
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati beosztások')
      .setDescription(description)
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
  else if (subcommand === 'view') {
    const shiftId = interaction.options.getInteger('shift_id')!;
    
    // Get the shift with signups
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        signups: true
      }
    });
    
    if (!shift) {
      return interaction.reply({
        content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
        ephemeral: true
      });
    }
    
    if (shift.guildId !== guildId) {
      return interaction.reply({
        content: 'Ez a beosztás másik szerveren jött létre.',
        ephemeral: true
      });
    }
    
    const durationMs = shift.endTime.getTime() - shift.startTime.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format signups
    let signupsList = '';
    if (shift.signups.length > 0) {
      signupsList = '\n\n**Jelentkezők:**\n';
      shift.signups.forEach((signup, index) => {
        signupsList += `${index + 1}. <@${signup.userId}>\n`;
      });
    } else {
      signupsList = '\n\nMég senki sem jelentkezett.';
    }
    
    // Check if the user is signed up
    const isSignedUp = shift.signups.some(signup => signup.userId === userId);
    
    // Create buttons for signup/cancel
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`dutyshift_signup_${shift.id}`)
          .setLabel('Jelentkezés')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isSignedUp || shift.signups.length >= shift.maxUsers),
        new ButtonBuilder()
          .setCustomId(`dutyshift_cancel_${shift.id}`)
          .setLabel('Visszavonás')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!isSignedUp)
      );
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Szolgálati beosztás: ${shift.title}`)
      .setDescription(
        `Időpont: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}\n` +
        `Időtartam: ${durationHours}ó ${durationMinutes}p\n` +
        `Létszám: ${shift.signups.length}/${shift.maxUsers}` +
        `${isSignedUp ? '\n✅ Jelentkeztél erre a beosztásra' : ''}` +
        signupsList
      )
      .setTimestamp();
    
    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
      fetchReply: true
    });
    
    // Handle button interactions
    const collector = reply.createMessageComponentCollector({ 
      componentType: ComponentType.Button,
      time: 60_000 
    });
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'Ez nem a te beosztásod!', ephemeral: true });
      }
      
      if (i.customId === `dutyshift_signup_${shift.id}`) {
        // Handle signup using imported handler
        await handleSignupButton(i, shift.id); 
      } else if (i.customId === `dutyshift_cancel_${shift.id}`) {
        // Handle cancel using imported handler
        await handleCancelButton(i, shift.id);
      }
      
      // Refresh the view after action
      collector.stop();
    });
  }
  // Removed redundant signup/cancel blocks here, they are handled below
  else if (subcommand === 'delete') {
    // Check if user has admin permissions
    const member = interaction.guild?.members.cache.get(userId);
    if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Csak adminisztrátorok törölhetnek beosztásokat!',
        ephemeral: true
      });
    }
    
    const shiftId = interaction.options.getInteger('shift_id')!;
    const confirm = interaction.options.getBoolean('confirm')!;
    
    if (!confirm) {
      return interaction.reply({
        content: 'A törlés megszakítva. A törléshez erősítsd meg a műveletet.',
        ephemeral: true
      });
    }
    
    // Find shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { signups: true }
    });
    
    if (!shift) {
      return interaction.reply({
        content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
        ephemeral: true
      });
    }
    
    if (shift.guildId !== guildId) {
      return interaction.reply({
        content: 'Ezt a beosztást nem módosíthatod, mert másik szerveren jött létre.',
        ephemeral: true
      });
    }
    
    // Delete shift (cascades to signups)
    await prisma.shift.delete({
      where: { id: shiftId }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Szolgálati beosztás törölve')
      .setDescription(
        `A ${shiftId} azonosítójú szolgálati beosztás sikeresen törölve lett.\n` +
        `Cím: ${shift.title}\n` +
        `Időpont: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}\n` +
        `Jelentkezők száma: ${shift.signups.length}`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  } else if (subcommand === 'signup') {
    const shiftId = interaction.options.getInteger('shift_id')!;
    // Use imported handler
    await handleSignupButton(interaction, shiftId); 
  } else if (subcommand === 'cancel') {
    const shiftId = interaction.options.getInteger('shift_id')!;
    // Use imported handler
    await handleCancelButton(interaction, shiftId);
  } else if (subcommand === 'delete') {
    // Check if user has admin permissions
    const member = interaction.guild?.members.cache.get(userId);
    if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Csak adminisztrátorok törölhetnek beosztásokat!',
        ephemeral: true
      });
    }
    
    const shiftId = interaction.options.getInteger('shift_id')!;
    const confirm = interaction.options.getBoolean('confirm')!;
    
    if (!confirm) {
      return interaction.reply({
        content: 'A törlés megszakítva. A törléshez erősítsd meg a műveletet.',
        ephemeral: true
      });
    }
    
    // Find shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { signups: true }
    });
    
    if (!shift) {
      return interaction.reply({
        content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
        ephemeral: true
      });
    }
    
    if (shift.guildId !== guildId) {
      return interaction.reply({
        content: 'Ezt a beosztást nem módosíthatod, mert másik szerveren jött létre.',
        ephemeral: true
      });
    }
    
    // Delete shift (cascades to signups)
    await prisma.shift.delete({
      where: { id: shiftId }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Szolgálati beosztás törölve')
      .setDescription(
        `A ${shiftId} azonosítójú szolgálati beosztás sikeresen törölve lett.\n` +
        `Cím: ${shift.title}\n` +
        `Időpont: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}\n` +
        `Jelentkezők száma: ${shift.signups.length}`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
}

/* Functions moved to src/components/dutyshiftButtons.ts

async function handleSignup(...) { ... }

async function handleCancel(...) { ... }

*/

// Make the functions available for import
// export { handleSignup, handleCancel }; // Removed export

// Removed local helper function parseDateTime
// It is now imported from ../utils/dateTimeUtils

// Removed local formatDateTime and padZero functions, now imported from utils
