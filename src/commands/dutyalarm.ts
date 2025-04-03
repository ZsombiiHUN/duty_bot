import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DUTY_ROLE_ID = process.env.DUTY_ROLE_ID!;

// In-memory cache is now deprecated since we're using database flags
// const alarmSentForUsers = new Set<string>();

export const data = new SlashCommandBuilder()
  .setName('dutyalarm')
  .setDescription('Szolgálati idő figyelmeztetések beállítása')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(subcommand => 
    subcommand
      .setName('config')
      .setDescription('Figyelmeztetés beállítása')
      .addIntegerOption(option => 
        option
          .setName('hours')
          .setDescription('Figyelmeztetés ennyi óra szolgálat után')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(24)
      )
      .addChannelOption(option => 
        option
          .setName('channel')
          .setDescription('Csatorna ahol a figyelmeztetést küldi')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('status')
      .setDescription('Jelenlegi figyelmeztetés beállítások')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('disable')
      .setDescription('Figyelmeztetések kikapcsolása')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('reminder')
      .setDescription('Felhasználói emlékeztetők beállítása')
      .addIntegerOption(option => 
        option
          .setName('hours')
          .setDescription('Emlékeztető ennyi óra szolgálat után')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(24)
      )
      .addBooleanOption(option => 
        option
          .setName('enabled')
          .setDescription('Bekapcsolás/kikapcsolás')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has the required role
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  
  if (!member?.roles.cache.has(DUTY_ROLE_ID) && !member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'Nincs jogosultságod használni ezt a parancsot!',
      ephemeral: true
    });
  }

  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  // Get or create settings for this guild
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

  if (subcommand === 'config') {
    const hours = interaction.options.getInteger('hours')!;
    const channel = interaction.options.getChannel('channel')!;

    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        alarmEnabled: true,
        alarmThresholdHours: hours,
        alarmChannelId: channel.id
      }
    });

    // Reset alarm flags for all active sessions when config changes
    await prisma.dutySession.updateMany({
      where: {
        guildId,
        endTime: null
      },
      data: {
        alarmSent: false
      }
    });

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati idő figyelmeztetések')
      .setDescription(`Figyelmeztetés beállítva ${hours} óra után a <#${channel.id}> csatornára.`)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  } 
  else if (subcommand === 'disable') {
    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        alarmEnabled: false
      }
    });

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati idő figyelmeztetések')
      .setDescription('Figyelmeztetések kikapcsolva.')
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'reminder') {
    const hours = interaction.options.getInteger('hours')!;
    const enabled = interaction.options.getBoolean('enabled')!;

    await prisma.guildSettings.update({
      where: { guildId },
      data: {
        reminderEnabled: enabled,
        reminderThresholdHours: hours
      }
    });

    // Reset reminder flags for all active sessions when config changes
    if (enabled) {
      await prisma.dutySession.updateMany({
        where: {
          guildId,
          endTime: null
        },
        data: {
          reminderSent: false
        }
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati idő emlékeztetők')
      .setDescription(
        enabled 
          ? `Felhasználói emlékeztetők beállítva ${hours} óra után.` 
          : 'Felhasználói emlékeztetők kikapcsolva.'
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
  else if (subcommand === 'status') {
    // Get fresh settings
    settings = await prisma.guildSettings.findUnique({
      where: { guildId }
    }) || settings;

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Szolgálati idő figyelmeztetések')
      .setDescription(
        `**Admin figyelmeztetések:**\n` +
        `Aktív: ${settings.alarmEnabled ? 'Igen' : 'Nem'}\n` +
        (settings.alarmEnabled 
          ? `Időkorlát: ${settings.alarmThresholdHours} óra\nCsatorna: <#${settings.alarmChannelId}>\n\n`
          : '\n') +
        `**Felhasználói emlékeztetők:**\n` +
        `Aktív: ${settings.reminderEnabled ? 'Igen' : 'Nem'}\n` +
        (settings.reminderEnabled
          ? `Időkorlát: ${settings.reminderThresholdHours} óra`
          : '')
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
}

// This function should be called periodically to check for long duty sessions
export async function checkLongDutySessions(client: any) {
  const now = new Date();
  
  try {
    // Get all guilds with alarms enabled
    const guildsWithAlarms = await prisma.guildSettings.findMany({
      where: {
        alarmEnabled: true,
        alarmChannelId: { not: null }
      }
    });

    for (const guildSettings of guildsWithAlarms) {
      const thresholdMs = guildSettings.alarmThresholdHours * 60 * 60 * 1000;
      const guildId = guildSettings.guildId;
    
      // Find all active duty sessions for this guild that haven't received an alarm yet
      const activeSessions = await prisma.dutySession.findMany({
        where: {
          guildId,
          endTime: null,
          alarmSent: false
        }
      });

      // Check each session
      for (const session of activeSessions) {
        const durationMs = now.getTime() - session.startTime.getTime();
        
        // Skip if duration is less than threshold
        if (durationMs < thresholdMs) {
          continue;
        }
        
        // Mark alarm as sent in the database
        await prisma.dutySession.update({
          where: { id: session.id },
          data: { alarmSent: true }
        });
        
        // Duration calculations
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        // Send alarm
        try {
          const channel = await client.channels.fetch(guildSettings.alarmChannelId);
          if (channel) {
            const embed = new EmbedBuilder()
              .setColor(0xFF9900)
              .setTitle('Hosszú szolgálati idő figyelmeztetés')
              .setDescription(`<@${session.userId}> már ${durationHours}ó ${durationMinutes}p ideje szolgálatban van.`)
              .setTimestamp();
            
            await channel.send({
              content: `<@${session.userId}> Figyelem! Hosszú szolgálati idő!`,
              embeds: [embed]
            });
          }
        } catch (error) {
          console.error(`Error sending alarm to channel ${guildSettings.alarmChannelId}:`, error);
        }
      }
    }

    // Check for user reminders
    const guildsWithReminders = await prisma.guildSettings.findMany({
      where: {
        reminderEnabled: true
      }
    });

    for (const guildSettings of guildsWithReminders) {
      const thresholdMs = guildSettings.reminderThresholdHours * 60 * 60 * 1000;
      const guildId = guildSettings.guildId;
    
      // Find all active duty sessions for this guild that haven't received a reminder yet
      const activeSessions = await prisma.dutySession.findMany({
        where: {
          guildId,
          endTime: null,
          reminderSent: false
        }
      });

      // Check each session
      for (const session of activeSessions) {
        const durationMs = now.getTime() - session.startTime.getTime();
        
        // Skip if duration is less than threshold
        if (durationMs < thresholdMs) {
          continue;
        }
        
        // Mark reminder as sent in the database
        await prisma.dutySession.update({
          where: { id: session.id },
          data: { reminderSent: true }
        });
        
        // Send DM reminder to user
        try {
          const user = await client.users.fetch(session.userId);
          if (user) {
            const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
            const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            
            const embed = new EmbedBuilder()
              .setColor(0x0099FF)
              .setTitle('Szolgálati idő emlékeztető')
              .setDescription(`Már ${durationHours}ó ${durationMinutes}p ideje szolgálatban vagy. Ha már befejezted a szolgálatot, ne felejtsd el lejelentkezni!`)
              .setTimestamp();
            
            await user.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error(`Error sending reminder to user ${session.userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error checking long duty sessions:', error);
  }
} 