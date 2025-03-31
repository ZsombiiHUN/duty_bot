import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DUTY_ROLE_ID = '1181694226761789592';

export const data = new SlashCommandBuilder()
  .setName('dutystats')
  .setDescription('Szolgálati idő statisztikák adminisztrátoroknak')
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
    const targetUser = interaction.options.getUser('user');
    await handleSummary(interaction, startDate, endDate, timeframeLabel, targetUser?.id);
  } else if (subcommand === 'leaderboard') {
    const limit = interaction.options.getInteger('limit') || 10;
    await handleLeaderboard(interaction, startDate, endDate, timeframeLabel, limit);
  } else if (subcommand === 'metrics') {
    await handleMetrics(interaction, startDate, endDate, timeframeLabel);
  }
}

async function handleSummary(
  interaction: ChatInputCommandInteraction, 
  startDate: Date,
  endDate: Date,
  timeframeLabel: string,
  userId?: string
) {
  const guildId = interaction.guildId!;

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
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Szolgálati statisztika - ${timeframeLabel}`)
      .setDescription(`<@${userId}> szolgálati ideje:\n\nÖsszes szolgálati idő: ${totalHours}ó ${totalMinutes}p\nBefejezett szolgálatok száma: ${stats.sessionCount}${activeSessionInfo}`)
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
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
      }
    });
    
    const activeUsers = activeSessions.map(s => s.userId);
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Szolgálati statisztika - ${timeframeLabel}`)
      .setDescription(
        `Összesített statisztikák:\n\n` +
        `Időszak: ${formatDate(startDate)} - ${formatDate(endDate)}\n` +
        `Összes szolgálati idő: ${totalHours}ó ${totalMinutes}p\n` +
        `Felhasználók száma: ${totalUsers}\n` +
        `Befejezett szolgálatok száma: ${totalSessions}\n` +
        `Aktív szolgálatban lévők: ${activeUsers.length} fő\n\n` +
        (activeUsers.length > 0 ? 
          `Jelenleg szolgálatban: ${activeUsers.map(id => `<@${id}>`).join(', ')}` : 
          'Jelenleg senki nincs szolgálatban.')
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
}

async function handleLeaderboard(
  interaction: ChatInputCommandInteraction, 
  startDate: Date,
  endDate: Date,
  timeframeLabel: string,
  limit: number
) {
  const guildId = interaction.guildId!;

  // Get completed sessions
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
    }
  });

  // Group by users
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

  // Convert to array and sort by total time
  const sortedUsers = Object.entries(userStats)
    .map(([userId, stats]) => ({
      userId,
      totalMs: stats.totalMs,
      sessionCount: stats.sessionCount,
      totalHours: Math.floor(stats.totalMs / (1000 * 60 * 60)),
      totalMinutes: Math.floor((stats.totalMs % (1000 * 60 * 60)) / (1000 * 60))
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  // Create leaderboard description
  let description = `Top szolgálati idők - ${timeframeLabel}\nIdőszak: ${formatDate(startDate)} - ${formatDate(endDate)}\n\n`;
  
  if (sortedUsers.length === 0) {
    description += 'Nincs adat ebben az időszakban.';
  } else {
    sortedUsers.slice(0, limit).forEach((user, index) => {
      description += `${index + 1}. <@${user.userId}>: ${user.totalHours}ó ${user.totalMinutes}p (${user.sessionCount} szolgálat)\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`Szolgálati toplista - ${timeframeLabel}`)
    .setDescription(description)
    .setTimestamp();

  await interaction.reply({
    embeds: [embed]
  });
}

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
  
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`Részletes szolgálati metrikák - ${timeframeLabel}`)
    .setDescription(
      `Időszak: ${formatDate(startDate)} - ${formatDate(endDate)}\n\n` +
      `**Általános statisztikák:**\n` +
      `Összes szolgálati idő: ${totalHours}ó ${totalMinutes}p\n` +
      `Összes szolgálat: ${totalSessions}\n` +
      `Egyedi felhasználók: ${uniqueUsers}\n\n` +
      
      `**Szolgálati időtartamok:**\n` +
      `Átlagos szolgálati idő: ${avgHours}ó ${avgMinutes}p\n` +
      `Medián szolgálati idő: ${medianHours}ó ${medianMinutes}p\n\n` +
      
      `**Kiemelt időszakok:**\n` +
      `Legnépszerűbb nap: ${peakDay}\n` +
      `Legnépszerűbb órák: ${peakHours}`
    )
    .setTimestamp();
  
  await interaction.reply({
    embeds: [embed]
  });
}

// Helper functions
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
      startDate = parseDate(startDateStr);
      startDate.setHours(0, 0, 0, 0);

      if (endDateStr) {
        endDate = parseDate(endDateStr);
        endDate.setHours(23, 59, 59, 999);
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

      timeframeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } catch (error) {
      return { 
        startDate, 
        endDate, 
        timeframeLabel: '',
        dateError: 'Érvénytelen dátum formátum. Használd a YYYY-MM-DD formátumot.' 
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

function parseDate(dateStr: string): Date {
  // Format: YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  
  if (!match) {
    throw new Error('Invalid date format');
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-based months
  const day = parseInt(match[3]);
  
  const date = new Date(year, month, day);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  return date;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
} 