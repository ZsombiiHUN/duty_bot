import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import prisma from '../db';
import logger from '../utils/logger';
import { getStartOfWeek, getStartOfMonth } from '../utils/dateTimeUtils';

/**
 * Checks duty time requirements for users in relevant guilds and sends reminders if needed.
 * @param {Client} client - The Discord client instance.
 */
export async function checkDutyRequirements(client: Client): Promise<void> {
  logger.info('[ReqCheck] Starting duty requirement check...');
  const now = new Date();

  try {
    // 1. Find guilds with requirements enabled
    const guildsSettings = await prisma.guildSettings.findMany({
      where: {
        requirementsEnabled: true,
        dutyRoleId: { not: null }, // Need a duty role to find members
        OR: [
          { requiredHoursWeekly: { gt: 0 } },
          { requiredHoursMonthly: { gt: 0 } },
        ],
      },
    });

    logger.info(`[ReqCheck] Found ${guildsSettings.length} guilds with requirements enabled.`);

    for (const settings of guildsSettings) {
      const guildId = settings.guildId;
      const dutyRoleId = settings.dutyRoleId!; // Not null due to query filter
      const requiredWeekly = settings.requiredHoursWeekly;
      const requiredMonthly = settings.requiredHoursMonthly;
      const reminderChannelId = settings.requirementsChannelId; // Channel for public reminders

      logger.info(`[ReqCheck] Processing guild ${guildId}. Weekly: ${requiredWeekly}h, Monthly: ${requiredMonthly}h`);

      // 2. Fetch the guild and the duty role
      const guild = await client.guilds.fetch(guildId).catch(err => {
        logger.error(`[ReqCheck] Failed to fetch guild ${guildId}:`, err);
        return null;
      });
      if (!guild) continue; // Skip if guild fetch fails

      const dutyRole = await guild.roles.fetch(dutyRoleId).catch(err => {
         logger.error(`[ReqCheck] Failed to fetch duty role ${dutyRoleId} in guild ${guildId}:`, err);
         return null;
      });
       if (!dutyRole) {
           logger.warn(`[ReqCheck] Duty role ${dutyRoleId} not found in guild ${guildId}, skipping guild.`);
           continue; // Skip if role fetch fails
       }

      // 3. Get members with the duty role
      const dutyMemberIds = dutyRole.members
        .filter(member => !member.user.bot)
        .map(member => member.id);

      if (dutyMemberIds.length === 0) {
        logger.info(`[ReqCheck] No members found with duty role ${dutyRole.name} in guild ${guildId}.`);
        continue; // Skip if no members have the role
      }

      logger.info(`[ReqCheck] Found ${dutyMemberIds.length} members with duty role in guild ${guildId}. Fetching sessions...`);

      // 4. Fetch relevant sessions efficiently
      const startOfWeek = getStartOfWeek();
      const startOfMonth = getStartOfMonth();

      const sessionsThisMonth = await prisma.dutySession.findMany({
        where: {
          guildId,
          userId: { in: dutyMemberIds },
          // Fetch sessions that started this month OR ended this month OR are still active
          OR: [
            { startTime: { gte: startOfMonth } },
            { endTime: { gte: startOfMonth } },
            { endTime: null } // Include active sessions
          ]
        },
        select: { userId: true, startTime: true, endTime: true }
      });

      logger.info(`[ReqCheck] Fetched ${sessionsThisMonth.length} potentially relevant sessions for guild ${guildId}. Processing...`);


      // 5. Calculate time and check compliance for each member
      const userDutyTime: Record<string, { weeklyMs: number; monthlyMs: number }> = {};
      dutyMemberIds.forEach(id => { userDutyTime[id] = { weeklyMs: 0, monthlyMs: 0 }; });

      sessionsThisMonth.forEach(session => {
        const userId = session.userId;
        if (!userDutyTime[userId]) return; // Should not happen, but safety check

        const sessionEnd = session.endTime ?? now; // Use 'now' if session is active

        // Calculate overlap with the current month
        const monthOverlapStart = Math.max(session.startTime.getTime(), startOfMonth.getTime());
        const monthOverlapEnd = Math.min(sessionEnd.getTime(), now.getTime()); // Cap at 'now'
        if (monthOverlapEnd > monthOverlapStart) {
            const monthlyDuration = monthOverlapEnd - monthOverlapStart;
            userDutyTime[userId].monthlyMs += monthlyDuration;

            // Calculate overlap with the current week (only if it contributed to monthly)
            const weekOverlapStart = Math.max(session.startTime.getTime(), startOfWeek.getTime());
             const weekOverlapEnd = Math.min(sessionEnd.getTime(), now.getTime()); // Cap at 'now'
             if (weekOverlapEnd > weekOverlapStart) {
                 userDutyTime[userId].weeklyMs += (weekOverlapEnd - weekOverlapStart);
             }
        }
      });

      // 6. Determine who needs reminders and send them
      // Basic reminder logic: Send if below threshold on specific days (e.g., Friday for weekly, last 3 days for monthly)
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const dateOfMonth = now.getDate();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const sendWeeklyReminder = requiredWeekly > 0 && (dayOfWeek === 5 || dayOfWeek === 6); // Fri or Sat
      const sendMonthlyReminder = requiredMonthly > 0 && (dateOfMonth >= endOfMonth - 2); // Last 3 days

      let remindersSentCount = 0;
      const lowPerformersWeekly: string[] = [];
      const lowPerformersMonthly: string[] = [];

      for (const userId of dutyMemberIds) {
        const weeklyHours = userDutyTime[userId].weeklyMs / (1000 * 60 * 60);
        const monthlyHours = userDutyTime[userId].monthlyMs / (1000 * 60 * 60);
        let reminderNeeded = false;
        let reminderMessage = `**Szolgálati idő emlékeztető ( ${guild.name} )**\n`;

        if (sendWeeklyReminder && weeklyHours < requiredWeekly) {
          reminderNeeded = true;
          reminderMessage += `\n📉 **Heti:** ${weeklyHours.toFixed(1)} / ${requiredWeekly.toFixed(1)} óra teljesítve.`;
          lowPerformersWeekly.push(`<@${userId}> (${weeklyHours.toFixed(1)}h)`);
        }
        if (sendMonthlyReminder && monthlyHours < requiredMonthly) {
          reminderNeeded = true;
          reminderMessage += `\n📉 **Havi:** ${monthlyHours.toFixed(1)} / ${requiredMonthly.toFixed(1)} óra teljesítve.`;
           if (!lowPerformersWeekly.includes(`<@${userId}> (${weeklyHours.toFixed(1)}h)`)) { // Avoid duplicate listing if low on both
               lowPerformersMonthly.push(`<@${userId}> (${monthlyHours.toFixed(1)}h)`);
           }
        }

        if (reminderNeeded) {
          try {
            const member = await guild.members.fetch(userId);
            await member.send(reminderMessage);
            remindersSentCount++;
            logger.info(`[ReqCheck] Sent reminder DM to user ${userId} in guild ${guildId}`);
          } catch (error) {
            logger.error(`[ReqCheck] Failed to send reminder DM to user ${userId} in guild ${guildId}:`, error);
            // Consider logging this failure to the reminder channel if DMs fail
          }
        }
      }

       // Send summary to reminder channel if configured
       if (reminderChannelId && (lowPerformersWeekly.length > 0 || lowPerformersMonthly.length > 0)) {
           try {
               const channel = await guild.channels.fetch(reminderChannelId);
               if (channel instanceof TextChannel) { // Check if it's a TextChannel
                   const embed = new EmbedBuilder()
                       .setColor(0xFFA500) // Orange
                       .setTitle('📉 Szolgálati Követelmény Emlékeztető')
                       .setTimestamp();

                   if (lowPerformersWeekly.length > 0) {
                       embed.addFields({ name: `Heti követelmény alatt (${requiredWeekly} óra)`, value: lowPerformersWeekly.join('\n') || 'Senki' });
                   }
                   if (lowPerformersMonthly.length > 0) {
                       embed.addFields({ name: `Havi követelmény alatt (${requiredMonthly} óra)`, value: lowPerformersMonthly.join('\n') || 'Senki' });
                   }

                   await channel.send({ embeds: [embed] });
                   logger.info(`[ReqCheck] Sent summary reminder to channel ${reminderChannelId} in guild ${guildId}`);
               } else {
                    logger.warn(`[ReqCheck] Configured reminder channel ${reminderChannelId} is not a text channel in guild ${guildId}.`);
               }
           } catch (error) {
                logger.error(`[ReqCheck] Failed to send summary reminder to channel ${reminderChannelId} in guild ${guildId}:`, error);
           }
       }


      logger.info(`[ReqCheck] Finished processing guild ${guildId}. Sent ${remindersSentCount} DMs.`);
    } // End guild loop

  } catch (error) {
    logger.error('[ReqCheck] Unhandled error during requirement check:', error);
  } finally {
      logger.info('[ReqCheck] Duty requirement check finished.');
  }
}
