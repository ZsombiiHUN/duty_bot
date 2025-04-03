import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

// Permission constants for clarity
const ADMIN_PERM = 'Adminisztrátor';
const DUTY_ROLE_OR_ADMIN_PERM = 'Szolgálati Szerep vagy Adminisztrátor';
const ANYONE_PERM = 'Bárki';

// Helper function to format subcommands
function formatSubcommands(subcommands: { name: string, description: string }[]): string {
  if (!subcommands || subcommands.length === 0) {
    return '';
  }
  return '\n**Alparancsok:**\n' + subcommands.map(sc => `  - \`${sc.name}\`: ${sc.description}`).join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Megjeleníti az összes elérhető parancsot és a szükséges jogosultságokat.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🤖 Parancsok és Jogosultságok')
    .setDescription('Itt találod az elérhető parancsokat, alparancsaikat és a használatukhoz szükséges jogosultságokat.')
    .addFields(
      { 
        name: '/duty', 
        value: `Szolgálati irányítópult megjelenítése.\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/dutyadmin', 
        value: `Szolgálati idő adminisztráció.` +
               formatSubcommands([
                 { name: 'add', description: 'Szolgálati idő manuális hozzáadása' },
                 { name: 'edit', description: 'Szolgálati idő szerkesztése' },
                 { name: 'delete', description: 'Szolgálati idő törlése' },
                 { name: 'role', description: 'Szolgálati státusz szerep beállítása' },
                 { name: 'status_role', description: 'Aktív szolgálati állapot szerep beállítása' },
                 { name: 'check', description: 'Jelenlegi szolgálati és szerep beállítások ellenőrzése' },
                 { name: 'requirements', description: 'Szolgálati idő követelmények beállítása' },
                 { name: 'find', description: 'Szolgálati időszakok keresése felhasználónként' },
                 { name: 'notifications_channel', description: 'Szolgálati értesítések csatornájának beállítása' }
               ]) +
               `\n*Jogosultság:* ${ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/dutyalarm', 
        value: `Szolgálati idő figyelmeztetések beállítása.` +
               formatSubcommands([
                 { name: 'config', description: 'Figyelmeztetés beállítása' },
                 { name: 'status', description: 'Jelenlegi figyelmeztetés beállítások' },
                 { name: 'disable', description: 'Figyelmeztetések kikapcsolása' },
                 { name: 'reminder', description: 'Felhasználói emlékeztetők beállítása' }
               ]) +
               `\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/dutyshift', 
        value: `Szolgálati beosztások kezelése.` +
               formatSubcommands([
                 { name: 'create', description: 'Új szolgálati beosztás létrehozása' },
                 { name: 'list', description: 'Elérhető beosztások listázása' },
                 { name: 'view', description: 'Beosztás részleteinek megtekintése' },
                 { name: 'signup', description: 'Jelentkezés szolgálati beosztásra' },
                 { name: 'cancel', description: 'Jelentkezés visszavonása' },
                 { name: 'delete', description: 'Beosztás törlése' }
               ]) +
               `\n*Jogosultságok:*\n  - \`create\`, \`delete\`: ${ADMIN_PERM}\n  - \`list\`, \`view\`, \`signup\`, \`cancel\`: ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/dutystats', 
        value: `Szolgálati idő statisztikák megtekintése.` +
               formatSubcommands([
                 { name: 'summary', description: 'Összesített szolgálati statisztikák' },
                 { name: 'leaderboard', description: 'Toplista a legtöbb szolgálati idővel' },
                 { name: 'metrics', description: 'Részletes szolgálati metrikák' }
               ]) +
               `\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/dutyuser', 
        value: `Személyes szolgálati információk.` +
               formatSubcommands([
                 { name: 'history', description: 'Saját szolgálati előzmények' },
                 { name: 'export', description: 'Szolgálati idő exportálása CSV fájlba' },
                 { name: 'rank', description: 'Saját helyezés megtekintése a toplistán' },
                 { name: 'requirements', description: 'Elvárt szolgálati idő követelmények ellenőrzése' }
               ]) +
               `\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/help', 
        value: `Ez a súgó üzenet.\n*Jogosultság:* ${ANYONE_PERM}`, 
        inline: false 
      }
    )
    .setTimestamp()
    .setFooter({ text: 'A jogosultságok a szerver beállításaitól függően eltérhetnek.' });

  await interaction.reply({
    embeds: [helpEmbed],
    ephemeral: true 
  });
}
