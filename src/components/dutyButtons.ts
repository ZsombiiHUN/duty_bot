import { 
  ButtonInteraction, 
  EmbedBuilder,
  GuildMember
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function handleDutyOn(interaction: ButtonInteraction) {
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
    const errorEmbed = new EmbedBuilder()
      .setColor(0xF94A4A)
      .setTitle('❌ Már szolgálatban vagy!')
      .setDescription('Nem kezdhetsz új szolgálatot, amíg a jelenlegi aktív.')
      .setFooter({ text: 'Használd a "Szolgálat befejezése" gombot a jelenlegi szolgálat lezárásához.' })
      .setTimestamp();

    return interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
  }

  // Get guild settings
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });

  const dutyRoleId = settings?.dutyRoleId;

  // Check if user has permission to go on duty
  if (dutyRoleId) {
    const member = interaction.member as GuildMember;
    if (!member.roles.cache.has(dutyRoleId) && !member.permissions.has('Administrator')) {
      const noPermissionEmbed = new EmbedBuilder()
        .setColor(0xF94A4A)
        .setTitle('❌ Jogosultság megtagadva')
        .setDescription('Nincs megfelelő jogosultságod a szolgálatba lépéshez.')
        .setFooter({ text: 'Kérj segítséget egy adminisztrátortól.' })
        .setTimestamp();

      return interaction.reply({
        embeds: [noPermissionEmbed],
        ephemeral: true
      });
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
        console.error('Guild not found for role assignment');
        roleStatus = '\n⚠️ Nem sikerült a szolgálati rang hozzáadása: guild not found';
      } else {
        // Log the onDutyRoleId for debugging
        console.log(`Attempting to add role with ID: ${onDutyRoleId} to user: ${userId}`);

        // Fetch the role first to verify it exists
        const role = await guild.roles.fetch(onDutyRoleId).catch(err => {
          console.error(`Error fetching role: ${err.message}`);
          return null;
        });

        if (!role) {
          console.error(`Role with ID ${onDutyRoleId} does not exist in guild ${guildId}`);
          roleStatus = `\n⚠️ Nem sikerült a szolgálati rang hozzáadása: a szerep nem létezik`;
        } else {
          // Check if bot has permission to add the role
          const botMember = await guild.members.fetchMe();
          const botRole = botMember.roles.highest;
                    
          if (role.position >= botRole.position) {
            console.error(`Bot cannot add role ${role.name} as it is positioned higher than bot's highest role`);
            roleStatus = `\n⚠️ Nem sikerült a szolgálati rang hozzáadása: a bot szerepe alacsonyabb, mint a hozzáadni kívánt szerep`;
          } else {
            // Now add the role
            await member.roles.add(role);
            console.log(`Successfully added role ${role.name} to user ${userId}`);
            roleStatus = `\n✅ Szolgálati rang hozzáadva: <@&${onDutyRoleId}> (${role.name})`;
          }
        }
      }
    } catch (error) {
      console.error('Error adding duty role:', error);
      roleStatus = `\n⚠️ Nem sikerült a szolgálati rang hozzáadása: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
    }
  } else {
    console.log('No onDutyRoleId configured for guild:', guildId);
  }

  const startTime = newSession.startTime;
  const formattedStartTime = formatDateTime(startTime);

  const embed = new EmbedBuilder()
    .setColor(0x4CAF50)
    .setTitle('🔰 Szolgálat megkezdve')
    .setDescription(
      `### <@${userId}> szolgálatba lépett\n` +
      `📅 Időpont: ${formattedStartTime}\n` +
      `🆔 Azonosító: ${newSession.id}${roleStatus}`
    )
    .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
    .setFooter({ text: 'A szolgálati időd mérése megkezdődött.' })
    .setTimestamp();

  // Check if a notification channel is configured
  const notificationChannelId = settings?.dutyNotificationsChannelId;
  
  if (notificationChannelId && notificationChannelId.trim() !== '') {
    try {
      const channel = await interaction.guild?.channels.fetch(notificationChannelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
        
        // Send a simple confirmation to the user
        const userEmbed = new EmbedBuilder()
          .setColor(0x4CAF50)
          .setTitle('🔰 Szolgálat megkezdve')
          .setDescription('A szolgálati időd mérése megkezdődött.')
          .setTimestamp();
          
        await interaction.reply({
          embeds: [userEmbed],
          ephemeral: true
        });
      } else {
        // Fall back to replying directly if channel is not text-based
        console.error(`Channel with ID ${notificationChannelId} is not a text channel`);
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`Error sending to notification channel: ${error instanceof Error ? error.message : 'unknown error'}`);
      await interaction.reply({ embeds: [embed] });
    }
  } else {
    // No notification channel configured, reply directly
    await interaction.reply({ embeds: [embed] });
  }
}

