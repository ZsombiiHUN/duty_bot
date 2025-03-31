import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';


const DUTY_ROLE_ID = '1181694226761789592';

export const data = new SlashCommandBuilder()
  .setName('duty')
  .setDescription('Szolgálat')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction: CommandInteraction) {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  
  if (!member?.roles.cache.has(DUTY_ROLE_ID) && !member?.permissions.has(PermissionFlagsBits.Administrator)) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xF94A4A)
      .setTitle('❌ Jogosultság hiányzik')
      .setDescription('Nincs jogosultságod használni ezt a parancsot!')
      .setFooter({ text: 'Ez a parancs csak adminisztrátorok és a megfelelő szereppel rendelkező felhasználók számára érhető el.' })
      .setTimestamp();

    return interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
  }

  const dutyEmbed = new EmbedBuilder()
    .setColor(0x3F51B5)
    .setTitle('🔰 Szolgálati irányítópult')
    .setDescription(
      '### Szolgálati idő kezelése\n\n' +
      '**Funkciók:**\n' +
      '🟢 **Szolgálat kezdése** - Új szolgálati időszak indítása\n' +
      '🔴 **Szolgálat befejezése** - Aktív szolgálat lezárása\n' +
      '📊 **Szolgálati idő** - Statisztikák megtekintése\n\n' +
      'A szolgálatban töltött idő automatikusan rögzítésre kerül.'
    )
    .setFooter({ text: 'További funkciókért használd a /dutyuser és /dutystats parancsokat.' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('duty_on')
        .setLabel('🟢 Szolgálat kezdése')
        .setStyle(ButtonStyle.Success),
      
      new ButtonBuilder()
        .setCustomId('duty_off')
        .setLabel('🔴 Szolgálat befejezése')
        .setStyle(ButtonStyle.Danger),
        
      new ButtonBuilder()
        .setCustomId('show_time')
        .setLabel('📊 Szolgálati idő')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.reply({
    embeds: [dutyEmbed],
    components: [row]
  });
}