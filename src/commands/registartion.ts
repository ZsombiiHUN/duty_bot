import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import prisma from '../db';

// Use SlashCommandBuilder for full compatibility with Command interface
const data = new SlashCommandBuilder()
  .setName('dutyregisztracio')
  .setDescription('Regisztrálj szolgálatra a szükséges adatokkal!')
  .addStringOption(option =>
    option.setName('nev').setDescription('Teljes név').setRequired(true)
  )
  .addStringOption(option =>
    option.setName('fedonev').setDescription('Fedőnév (opcionális)').setRequired(false)
  )
  .addStringOption(option =>
    option.setName('jelvényszám').setDescription('Jelvényszám (opcionális)').setRequired(false)
  )
  .addStringOption(option =>
    option.setName('telefonszám').setDescription('Telefonszám (opcionális)').setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const fullName = interaction.options.getString('nev', true);
  const codename = interaction.options.getString('fedonev');
  const badgeNumber = interaction.options.getString('jelvényszám');
  const phoneNumber = interaction.options.getString('telefonszám');

  // Upsert profile
  await prisma.dutyProfile.upsert({
    where: { userId },
    update: { fullName, codename, badgeNumber, phoneNumber, guildId },
    create: { userId, guildId, fullName, codename, badgeNumber, phoneNumber },
  });

  await interaction.reply({
    content:
      `✅ Sikeres regisztráció!\n` +
      '```' +
      `${'Név'.padEnd(20)} | ${'Fedőnév'.padEnd(15)} | ${'Jelvényszám'.padEnd(12)} | ${'Telefonszám'.padEnd(14)} | Felhasználó\n` +
      `${'-'.repeat(20)}-|-${'-'.repeat(15)}-|-${'-'.repeat(12)}-|-${'-'.repeat(14)}-|----------------\n` +
      `${fullName.padEnd(20)} | ${(codename || '—').padEnd(15)} | ${(badgeNumber || '—').padEnd(12)} | ${(phoneNumber || '—').padEnd(14)} | <@${userId}>` +
      '```',
  });
}

// Export as Command object for compatibility
const command = {
  data: data as SlashCommandBuilder, // Explicit cast to resolve type
  execute,
};
export default command;
