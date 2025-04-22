import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import prisma from '../db';

export const data = new SlashCommandBuilder()
  .setName('dutyreport')
  .setDescription('Automated duty/compliance report scheduling')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('schedule')
      .setDescription('Ütemezett automatikus jelentés')
      .addStringOption(option =>
        option.setName('frequency').setDescription('Gyakoriság').setRequired(true)
          .addChoices(
            { name: 'Napi', value: 'daily' },
            { name: 'Heti', value: 'weekly' },
            { name: 'Havi', value: 'monthly' }
          )
      )
      .addChannelOption(option =>
        option.setName('channel').setDescription('Cél csatorna').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption(option =>
        option.setName('report_type').setDescription('Jelentés típusa').setRequired(true)
          .addChoices(
            { name: 'Toplista', value: 'leaderboard' },
            { name: 'Megfelelőség', value: 'compliance' },
            { name: 'Összegzés', value: 'summary' }
          )
      )
      .addStringOption(option =>
        option.setName('time_of_day').setDescription('Küldési idő (HH:mm)').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Ütemezett jelentések listázása')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Ütemezett jelentés törlése')
      .addIntegerOption(option =>
        option.setName('id').setDescription('Jelentés azonosítója').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'schedule') {
    const guildId = interaction.guildId!;
    const channel = interaction.options.getChannel('channel', true);
    const frequency = interaction.options.getString('frequency', true);
    const reportType = interaction.options.getString('report_type', true);
    const timeOfDay = interaction.options.getString('time_of_day', true);

    // Compute nextRun (today or tomorrow at timeOfDay)
    const [hour, minute] = timeOfDay.split(':').map(Number);
    const now = new Date();
    let nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (nextRun <= now) {
      // If time has already passed today, schedule for tomorrow
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const created = await prisma.autoReportSchedule.create({
      data: {
        guildId,
        channelId: channel.id,
        reportType,
        frequency,
        timeOfDay,
        nextRun,
        enabled: true
      }
    });
    await interaction.reply({ content: `Automatikus jelentés ütemezve: ${frequency}, ${reportType}, ${channel}, ${timeOfDay}. (ID: ${created.id})`, ephemeral: true });
  } else if (subcommand === 'list') {
    const guildId = interaction.guildId!;
    const reports = await prisma.autoReportSchedule.findMany({ where: { guildId } });
    if (reports.length === 0) {
      await interaction.reply({ content: 'Nincs ütemezett jelentés.', ephemeral: true });
      return;
    }
    const lines = reports.map((r: any) => `ID: ${r.id} | Típus: ${r.reportType} | Csatorna: <#${r.channelId}> | Gyakoriság: ${r.frequency} | Idő: ${r.timeOfDay} | Következő: ${r.nextRun.toLocaleString()} | Aktív: ${r.enabled ? 'igen' : 'nem'}`);
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  } else if (subcommand === 'remove') {
    const id = interaction.options.getInteger('id', true);
    const deleted = await prisma.autoReportSchedule.delete({ where: { id } });
    await interaction.reply({ content: `Jelentés törölve (ID: ${deleted.id})`, ephemeral: true });
  }
}

export default { data, execute };
