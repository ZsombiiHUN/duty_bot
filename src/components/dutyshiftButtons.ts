import {
  ButtonInteraction,
  ChatInputCommandInteraction, // Keep for type compatibility if needed, though ButtonInteraction is primary
  EmbedBuilder
} from 'discord.js';
// import { PrismaClient } from '@prisma/client'; // Removed local instance import
import prisma from '../db'; // Import shared Prisma client
import { formatDateTime } from '../utils/dateTimeUtils'; // Import shared date formatter
import logger from '../utils/logger'; // Import the logger

// const prisma = new PrismaClient(); // Removed local instance creation

// Note: The interaction type is broadened slightly to allow use from both
// button clicks (ButtonInteraction) and potentially slash commands (ChatInputCommandInteraction)
// if called directly, though the primary use case here is buttons.
// Consider refining if only ButtonInteraction is ever passed.
export async function handleSignup(interaction: ButtonInteraction | ChatInputCommandInteraction, shiftId: number) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  // Get the shift
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      signups: true
    }
  });

  if (!shift) {
    return interaction.reply({
      content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
      ephemeral: true
    });
  }

  if (shift.guildId !== guildId) {
    return interaction.reply({
      content: 'Ez a beosztás másik szerveren jött létre.',
      ephemeral: true
    });
  }

  // Check if shift is in the past
  if (shift.startTime <= new Date()) {
    return interaction.reply({
      content: 'Nem jelentkezhetsz elmúlt beosztásokra.',
      ephemeral: true
    });
  }

  // Check if already signed up
  const existingSignup = shift.signups.find(signup => signup.userId === userId);
  if (existingSignup) {
    return interaction.reply({
      content: 'Már jelentkeztél erre a beosztásra.',
      ephemeral: true
    });
  }

  // Check if shift is full
  if (shift.signups.length >= shift.maxUsers) {
    return interaction.reply({
      content: 'Ez a beosztás már megtelt.',
      ephemeral: true
    });
  }

  // Create signup
  await prisma.signup.create({
    data: {
      userId,
      shiftId
    }
  });

  // Get updated shift
  const updatedShift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { signups: true }
  });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('Sikeres jelentkezés')
    .setDescription(
      `Sikeresen jelentkeztél a következő beosztásra:\n\n` +
      `**${shift.title}**\n` +
      `Időpont: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}\n` +
      `Létszám: ${updatedShift?.signups.length || 0}/${shift.maxUsers}`
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

export async function handleCancel(interaction: ButtonInteraction | ChatInputCommandInteraction, shiftId: number) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  // Get the shift
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId }
  });

  if (!shift) {
    return interaction.reply({
      content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
      ephemeral: true
    });
  }

  if (shift.guildId !== guildId) {
    return interaction.reply({
      content: 'Ez a beosztás másik szerveren jött létre.',
      ephemeral: true
    });
  }

  // Find and delete signup
  const signup = await prisma.signup.findFirst({
    where: {
      userId,
      shiftId
    }
  });

  if (!signup) {
    return interaction.reply({
      content: 'Nem vagy jelentkezve erre a beosztásra.',
      ephemeral: true
    });
  }

  await prisma.signup.delete({
    where: { id: signup.id }
  });

  // Get updated shift
  const updatedShift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { signups: true }
  });

  const embed = new EmbedBuilder()
    .setColor(0xFF9900)
    .setTitle('Jelentkezés visszavonva')
    .setDescription(
      `Sikeresen visszavontad a jelentkezésed a következő beosztásról:\n\n` +
      `**${shift.title}**\n` +
      `Időpont: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}\n` +
      `Létszám: ${updatedShift?.signups.length || 0}/${shift.maxUsers}`
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// Removed local formatDateTime and padZero functions, now imported from utils
