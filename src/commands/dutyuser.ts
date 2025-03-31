import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import os from 'os';

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName('dutyuser')
  .setDescription('Személyes szolgálati idő információk')
  .setDMPermission(false)
  .addSubcommand(subcommand => 
    subcommand
      .setName('history')
      .setDescription('Saját szolgálati előzmények')
      .addIntegerOption(option => 
        option
          .setName('limit')
          .setDescription('Megjelenítendő szolgálatok száma')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(30)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('export')
      .setDescription('Szolgálati idő exportálása CSV fájlba')
      .addStringOption(option => 
        option
          .setName('timeframe')
          .setDescription('Időkeret')
          .setRequired(true)
          .addChoices(
            { name: 'Ezen a héten', value: 'weekly' },
            { name: 'Ebben a hónapban', value: 'monthly' },
            { name: 'Idén', value: 'yearly' },
            { name: 'Összes idő', value: 'all' }
          )
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('rank')
      .setDescription('Saját helyezés megtekintése a toplistán')
      .addStringOption(option => 
        option
          .setName('timeframe')
          .setDescription('Időkeret')
          .setRequired(true)
          .addChoices(
            { name: 'Ezen a héten', value: 'weekly' },
            { name: 'Ebben a hónapban', value: 'monthly' },
            { name: 'Idén', value: 'yearly' },
            { name: 'Összes idő', value: 'all' }
          )
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('requirements')
      .setDescription('Elvárt szolgálati idő követelmények ellenőrzése')
  );

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

  if (subcommand === 'history') {
    const limit = interaction.options.getInteger('limit') || 10;
    
    // Get user's completed duty sessions
    const sessions = await prisma.dutySession.findMany({
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
      take: limit
    });

    // Get active session
    const activeSession = await prisma.dutySession.findFirst({
      where: {
        userId,
        guildId,
        endTime: null
      }
    });

    // Calculate total duty time
    let totalDurationMs = 0;
    sessions.forEach(session => {
      if (session.endTime) {
        totalDurationMs += session.endTime.getTime() - session.startTime.getTime();
      }
    });

    const totalHours = Math.floor(totalDurationMs / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalDurationMs % (1000 * 60 * 60)) / (1000 * 60));

    // Active session info
    let activeSessionInfo = '';
    if (activeSession) {
      const now = new Date();
      const activeDurationMs = now.getTime() - activeSession.startTime.getTime();
      const activeDurationHours = Math.floor(activeDurationMs / (1000 * 60 * 60));
      const activeDurationMinutes = Math.floor((activeDurationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      activeSessionInfo = `\n\n**Aktív szolgálat:**\nKezdés: ${formatDateTime(activeSession.startTime)}\nIdőtartam: ${activeDurationHours}ó ${activeDurationMinutes}p`;
    }

    // Build history
    let historyInfo = '';
    if (sessions.length > 0) {
      historyInfo = '\n\n**Szolgálati előzmények:**\n';
      sessions.forEach((session, index) => {
        if (session.endTime) {
          const durationMs = session.endTime.getTime() - session.startTime.getTime();
          const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
          const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          
          historyInfo += `**${index + 1}.** ${formatDateTime(session.startTime)} - ${formatDateTime(session.endTime)} (${durationHours}ó ${durationMinutes}p)\n`;
        }
      });
    } else {
      historyInfo = '\n\nNincsenek korábbi szolgálati időszakok.';
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati előzmények')
      .setDescription(
        `**Összesítés:**\nÖsszes szolgálati idő: ${totalHours}ó ${totalMinutes}p\nBefejezett szolgálatok száma: ${sessions.length}${activeSessionInfo}${historyInfo}`
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
  else if (subcommand === 'export') {
    await interaction.deferReply({ ephemeral: true });
    const timeframe = interaction.options.getString('timeframe')!;
    
    // Calculate start date based on timeframe
    let startDate = new Date();
    let timeframeLabel = '';

    switch(timeframe) {
      case 'weekly':
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(startDate.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        timeframeLabel = 'weekly';
        break;
      case 'monthly':
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        timeframeLabel = 'monthly';
        break;
      case 'yearly':
        startDate = new Date(startDate.getFullYear(), 0, 1);
        timeframeLabel = 'yearly';
        break;
      case 'all':
      default:
        startDate = new Date(0); // January 1, 1970
        timeframeLabel = 'all_time';
        break;
    }

    // Get all duty sessions
    const sessions = await prisma.dutySession.findMany({
      where: {
        userId,
        guildId,
        startTime: {
          gte: startDate
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Create CSV content
    let csvContent = 'Session ID,Start Time,End Time,Duration (hours),Duration (minutes)\n';
    
    sessions.forEach(session => {
      const startTime = formatDateTime(session.startTime);
      const endTime = session.endTime ? formatDateTime(session.endTime) : 'Active';
      
      let durationHours = 0;
      let durationMinutes = 0;
      
      if (session.endTime) {
        const durationMs = session.endTime.getTime() - session.startTime.getTime();
        durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      }
      
      csvContent += `${session.id},"${startTime}","${endTime}",${durationHours},${durationMinutes}\n`;
    });
    
    // Write to temporary file
    const tempDir = os.tmpdir();
    const fileName = `duty_${userId}_${timeframeLabel}_${Date.now()}.csv`;
    const filePath = path.join(tempDir, fileName);
    
    try {
      fs.writeFileSync(filePath, csvContent);
      
      // Create attachment
      const attachment = new AttachmentBuilder(filePath)
        .setName(fileName)
        .setDescription('Duty time export');
      
      // Reply with file
      await interaction.editReply({
        content: `${sessions.length} szolgálati időszak exportálva.`,
        files: [attachment]
      });
      
      // Clean up file after sending
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error deleting temporary file:', error);
        }
      }, 5000);
    } catch (error) {
      console.error('Error creating CSV file:', error);
      await interaction.editReply({
        content: 'Hiba történt az exportálás során. Kérlek próbáld újra később.'
      });
    }
  }
  else if (subcommand === 'rank') {
    const timeframe = interaction.options.getString('timeframe')!;
    
    // Calculate start date based on timeframe
    let startDate = new Date();
    let timeframeLabel = '';

    switch(timeframe) {
      case 'weekly':
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(startDate.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        timeframeLabel = 'Ezen a héten';
        break;
      case 'monthly':
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        timeframeLabel = 'Ebben a hónapban';
        break;
      case 'yearly':
        startDate = new Date(startDate.getFullYear(), 0, 1);
        timeframeLabel = 'Idén';
        break;
      case 'all':
      default:
        startDate = new Date(0); // January 1, 1970
        timeframeLabel = 'Összes idő';
        break;
    }

    // Get all completed sessions in the timeframe
    const completedSessions = await prisma.dutySession.findMany({
      where: {
        guildId,
        startTime: {
          gte: startDate
        },
        endTime: {
          not: null
        }
      }
    });

    // Group by users and calculate durations
    const userStats: Record<string, number> = {};
    
    completedSessions.forEach(session => {
      if (session.endTime) {
        const durationMs = session.endTime.getTime() - session.startTime.getTime();
        
        if (!userStats[session.userId]) {
          userStats[session.userId] = 0;
        }
        
        userStats[session.userId] += durationMs;
      }
    });

    // Convert to array and sort by total time
    const sortedUsers = Object.entries(userStats)
      .map(([userId, totalMs]) => ({
        userId,
        totalMs
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    // Find the user's rank
    const userRank = sortedUsers.findIndex(user => user.userId === userId) + 1;
    
    // Calculate user's total time
    const userTotalMs = userStats[userId] || 0;
    const userTotalHours = Math.floor(userTotalMs / (1000 * 60 * 60));
    const userTotalMinutes = Math.floor((userTotalMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Create leaderboard slice around the user
    let leaderboardSlice = '';
    const totalUsers = sortedUsers.length;
    
    if (totalUsers === 0) {
      leaderboardSlice = 'Nincs adat ebben az időszakban.';
    } else {
      // Show users above and below the current user
      const startIndex = Math.max(0, userRank - 4);
      const endIndex = Math.min(totalUsers, userRank + 3);
      
      for (let i = startIndex; i < endIndex; i++) {
        const user = sortedUsers[i];
        const hours = Math.floor(user.totalMs / (1000 * 60 * 60));
        const minutes = Math.floor((user.totalMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (user.userId === userId) {
          // Highlight the current user
          leaderboardSlice += `**${i + 1}. <@${user.userId}>: ${hours}ó ${minutes}p** ← Te\n`;
        } else {
          leaderboardSlice += `${i + 1}. <@${user.userId}>: ${hours}ó ${minutes}p\n`;
        }
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Szolgálati toplista helyezésed - ${timeframeLabel}`)
      .setDescription(
        userRank > 0
          ? `A helyezésed a toplistán: **${userRank}** / ${totalUsers}\nSzolgálati időd: ${userTotalHours}ó ${userTotalMinutes}p\n\n${leaderboardSlice}`
          : 'Nincs szolgálati időd ebben az időszakban.'
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
  else if (subcommand === 'requirements') {
    // Check if requirements are enabled
    if (!settings?.requirementsEnabled) {
      return interaction.reply({
        content: 'Ezen a szerveren nincsenek beállítva szolgálati követelmények.',
        ephemeral: true
      });
    }
    
    // Get the current week and month start dates
    const now = new Date();
    
    // Weekly (Monday as start of week)
    const day = now.getDay();
    const weekDiff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), weekDiff);
    weekStart.setHours(0, 0, 0, 0);
    
    // Monthly
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    
    // Get sessions for current week
    const weekSessions = await prisma.dutySession.findMany({
      where: {
        userId,
        guildId,
        startTime: {
          gte: weekStart
        },
        endTime: {
          not: null
        }
      }
    });
    
    // Get sessions for current month
    const monthSessions = await prisma.dutySession.findMany({
      where: {
        userId,
        guildId,
        startTime: {
          gte: monthStart
        },
        endTime: {
          not: null
        }
      }
    });
    
    // Calculate weekly total hours
    let weeklyTotalMs = 0;
    weekSessions.forEach(session => {
      if (session.endTime) {
        weeklyTotalMs += session.endTime.getTime() - session.startTime.getTime();
      }
    });
    
    const weeklyHours = weeklyTotalMs / (1000 * 60 * 60);
    const weeklyRequirement = settings.requiredHoursWeekly || 0;
    const weeklyPercentage = weeklyRequirement > 0 ? Math.min(100, (weeklyHours / weeklyRequirement) * 100) : 100;
    
    // Calculate monthly total hours
    let monthlyTotalMs = 0;
    monthSessions.forEach(session => {
      if (session.endTime) {
        monthlyTotalMs += session.endTime.getTime() - session.startTime.getTime();
      }
    });
    
    const monthlyHours = monthlyTotalMs / (1000 * 60 * 60);
    const monthlyRequirement = settings.requiredHoursMonthly || 0;
    const monthlyPercentage = monthlyRequirement > 0 ? Math.min(100, (monthlyHours / monthlyRequirement) * 100) : 100;
    
    // Format the progress bars
    const weeklyBar = createProgressBar(weeklyPercentage);
    const monthlyBar = createProgressBar(monthlyPercentage);
    
    // Get the end of the current week and month
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati követelmények teljesítése')
      .setDescription(
        `Az elvárt szolgálati időd teljesítése:\n\n` +
        `**Heti követelmény (${formatDate(weekStart)} - ${formatDate(weekEnd)}):**\n` +
        `${weeklyBar} ${weeklyPercentage.toFixed(1)}%\n` +
        `${weeklyHours.toFixed(1)} / ${weeklyRequirement} óra\n\n` +
        `**Havi követelmény (${formatDate(monthStart)} - ${formatDate(monthEnd)}):**\n` +
        `${monthlyBar} ${monthlyPercentage.toFixed(1)}%\n` +
        `${monthlyHours.toFixed(1)} / ${monthlyRequirement} óra`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}

// Helper function to create a progress bar
function createProgressBar(percentage: number): string {
  const filledCount = Math.floor(percentage / 10);
  const emptyCount = 10 - filledCount;
  
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

// Helper functions
function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
} 