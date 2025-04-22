import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import prisma from '../db';

export const data = new SlashCommandBuilder()
  .setName('vakacio')
  .setDescription('Szabadság/elfoglaltság beállítása')
  .addSubcommand(subcommand =>
    subcommand
      .setName('hozzaad')
      .setDescription('Új szabadság vagy elfoglaltság hozzáadása')
      .addStringOption(option =>
        option.setName('kezdet').setDescription('Kezdő dátum (ÉÉÉÉ-HH-NN)').setRequired(true)
      )
      .addStringOption(option =>
        option.setName('vege').setDescription('Záró dátum (ÉÉÉÉ-HH-NN)').setRequired(true)
      )
      .addStringOption(option =>
        option.setName('indok').setDescription('Indoklás (opcionális)')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('listaz')
      .setDescription('Saját szabadságok/elfoglaltságok listázása')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('torol')
      .setDescription('Szabadság/elfoglaltság törlése')
      .addIntegerOption(option =>
        option.setName('id').setDescription('Szabadság azonosítója').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('admin-listaz')
      .setDescription('Összes szabadság/elfoglaltság listázása a szerveren (admin)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('admin-torol')
      .setDescription('Bármely szabadság/elfoglaltság törlése ID alapján (admin)')
      .addIntegerOption(option =>
        option.setName('id').setDescription('Szabadság azonosítója').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  if (subcommand === 'hozzaad') {
    const kezdet = interaction.options.getString('kezdet', true);
    const vege = interaction.options.getString('vege', true);
    const indok = interaction.options.getString('indok') || undefined;
    try {
      const startDate = new Date(kezdet);
      const endDate = new Date(vege);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        await interaction.reply({ content: 'Hibás dátumformátum. Használd: ÉÉÉÉ-HH-NN', ephemeral: true });
        return;
      }
      if (endDate < startDate) {
        await interaction.reply({ content: 'A záró dátum nem lehet korábbi, mint a kezdő dátum.', ephemeral: true });
        return;
      }
      const created = await prisma.userUnavailability.create({
        data: { userId, guildId, startDate, endDate, reason: indok }
      });
      await interaction.reply({ content: `Szabadság/elfoglaltság rögzítve (ID: ${created.id}, ${kezdet} - ${vege}${indok ? ', Indok: ' + indok : ''})`, ephemeral: true });
    } catch {
      await interaction.reply({ content: 'Hiba történt a rögzítés során.', ephemeral: true });
    }
  } else if (subcommand === 'listaz') {
    const list = await prisma.userUnavailability.findMany({ where: { userId, guildId } });
    if (list.length === 0) {
      await interaction.reply({ content: 'Nincs rögzített szabadságod vagy elfoglaltságod.', ephemeral: true });
      return;
    }
    const lines = list.map(v => `ID: ${v.id} | ${v.startDate.toISOString().slice(0,10)} - ${v.endDate.toISOString().slice(0,10)}${v.reason ? ' | Indok: ' + v.reason : ''}`);
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  } else if (subcommand === 'torol') {
    const id = interaction.options.getInteger('id', true);
    const found = await prisma.userUnavailability.findUnique({ where: { id } });
    if (!found || found.userId !== userId || found.guildId !== guildId) {
      await interaction.reply({ content: 'Nincs ilyen azonosítójú szabadságod vagy elfoglaltságod.', ephemeral: true });
      return;
    }
    await prisma.userUnavailability.delete({ where: { id } });
    await interaction.reply({ content: 'Szabadság/elfoglaltság törölve.', ephemeral: true });
  } else if (subcommand === 'admin-listaz') {
    // Only allow admins
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ content: 'Nincs jogosultságod ehhez a parancshoz.' });
      return;
    }
    const list = await prisma.userUnavailability.findMany({ where: { guildId } });
    if (list.length === 0) {
      await interaction.reply({ content: 'Nincs rögzített szabadság vagy elfoglaltság a szerveren.' });
      return;
    }
    const pad = (str: string, len: number) => str.padEnd(len, ' ');
    const rows = [
      `${pad('ID', 5)} | ${pad('Felhasználó', 20)} | ${pad('Kezdet', 10)} | ${pad('Vége', 10)} | Indok`,
      `${'-'.repeat(5)}-|-${'-'.repeat(20)}-|-${'-'.repeat(10)}-|-${'-'.repeat(10)}-|------`
    ];
    for (const v of list) {
      rows.push(
        `${pad(v.id.toString(), 5)} | ${pad((interaction.guild?.members.cache.get(v.userId)?.displayName || 'Ismeretlen'), 20)} | ${pad(v.startDate.toISOString().slice(0,10), 10)} | ${pad(v.endDate.toISOString().slice(0,10), 10)} | ${v.reason || '—'}`
      );
    }
    let table = '```' + rows.join('\n') + '```';
    if (table.length > 1900) {
      table = table.slice(0, 1890) + '\n... (túl sok szabadság, lista rövidítve)```';
    }
    await interaction.reply({ content: `**Szerver összes szabadsága/elfoglaltsága**\n${table}` });
    return;
  } else if (subcommand === 'admin-torol') {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ content: 'Nincs jogosultságod ehhez a parancshoz.' });
      return;
    }
    const id = interaction.options.getInteger('id', true);
    const found = await prisma.userUnavailability.findUnique({ where: { id } });
    if (!found || found.guildId !== guildId) {
      await interaction.reply({ content: 'Nincs ilyen azonosítójú szabadság vagy elfoglaltság a szerveren.' });
      return;
    }
    await prisma.userUnavailability.delete({ where: { id } });
    await interaction.reply({ content: `Szabadság/elfoglaltság törölve (ID: ${id}).` });
    return;
  }
}

export default { data, execute };
