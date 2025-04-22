import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

// Permission constants for clarity
const ADMIN_PERM = 'Adminisztrátor';
const DUTY_ROLE_OR_ADMIN_PERM = 'Szolgálati Szerep vagy Adminisztrátor';
const ANYONE_PERM = 'Bárki';

/**
 * Helper function to format a list of subcommands for the help embed.
 * @param {Array<{ name: string, description: string }>} subcommands - Array of subcommand objects.
 * @returns {string} A formatted string listing subcommands, or an empty string if none.
 * @private
 */
function formatSubcommands(subcommands: { name: string, description: string }[]): string {
  if (!subcommands || subcommands.length === 0) {
    return '';
  }
  return '\n**Alparancsok:**\n' + subcommands.map(sc => `  - \`${sc.name}\`: ${sc.description}`).join('\n');
}

/**
 * Command definition for the /segitseg command.
 * Displays help information about available commands.
 */
export const data = new SlashCommandBuilder()
  .setName('segitseg')
  .setDescription('Segítség a szolgálati rendszerhez');

/**
 * Executes the /segitseg command.
 * Sends an ephemeral embed listing all commands, their subcommands, and required permissions.
 * @param {ChatInputCommandInteraction} interaction - The command interaction object.
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🤖 Parancsok és Jogosultságok')
    .setDescription('Itt találod az elérhető parancsokat, alparancsaikat és a használatukhoz szükséges jogosultságokat.')
    .addFields(
      { 
        name: '/setup', 
        value: `Interaktív szolgálat bot beállítás varázsló.\n*Jogosultság:* ${ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/dutyreport', 
        value: `Automatikus szolgálati jelentések ütemezése, listázása, törlése.` +
               formatSubcommands([
                 { name: 'schedule', description: 'Ütemezett automatikus jelentés' },
                 { name: 'list', description: 'Ütemezett jelentések listázása' },
                 { name: 'remove', description: 'Ütemezett jelentés törlése' }
               ]) +
               `\n*Jogosultság:* ${ADMIN_PERM}`,
        inline: false 
      },
      { 
        name: '/roster', 
        value: `Szolgálati névsor adminisztráció.` +
               formatSubcommands([
                 { name: 'list', description: 'Felhasználók listázása a névsorban' },
                 { name: 'search', description: 'Felhasználó keresése név, fedőnév vagy jelvényszám alapján' },
                 { name: 'remove', description: 'Felhasználó regisztrációjának törlése a névsorból' }
               ]) +
               `\n*Jogosultság:* ${ADMIN_PERM}`,
        inline: false 
      },
      { 
        name: '/vakacio', 
        value: `Szabadság/elfoglaltság kezelése, admin funkciók.` +
               formatSubcommands([
                 { name: 'hozzaad', description: 'Új szabadság vagy elfoglaltság hozzáadása' },
                 { name: 'listaz', description: 'Saját szabadságok/elfoglaltságok listázása' },
                 { name: 'torol', description: 'Saját szabadság/elfoglaltság törlése' },
                 { name: 'admin-listaz', description: 'Összes szabadság/elfoglaltság listázása (admin)' },
                 { name: 'admin-torol', description: 'Bármely szabadság/elfoglaltság törlése ID alapján (admin)' }
               ]) +
               `\n*Jogosultság:* ${ADMIN_PERM}`,
        inline: false 
      },
      { 
        name: '/szolgalat', 
        value: `Szolgálat kezelése (irányítópult).\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/szolgadmin', 
        value: `Adminisztrátori parancsok szolgálati idő, szerepkörök és beállítások kezeléséhez.` +
               formatSubcommands([
                 { name: 'add', description: 'Szolgálati idő hozzáadása felhasználónak' },
                 { name: 'edit', description: 'Szolgálati idő szerkesztése' },
                 { name: 'delete', description: 'Szolgálati idő törlése' },
                 { name: 'role', description: 'Szolgálati státusz szerep beállítása' },
                 { name: 'status_role', description: 'Aktív szolgálati állapot szerep beállítása' },
                 { name: 'check', description: 'Jelenlegi szolgálati és szerep beállítások ellenőrzése' },
                 { name: 'requirements', description: 'Szolgálati idő követelmények beállítása' },
                 { name: 'find', description: 'Szolgálati időszakok keresése felhasználónként' },
                 { name: 'notifications_channel', description: 'Szolgálati értesítések csatornájának beállítása' },
                 { name: 'log_channel', description: 'Szolgálati naplózási csatorna beállítása/törlése' },
                 { name: 'export', description: 'Szolgálati idők exportálása CSV-be' }
               ]) +
               `\n*Jogosultság:* ${ADMIN_PERM}`,
        inline: false 
      },
      { 
        name: '/szolgfigyelo', 
        value: `Szolgálati figyelmeztetések és emlékeztetők beállítása adminoknak.` +
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
        name: '/beosztas', 
        value: `Szolgálati beosztások kezelése, jelentkezés, lemondás.` +
               formatSubcommands([
                 { name: 'create', description: 'Új szolgálati beosztás létrehozása' },
                 { name: 'list', description: 'Elérhető beosztások listázása' },
                 { name: 'view', description: 'Beosztás részleteinek megtekintése' },
                 { name: 'signup', description: 'Jelentkezés szolgálati beosztásra' },
                 { name: 'cancel', description: 'Jelentkezés visszavonása' },
                 { name: 'delete', description: 'Beosztás törlése' }
               ]) +
               `\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`,
        inline: false 
      },
      { 
        name: '/szolgstat', 
        value: `Statisztikák, toplisták, megfelelőség szolgálati időkről.` +
               formatSubcommands([
                 { name: 'summary', description: 'Összesített szolgálati statisztikák' },
                 { name: 'leaderboard', description: 'Toplista a legtöbb szolgálati idővel' },
                 { name: 'metrics', description: 'Részletes szolgálati metrikák' },
                 { name: 'compliance', description: 'Megfelelőség ellenőrzése' }
               ]) +
               `\n*Jogosultság:* ${ADMIN_PERM}`,
        inline: false 
      },
      { 
        name: '/szemelyiszolgalat', 
        value: `Személyes szolgálati adatok, export, rang, követelmények.` +
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
        name: '/dutyregisztracio', 
        value: `Szolgálati regisztráció a szükséges adatokkal.\n*Jogosultság:* ${ANYONE_PERM}`, 
        inline: false 
      },
      { 
        name: '/duty', 
        value: `Szolgálati irányítópult megjelenítése.\n*Jogosultság:* ${DUTY_ROLE_OR_ADMIN_PERM}`, 
        inline: false 
      },
      { 
        name: '/segitseg', 
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

