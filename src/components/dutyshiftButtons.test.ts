// src/components/dutyshiftButtons.test.ts
import { ButtonInteraction, User } from 'discord.js'; // Removed unused imports
import prisma from '../db';
// import { formatDateTime } from '../utils/dateTimeUtils'; // formatDateTime is mocked
// import logger from '../utils/logger'; // logger is mocked
import { handleSignup, handleCancel } from './dutyshiftButtons';

// --- Mocks ---

// Mock Prisma client
jest.mock('../db', () => ({
  shift: {
    findUnique: jest.fn(),
  },
  signup: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock dateTimeUtils
jest.mock('../utils/dateTimeUtils', () => ({
  formatDateTime: jest.fn((date: Date) => {
    if (!date || isNaN(date.getTime())) return 'Invalid Date';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }),
}));

// Mock EmbedBuilder
const mockEmbedSetColor = jest.fn().mockReturnThis();
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetDescription = jest.fn().mockReturnThis();
const mockEmbedSetTimestamp = jest.fn().mockReturnThis();
jest.mock('discord.js', () => {
    const originalModule = jest.requireActual('discord.js');
    return {
        ...originalModule,
        EmbedBuilder: jest.fn(() => ({
            setColor: mockEmbedSetColor,
            setTitle: mockEmbedSetTitle,
            setDescription: mockEmbedSetDescription,
            setTimestamp: mockEmbedSetTimestamp,
            data: {}
        })),
    };
});

// Helper to create a mock interaction (simplified)
const createMockShiftInteraction = (
    userId: string,
    guildId: string
): ButtonInteraction => {
     const mockUser: Partial<User> = {
        id: userId,
        tag: 'testuser#1234',
        username: 'testuser',
        bot: false,
        toString: jest.fn((): `<@${string}>` => `<@${userId}>`),
        valueOf: jest.fn(() => userId), // Add valueOf
    };
    // Cast to 'any' first to bypass strict type checking for the mock
    return {
        user: mockUser as User,
        guildId: guildId,
        reply: jest.fn().mockResolvedValue(undefined),
        // Add other ButtonInteraction properties ONLY if needed by the handlers
        isButton: jest.fn(() => true), // Identify as button interaction
        customId: 'mock_custom_id', // Add a default customId
    } as any; // Final cast to any for simplicity in mock creation
};

// --- Tests ---

describe('dutyshiftButtons', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Prisma mocks
        (prisma.shift.findUnique as jest.Mock).mockReset();
        (prisma.signup.findFirst as jest.Mock).mockReset();
        (prisma.signup.create as jest.Mock).mockReset();
        (prisma.signup.delete as jest.Mock).mockReset();
        // Reset Embed mocks
        mockEmbedSetColor.mockClear().mockReturnThis();
        mockEmbedSetTitle.mockClear().mockReturnThis();
        mockEmbedSetDescription.mockClear().mockReturnThis();
        mockEmbedSetTimestamp.mockClear().mockReturnThis();
    });

    describe('handleSignup', () => {
        const userId = 'user1';
        const guildId = 'guild1';
        const shiftId = 1;
        let mockInteraction: ButtonInteraction; // Use the correct type
        const futureStartTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
        const futureEndTime = new Date(futureStartTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

        beforeEach(() => {
             mockInteraction = createMockShiftInteraction(userId, guildId);
        });

        it('should successfully sign up a user for an available shift', async () => {
            const mockShift = {
                id: shiftId,
                guildId,
                title: 'Test Shift',
                startTime: futureStartTime,
                endTime: futureEndTime,
                maxUsers: 2,
                signups: [], // Shift is empty
            };
            (prisma.shift.findUnique as jest.Mock)
                .mockResolvedValueOnce(mockShift) // Initial fetch
                .mockResolvedValueOnce({ ...mockShift, signups: [{ userId, shiftId }] }); // Fetch after signup
            (prisma.signup.create as jest.Mock).mockResolvedValue({ id: 10, userId, shiftId });

            await handleSignup(mockInteraction, shiftId);

            expect(prisma.shift.findUnique).toHaveBeenCalledWith({ where: { id: shiftId }, include: { signups: true } });
            expect(prisma.signup.create).toHaveBeenCalledWith({ data: { userId, shiftId } });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                ephemeral: true,
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('Sikeres jelentkezés');
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Létszám: 1/2'));
        });

        it('should reply with error if shift not found', async () => {
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(null);

            await handleSignup(mockInteraction, shiftId);

            expect(prisma.shift.findUnique).toHaveBeenCalledWith({ where: { id: shiftId }, include: { signups: true } });
            expect(prisma.signup.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
                ephemeral: true,
            });
        });

        it('should reply with error if shift is in the past', async () => {
             const pastStartTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
             const pastEndTime = new Date(pastStartTime.getTime() + 2 * 60 * 60 * 1000);
             const mockShift = { id: shiftId, guildId, startTime: pastStartTime, endTime: pastEndTime, maxUsers: 1, signups: [] };
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(mockShift);

            await handleSignup(mockInteraction, shiftId);

            expect(prisma.signup.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Nem jelentkezhetsz elmúlt beosztásokra.',
                ephemeral: true,
            });
        });

        it('should reply with error if user is already signed up', async () => {
            const mockShift = {
                id: shiftId, guildId, startTime: futureStartTime, endTime: futureEndTime, maxUsers: 2,
                signups: [{ userId, shiftId }] // User already signed up
            };
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(mockShift);

            await handleSignup(mockInteraction, shiftId);

            expect(prisma.signup.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Már jelentkeztél erre a beosztásra.',
                ephemeral: true,
            });
        });

        it('should reply with error if shift is full', async () => {
             const mockShift = {
                id: shiftId, guildId, startTime: futureStartTime, endTime: futureEndTime, maxUsers: 1,
                signups: [{ userId: 'otherUser', shiftId }] // Shift is full
            };
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(mockShift);

            await handleSignup(mockInteraction, shiftId);

            expect(prisma.signup.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Ez a beosztás már megtelt.',
                ephemeral: true,
            });
        });

        // Add test for guildId mismatch if necessary
        it('should reply with error if shift guildId does not match interaction guildId', async () => {
            const mockShift = {
                id: shiftId,
                guildId: 'differentGuild', // Different guild ID
                title: 'Test Shift',
                startTime: futureStartTime,
                endTime: futureEndTime,
                maxUsers: 2,
                signups: [],
            };
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(mockShift);

            await handleSignup(mockInteraction, shiftId);

            expect(prisma.shift.findUnique).toHaveBeenCalledWith({ where: { id: shiftId }, include: { signups: true } });
            expect(prisma.signup.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Ez a beosztás másik szerveren jött létre.',
                ephemeral: true,
            });
        });
    });

    describe('handleCancel', () => {
        const userId = 'user1';
        const guildId = 'guild1';
        const shiftId = 1;
        let mockInteraction: ButtonInteraction; // Use correct type
        const futureStartTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const futureEndTime = new Date(futureStartTime.getTime() + 2 * 60 * 60 * 1000);

         beforeEach(() => {
             mockInteraction = createMockShiftInteraction(userId, guildId);
        });

        it('should successfully cancel a signup', async () => {
            const mockShift = { id: shiftId, guildId, title: 'Test Shift', startTime: futureStartTime, endTime: futureEndTime, maxUsers: 2 };
            const mockSignup = { id: 10, userId, shiftId };
            (prisma.shift.findUnique as jest.Mock)
                .mockResolvedValueOnce(mockShift) // Initial fetch
                .mockResolvedValueOnce({ ...mockShift, signups: [] }); // Fetch after delete
            (prisma.signup.findFirst as jest.Mock).mockResolvedValue(mockSignup);
            (prisma.signup.delete as jest.Mock).mockResolvedValue({});

            await handleCancel(mockInteraction, shiftId);

            expect(prisma.shift.findUnique).toHaveBeenCalledWith({ where: { id: shiftId } });
            expect(prisma.signup.findFirst).toHaveBeenCalledWith({ where: { userId, shiftId } });
            expect(prisma.signup.delete).toHaveBeenCalledWith({ where: { id: mockSignup.id } });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                ephemeral: true,
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('Jelentkezés visszavonva');
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Létszám: 0/2'));
        });

        it('should reply with error if shift not found', async () => {
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(null);

            await handleCancel(mockInteraction, shiftId);

            expect(prisma.shift.findUnique).toHaveBeenCalledWith({ where: { id: shiftId } });
            expect(prisma.signup.delete).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: `Nem található beosztás ezzel az azonosítóval: ${shiftId}`,
                ephemeral: true,
            });
        });

        it('should reply with error if user is not signed up', async () => {
            const mockShift = { id: shiftId, guildId, startTime: futureStartTime, endTime: futureEndTime, maxUsers: 2 };
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(mockShift);
            (prisma.signup.findFirst as jest.Mock).mockResolvedValue(null); // User not signed up

            await handleCancel(mockInteraction, shiftId);

            expect(prisma.signup.findFirst).toHaveBeenCalledWith({ where: { userId, shiftId } });
            expect(prisma.signup.delete).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Nem vagy jelentkezve erre a beosztásra.',
                ephemeral: true,
            });
        });

        // Add test for guildId mismatch if necessary
        it('should reply with error if shift guildId does not match interaction guildId', async () => {
            const mockShift = {
                id: shiftId,
                guildId: 'differentGuild', // Different guild ID
                title: 'Test Shift',
                startTime: futureStartTime,
                endTime: futureEndTime,
                maxUsers: 2,
            };
            (prisma.shift.findUnique as jest.Mock).mockResolvedValue(mockShift);

            await handleCancel(mockInteraction, shiftId);

            expect(prisma.shift.findUnique).toHaveBeenCalledWith({ where: { id: shiftId } });
            expect(prisma.signup.findFirst).not.toHaveBeenCalled();
            expect(prisma.signup.delete).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Ez a beosztás másik szerveren jött létre.',
                ephemeral: true,
            });
        });
    });
});
