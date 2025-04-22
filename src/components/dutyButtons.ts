import { 
  ButtonInteraction, 
  EmbedBuilder,
  GuildMember
} from 'discord.js';
// import { PrismaClient } from '@prisma/client'; // Removed local instance import
import prisma from '../db'; // Import shared Prisma client
import { formatDateTime } from '../utils/dateTimeUtils'; // Import shared date formatter
import logger from '../utils/logger'; // Import the logger

// const prisma = new PrismaClient(); // Removed local instance creation

/**
 * Handles the 'Duty On' button interaction.
 * Checks if the user is already on duty or lacks permissions.
 * Creates a new duty session, adds the 'On Duty' role (if configured),
 * and sends a confirmation message.
 * @param {ButtonInteraction} interaction - The button interaction object.
 */
export async function handleDutyOn(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId || '';
  
  // Check if user is already on duty - this should now be clean
  const activeSession = await prisma.dutySession.findFirst({
    where: {
      userId,
      guildId,
      endTime: null
    }
  });

  if (activeSession) {
    // --- Improved Error Embed (Already On Duty) ---
    const errorEmbed = new EmbedBuilder()
      .setColor(0xED4245) // Standard Red
      .setTitle('⚠️ Már szolgálatban vagy')
      .setDescription('Egyszerre csak egy aktív szolgálatod lehet.')
      .setFooter({ text: 'Fejezd be a jelenlegit a "Szolgálat befejezése" gombbal.' })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
    return;
  }

  // Get guild settings
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });

  const dutyRoleId = settings?.dutyRoleId;

  // Check if user has permission to go on duty
  if (dutyRoleId) {
    const member = interaction.member as GuildMember;
    // Ensure member exists before checking roles/permissions
    if (!member) {
        logger.error(`Could not get GuildMember object for user ${userId} in handleDutyOn`, { guildId });
        // Send a generic error if member object is missing
        const genericErrorEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Hiba történt')
            .setDescription('Nem sikerült ellenőrizni a jogosultságodat. Próbáld újra később.')
            .setTimestamp();
        await interaction.reply({ embeds: [genericErrorEmbed], ephemeral: true });
        return;
    }
    
    if (!member.roles.cache.has(dutyRoleId) && !member.permissions.has('Administrator')) {
      // --- Improved Error Embed (No Permission) ---
      const noPermissionEmbed = new EmbedBuilder()
        .setColor(0xED4245) // Standard Red
        .setTitle('🚫 Hozzáférés megtagadva')
        .setDescription('Nincs megfelelő jogosultságod (szolgálati szerep vagy adminisztrátor) a szolgálatba lépéshez.')
        .setTimestamp();

      await interaction.reply({
        embeds: [noPermissionEmbed],
        ephemeral: true
      });
      return;
    }
  }

  // Create new duty session
  const newSession = await prisma.dutySession.create({
    data: {
      userId,
      guildId
    }
  });

  // Add "On Duty" role if configured
  const onDutyRoleId = settings?.onDutyRoleId;
  let roleStatus = '';
  
  if (onDutyRoleId) {
    try {
      const member = interaction.member as GuildMember;
      const guild = interaction.guild;

      if (!guild) {
        logger.error('Guild not found for role assignment', { guildId, userId });
        roleStatus = '\n⚠️ Nem sikerült a szolgálati rang hozzáadása: guild not found';
      } else {
        // Log the onDutyRoleId for debugging
        logger.info(`Attempting to add role with ID: ${onDutyRoleId} to user: ${userId} in guild: ${guildId}`);

        // Fetch the role first to verify it exists
        const role = await guild.roles.fetch(onDutyRoleId).catch(err => {
          logger.error(`Error fetching role ${onDutyRoleId} in guild ${guildId}:`, { error: err });
          return null;
        });

        if (!role) {
          logger.error(`Role with ID ${onDutyRoleId} does not exist in guild ${guildId}`);
          roleStatus = `\n⚠️ Nem sikerült a szolgálati rang hozzáadása: a szerep nem létezik`;
        } else {
          // Check if bot has permission to add the role
          const botMember = await guild.members.fetchMe();
          const botRole = botMember.roles.highest;
                    
          if (role.position >= botRole.position) {
            logger.error(`Bot cannot add role ${role.name} (${role.id}) as it is positioned higher than bot's highest role ${botRole.name} (${botRole.id})`, { guildId, userId });
            roleStatus = `\n⚠️ Nem sikerült a szolgálati rang hozzáadása: a bot szerepe alacsonyabb, mint a hozzáadni kívánt szerep`;
          } else {
            // Now add the role
            await member.roles.add(role);
            logger.info(`Successfully added role ${role.name} (${role.id}) to user ${userId}`, { guildId });
            roleStatus = `\n✅ Szolgálati rang hozzáadva: <@&${onDutyRoleId}> (${role.name})`;
          }
        }
      }
    } catch (error) {
      logger.error('Error adding duty role:', { error, userId, guildId, onDutyRoleId });
      roleStatus = `\n⚠️ Nem sikerült a szolgálati rang hozzáadása: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
    }
  } else {
    logger.info(`No onDutyRoleId configured for guild: ${guildId}`);
  }

  const startTime = newSession.startTime;
  const formattedStartTime = formatDateTime(startTime);

  // --- Improved Success Embed (Main/Notification) ---
  const embed = new EmbedBuilder()
    .setColor(0x57F287) // Standard Green
    .setTitle('🟢 Szolgálat megkezdve')
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }) || undefined })
    .addFields(
        { name: 'Felhasználó', value: `<@${userId}>`, inline: true },
        { name: 'Időpont', value: formattedStartTime, inline: true },
        { name: 'Azonosító', value: `\`${newSession.id}\``, inline: true }
    )
    .setFooter({ text: 'A szolgálati idő mérése elindult.' })
    .setTimestamp();

  // Add role status as a separate field if it exists
  if (roleStatus.trim() !== '') {
      // Extract the core message from roleStatus (remove potential leading newline and icon)
      const roleStatusMessage = roleStatus.replace(/^\s*(✅|⚠️)\s*/, '');
      const roleFieldName = roleStatus.includes('✅') ? 'Szerep hozzáadva' : 'Szerep hiba';
      embed.addFields({ name: roleFieldName, value: roleStatusMessage });
  }

  // --- Send Dedicated Log Message ---
  const logChannelId = settings?.dutyLogChannelId;
  if (logChannelId && logChannelId.trim() !== '') {
    try {
      const logChannel = await interaction.guild?.channels.fetch(logChannelId);
      if (logChannel?.isTextBased()) {
        // Use a simpler log message format
        await logChannel.send(`🟢 <@${userId}> started duty. Session ID: \`${newSession.id}\``);
        logger.info(`Sent duty start log to channel ${logChannelId} for user ${userId}`, { guildId });
      } else {
        logger.warn(`Duty log channel ${logChannelId} not found or not text-based`, { guildId });
        // Optionally notify the admin who ran the command if the log channel is invalid? Maybe too noisy.
      }
    } catch (error) {
      logger.error(`Error sending duty start log to channel ${logChannelId}:`, { error, guildId });
    }
  }
  // --- End Dedicated Log Message ---

  // Check if a notification channel is configured
  const notificationChannelId = settings?.dutyNotificationsChannelId;
  
  if (notificationChannelId && notificationChannelId.trim() !== '') {
    try {
      const channel = await interaction.guild?.channels.fetch(notificationChannelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] }); // Send the detailed embed to the channel

        // --- Simplified Ephemeral Confirmation ---
        const userConfirmationEmbed = new EmbedBuilder()
          .setColor(0x57F287) // Standard Green
          .setDescription('✅ Sikeresen szolgálatba léptél.')
          // No title, timestamp, or footer needed for simple confirmation

        await interaction.reply({
          embeds: [userConfirmationEmbed],
          ephemeral: true
        });
      } else {
        // Fall back to replying directly (with the detailed embed) if channel is not text-based
        logger.error(`Channel with ID ${notificationChannelId} is not a text channel`, { guildId });
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error(`Error sending to notification channel ${notificationChannelId}:`, { error, guildId });
      await interaction.reply({ embeds: [embed] });
    }
  } else {
    // No notification channel configured, reply directly
    await interaction.reply({ embeds: [embed] });
  }
}

