import prisma from '../db';
import { Client, TextChannel } from 'discord.js';
import { handleLeaderboard } from '../commands/dutystats';

// Helper to parse HH:mm string
function getNextRunDate(timeOfDay: string, frequency: string): Date {
  const now = new Date();
  const [hour, minute] = timeOfDay.split(':').map(Number);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export async function startAutoReportScheduler(client: Client) {
  setInterval(async () => {
    const now = new Date();
    const dueReports = await prisma.autoReportSchedule.findMany({
      where: { enabled: true, nextRun: { lte: now } }
    });
    for (const report of dueReports) {
      try {
        const channel = await client.channels.fetch(report.channelId);
        if (!channel || channel.type !== 0) continue; // 0 = GuildText
        // Generate embed based on reportType
        // For simplicity, only leaderboard is implemented here
        if (report.reportType === 'leaderboard') {
          // Use current month as default timeframe
          const now = new Date();
          const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          const endDate = now;
          // Fake interaction object for reuse
          const interaction = {
            guildId: report.guildId,
            channel,
            user: { id: 'auto', username: 'Duty Bot' },
            client,
            reply: async (opts: any) => { await (channel as TextChannel).send(opts); },
          } as any;
          await handleLeaderboard(interaction, startDate, endDate, 'E hónap', 10);
        } else if (report.reportType === 'compliance') {
          // TODO: implement compliance report logic
        } else if (report.reportType === 'summary') {
          // TODO: implement summary report logic
        }
        // Update nextRun
        const nextRun = getNextRunDate(report.timeOfDay, report.frequency);
        await prisma.autoReportSchedule.update({ where: { id: report.id }, data: { lastRun: now, nextRun } });
      } catch (e) {
        // Optionally log errors
      }
    }
  }, 60 * 1000); // Check every minute
}
