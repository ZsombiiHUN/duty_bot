import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Role
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DUTY_ROLE_ID = process.env.DUTY_ROLE_ID!;

export const data = new SlashCommandBuilder()
  .setName('dutyadmin')
  .setDescription('Szolgálati idő adminisztráció')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(subcommand => 
    subcommand
      .setName('add')
      .setDescription('Szolgálati idő manuális hozzáadása')
      .addUserOption(option => 
        option
          .setName('user')
          .setDescription('Felhasználó')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('start_time')
          .setDescription('Kezdés időpontja (YYYY-MM-DD HH:MM)')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('end_time')
          .setDescription('Befejezés időpontja (YYYY-MM-DD HH:MM)')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('edit')
      .setDescription('Szolgálati idő szerkesztése')
      .addIntegerOption(option => 
        option
          .setName('session_id')
          .setDescription('Szolgálati időszak azonosítója')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('start_time')
          .setDescription('Új kezdés időpontja (YYYY-MM-DD HH:MM)')
          .setRequired(false)
      )
      .addStringOption(option => 
        option
          .setName('end_time')
          .setDescription('Új befejezés időpontja (YYYY-MM-DD HH:MM)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('delete')
      .setDescription('Szolgálati idő törlése')
      .addIntegerOption(option => 
        option
          .setName('session_id')
          .setDescription('Szolgálati időszak azonosítója')
          .setRequired(true)
      )
      .addBooleanOption(option => 
        option
          .setName('confirm')
          .setDescription('Megerősítés')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('role')
      .setDescription('Szolgálati státusz szerep beállítása')
      .addRoleOption(option => 
        option
          .setName('duty_role')
          .setDescription('Admin | Lehet buggos, hasznald a status_role-t')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('status_role')
      .setDescription('Aktív szolgálati állapot szerep beállítása')
      .addRoleOption(option => 
        option
          .setName('status_role')
          .setDescription('Aktív szolgálati szerep')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('check')
      .setDescription('Ellenőrzi a jelenlegi szolgálati és szerep beállításokat')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('requirements')
      .setDescription('Szolgálati idő követelmények beállítása')
      .addBooleanOption(option => 
        option
          .setName('enabled')
          .setDescription('Követelmények használata')
          .setRequired(true)
      )
      .addNumberOption(option => 
        option
          .setName('weekly')
          .setDescription('Heti minimális szolgálati idő (órák)')
          .setRequired(false)
          .setMinValue(0)
      )
      .addNumberOption(option => 
        option
          .setName('monthly')
          .setDescription('Havi minimális szolgálati idő (órák)')
          .setRequired(false)
          .setMinValue(0)
      )
      .addChannelOption(option => 
        option
          .setName('channel')
          .setDescription('Értesítési csatorna')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('find')
      .setDescription('Szolgálati időszakok keresése felhasználónként')
      .addUserOption(option => 
        option
          .setName('user')
          .setDescription('Felhasználó')
          .setRequired(true)
      )
      .addIntegerOption(option => 
        option
          .setName('limit')
          .setDescription('Találatok maximális száma')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('notifications_channel')
      .setDescription('Szolgálati értesítések csatornájának beállítása')
      .addChannelOption(option => 
        option
          .setName('channel')
          .setDescription('Csatorna az értesítések küldéséhez')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('export')
      .setDescription('Szolgálati idők exportálása és opcionális törlése')
      .addStringOption(option => 
        option
          .setName('timeframe')
          .setDescription('Időkeret')
          .setRequired(true)
          .addChoices(
            { name: 'Napi', value: 'daily' },
            { name: 'Heti', value: 'weekly' },
            { name: 'Havi', value: 'monthly' },
            { name: 'Egyéni', value: 'custom' }
          )
      )
      .addStringOption(option => 
        option
          .setName('start_date')
          .setDescription('Kezdő dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addStringOption(option => 
        option
          .setName('end_date')
          .setDescription('Záró dátum (YYYY-MM-DD) - csak egyéni időkerethez')
          .setRequired(false)
      )
      .addBooleanOption(option => 
        option
          .setName('delete')
          .setDescription('Exportált adatok törlése az adatbázisból')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has the required role or is admin
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'Ezt a parancsot csak adminisztrátor használhatja!',
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  // Get settings
  let settings = await prisma.guildSettings.findUnique({
    where: { guildId }
  });

  if (!settings) {
    settings = await prisma.guildSettings.create({
      data: {
        guildId,
        dutyRoleId: DUTY_ROLE_ID
      }
    });
  }

  if (subcommand === 'add') {
    const user = interaction.options.getUser('user')!;
    const startTimeStr = interaction.options.getString('start_time')!;
    const endTimeStr = interaction.options.getString('end_time')!;
    
    // Parse date strings
    let startTime: Date;
    let endTime: Date;
    
    try {
      startTime = parseDateTime(startTimeStr);
      endTime = parseDateTime(endTimeStr);
    } catch (error) {
      return interaction.reply({
        content: 'Érvénytelen dátum/idő formátum. Használd a YYYY-MM-DD HH:MM formátumot.',
        ephemeral: true
      });
    }
    
    // Validate dates
    if (startTime >= endTime) {
      return interaction.reply({
        content: 'A kezdés időpontja nem lehet későbbi, mint a befejezés időpontja.',
        ephemeral: true
      });
    }
    
    // Create session
    const session = await prisma.dutySession.create({
      data: {
        userId: user.id,
        guildId,
        startTime,
        endTime
      }
    });
    
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Szolgálati idő hozzáadva')
      .setDescription(
        `Szolgálati idő rögzítve <@${user.id}> számára.\n\n` +
        `ID: ${session.id}\n` +
        `Kezdés: ${formatDateTime(startTime)}\n` +
        `Befejezés: ${formatDateTime(endTime)}\n` +
        `Időtartam: ${durationHours}ó ${durationMinutes}p`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'edit') {
    const sessionId = interaction.options.getInteger('session_id')!;
    const startTimeStr = interaction.options.getString('start_time');
    const endTimeStr = interaction.options.getString('end_time');
    
    // Check if at least one field is being edited
    if (!startTimeStr && !endTimeStr) {
      return interaction.reply({
        content: 'Legalább egy mezőt meg kell adnod (kezdés vagy befejezés időpontja).',
        ephemeral: true
      });
    }
    
    // Find session
    const session = await prisma.dutySession.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) {
      return interaction.reply({
        content: `Nem található szolgálati időszak ezzel az azonosítóval: ${sessionId}`,
        ephemeral: true
      });
    }
    
    if (session.guildId !== guildId) {
      return interaction.reply({
        content: 'Ezt a szolgálati időszakot nem módosíthatod, mert másik szerveren jött létre.',
        ephemeral: true
      });
    }
    
    // Parse date strings
    let startTime: Date | undefined;
    let endTime: Date | null | undefined;
    
    if (startTimeStr) {
      try {
        startTime = parseDateTime(startTimeStr);
      } catch (error) {
        return interaction.reply({
          content: 'Érvénytelen kezdés időpont formátum. Használd a YYYY-MM-DD HH:MM formátumot.',
          ephemeral: true
        });
      }
    }
    
    if (endTimeStr) {
      try {
        endTime = parseDateTime(endTimeStr);
      } catch (error) {
        return interaction.reply({
          content: 'Érvénytelen befejezés időpont formátum. Használd a YYYY-MM-DD HH:MM formátumot.',
          ephemeral: true
        });
      }
    }
    
    // Use existing values if not provided
    startTime = startTime || session.startTime;
    
    // Only update endTime if it was provided
    const updateData: any = {
      startTime,
      alarmSent: false,
      reminderSent: false
    };
    
    if (endTimeStr !== null && endTimeStr !== undefined) {
      updateData.endTime = endTime;
    }
    
    // Validate dates if both are provided
    if (startTime && endTime && startTime >= endTime) {
      return interaction.reply({
        content: 'A kezdés időpontja nem lehet későbbi, mint a befejezés időpontja.',
        ephemeral: true
      });
    }
    
    // Update session
    const updatedSession = await prisma.dutySession.update({
      where: { id: sessionId },
      data: updateData
    });
    
    // Calculate duration if endTime exists
    let durationInfo = '';
    if (updatedSession.endTime) {
      const durationMs = updatedSession.endTime.getTime() - updatedSession.startTime.getTime();
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      durationInfo = `\nIdőtartam: ${durationHours}ó ${durationMinutes}p`;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati idő szerkesztve')
      .setDescription(
        `<@${session.userId}> szolgálati időszaka módosítva.\n\n` +
        `ID: ${sessionId}\n` +
        `Kezdés: ${formatDateTime(updatedSession.startTime)}\n` +
        `Befejezés: ${updatedSession.endTime ? formatDateTime(updatedSession.endTime) : 'Aktív'}${durationInfo}`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'delete') {
    const sessionId = interaction.options.getInteger('session_id')!;
    const confirm = interaction.options.getBoolean('confirm')!;
    
    if (!confirm) {
      return interaction.reply({
        content: 'A törlés megszakítva. A törléshez erősítsd meg a műveletet.',
        ephemeral: true
      });
    }
    
    // Find session
    const session = await prisma.dutySession.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) {
      return interaction.reply({
        content: `Nem található szolgálati időszak ezzel az azonosítóval: ${sessionId}`,
        ephemeral: true
      });
    }
    
    if (session.guildId !== guildId) {
      return interaction.reply({
        content: 'Ezt a szolgálati időszakot nem módosíthatod, mert másik szerveren jött létre.',
        ephemeral: true
      });
    }
    
    // Delete session
    await prisma.dutySession.delete({
      where: { id: sessionId }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Szolgálati idő törölve')
      .setDescription(
        `A ${sessionId} azonosítójú szolgálati időszak sikeresen törölve lett.\n` +
        `Felhasználó: <@${session.userId}>\n` +
        `Kezdés: ${formatDateTime(session.startTime)}\n` +
        `Befejezés: ${session.endTime ? formatDateTime(session.endTime) : 'Nincs befejezve'}`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }

  else if (subcommand === 'role') {
    const role = interaction.options.getRole('duty_role') as Role;
    
    if (!role) {
      return interaction.reply({
        content: 'Érvénytelen role. Kérlek, válassz egy role-t.',
        ephemeral: true
      });
    }

    // Update settings
    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        dutyRoleId: role.id
      }
    });
    
    //Note: Ez ugyan az mint a Status_Role, tbd

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati jogosultság szerep beállítva')
      .setDescription(
        `A szolgálati jogosultság szerep beállítva: <@&${role.id}>\n\n` +
        `Ezt a szerepet birtokló felhasználók indíthatnak és kezelhetnek szolgálati időket.`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'status_role') {
    const role = interaction.options.getRole('status_role') as Role;
    
    // Update settings
    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        onDutyRoleId: role.id
      }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Aktív szolgálati szerep beállítva')
      .setDescription(
        `Az aktív szolgálati szerep beállítva: <@&${role.id}>\n\n` +
        `Ezt a szerepet automatikusan megkapják a szolgálatban lévő tagok, ` +
        `és automatikusan elveszítik, amikor befejezik a szolgálatot.`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'check') {
    // Get guild settings
    const settings = await prisma.guildSettings.findUnique({
      where: { guildId }
    });

    if (!settings) {
      return interaction.reply({
        content: '⚠️ Nem találhatóak szerver beállítások. Használd a `/dutyadmin role` és `/dutyadmin status_role` parancsokat a beállításhoz.',
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const dutyRoleId = settings.dutyRoleId;
    const onDutyRoleId = settings.onDutyRoleId;
    
    let dutyRoleStatus = '❌ Nincs beállítva';
    let onDutyRoleStatus = '❌ Nincs beállítva';
    
    // Check duty role configuration
    if (dutyRoleId) {
      try {
        const dutyRole = await guild?.roles.fetch(dutyRoleId);
        if (dutyRole) {
          dutyRoleStatus = `✅ <@&${dutyRoleId}> (${dutyRole.name})`;
        } else {
          dutyRoleStatus = `⚠️ Érvénytelen: A szerep nem létezik (ID: ${dutyRoleId})`;
        }
      } catch (error) {
        dutyRoleStatus = `⚠️ Hiba: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
      }
    }
    
    // Check on-duty role configuration
    if (onDutyRoleId) {
      try {
        const onDutyRole = await guild?.roles.fetch(onDutyRoleId);
        if (onDutyRole) {
          // Check if bot can assign this role
          const botMember = await guild?.members.fetchMe();
          if (botMember && onDutyRole.position >= botMember.roles.highest.position) {
            onDutyRoleStatus = `⚠️ <@&${onDutyRoleId}> (${onDutyRole.name}) - A botnak nincs jogosultsága kezelni ezt a szerepet`;
          } else {
            onDutyRoleStatus = `✅ <@&${onDutyRoleId}> (${onDutyRole.name})`;
          }
        } else {
          onDutyRoleStatus = `⚠️ Érvénytelen: A szerep nem létezik (ID: ${onDutyRoleId})`;
        }
      } catch (error) {
        onDutyRoleStatus = `⚠️ Hiba: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
      }
    }

    // Check notification channel
    let notificationChannelStatus = '❌ Nincs beállítva';
    const notificationChannelId = settings.dutyNotificationsChannelId;

    if (notificationChannelId) {
      try {
        const channel = await guild?.channels.fetch(notificationChannelId);
        if (channel && channel.isTextBased()) {
          notificationChannelStatus = `✅ <#${notificationChannelId}> (${channel.name})`;
        } else {
          notificationChannelStatus = `⚠️ Érvénytelen: A csatorna nem létezik vagy nem szöveges (ID: ${notificationChannelId})`;
        }
      } catch (error) {
        notificationChannelStatus = `⚠️ Hiba: ${error instanceof Error ? error.message : 'ismeretlen hiba'}`;
      }
    }

    // Check bot permissions
    const botMember = await guild?.members.fetchMe();
    let botPermissions = '❌ Hiányzó jogosultságok';
    
    if (botMember && botMember.permissions.has('ManageRoles')) {
      botPermissions = '✅ A bot rendelkezik a szerepek kezeléséhez szükséges jogosultságokkal';
    } else {
      botPermissions = '❌ A botnak nincs "ManageRoles" jogosultsága, ami szükséges a szerepek kezeléséhez';
    }

    const embed = new EmbedBuilder()
      .setColor(0x3F51B5)
      .setTitle('🔍 Szolgálati beállítások ellenőrzése')
      .setDescription(
        `## Szerverbeállítások ellenőrzése\n\n` +
        `### Szerepek:\n` +
        `**Szolgálati jogosultság szerep:** ${dutyRoleId ? dutyRoleId : 'Nincs beállítva'}\n` +
        `**Állapot:** ${dutyRoleStatus}\n\n` +
        `**Aktív szolgálati szerep:** ${onDutyRoleId ? onDutyRoleId : 'Nincs beállítva'}\n` +
        `**Állapot:** ${onDutyRoleStatus}\n\n` +
        `### Értesítések:\n` +
        `**Szolgálati értesítések csatornája:** ${notificationChannelId ? notificationChannelId : 'Nincs beállítva'}\n` +
        `**Állapot:** ${notificationChannelStatus}\n\n` +
        `### Bot jogosultságok:\n` +
        `${botPermissions}\n\n` +
        `### Tippek a hibák javításához:\n` +
        `- Ellenőrizd, hogy a szerepek léteznek-e a szerveren\n` +
        `- Ellenőrizd, hogy a bot szerepe magasabb pozícióban van-e, mint a kezelendő szerepek\n` +
        `- Használd a \`/dutyadmin role\` és \`/dutyadmin status_role\` parancsokat a szerepek frissítéséhez\n` +
        `- Használd a \`/dutyadmin notifications_channel\` parancsot az értesítési csatorna beállításához`
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
  else if (subcommand === 'requirements') {
    const enabled = interaction.options.getBoolean('enabled')!;
    const weeklyHours = interaction.options.getNumber('weekly');
    const monthlyHours = interaction.options.getNumber('monthly');
    const channel = interaction.options.getChannel('channel');
    
    // Update settings
    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        requirementsEnabled: enabled,
        ...(weeklyHours !== null ? { requiredHoursWeekly: weeklyHours } : {}),
        ...(monthlyHours !== null ? { requiredHoursMonthly: monthlyHours } : {}),
        ...(channel ? { requirementsChannelId: channel.id } : {})
      }
    });
    
    // Get fresh settings
    const updatedSettings = await prisma.guildSettings.findUnique({
      where: { guildId }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati idő követelmények')
      .setDescription(
        `Követelmények ${enabled ? 'bekapcsolva' : 'kikapcsolva'}.\n\n` +
        (enabled ? `Heti minimum: ${updatedSettings?.requiredHoursWeekly || 0} óra\n` +
                  `Havi minimum: ${updatedSettings?.requiredHoursMonthly || 0} óra\n` +
                  `Értesítési csatorna: ${updatedSettings?.requirementsChannelId ? `<#${updatedSettings.requirementsChannelId}>` : 'Nincs beállítva'}` : '')
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'find') {
    const user = interaction.options.getUser('user')!;
    const limit = interaction.options.getInteger('limit') || 10;
    
    // Find sessions
    const sessions = await prisma.dutySession.findMany({
      where: {
        userId: user.id,
        guildId
      },
      orderBy: {
        startTime: 'desc'
      },
      take: limit
    });
    
    if (sessions.length === 0) {
      return interaction.reply({
        content: `Nem található szolgálati időszak <@${user.id}> felhasználóhoz.`,
        ephemeral: true
      });
    }
    
    let description = `<@${user.id}> szolgálati időszakai (legutóbbi ${limit}):\n\n`;
    
    sessions.forEach(session => {
      const startTime = formatDateTime(session.startTime);
      const endTime = session.endTime ? formatDateTime(session.endTime) : 'Aktív';
      
      let duration = '';
      if (session.endTime) {
        const durationMs = session.endTime.getTime() - session.startTime.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        duration = `${durationHours}ó ${durationMinutes}p`;
      }
      
      description += `ID: **${session.id}** | ${startTime} - ${endTime}${duration ? ` | ${duration}` : ''}\n`;
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati időszakok')
      .setDescription(description)
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'notifications_channel') {
    const channel = interaction.options.getChannel('channel');
    
    // Update settings
    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        dutyNotificationsChannelId: channel ? channel.id : null
      }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati értesítések csatornájának beállítása')
      .setDescription(
        `Szolgálati értesítések csatornájának beállítása: ${channel ? `<#${channel.id}>` : 'Kikapcsolva'}`
      )
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'export') {
    const timeframe = interaction.options.getString('timeframe')!;
    const startDateStr = interaction.options.getString('start_date');
    const endDateStr = interaction.options.getString('end_date');
    const deleteOption = interaction.options.getBoolean('delete') || false;
    
    // Determine start and end dates based on timeframe
    let startDate: Date = new Date();
    let endDate: Date = new Date();
    let timeframeLabel: string;
    
    if (timeframe === 'daily') {
      // Set to start of today
      startDate.setHours(0, 0, 0, 0);
      // Set to end of today
      endDate.setHours(23, 59, 59, 999);
      timeframeLabel = 'Napi';
    } else if (timeframe === 'weekly') {
      // Set to start of this week (Monday)
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      startDate = new Date(startDate.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      
      // Set to end of this week (Sunday)
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      timeframeLabel = 'Heti';
    } else if (timeframe === 'monthly') {
      // Set to start of this month
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      
      // Set to end of this month
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      timeframeLabel = 'Havi';
    } else {
      // Custom timeframe
      if (!startDateStr || !endDateStr) {
        return interaction.reply({
          content: 'Egyéni időkerethez a kezdő és záró dátum megadása kötelező!',
          ephemeral: true
        });
      }
      
      try {
        startDate = parseDate(startDateStr);
        startDate.setHours(0, 0, 0, 0);
      } catch (error) {
        return interaction.reply({
          content: 'Érvénytelen kezdő dátum formátum. Használd a YYYY-MM-DD formátumot.',
          ephemeral: true
        });
      }
      
      try {
        endDate = parseDate(endDateStr);
        endDate.setHours(23, 59, 59, 999);
      } catch (error) {
        return interaction.reply({
          content: 'Érvénytelen záró dátum formátum. Használd a YYYY-MM-DD formátumot.',
          ephemeral: true
        });
      }
      
      timeframeLabel = 'Egyéni';
    }
    
    await interaction.deferReply();
    
    // Find sessions
    const sessions = await prisma.dutySession.findMany({
      where: {
        guildId,
        startTime: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [
        { userId: 'asc' },
        { startTime: 'asc' }
      ]
    });
    
    if (sessions.length === 0) {
      return interaction.editReply({
        content: 'Nem található szolgálati időszak a megadott időkeretben.'
      });
    }
    
    // Group sessions by user
    const userSessions: Record<string, {
      totalMs: number,
      sessionCount: number,
      sessions: typeof sessions
    }> = {};
    
    for (const session of sessions) {
      if (!userSessions[session.userId]) {
        userSessions[session.userId] = {
          totalMs: 0,
          sessionCount: 0,
          sessions: []
        };
      }
      
      userSessions[session.userId].sessions.push(session);
      userSessions[session.userId].sessionCount++;
      
      if (session.endTime) {
        const durationMs = session.endTime.getTime() - session.startTime.getTime();
        userSessions[session.userId].totalMs += durationMs;
      }
    }
    
    // Format the data
    let userTableRows: string[] = [];
    let sessionDetails: string[] = [];
    
    for (const userId in userSessions) {
      try {
        const member = await interaction.guild?.members.fetch(userId);
        const username = member?.displayName || userId;
        const { totalMs, sessionCount } = userSessions[userId];
        
        // Format hours with 2 decimal places
        const hours = (totalMs / (1000 * 60 * 60)).toFixed(2);
        
        userTableRows.push(`${username} | ${hours} óra | ${sessionCount} időszak`);
        
        // Add session details
        sessionDetails.push(`\n**${username} részletes időszakai:**`);
        userSessions[userId].sessions.forEach(session => {
          const startTime = formatDateTime(session.startTime);
          const endTime = session.endTime ? formatDateTime(session.endTime) : 'Aktív';
          let duration = '-';
          
          if (session.endTime) {
            const durationMs = session.endTime.getTime() - session.startTime.getTime();
            const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
            duration = `${durationHours} óra`;
          }
          
          sessionDetails.push(`ID: ${session.id} | ${startTime} - ${endTime} | ${duration}`);
        });
      } catch (error) {
        console.error(`Couldn't fetch user ${userId}:`, error);
        continue;
      }
    }
    
    // Create the embeds
    const summaryEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`${timeframeLabel} Szolgálati Idő Exportálás`)
      .setDescription(`**Időkeret:** ${formatDate(startDate)} - ${formatDate(endDate)}`)
      .addFields({ name: 'Összesítés', value: userTableRows.join('\n') || 'Nincs adat' })
      .setFooter({ text: deleteOption ? 'Az adatok exportálás után törlésre kerülnek' : 'Az adatok megmaradnak az adatbázisban' })
      .setTimestamp();
    
    // Split session details into chunks if needed (Discord has a limit on embed field values)
    const maxChunkSize = 1024; // Discord's limit for field values
    const detailChunks: string[] = [];
    let currentChunk = '';
    
    for (const detail of sessionDetails) {
      // If adding this detail would exceed the limit, push current chunk and start a new one
      if (currentChunk.length + detail.length + 1 > maxChunkSize) {
        detailChunks.push(currentChunk);
        currentChunk = detail;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + detail;
      }
    }
    
    // Push the last chunk
    if (currentChunk) {
      detailChunks.push(currentChunk);
    }
    
    // Create detail embed(s)
    const detailEmbeds = detailChunks.map((chunk, index) => {
      return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`Részletes Adatok (${index + 1}/${detailChunks.length})`)
        .setDescription(chunk)
        .setTimestamp();
    });
    
    // Send the embeds
    await interaction.editReply({
      embeds: [summaryEmbed]
    });
    
    // Send detail embeds as follow-ups
    for (const embed of detailEmbeds) {
      await interaction.followUp({
        embeds: [embed]
      });
    }
    
    // Delete the sessions if requested
    if (deleteOption) {
      const deletedCount = await prisma.dutySession.deleteMany({
        where: {
          guildId,
          startTime: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      await interaction.followUp({
        content: `${deletedCount.count} szolgálati időszak törölve az adatbázisból.`,
        ephemeral: true
      });
    }
  }
}

// Helper functions
function parseDateTime(dateTimeStr: string): Date {
  // Format: YYYY-MM-DD HH:MM
  const match = dateTimeStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2})$/);
  
  if (!match) {
    throw new Error('Invalid date format');
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-based months
  const day = parseInt(match[3]);
  const hour = parseInt(match[4]);
  const minute = parseInt(match[5]);
  
  const date = new Date(year, month, day, hour, minute);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  return date;
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
}

function parseDate(dateStr: string): Date {
  // Validate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new Error('Invalid date format');
  }
  
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  return date;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}