/**
 * Handles the 'Duty Off' button interaction.
 * Checks if the user is currently on duty.
 * Ends the active duty session(s), removes the 'On Duty' role (if configured),
 * calculates duration, and sends a confirmation message.
 * @param {ButtonInteraction} interaction - The button interaction object.
 */
export async function handleDutyOff(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId || '';

  // Find all active duty sessions - should be just one, but let's be safe
  const activeSessions = await prisma.dutySession.findMany({
    where: {
      userId,
      guildId,
      endTime: null
    }
  });

  if (activeSessions.length === 0) {
    // --- Improved Error Embed (Not On Duty) ---
    const errorEmbed = new EmbedBuilder()
      .setColor(0xED4245) // Standard Red
      .setTitle('⚠️ Nem vagy szolgálatban')
      .setDescription('Nincs aktív szolgálat, amit befejezhetnél.')
      .setFooter({ text: 'Kezdj új szolgálatot a "Szolgálat kezdése" gombbal.' })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
    return;
  }

  // Get the most recent active session
  const activeSession = activeSessions[0];
  const endTime = new Date();
  
  // Calculate duty duration
  const startTime = activeSession.startTime;
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const durationSeconds = Math.floor((durationMs % (1000 * 60)) / 1000);

  // Close ALL active sessions to be sure
  await prisma.dutySession.updateMany({
    where: {
      userId,
      guildId,
      endTime: null
    },
    data: {
      endTime
    }
  });

  // Remove "On Duty" role if configured
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });
  
  const onDutyRoleId = settings?.onDutyRoleId;
  let roleStatus = '';
  
  if (onDutyRoleId) {
    try {
      const member = interaction.member as GuildMember;
      const guild = interaction.guild;

      if (!guild) {
        logger.error('Guild not found for role removal', { guildId, userId });
        roleStatus = '\n⚠️ Nem sikerült a szolgálati rang eltávolítása: guild not found';
      } else {
        // Log the onDutyRoleId for debugging
        logger.info(`Attempting to remove role with ID: ${onDutyRoleId} from user: ${userId} in guild: ${guildId}`);

        // Fetch the role first to verify it exists
        const role = await guild.roles.fetch(onDutyRoleId).catch(err => {
          logger.error(`Error fetching role ${onDutyRoleId} in guild ${guildId}:`, { error: err });
          return null;
        });

        if (!role) {
          logger.error(`Role with ID ${onDutyRoleId} does not exist in guild ${guildId}`);
          roleStatus = `\n⚠️ Nem sikerült a szolgálati rang eltávolítása: a szerep nem létezik`;
        } else {
          // Check if bot has permission to remove the role
          const botMember = await guild.members.fetchMe();
          const botRole = botMember.roles.highest;
                    
          if (role.position >= botRole.position) {
            logger.error(`Bot cannot remove role ${role.name} (${role.id}) as it is positioned higher than bot's highest role ${botRole.name} (${botRole.id})`, { guildId, userId });
            roleStatus = `\n⚠️ Nem sikerült a szolgálati rang eltávolítása: a bot szerepe alacsonyabb, mint az eltávolítani kívánt szerep`;
          } else {
            // Now remove the role
            await member.roles.remove(role);
            logger.info(`Successfully removed role ${role.name} (${role.id}) from user ${userId}`, { guildId });
            roleStatus = `\n✅ Szolgálati rang eltávolítva: <@&${onDutyRoleId}> (${role.name})`;
          }
        }
      }
    } catch (error) {
      logger.error('Error removing duty role:', { error, userId, guildId, onDutyRoleId });
      roleStatus = `\n⚠️ Nem sikerült a szolgálati rang eltávolítása: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
    }
  } else {
    logger.info(`No onDutyRoleId configured for guild: ${guildId}`);
  }

  const formattedStartTime = formatDateTime(startTime);
  const formattedEndTime = formatDateTime(endTime);

  // Get total stats
  const completedSessions = await prisma.dutySession.count({
    where: {
      userId,
      guildId,
      endTime: {
        not: null
      }
    }
  });

  // --- Improved Success Embed (Main/Notification) ---
  const embed = new EmbedBuilder()
    .setColor(0xE67E22) // Orange for ending duty
    .setTitle('🔴 Szolgálat befejezve')
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }) || undefined })
    .addFields(
        { name: 'Felhasználó', value: `<@${userId}>`, inline: true },
        { name: 'Időtartam', value: `${durationHours}ó ${durationMinutes}p ${durationSeconds}mp`, inline: true },
        { name: 'Összes szolgálat', value: `${completedSessions} db`, inline: true },
        { name: 'Kezdés', value: formattedStartTime, inline: true },
        { name: 'Befejezés', value: formattedEndTime, inline: true },
        { name: 'Azonosító', value: `\`${activeSession.id}\``, inline: true }
    )
    .setFooter({ text: 'A szolgálati idő rögzítve.' })
    .setTimestamp();

  // Add role status as a separate field if it exists
  if (roleStatus.trim() !== '') {
      // Extract the core message from roleStatus
      const roleStatusMessage = roleStatus.replace(/^\s*(✅|⚠️)\s*/, '');
      const roleFieldName = roleStatus.includes('✅') ? 'Szerep eltávolítva' : 'Szerep hiba';
      embed.addFields({ name: roleFieldName, value: roleStatusMessage });
  }

  // --- Send Dedicated Log Message ---
  const logChannelId = settings?.dutyLogChannelId;
  if (logChannelId && logChannelId.trim() !== '') {
    try {
      const logChannel = await interaction.guild?.channels.fetch(logChannelId);
      if (logChannel?.isTextBased()) {
        // Use a simpler log message format with backticks for ID
        await logChannel.send(`🔴 <@${userId}> ended duty. Duration: ${durationHours}h ${durationMinutes}m ${durationSeconds}s. Session ID: \`${activeSession.id}\``);
        logger.info(`Sent duty end log to channel ${logChannelId} for user ${userId}`, { guildId });
      } else {
        logger.warn(`Duty log channel ${logChannelId} not found or not text-based`, { guildId });
      }
    } catch (error) {
      logger.error(`Error sending duty end log to channel ${logChannelId}:`, { error, guildId });
    }
  }
  // --- End Dedicated Log Message ---

  // Check if a notification channel is configured
  const notificationChannelId = settings?.dutyNotificationsChannelId;
  
  if (notificationChannelId && notificationChannelId.trim() !== '') {
    try {
      const channel = await interaction.guild?.channels.fetch(notificationChannelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] }); // Send detailed embed to channel

        // --- Simplified Ephemeral Confirmation ---
        const userConfirmationEmbed = new EmbedBuilder()
          .setColor(0xE67E22) // Orange
          .setDescription('✅ Sikeresen befejezted a szolgálatot.')
          // No title, timestamp, or footer needed

        await interaction.reply({
          embeds: [userConfirmationEmbed],
          ephemeral: true
        });
      } else {
        // Fall back to replying directly (with the detailed embed) if channel is not text-based
        logger.error(`Channel with ID ${notificationChannelId} is not a text channel`, { guildId });
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error(`Error sending to notification channel ${notificationChannelId}:`, { error, guildId });
      await interaction.reply({ embeds: [embed] });
    }
  } else {
    // No notification channel configured, reply directly
    await interaction.reply({ embeds: [embed] });
  }
}

