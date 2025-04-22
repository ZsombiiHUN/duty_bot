import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, ChannelSelectMenuBuilder, ChannelType, RoleSelectMenuBuilder, RoleSelectMenuInteraction, ChannelSelectMenuInteraction } from 'discord.js';
import prisma from '../db';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Interaktív szolgálat bot beállítás varázsló')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Permission check
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'Csak adminisztrátorok használhatják ezt a parancsot.', ephemeral: true });
  }

  // Step 1: Select duty role
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Üdvözöllek a szolgálat bot beállítás varázslóban!\n\n1. lépés: Válassz egy szerepet, amely jogosult lesz szolgálatba lépni.')
    .setFooter({ text: '1/6: Jogosultság szerep kiválasztása' });

  const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
    .addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('setup_duty_role')
        .setPlaceholder('Válassz szerepet...')
        .setMinValues(1)
        .setMaxValues(1)
    );

  await interaction.reply({ embeds: [embed], components: [roleRow], ephemeral: true });
}

// Handler for role selection interaction
export async function handleDutyRoleSelect(interaction: RoleSelectMenuInteraction) {
  const selectedRole = interaction.values[0];
  const guildId = interaction.guildId!;
  // Save to DB
  await prisma.guildSettings.upsert({
    where: { guildId },
    update: { dutyRoleId: selectedRole },
    create: { guildId, dutyRoleId: selectedRole },
  });

  // Step 2: Select on-duty role
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('2. lépés: Válassz egy szerepet, amelyet a bot kioszt, amikor valaki szolgálatba lép.')
    .setFooter({ text: '2/6: Szolgálatban szerep kiválasztása' });

  const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
    .addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('setup_on_duty_role')
        .setPlaceholder('Válassz szerepet...')
        .setMinValues(1)
        .setMaxValues(1)
    );

  await interaction.update({ embeds: [embed], components: [roleRow] });
}

export async function handleOnDutyRoleSelect(interaction: RoleSelectMenuInteraction) {
  const selectedRole = interaction.values[0];
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { onDutyRoleId: selectedRole },
  });

  // Step 3: Select log channel
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('3. lépés: Válassz egy csatornát, ahová a bot naplózza a szolgálati eseményeket.')
    .setFooter({ text: '3/6: Naplózási csatorna kiválasztása' });

  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
    .addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_log_channel')
        .setPlaceholder('Válassz csatornát...')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    );

  await interaction.update({ embeds: [embed], components: [channelRow] });
}

export async function handleLogChannelSelect(interaction: ChannelSelectMenuInteraction) {
  const selectedChannel = interaction.values[0];
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { dutyLogChannelId: selectedChannel },
  });

  // Step 4: Select notification channel
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('4. lépés: Válassz egy csatornát, ahová a bot értesítéseket küld.')
    .setFooter({ text: '4/6: Értesítési csatorna kiválasztása' });

  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
    .addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_notification_channel')
        .setPlaceholder('Válassz csatornát...')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    );

  await interaction.update({ embeds: [embed], components: [channelRow] });
}

export async function handleNotificationChannelSelect(interaction: ChannelSelectMenuInteraction) {
  const selectedChannel = interaction.values[0];
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { dutyNotificationsChannelId: selectedChannel },
  });

  // Step 5: Requirements setup
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('5. lépés: Szeretnél heti/havi szolgálati követelményeket beállítani?')
    .setFooter({ text: '5/6: Követelmények bekapcsolása' });
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_requirements_enable')
        .setPlaceholder('Követelmények bekapcsolása?')
        .addOptions([
          { label: 'Igen', value: 'enable' },
          { label: 'Nem', value: 'disable' }
        ])
    );
  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleRequirementsEnable(interaction: StringSelectMenuInteraction) {
  const value = interaction.values[0];
  const guildId = interaction.guildId!;
  if (value === 'disable') {
    await prisma.guildSettings.update({
      where: { guildId },
      data: { requirementsEnabled: false },
    });
    // Skip to alarm setup
    return await showAlarmStep(interaction);
  }
  // Enable requirements, ask for weekly hours
  await prisma.guildSettings.update({
    where: { guildId },
    data: { requirementsEnabled: true },
  });
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Add meg a heti követelmény óraszámát! (0 = nincs)')
    .setFooter({ text: '5/6: Heti követelmény' });
  // Use string select for 0-25 hours (Discord limit is 25 options)
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_requirements_weekly')
        .setPlaceholder('Heti követelmény...')
        .addOptions(Array.from({ length: 25 }, (_, i) => ({ label: `${i} óra`, value: `${i}` })))
    );
  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleRequirementsWeekly(interaction: StringSelectMenuInteraction) {
  const value = parseInt(interaction.values[0]);
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { requiredHoursWeekly: value },
  });
  // Ask for monthly hours
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Add meg a havi követelmény óraszámát! (0 = nincs)')
    .setFooter({ text: '5/6: Havi követelmény' });
  // Use string select for 0-25 hours (Discord limit is 25 options)
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_requirements_monthly')
        .setPlaceholder('Havi követelmény...')
        .addOptions(Array.from({ length: 25 }, (_, i) => ({ label: `${i} óra`, value: `${i}` })))
    );
  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleRequirementsMonthly(interaction: StringSelectMenuInteraction) {
  const value = parseInt(interaction.values[0]);
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { requiredHoursMonthly: value },
  });
  // Ask for requirements channel
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Válassz egy csatornát, ahová a bot a követelmény emlékeztetőket küldi!')
    .setFooter({ text: '5/6: Követelmény csatorna' });
  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
    .addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_requirements_channel')
        .setPlaceholder('Követelmény csatorna...')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    );
  await interaction.update({ embeds: [embed], components: [channelRow] });
}

