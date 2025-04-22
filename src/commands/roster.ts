import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db';

export const data = new SlashCommandBuilder()
  .setName('roster')
  .setDescription('Adminisztrátori parancsok a szolgálati névsor kezeléséhez.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand.setName('list').setDescription('Felhasználók listázása a névsorban'))
  .addSubcommand(subcommand =>
    subcommand.setName('search')
      .setDescription('Felhasználó keresése név, fedőnév vagy jelvényszám alapján')
      .addStringOption(option =>
        option.setName('query').setDescription('Keresési kifejezés').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand.setName('remove')
      .setDescription('Felhasználó regisztrációjának törlése a névsorból')
      .addUserOption(option =>
        option.setName('user').setDescription('Törlendő felhasználó').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (sub === 'list') {
    const profiles = await prisma.dutyProfile.findMany({ where: { guildId } });
    if (profiles.length === 0) {
      await interaction.reply({ content: 'Nincs regisztrált felhasználó a névsorban.' });
      return;
    }
    // Build a code block table for the roster (monospaced columns), using display name
    const pad = (str: string, len: number) => str.padEnd(len, ' ');
    const rows = [
      `${pad('Név', 20)} | ${pad('Fedőnév', 15)} | ${pad('Jelvényszám', 12)} | ${pad('Telefonszám', 14)} | ${pad('Felhasználó', 20)}`,
      `${'-'.repeat(20)}-|-${'-'.repeat(15)}-|-${'-'.repeat(12)}-|-${'-'.repeat(14)}-|-${'-'.repeat(20)}`
    ];
    for (const p of profiles) {
      const displayName = interaction.guild?.members.cache.get(p.userId)?.displayName || 'Ismeretlen';
      rows.push(
        `${pad(p.fullName, 20)} | ${pad(p.codename || '—', 15)} | ${pad(p.badgeNumber || '—', 12)} | ${pad(p.phoneNumber || '—', 14)} | ${pad(displayName, 20)}`
      );
    }
    let table = '```' + rows.join('\n') + '```';
    if (table.length > 1900) {
      table = table.slice(0, 1890) + '\n... (túl sok felhasználó, lista rövidítve)```';
    }
    await interaction.reply({ content: `**Szolgálati névsor**\n${table}` });
  } else if (sub === 'search') {
    const query = interaction.options.getString('query', true).toLowerCase();
    const profiles = await prisma.dutyProfile.findMany({
      where: {
        guildId,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { codename: { contains: query, mode: 'insensitive' } },
          { badgeNumber: { contains: query, mode: 'insensitive' } }
        ]
      }
    });
    if (profiles.length === 0) {
      await interaction.reply({ content: 'Nincs találat a keresésre.' });
      return;
    }
    // Build a code block table for search results, using display name
    const pad = (str: string, len: number) => str.padEnd(len, ' ');
    const rows = [
      `${pad('Név', 20)} | ${pad('Fedőnév', 15)} | ${pad('Jelvényszám', 12)} | ${pad('Telefonszám', 14)} | ${pad('Felhasználó', 20)}`,
      `${'-'.repeat(20)}-|-${'-'.repeat(15)}-|-${'-'.repeat(12)}-|-${'-'.repeat(14)}-|-${'-'.repeat(20)}`
    ];
    for (const p of profiles) {
      const displayName = interaction.guild?.members.cache.get(p.userId)?.displayName || 'Ismeretlen';
      rows.push(
        `${pad(p.fullName, 20)} | ${pad(p.codename || '—', 15)} | ${pad(p.badgeNumber || '—', 12)} | ${pad(p.phoneNumber || '—', 14)} | ${pad(displayName, 20)}`
      );
    }
    let table = '```' + rows.join('\n') + '```';
    if (table.length > 1900) {
      table = table.slice(0, 1890) + '\n... (túl sok találat, lista rövidítve)```';
    }
    await interaction.reply({ content: `**Keresési eredmények a névsorban**\n${table}` });
  } else if (sub === 'remove') {
    const user = interaction.options.getUser('user', true);
    const deleted = await prisma.dutyProfile.deleteMany({ where: { userId: user.id, guildId } });
    if (deleted.count === 0) {
      await interaction.reply({ content: `Nem található regisztráció ehhez a felhasználóhoz: <@${user.id}>.` });
    } else {
      await interaction.reply({ content: `Regisztráció törölve: <@${user.id}>` });
    }
    return;
  }
}

// Export as Command object
const command = { data, execute };
export default command;