export async function handleDutyOff(interaction: ButtonInteraction) {
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
    const errorEmbed = new EmbedBuilder()
      .setColor(0xF94A4A)
      .setTitle('❌ Nem vagy szolgálatban!')
      .setDescription('Nem fejezhetsz be egy nem létező szolgálatot.')
      .setFooter({ text: 'Használd a "Szolgálat kezdése" gombot az új szolgálat indításához.' })
      .setTimestamp();

    return interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
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
        console.error('Guild not found for role removal');
        roleStatus = '\n⚠️ Nem sikerült a szolgálati rang eltávolítása: guild not found';
      } else {
        // Log the onDutyRoleId for debugging
        console.log(`Attempting to remove role with ID: ${onDutyRoleId} from user: ${userId}`);

        // Fetch the role first to verify it exists
        const role = await guild.roles.fetch(onDutyRoleId).catch(err => {
          console.error(`Error fetching role: ${err.message}`);
          return null;
        });

        if (!role) {
          console.error(`Role with ID ${onDutyRoleId} does not exist in guild ${guildId}`);
          roleStatus = `\n⚠️ Nem sikerült a szolgálati rang eltávolítása: a szerep nem létezik`;
        } else {
          // Check if bot has permission to remove the role
          const botMember = await guild.members.fetchMe();
          const botRole = botMember.roles.highest;
                    
          if (role.position >= botRole.position) {
            console.error(`Bot cannot remove role ${role.name} as it is positioned higher than bot's highest role`);
            roleStatus = `\n⚠️ Nem sikerült a szolgálati rang eltávolítása: a bot szerepe alacsonyabb, mint az eltávolítani kívánt szerep`;
          } else {
            // Now remove the role
            await member.roles.remove(role);
            console.log(`Successfully removed role ${role.name} from user ${userId}`);
            roleStatus = `\n✅ Szolgálati rang eltávolítva: <@&${onDutyRoleId}> (${role.name})`;
          }
        }
      }
    } catch (error) {
      console.error('Error removing duty role:', error);
      roleStatus = `\n⚠️ Nem sikerült a szolgálati rang eltávolítása: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
    }
  } else {
    console.log('No onDutyRoleId configured for guild:', guildId);
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

  const embed = new EmbedBuilder()
    .setColor(0xFF5722)
    .setTitle('🛑 Szolgálat befejezve')
    .setDescription(
      `### <@${userId}> befejezte a szolgálatot\n` +
      `📅 Kezdés: ${formattedStartTime}\n` +
      `🏁 Befejezés: ${formattedEndTime}\n` +
      `⏱️ Időtartam: ${durationHours}ó ${durationMinutes}p ${durationSeconds}mp\n` +
      `🆔 Azonosító: ${activeSession.id}\n` +
      `📊 Összes befejezett szolgálat: ${completedSessions}${roleStatus}`
    )
    .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
    .setFooter({ text: 'A szolgálati időd rögzítésre került.' })
    .setTimestamp();

  // Check if a notification channel is configured
  const notificationChannelId = settings?.dutyNotificationsChannelId;
  
  if (notificationChannelId && notificationChannelId.trim() !== '') {
    try {
      const channel = await interaction.guild?.channels.fetch(notificationChannelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
        
        // Send a simple confirmation to the user
        const userEmbed = new EmbedBuilder()
          .setColor(0xFF5722)
          .setTitle('🛑 Szolgálat befejezve')
          .setDescription('A szolgálati időd rögzítésre került.')
          .setTimestamp();
          
        await interaction.reply({
          embeds: [userEmbed],
          ephemeral: true
        });
      } else {
        // Fall back to replying directly if channel is not text-based
        console.error(`Channel with ID ${notificationChannelId} is not a text channel`);
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`Error sending to notification channel: ${error instanceof Error ? error.message : 'unknown error'}`);
      await interaction.reply({ embeds: [embed] });
    }
  } else {
    // No notification channel configured, reply directly
    await interaction.reply({ embeds: [embed] });
  }
}

export async function handleShowTime(interaction: ButtonInteraction) {
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

  let activeSessionInfo = '';
  if (activeSession) {
    const startTime = activeSession.startTime;
    const currentTime = new Date();
    const activeDurationMs = currentTime.getTime() - startTime.getTime();
    const activeDurationHours = Math.floor(activeDurationMs / (1000 * 60 * 60));
    const activeDurationMinutes = Math.floor((activeDurationMs % (1000 * 60 * 60)) / (1000 * 60));
    const activeDurationSeconds = Math.floor((activeDurationMs % (1000 * 60)) / 1000);
    const formattedStartTime = formatDateTime(startTime);
    
    activeSessionInfo = 
      `## 🔴 Aktív szolgálat\n` +
      `📅 Kezdés: ${formattedStartTime}\n` +
      `⏱️ Jelenlegi időtartam: ${activeDurationHours}ó ${activeDurationMinutes}p ${activeDurationSeconds}mp\n` +
      `🆔 Azonosító: ${activeSession.id}\n\n`;
  }

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
      console.error(`Error fetching onDutyRole: ${error}`);
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
    
    avgInfo = `\n📊 Átlagos szolgálati idő: ${avgHours}ó ${avgMinutes}p`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x3F51B5)
    .setTitle('📊 Szolgálati idő statisztika')
    .setDescription(
      `## 📝 Összesítés - <@${userId}>\n` +
      `⏱️ Összes szolgálati idő: ${totalHours}ó ${totalMinutes}p\n` +
      `🔢 Befejezett szolgálatok: ${completedSessions.length}${avgInfo}${rankInfo}\n\n` +
      `${activeSessionInfo}${recentSessionsInfo}`
    )
    .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
    .setFooter({ text: 'További részletekért használd a /dutyuser parancsot.' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// Helper function to format dates
function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
}