export async function handleRequirementsChannel(interaction: ChannelSelectMenuInteraction) {
  const selectedChannel = interaction.values[0];
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { requirementsChannelId: selectedChannel },
  });
  // Proceed to alarm setup
  await showAlarmStep(interaction);
}

async function showAlarmStep(interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction) {
  // Step 6: Alarm/reminder settings
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('6. lépés: Szeretnél szolgálati idő figyelmeztetést vagy emlékeztetőt beállítani?')
    .setFooter({ text: '6/6: Figyelmeztetés/Emlékeztető' });
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_alarm_enable')
        .setPlaceholder('Figyelmeztetés/Emlékeztető bekapcsolása?')
        .addOptions([
          { label: 'Igen', value: 'enable' },
          { label: 'Nem', value: 'disable' }
        ])
    );
  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleAlarmEnable(interaction: StringSelectMenuInteraction) {
  const value = interaction.values[0];
  const guildId = interaction.guildId!;
  if (value === 'disable') {
    await prisma.guildSettings.update({
      where: { guildId },
      data: { alarmEnabled: false, reminderEnabled: false },
    });
    return await showSetupComplete(interaction);
  }
  // Enable alarm, ask for alarm threshold
  await prisma.guildSettings.update({
    where: { guildId },
    data: { alarmEnabled: true, reminderEnabled: true },
  });
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Add meg az admin figyelmeztetés időkorlátját (órában)! (1-24)')
    .setFooter({ text: '6/6: Admin figyelmeztetés időkorlát' });
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_alarm_threshold')
        .setPlaceholder('Időkorlát...')
        .addOptions(Array.from({ length: 24 }, (_, i) => ({ label: `${i + 1} óra`, value: `${i + 1}` })))
    );
  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleAlarmThreshold(interaction: StringSelectMenuInteraction) {
  const value = parseInt(interaction.values[0]);
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { alarmThresholdHours: value },
  });
  // Ask for alarm channel
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Válassz egy csatornát, ahová az admin figyelmeztetések menjenek!')
    .setFooter({ text: '6/6: Admin figyelmeztetés csatorna' });
  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
    .addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_alarm_channel')
        .setPlaceholder('Admin figyelmeztetés csatorna...')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    );
  await interaction.update({ embeds: [embed], components: [channelRow] });
}

export async function handleAlarmChannel(interaction: ChannelSelectMenuInteraction) {
  const selectedChannel = interaction.values[0];
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { alarmChannelId: selectedChannel },
  });
  // Ask for reminder threshold
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Duty Bot Beállítás Varázsló')
    .setDescription('Add meg a felhasználói emlékeztető időkorlátját (órában)! (1-24)')
    .setFooter({ text: '6/6: Felhasználói emlékeztető időkorlát' });
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_reminder_threshold')
        .setPlaceholder('Időkorlát...')
        .addOptions(Array.from({ length: 24 }, (_, i) => ({ label: `${i + 1} óra`, value: `${i + 1}` })))
    );
  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleReminderThreshold(interaction: StringSelectMenuInteraction) {
  const value = parseInt(interaction.values[0]);
  const guildId = interaction.guildId!;
  await prisma.guildSettings.update({
    where: { guildId },
    data: { reminderThresholdHours: value },
  });
  // Setup complete
  await showSetupComplete(interaction);
}

async function showSetupComplete(interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('Duty Bot Beállítás kész!')
    .setDescription('A szolgálat bot sikeresen be lett állítva az összes szükséges paraméterrel.')
    .setFooter({ text: 'Beállítás sikeres' });
  await interaction.update({ embeds: [embed], components: [] });
}
