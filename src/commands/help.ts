import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

// It's good practice to define the permissions clearly
const ADMIN_PERM = 'Adminisztrátor';
const DUTY_ROLE_OR_ADMIN_PERM = 'Szolgálati Szerep vagy Adminisztrátor';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Megjeleníti az összes elérhető parancsot és a szükséges jogosultságokat.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x3498DB) // A nice blue color
    .setTitle('🤖 Parancsok és Jogosultságok')
    .setDescription('Itt találod az elérhető parancsokat és a használatukhoz szükséges jogosultságokat.')
    .addFields(
      { name: '/duty', value: `Szolgálati irányítópult megjelenítése.\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, inline: false },
      { name: '/dutyadmin', value: `Szolgálati idő adminisztráció (hozzáadás, szerkesztés, törlés, beállítások).\n*Jogosultság:* ${ADMIN_PERM}`, inline: false },
      { name: '/dutyalarm', value: `Szolgálati idő figyelmeztetések beállítása.\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, inline: false },
      { name: '/dutyshift', value: `Szolgálati beosztások kezelése.\n*Jogosultságok:*\n  - \`create\`, \`delete\`: ${ADMIN_PERM}\n  - \`list\`, \`view\`, \`signup\`, \`cancel\`: ${DUTY_ROLE_OR_ADMIN_PERM}`, inline: false },
      { name: '/dutystats', value: `Szolgálati idő statisztikák megtekintése.\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, inline: false },
      { name: '/dutyuser', value: `Személyes szolgálati információk (előzmények, export, rang).\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, inline: false },
      { name: '/help', value: `Ez a súgó üzenet.\n*Jogosultság:* Bárki`, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'A jogosultságok a szerver beállításaitól függően eltérhetnek.' });

  await interaction.reply({
    embeds: [helpEmbed],
    ephemeral: true // Keep the help message private to the user
  });
}
