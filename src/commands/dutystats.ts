import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  User, // Import User type
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
// import { PrismaClient } from '@prisma/client'; // Removed local instance import
import prisma from '../db'; // Import shared Prisma client
import logger from '../utils/logger'; // Import logger
import { parseDate, formatDate, getStartOfWeek, getStartOfMonth } from '../utils/dateTimeUtils'; // Import shared utils AND new helpers

// const prisma = new PrismaClient(); // Removed local instance creation
const DUTY_ROLE_ID = process.env.DUTY_ROLE_ID!; // Fallback for permission check

/**
 * Command definition for the /szolgstat command.
 * Provides various statistical views of duty time data for administrators.
 * Requires Administrator permissions or the configured duty role.
 */
export const data = new SlashCommandBuilder()
  .setName('szolgstat')
  .setDescription('Statisztikák, toplisták, megfelelőség szolgálati időkről.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(subcommand => 
    subcommand
      .setName('summary')
      .setDescription('Összesített szolgálati statisztikák')
      .addStringOption(option => 
        option
          .setName('timeframe')
          .setDescription('Időkeret')
          .setRequired(true)
          .addChoices(
            { name: 'Napi', value: 'daily' },
            { name: 'Heti', value: 'weekly' },
            { name: 'Havi', value: 'monthly' },
            { name: 'Összes', value: 'all' },
            { name: 'Egyéni', value: 'custom' }
          )
      )
      .addStringOption(option => 
        option
          .setName('start_date')
          .setDescription('Kezdő dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addStringOption(option => 
        option
          .setName('end_date')
          .setDescription('Záró dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('user')
          .setDescription('Felhasználó (opcionális)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('leaderboard')
      .setDescription('Toplista a legtöbb szolgálati idővel')
      .addStringOption(option => 
        option
          .setName('timeframe')
          .setDescription('Időkeret')
          .setRequired(true)
          .addChoices(
            { name: 'Napi', value: 'daily' },
            { name: 'Heti', value: 'weekly' },
            { name: 'Havi', value: 'monthly' },
            { name: 'Összes', value: 'all' },
            { name: 'Egyéni', value: 'custom' }
          )
      )
      .addStringOption(option => 
        option
          .setName('start_date')
          .setDescription('Kezdő dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addStringOption(option => 
        option
          .setName('end_date')
          .setDescription('Záró dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addIntegerOption(option => 
        option
          .setName('limit')
          .setDescription('Megjelenítendő felhasználók száma')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(30)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('compliance')
      .setDescription('Megjeleníti a felhasználók szolgálati követelményeknek való megfelelését')
      // No options needed for initial version
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('metrics')
      .setDescription('Részletes szolgálati metrikák')
      .addStringOption(option => 
        option
          .setName('timeframe')
          .setDescription('Időkeret')
          .setRequired(true)
          .addChoices(
            { name: 'Napi', value: 'daily' },
            { name: 'Heti', value: 'weekly' },
            { name: 'Havi', value: 'monthly' },
            { name: 'Összes', value: 'all' },
            { name: 'Egyéni', value: 'custom' }
          )
      )
      .addStringOption(option => 
        option
          .setName('start_date')
          .setDescription('Kezdő dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addStringOption(option => 
        option
          .setName('end_date')
          .setDescription('Záró dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
  );

/**
 * Executes the /szolgstat command based on the chosen subcommand.
 * Handles generating summaries, leaderboards, and detailed metrics for duty sessions.
 * Requires Administrator permissions or the configured duty role.
 * @param {ChatInputCommandInteraction} interaction - The command interaction object.
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has the required role
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  
  if (!member?.roles.cache.has(DUTY_ROLE_ID) && !member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'Nincs jogosultságod használni ezt a parancsot!',
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const timeframe = interaction.options.getString('timeframe')!;
  const startDateStr = interaction.options.getString('start_date');
  const endDateStr = interaction.options.getString('end_date');

  // Parse date range
  const { startDate, endDate, timeframeLabel, dateError } = getDateRange(timeframe, startDateStr, endDateStr);
  
  if (dateError) {
    return interaction.reply({
      content: dateError,
      ephemeral: true
    });
  }

  if (subcommand === 'summary') {
    const targetUser = interaction.options.getUser('user'); // Get the User object (or null)
    await handleSummary(interaction, startDate, endDate, timeframeLabel, targetUser); // Pass the User object directly
  } else if (subcommand === 'leaderboard') {
    const limit = interaction.options.getInteger('limit') || 10;
    await handleLeaderboard(interaction, startDate, endDate, timeframeLabel, limit);
  } else if (subcommand === 'metrics') {
    await handleMetrics(interaction, startDate, endDate, timeframeLabel);
  } else if (subcommand === 'compliance') {
    await handleCompliance(interaction); // Call the new handler
  }
}

/**
 * Handles the 'summary' subcommand.
 * Calculates and displays total duty time, session count, and active users
 * for a given timeframe, optionally filtered by user.
 * @param {ChatInputCommandInteraction} interaction - The interaction object.
 * @param {Date} startDate - The start date for the query range.
 * @param {Date} endDate - The end date for the query range.
 * @param {string} timeframeLabel - A label describing the timeframe (e.g., 'Weekly', 'Monthly').
 * @param {User | null} targetUser - Optional Discord User object to filter results for.
 */
export async function handleSummary(
  interaction: ChatInputCommandInteraction,
  startDate: Date,
  endDate: Date,
  timeframeLabel: string,
  targetUser: User | null // Changed parameter type
) {
  const guildId = interaction.guildId!;
  const userId = targetUser?.id; // Get userId from targetUser if provided

  // Build the query
  let query: any = {
    where: {
      guildId,
      startTime: {
        gte: startDate,
        lte: endDate
      }
    }
  };

  // Add user filter if specified
  if (userId) {
    query.where.userId = userId;
  }

  // Get completed sessions
  const completedSessions = await prisma.dutySession.findMany({
    ...query,
    where: {
      ...query.where,
      endTime: {
        not: null
      }
    }
  });

  // Group by users if not filtering for a specific user
  const userStats: Record<string, { totalMs: number, sessionCount: number }> = {};
  
  completedSessions.forEach(session => {
    if (session.endTime) {
      const durationMs = session.endTime.getTime() - session.startTime.getTime();
      
      if (!userStats[session.userId]) {
        userStats[session.userId] = {
          totalMs: 0,
          sessionCount: 0
        };
      }
      
      userStats[session.userId].totalMs += durationMs;
      userStats[session.userId].sessionCount += 1;
    }
  });

  // For a specific user
  if (userId) {
    const stats = userStats[userId] || { totalMs: 0, sessionCount: 0 };
    const totalHours = Math.floor(stats.totalMs / (1000 * 60 * 60));
    const totalMinutes = Math.floor((stats.totalMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Check for active session
    const activeSession = await prisma.dutySession.findFirst({
      where: {
        userId,
        guildId,
        endTime: null
      }
    });
    
    let activeSessionInfo = '';
    if (activeSession) {
      const now = new Date();
      const activeDurationMs = now.getTime() - activeSession.startTime.getTime();
      const activeDurationHours = Math.floor(activeDurationMs / (1000 * 60 * 60));
      const activeDurationMinutes = Math.floor((activeDurationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      activeSessionInfo = `\n\nJelenleg szolgálatban: ${activeDurationHours}ó ${activeDurationMinutes}p`;
    }

    // --- Requirements Calculation ---
    let requirementsInfo = '';
    try {
      const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
      if (settings?.requirementsEnabled && (settings.requiredHoursWeekly > 0 || settings.requiredHoursMonthly > 0)) {
        const now = new Date();
        const startOfWeek = getStartOfWeek();
        const startOfMonth = getStartOfMonth();

        // Calculate weekly time
        const weeklySessions = await prisma.dutySession.findMany({
          where: { userId, guildId, endTime: { not: null }, startTime: { gte: startOfWeek, lte: now } }
        });
        let weeklyMs = weeklySessions.reduce((sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()), 0);
        // Add active session time if it started this week
        if (activeSession && activeSession.startTime >= startOfWeek) {
          weeklyMs += now.getTime() - activeSession.startTime.getTime();
        }
        const weeklyHours = Math.floor(weeklyMs / (1000 * 60 * 60));
        const weeklyMinutes = Math.floor((weeklyMs % (1000 * 60 * 60)) / (1000 * 60));

        // Calculate monthly time
        const monthlySessions = await prisma.dutySession.findMany({
          where: { userId, guildId, endTime: { not: null }, startTime: { gte: startOfMonth, lte: now } }
        });
        let monthlyMs = monthlySessions.reduce((sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()), 0);
        // Add active session time if it started this month
        if (activeSession && activeSession.startTime >= startOfMonth) {
           monthlyMs += now.getTime() - activeSession.startTime.getTime();
        }
        const monthlyHours = Math.floor(monthlyMs / (1000 * 60 * 60));
        const monthlyMinutes = Math.floor((monthlyMs % (1000 * 60 * 60)) / (1000 * 60));

        requirementsInfo = '\n\n**Követelmények:**';
        if (settings.requiredHoursWeekly > 0) {
          requirementsInfo += `\nHeti: ${weeklyHours}ó ${weeklyMinutes}p / ${settings.requiredHoursWeekly}ó`;
        }
        if (settings.requiredHoursMonthly > 0) {
          requirementsInfo += `\nHavi: ${monthlyHours}ó ${monthlyMinutes}p / ${settings.requiredHoursMonthly}ó`;
        }
      }
    } catch (error) {
       console.error("Error fetching/calculating requirements:", error);
       requirementsInfo = '\n\n⚠️ Hiba a követelmények lekérésekor.';
    }
    // --- End Requirements Calculation ---

    // --- Build Embed for Specific User ---
    const embed = new EmbedBuilder()
      .setColor(0x0099FF) // Keep standard blue for now
      .setTitle(`📊 Szolgálati statisztika - ${targetUser?.username || 'Ismeretlen felhasználó'}`)
      .setDescription(`Időkeret: **${timeframeLabel}**`)
      .setThumbnail(targetUser?.displayAvatarURL({ extension: 'png', size: 128 }) || null)
      .setTimestamp()
      .addFields(
        { name: '⏰ Összes idő', value: `${totalHours} óra ${totalMinutes} perc`, inline: true },
        { name: '✅ Befejezett szolgálatok', value: `${stats.sessionCount} db`, inline: true }
      );

    // Add active session info if applicable
    if (activeSessionInfo) {
      // Extract duration from the existing string (a bit fragile, but avoids recalculating)
      const activeDurationMatch = activeSessionInfo.match(/(\d+)ó (\d+)p/);
      if (activeDurationMatch) {
        embed.addFields({ name: '🟢 Jelenleg szolgálatban', value: `${activeDurationMatch[1]} óra ${activeDurationMatch[2]} perc` });
      } else {
         embed.addFields({ name: '🟢 Jelenleg szolgálatban', value: `Igen` }); // Fallback
      }
    } else {
       embed.addFields({ name: '⚪ Jelenlegi állapot', value: `Nem szolgálatban` });
    }

    // Add requirements info if applicable
    if (requirementsInfo) {
      // Split the requirements string into lines and add as fields
      const reqLines = requirementsInfo.split('\n').filter(line => line.trim() !== '' && !line.startsWith('**') && !line.startsWith('⚠️'));
      if (reqLines.length > 0) {
          embed.addFields({ name: '🎯 Követelmények', value: reqLines.join('\n') || 'Nincs adat' });
      } else if (requirementsInfo.includes('⚠️')) {
          embed.addFields({ name: '🎯 Követelmények', value: '⚠️ Hiba a lekéréskor.' });
      }
    }

    await interaction.reply({ embeds: [embed] });

  }
  // For all users
  else {
    let totalUsers = Object.keys(userStats).length;
    let totalSessions = completedSessions.length;
    let totalMs = Object.values(userStats).reduce((sum, stat) => sum + stat.totalMs, 0);
    let totalHours = Math.floor(totalMs / (1000 * 60 * 60));
    let totalMinutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

    // Active sessions
    const activeSessions = await prisma.dutySession.findMany({
      where: {
        guildId,
        endTime: null
      },
      select: { userId: true } // Select only userId
    });

    const activeUserIds = activeSessions.map(s => s.userId);
    const activeUserMentions = activeUserIds.length > 0 ? activeUserIds.map(id => `<@${id}>`).join(', ') : 'Senki';

    // --- Build Embed for All Users ---
    const embed = new EmbedBuilder()
      .setColor(0x1F8B4C) // Use a slightly different color (e.g., green) for summary
      .setTitle(`📊 Összesített szolgálati statisztika`)
      .setDescription(`Időkeret: **${timeframeLabel}**\n*(${formatDate(startDate)} - ${formatDate(endDate)})*`)
      .setTimestamp()
      .addFields(
        { name: '⏰ Összes szolgálati idő', value: `${totalHours} óra ${totalMinutes} perc`, inline: true },
        { name: '👥 Felhasználók száma', value: `${totalUsers} fő`, inline: true },
        { name: '✅ Befejezett szolgálatok', value: `${totalSessions} db`, inline: true },
        { name: '🟢 Aktív szolgálatban', value: `${activeUserIds.length} fő`, inline: true },
        // Add a field for the list of active users, but only if there are any
        ...(activeUserIds.length > 0 ? [{ name: 'Aktív felhasználók', value: activeUserMentions }] : [])
      );

    await interaction.reply({ embeds: [embed] });
  }
}

/**
 * Handles the 'leaderboard' subcommand.
 * Calculates and displays a ranked list of users based on total duty time
 * within a given timeframe, with pagination, user highlighting, and more.
 * @param {ChatInputCommandInteraction} interaction - The interaction object.
 * @param {Date} startDate - The start date for the query range.
 * @param {Date} endDate - The end date for the query range.
 * @param {string} timeframeLabel - A label describing the timeframe.
 * @param {number} limit - The maximum number of users to display on the leaderboard (per page).
 */
export async function handleLeaderboard(
  interaction: any,
  startDate: Date,
  endDate: Date,
  timeframeLabel: string,
  limit: number = 10,
  page: number = 1
) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Get unavailable users in the period
  const unavailable = await prisma.userUnavailability.findMany({
    where: {
      guildId,
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        }
      ]
    },
    select: { userId: true }
  });
  const unavailableUserIds = new Set(unavailable.map(u => u.userId));

  // Get completed sessions, EXCLUDING unavailable users
  const completedSessions = await prisma.dutySession.findMany({
    where: {
      guildId,
      startTime: { gte: startDate, lte: endDate },
      endTime: { not: null },
      userId: { notIn: Array.from(unavailableUserIds) }
    }
  });

  // Group by users
  const userStats: Record<string, { totalMs: number, sessionCount: number, avgMs: number }> = {};

  completedSessions.forEach(session => {
    if (session.endTime) {
      const durationMs = session.endTime.getTime() - session.startTime.getTime();
      if (!userStats[session.userId]) {
        userStats[session.userId] = { totalMs: 0, sessionCount: 0, avgMs: 0 };
      }
      userStats[session.userId].totalMs += durationMs;
      userStats[session.userId].sessionCount += 1;
    }
  });

  // Calculate average for each user
  Object.keys(userStats).forEach(uid => {
    const stats = userStats[uid];
    stats.avgMs = stats.sessionCount > 0 ? stats.totalMs / stats.sessionCount : 0;
  });

  // Convert to array and sort by total time
  const sortedUsers = Object.entries(userStats)
    .map(([userId, stats]) => ({
      userId,
      totalMs: stats.totalMs,
      sessionCount: stats.sessionCount,
      avgMs: stats.avgMs,
      totalHours: Math.floor(stats.totalMs / (1000 * 60 * 60)),
      totalMinutes: Math.floor((stats.totalMs % (1000 * 60 * 60)) / (1000 * 60)),
      avgHours: Math.floor(stats.avgMs / (1000 * 60 * 60)),
      avgMinutes: Math.floor((stats.avgMs % (1000 * 60 * 60)) / (1000 * 60))
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  // Pagination
  const totalUsers = sortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / limit));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (currentPage - 1) * limit;
  const endIdx = startIdx + limit;
  const pageUsers = sortedUsers.slice(startIdx, endIdx);

  // Fetch usernames for this page and the requesting user (if not on this page)
  const userIdsToFetch = [...pageUsers.map(u => u.userId)];
  const requestingUserRank = sortedUsers.findIndex(u => u.userId === userId);
  let requestingUserStats = null;
  if (requestingUserRank !== -1 && (requestingUserRank < startIdx || requestingUserRank >= endIdx)) {
    userIdsToFetch.push(userId);
    requestingUserStats = sortedUsers[requestingUserRank];
  }
  // Fetch Discord user objects (cache first)
  const guild = await interaction.client.guilds.fetch(guildId);
  // Fix: use Promise.all to fetch members individually, as fetch({user: string[]}) is not supported
  const fetchedMembers = new Map();
  for (const uid of userIdsToFetch) {
    try {
      const member = await guild.members.fetch(uid);
      fetchedMembers.set(uid, member);
    } catch (e) {
      // If user left the server, fallback to mention
      fetchedMembers.set(uid, null);
    }
  }

  // --- Build Leaderboard Embed ---
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle(`🏆 Szolgálati toplista - ${timeframeLabel}`)
    .setDescription(`Időszak: *${formatDate(startDate)} - ${formatDate(endDate)}*\nTop ${limit} felhasználó (Oldal ${currentPage}/${totalPages}):`)
    .setTimestamp();

  if (sortedUsers.length === 0) {
    embed.addFields({ name: 'Nincs adat', value: 'Ebben az időszakban nem volt befejezett szolgálat.' });
  } else {
    // Add fields for each user on this page
    pageUsers.forEach((user, index) => {
      const rank = startIdx + index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const member = fetchedMembers.get(user.userId);
      const displayName = member ? member.displayName : `<@${user.userId}>`;
      const highlight = user.userId === userId ? ' **← Te**' : '';
      embed.addFields({
        name: `${medal} ${displayName}${highlight}`,
        value: `**${user.totalHours} óra ${user.totalMinutes} perc** (${user.sessionCount} szolgálat)\nÁtlag: ${user.avgHours}ó ${user.avgMinutes}p/szolgálat`,
        inline: false
      });
    });
    // If user's rank is not on this page, show them at the bottom
    if (requestingUserStats && requestingUserRank !== -1) {
      const member = fetchedMembers.get(userId);
      const displayName = member ? member.displayName : `<@${userId}>`;
      embed.addFields({
        name: `⋯ ${requestingUserRank + 1}. ${displayName} **← Te**`,
        value: `**${requestingUserStats.totalHours} óra ${requestingUserStats.totalMinutes} perc** (${requestingUserStats.sessionCount} szolgálat)\nÁtlag: ${requestingUserStats.avgHours}ó ${requestingUserStats.avgMinutes}p/szolgálat`,
        inline: false
      });
    }
  }

  // Add pagination buttons if needed
  const components = [];
  if (totalPages > 1) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`leaderboard_prev_${currentPage}_${limit}_${startDate.getTime()}_${endDate.getTime()}`)
        .setLabel('Előző')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`leaderboard_next_${currentPage}_${limit}_${startDate.getTime()}_${endDate.getTime()}`)
        .setLabel('Következő')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages)
    );
    components.push(row);
  }

  await interaction.reply({ embeds: [embed], components: components as any });
}

/**
 * Handles the 'metrics' subcommand.
 * Calculates and displays detailed duty metrics like total/average/median duration,
 * session counts, unique users, and peak activity times within a given timeframe.
 * @param {ChatInputCommandInteraction} interaction - The interaction object.
 * @param {Date} startDate - The start date for the query range.
 * @param {Date} endDate - The end date for the query range.
 * @param {string} timeframeLabel - A label describing the timeframe.
 */
async function handleMetrics(
  interaction: ChatInputCommandInteraction,
  startDate: Date,
  endDate: Date,
  timeframeLabel: string
) {
  const guildId = interaction.guildId!;
  
  // Get completed sessions within the timeframe
  const completedSessions = await prisma.dutySession.findMany({
    where: {
      guildId,
      startTime: {
        gte: startDate,
        lte: endDate
      },
      endTime: {
        not: null
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  });
  
  if (completedSessions.length === 0) {
    return interaction.reply({
      content: `Nincs adat ebben az időszakban: ${timeframeLabel} (${formatDate(startDate)} - ${formatDate(endDate)})`,
      ephemeral: true
    });
  }
  
  // Total metrics
  const totalSessions = completedSessions.length;
  let totalDurationMs = 0;
  const userSessions: Record<string, number> = {};
  const durations: number[] = [];
  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};
  
  // Calculate metrics
  completedSessions.forEach(session => {
    if (session.endTime) {
      // Total duration
      const durationMs = session.endTime.getTime() - session.startTime.getTime();
      totalDurationMs += durationMs;
      
      // Store all durations for average/median calculation
      durations.push(durationMs);
      
      // Count sessions per user
      userSessions[session.userId] = (userSessions[session.userId] || 0) + 1;
      
      // Count by day of week (0-6, where 0 is Sunday)
      const dayOfWeek = session.startTime.getDay();
      const dayName = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'][dayOfWeek];
      dayCount[dayName] = (dayCount[dayName] || 0) + 1;
      
      // Count by hour of day (0-23)
      const hour = session.startTime.getHours();
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    }
  });
  
  // Unique users count
  const uniqueUsers = Object.keys(userSessions).length;
  
  // Average session duration
  const avgDurationMs = totalDurationMs / totalSessions;
  const avgHours = Math.floor(avgDurationMs / (1000 * 60 * 60));
  const avgMinutes = Math.floor((avgDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  // Median session duration
  durations.sort((a, b) => a - b);
  const medianDurationMs = durations[Math.floor(durations.length / 2)];
  const medianHours = Math.floor(medianDurationMs / (1000 * 60 * 60));
  const medianMinutes = Math.floor((medianDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  // Find peak days and hours
  const peakDay = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([day, count]) => `${day} (${count} szolgálat)`)
    .join(', ');
  
  const peakHours = Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => `${hour}:00 (${count} szolgálat)`)
    .join(', ');
  
  // Format metrics
  const totalHours = Math.floor(totalDurationMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor((totalDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  // --- Build Metrics Embed ---
  const embed = new EmbedBuilder()
    .setColor(0x3498DB) // Yet another color (e.g., lighter blue) for metrics
    .setTitle(`📈 Részletes szolgálati metrikák - ${timeframeLabel}`)
    .setDescription(`Időszak: *${formatDate(startDate)} - ${formatDate(endDate)}*`)
    .setTimestamp()
    .addFields(
      // General Stats (inline where appropriate)
      { name: '📊 Összes szolgálati idő', value: `${totalHours} óra ${totalMinutes} perc`, inline: true },
      { name: '✅ Összes szolgálat', value: `${totalSessions} db`, inline: true },
      { name: '👥 Egyedi felhasználók', value: `${uniqueUsers} fő`, inline: true },

      // Durations (inline)
      { name: '⏱️ Átlagos időtartam', value: `${avgHours} óra ${avgMinutes} perc`, inline: true },
      { name: '⚖️ Medián időtartam', value: `${medianHours} óra ${medianMinutes} perc`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true }, // Spacer field if needed

      // Peak Times (not inline)
      { name: '☀️ Legnépszerűbb nap', value: peakDay || 'Nincs adat', inline: false },
      { name: '🕒 Legnépszerűbb órák', value: peakHours || 'Nincs adat', inline: false }
    );

  await interaction.reply({ embeds: [embed] });
}

/**
 * Handles the 'compliance' subcommand.
 * Fetches users with the duty role and checks their duty time against
 * configured weekly and monthly requirements.
 * @param {ChatInputCommandInteraction} interaction - The interaction object.
 */
export async function handleCompliance(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  logger.info(`[handleCompliance] Starting compliance check for guild ${guildId}`);
  await interaction.deferReply({ ephemeral: true }); // Defer reply ephemerally

  // 1. Fetch Guild Settings
  logger.info(`[handleCompliance] Fetching settings for guild ${guildId}`);
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });
  logger.info(`[handleCompliance] Settings fetched for guild ${guildId}`);

  if (!settings?.requirementsEnabled) {
    return interaction.editReply({ content: '⚠️ A szolgálati követelmények nincsenek engedélyezve ezen a szerveren.' });
  }
  if (!settings.dutyRoleId) {
    return interaction.editReply({ content: '⚠️ A szolgálati jogosultság szerep nincs beállítva. A megfelelőség nem ellenőrizhető.' });
  }
  if (settings.requiredHoursWeekly <= 0 && settings.requiredHoursMonthly <= 0) {
     return interaction.editReply({ content: '⚠️ Nincsenek heti vagy havi követelmények beállítva (0 óra).' });
  }

  const dutyRoleId = settings.dutyRoleId;
  const requiredWeekly = settings.requiredHoursWeekly;
  const requiredMonthly = settings.requiredHoursMonthly;

  // 2. Fetch Members with Duty Role
  try {
    logger.info(`[handleCompliance] Fetching duty role ${dutyRoleId}`);
    const dutyRole = await interaction.guild?.roles.fetch(dutyRoleId);

    if (!dutyRole) {
        logger.error(`[handleCompliance] Duty role ${dutyRoleId} not found in guild ${guildId}`);
        return interaction.editReply({ content: `⚠️ Hiba: A ${dutyRoleId} azonosítójú szolgálati szerep nem található.` });
    }
    logger.info(`[handleCompliance] Duty role "${dutyRole.name}" fetched. Accessing members from role cache.`);

    // Get member IDs directly from the role's member cache
    const dutyMemberIds = dutyRole.members
        .filter(member => !member.user.bot) // Filter out bots
        .map(member => member.id);

    logger.info(`[handleCompliance] Found ${dutyMemberIds.length} members in duty role cache "${dutyRole.name}"`);

    if (dutyMemberIds.length === 0) {
      // Use the role name in the reply for clarity
      return interaction.editReply({ content: `ℹ️ Nem található felhasználó a <@&${dutyRoleId}> (${dutyRole.name}) szereppel.` });
    }

    // Get unavailable users for the month (any overlap)
    const unavailable = await prisma.userUnavailability.findMany({
      where: {
        guildId,
        OR: [
          {
            startDate: { lte: new Date() },
            endDate: { gte: getStartOfMonth() }
          }
        ]
      },
      select: { userId: true }
    });
    const unavailableUserIds = new Set(unavailable.map(u => u.userId));
    // Remove unavailable users from dutyMemberIds
    const filteredDutyMemberIds = dutyMemberIds.filter(id => !unavailableUserIds.has(id));
    if (filteredDutyMemberIds.length === 0) {
      return interaction.editReply({ content: `ℹ️ Nincs aktív, elérhető felhasználó a <@&${dutyRoleId}> (${dutyRole.name}) szereppel ebben az időszakban.` });
    }

    // 3. Fetch all relevant sessions for these members in fewer queries
    const now = new Date();
    const startOfWeek = getStartOfWeek();
    const startOfMonth = getStartOfMonth();

    // Fetch completed sessions within the month (covers weekly as well)
    logger.info(`[handleCompliance] Fetching completed sessions since ${startOfMonth.toISOString()} for ${filteredDutyMemberIds?.length} users`);
    const completedSessionsThisMonth = await prisma.dutySession.findMany({
        where: {
            guildId,
            userId: { in: filteredDutyMemberIds },
            endTime: { not: null },
            startTime: { gte: startOfMonth } // Fetch since start of month
        },
        select: { userId: true, startTime: true, endTime: true }
    });
    logger.info(`[handleCompliance] Fetched ${completedSessionsThisMonth.length} completed sessions`);

    // Fetch active sessions for these members
    logger.info(`[handleCompliance] Fetching active sessions for ${filteredDutyMemberIds?.length} users`);
    const activeSessions = await prisma.dutySession.findMany({
        where: {
            guildId,
            userId: { in: filteredDutyMemberIds },
            endTime: null
        },
        select: { userId: true, startTime: true }
    });
    logger.info(`[handleCompliance] Fetched ${activeSessions.length} active sessions`);

    // 4. Process Data In Memory
    logger.info(`[handleCompliance] Processing session data in memory`);
    const userCompliance: Record<string, { weeklyMs: number; monthlyMs: number }> = {};

    // Initialize for all duty members
    filteredDutyMemberIds.forEach(id => {
        userCompliance[id] = { weeklyMs: 0, monthlyMs: 0 };
    });

    // Process completed sessions
    completedSessionsThisMonth.forEach(session => {
        if (!session.endTime) return; // Should not happen based on query, but safety check
        const durationMs = session.endTime.getTime() - session.startTime.getTime();
        const userId = session.userId;

        if (userCompliance[userId]) {
             userCompliance[userId].monthlyMs += durationMs;
             // Add to weekly total only if session started within the current week
             if (session.startTime >= startOfWeek) {
                 userCompliance[userId].weeklyMs += durationMs;
             }
        }
    });

    // Process active sessions
    activeSessions.forEach(session => {
        const userId = session.userId;
        if (userCompliance[userId]) {
            const activeDurationMs = now.getTime() - session.startTime.getTime();
            if (session.startTime >= startOfWeek) {
                userCompliance[userId].weeklyMs += activeDurationMs;
            }
            // Active session always counts towards monthly if started within the month
            if (session.startTime >= startOfMonth) {
                 userCompliance[userId].monthlyMs += activeDurationMs;
            }
        }
    });

    // Convert ms to hours for results
    const complianceResults = Object.entries(userCompliance).map(([userId, stats]) => ({
        userId,
        weekly: stats.weeklyMs / (1000 * 60 * 60),
        monthly: stats.monthlyMs / (1000 * 60 * 60)
    }));
    logger.info(`[handleCompliance] Finished processing session data`);


    // 5. Format Embed
    logger.info(`[handleCompliance] Formatting embed`);
    // Sort results (e.g., by weekly compliance percentage, descending)
    complianceResults.sort((a, b) => {
        const percA = requiredWeekly > 0 ? (a.weekly / requiredWeekly) : 1;
        const percB = requiredWeekly > 0 ? (b.weekly / requiredWeekly) : 1;
        return percB - percA; // Sort descending by weekly percentage
    });


    let description = `**Heti követelmény:** ${requiredWeekly > 0 ? `${requiredWeekly} óra` : 'Nincs'}\n` +
                      `**Havi követelmény:** ${requiredMonthly > 0 ? `${requiredMonthly} óra` : 'Nincs'}\n\n`;

    // Handle pagination if too many users (simple approach for now: limit display)
    const displayLimit = 25; // Embed field limit
    const resultsToShow = complianceResults.slice(0, displayLimit);

    resultsToShow.forEach(result => {
      const weeklyStatus = requiredWeekly > 0 ? (result.weekly >= requiredWeekly ? '✅' : '⚠️') : '➖';
      const monthlyStatus = requiredMonthly > 0 ? (result.monthly >= requiredMonthly ? '✅' : '⚠️') : '➖';

      description += `<@${result.userId}>:\n` +
                     `  Heti: ${weeklyStatus} ${result.weekly.toFixed(1)} / ${requiredWeekly > 0 ? requiredWeekly.toFixed(1) : '-'} óra\n` +
                     `  Havi: ${monthlyStatus} ${result.monthly.toFixed(1)} / ${requiredMonthly > 0 ? requiredMonthly.toFixed(1) : '-'} óra\n`;
    });

     if (complianceResults.length > displayLimit) {
        description += `\n*...és további ${complianceResults.length - displayLimit} felhasználó.*`;
    }


    const embed = new EmbedBuilder()
      .setColor(0x4CAF50) // Green color for compliance theme
      .setTitle('📊 Szolgálati Követelmények Megfelelése')
      .setDescription(description)
      .setFooter({ text: `Ellenőrzés időpontja` })
      .setTimestamp();

    logger.info(`[handleCompliance] Sending final reply`);
    await interaction.editReply({ embeds: [embed] });
    logger.info(`[handleCompliance] Compliance check finished successfully for guild ${guildId}`);

  } catch (error) {
    logger.error("[handleCompliance] Error during compliance check:", { error, guildId });
    // Try to edit reply even on error, if possible
    if (!interaction.replied && !interaction.deferred) {
        // This case should ideally not happen due to deferReply, but as a fallback
        await interaction.reply({ content: '❌ Hiba történt a megfelelőség ellenőrzése közben.', ephemeral: true }).catch(e => logger.error("Error sending initial error reply:", e));
    } else {
        await interaction.editReply({ content: '❌ Hiba történt a megfelelőség ellenőrzése közben.' }).catch(e => logger.error("Error sending edit error reply:", e));
    }
  }
}

/**
 * Calculates the start and end dates based on a timeframe string or custom dates.
 * @param {string} timeframe - The selected timeframe ('daily', 'weekly', 'monthly', 'all', 'custom').
 * @param {string | null | undefined} startDateStr - The start date string for 'custom' timeframe (YYYY-MM-DD).
 * @param {string | null | undefined} endDateStr - The end date string for 'custom' timeframe (YYYY-MM-DD).
 * @returns {{ startDate: Date, endDate: Date, timeframeLabel: string, dateError?: string }} Object containing dates, label, and optional error message.
 * @private
 */
function getDateRange(timeframe: string, startDateStr?: string | null, endDateStr?: string | null): {
  startDate: Date,
  endDate: Date, 
  timeframeLabel: string,
  dateError?: string
} {
  let startDate = new Date();
  let endDate = new Date();
  let timeframeLabel = '';

  if (timeframe === 'custom') {
    if (!startDateStr) {
      return { 
        startDate, 
        endDate, 
        timeframeLabel: '',
        dateError: 'Kezdő dátum megadása kötelező egyéni időkerethez.' 
      };
    }

    try {
      startDate = parseDate(startDateStr); // Use imported parseDate
      // startDate.setHours(0, 0, 0, 0); // parseDate already sets time to 00:00

      if (endDateStr) {
        endDate = parseDate(endDateStr); // Use imported parseDate
        endDate.setHours(23, 59, 59, 999); // Set end date to end of day
      } else {
        // If no end date is provided, use the current date
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      }

      if (startDate > endDate) {
        return { 
          startDate, 
          endDate, 
          timeframeLabel: '',
          dateError: 'A kezdő dátum nem lehet későbbi, mint a záró dátum.' 
        };
      }

      timeframeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`; // Use imported formatDate
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen dátumhiba';
      return { 
        startDate, 
        endDate, 
        timeframeLabel: '',
        dateError: message // Pass specific error message
      };
    }
  } else {
    // Calculate start date based on timeframe
    endDate.setHours(23, 59, 59, 999); // End of current day

    switch(timeframe) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        timeframeLabel = 'Mai nap';
        break;
      case 'weekly':
        // Get the first day of the week (Monday)
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
      case 'all':
        startDate = new Date(0); // January 1, 1970
        timeframeLabel = 'Összes idő';
        break;
    }
  }

  return { startDate, endDate, timeframeLabel };
}