/**
 * Handles the 'Show Time' button interaction.
 * Fetches the user's active session (if any) and recent completed sessions.
 * Calculates total time, average time, and displays a summary embed.
 * @param {ButtonInteraction} interaction - The button interaction object.
 */
export async function handleShowTime(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId || '';

  // Get all completed duty sessions
  const completedSessions = await prisma.dutySession.findMany({
    where: {
      userId,
      guildId,
      endTime: {
        not: null
      }
    },
    orderBy: {
      startTime: 'desc'
    },
    take: 10
  });

  // Calculate total duty time
  let totalDurationMs = 0;
  completedSessions.forEach(session => {
    if (session.endTime) {
      totalDurationMs += session.endTime.getTime() - session.startTime.getTime();
    }
  });

  // Check if there's an active session
  const activeSession = await prisma.dutySession.findFirst({
    where: {
      userId,
      guildId,
      endTime: null
    }
  });

  // Format total duration
  const totalHours = Math.floor(totalDurationMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor((totalDurationMs % (1000 * 60 * 60)) / (1000 * 60));

  // Note: activeSessionInfo string was removed as it was unused.
  // Calculations needed for the embed are still done inside the if(activeSession) block below.

  // Build information about recent sessions
  let recentSessionsInfo = '';
  if (completedSessions.length > 0) {
    recentSessionsInfo = '## 📚 Legutóbbi szolgálatok\n';
    completedSessions.slice(0, 5).forEach((session, index) => {
      if (session.endTime) {
        const durationMs = session.endTime.getTime() - session.startTime.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        recentSessionsInfo += 
          `**${index + 1}.** ${formatDateTime(session.startTime)} - ${formatDateTime(session.endTime)}\n` +
          `⏱️ Időtartam: ${durationHours}ó ${durationMinutes}p | 🆔 Azonosító: ${session.id}\n\n`;
      }
    });
  } else {
    recentSessionsInfo = '## 📚 Legutóbbi szolgálatok\nNincsenek korábbi szolgálati időszakok.';
  }

  // Get rank information
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });
  
  const onDutyRoleId = settings?.onDutyRoleId;
  let rankInfo = '';
  
  if (onDutyRoleId) {
    try {
      const guild = interaction.guild;
      if (guild) {
        const role = await guild.roles.fetch(onDutyRoleId);
        if (role) {
          rankInfo = `\n👑 Szolgálati rang: <@&${onDutyRoleId}> (${role.name})`;
        } else {
          rankInfo = `\n👑 Szolgálati rang: Érvénytelen (ID: ${onDutyRoleId})`;
        }
      }
    } catch (error) {
      logger.error(`Error fetching onDutyRole ${onDutyRoleId}:`, { error, guildId });
      rankInfo = `\n👑 Szolgálati rang: Beállítva, de hiba történt az információ lekérésekor`;
    }
  } else {
    rankInfo = '\n👑 Szolgálati rang: Nincs beállítva';
  }

  // Calculate average session duration if there are completed sessions
  let avgInfo = '';
  if (completedSessions.length > 0) {
    const avgDurationMs = totalDurationMs / completedSessions.length;
    const avgHours = Math.floor(avgDurationMs / (1000 * 60 * 60));
    const avgMinutes = Math.floor((avgDurationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    avgInfo = `${avgHours} óra ${avgMinutes} perc`;
  } else {
    avgInfo = 'Nincs elég adat';
  }

  // --- Improved Show Time Embed ---
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Standard Blurple
    .setTitle(`📊 Szolgálati idő - ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) || null)
    .setTimestamp()
    .addFields(
        // Summary Fields
        { name: '⏱️ Összes idő', value: `${totalHours} óra ${totalMinutes} perc`, inline: true },
        { name: '✅ Befejezett szolgálatok', value: `${completedSessions.length} db`, inline: true },
        { name: '📊 Átlagos idő', value: avgInfo, inline: true }
        // Rank info could be added here if needed, extracted from rankInfo string
    );

    // Add Active Session field if applicable
    if (activeSession) {
        // Calculate details needed for the embed here
        const startTime = activeSession.startTime;
        const currentTime = new Date();
        const activeDurationMs = currentTime.getTime() - startTime.getTime(); // Keep this intermediate for calculation
        const activeDurationHours = Math.floor(activeDurationMs / (1000 * 60 * 60));
        const activeDurationMinutes = Math.floor((activeDurationMs % (1000 * 60 * 60)) / (1000 * 60));
        // activeDurationSeconds is not used in the embed, so removed calculation
        const formattedStartTime = formatDateTime(startTime);
        embed.addFields({
            name: '🟢 Aktív szolgálat',
            // Use the calculated values directly
            value: `Kezdés: ${formattedStartTime}\nIdőtartam: ${activeDurationHours}ó ${activeDurationMinutes}p\nAzonosító: \`${activeSession.id}\``,
            inline: false
        });
    } else {
         embed.addFields({ name: '⚪ Jelenlegi állapot', value: 'Nem szolgálatban', inline: false });
    }

    // Add Recent Sessions field
    if (completedSessions.length > 0) {
        let recentSessionsValue = '';
        completedSessions.slice(0, 3).forEach((session) => { // Show top 3 recent
            if (session.endTime) {
                const durationMs = session.endTime.getTime() - session.startTime.getTime();
                const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                recentSessionsValue += `*${formatDateTime(session.startTime)}* (${durationHours}ó ${durationMinutes}p) - ID: \`${session.id}\`\n`;
            }
        });
        embed.addFields({ name: '📚 Legutóbbi 3 szolgálat', value: recentSessionsValue.trim() || 'Nincs adat', inline: false });
    } else {
         embed.addFields({ name: '📚 Legutóbbi szolgálatok', value: 'Nincsenek korábbi szolgálati időszakok.', inline: false });
    }

    // Add Rank Info if available
    if (rankInfo.trim() !== '' && !rankInfo.includes('Nincs beállítva')) {
         const rankValue = rankInfo.replace(/^\s*👑\s*Szolgálati rang:\s*/, ''); // Clean up the string
         embed.addFields({ name: '👑 Szolgálati rang', value: rankValue, inline: false });
    }

    embed.setFooter({ text: 'Részletesebb statisztikák: /dutystats' });


  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// Removed local formatDateTime and padZero functions, now imported from utils
