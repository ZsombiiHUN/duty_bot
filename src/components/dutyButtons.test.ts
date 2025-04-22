// src/components/dutyButtons.test.ts
import { ButtonInteraction, Guild, GuildMember, Role, Collection, ClientUser, User } from 'discord.js';
// import { DutySession, GuildSettings } from '@prisma/client'; // Removed unused Prisma type imports
import prisma from '../db';
import { formatDateTime } from '../utils/dateTimeUtils';
import logger from '../utils/logger';
import { handleDutyOn, handleDutyOff, handleShowTime } from './dutyButtons'; // Import handleShowTime now

// --- Mocks ---

// Mock Prisma client
jest.mock('../db', () => ({
  dutySession: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  guildSettings: {
    findUnique: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(), // Add other methods if used
}));

// Mock dateTimeUtils (though formatDateTime is tested, mocking avoids dependency)
jest.mock('../utils/dateTimeUtils', () => ({
  formatDateTime: jest.fn((date: Date) => {
    // Provide a simple consistent format for testing if needed
    if (!date || isNaN(date.getTime())) return 'Invalid Date';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }),
}));

// Mock EmbedBuilder to check its usage
const mockEmbedSetColor = jest.fn().mockReturnThis();
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetDescription = jest.fn().mockReturnThis();
const mockEmbedSetFooter = jest.fn().mockReturnThis();
const mockEmbedSetTimestamp = jest.fn().mockReturnThis();
const mockEmbedSetThumbnail = jest.fn().mockReturnThis();
// We need to mock the actual EmbedBuilder class from discord.js
jest.mock('discord.js', () => {
    const originalModule = jest.requireActual('discord.js');
    return {
        ...originalModule, // Keep other exports intact
        EmbedBuilder: jest.fn(() => ({
            setColor: mockEmbedSetColor,
            setTitle: mockEmbedSetTitle,
            setDescription: mockEmbedSetDescription,
            setFooter: mockEmbedSetFooter,
            setTimestamp: mockEmbedSetTimestamp,
            setThumbnail: mockEmbedSetThumbnail,
            // Mock the data property for checks if needed
            data: {}
        })),
    };
});


// Helper to create a mock interaction
const createMockInteraction = (
    userId: string,
    guildId: string,
    memberRoles: string[] = [],
    memberPermissions: string[] = [],
    guildRoles: { id: string; name: string; position: number }[] = [],
    botRoles: { id: string; name: string; position: number }[] = [],
    channels: { id: string; name: string; type: number }[] = [] // 0 for TextChannel
): Partial<ButtonInteraction> => {

    const mockGuildMember = {
        id: userId,
        roles: {
            cache: new Collection(memberRoles.map(id => [id, { id } as Role])),
            add: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
            highest: botRoles.length > 0 ? { position: Math.max(...botRoles.map(r => r.position)) } : { position: 0 },
        },
        permissions: {
            has: jest.fn((perm: string) => memberPermissions.includes(perm)),
        },
        // Add other GuildMember properties if needed
    } as unknown as Partial<GuildMember>; // Cast to unknown first

    const mockGuild = {
        id: guildId,
        roles: {
            fetch: jest.fn((roleId?: string) => {
                if (!roleId) return Promise.resolve(new Collection(guildRoles.map(r => [r.id, r as any])));
                const role = guildRoles.find(r => r.id === roleId);
                // Return null if role not found, mimicking discord.js behavior
                return role ? Promise.resolve(role as any) : Promise.resolve(null);
            }),
            // Add other RoleManager properties if needed
        },
        members: {
             fetchMe: jest.fn().mockResolvedValue({ // Mock fetchMe
                roles: {
                    highest: botRoles.length > 0 ? { position: Math.max(...botRoles.map(r => r.position)), name: 'BotHighestRole', id: 'botHighestRoleId' } : { position: 0, name: 'BotBaseRole', id: 'botBaseRoleId' },
                }
            } as unknown as Partial<ClientUser>), // Cast to unknown first
            // Add other GuildMemberManager properties if needed
        },
        channels: {
            fetch: jest.fn((channelId?: string) => {
                 if (!channelId) return Promise.resolve(new Collection(channels.map(c => [c.id, c as any])));
                 const channel = channels.find(c => c.id === channelId);
                 if (channel) {
                     return Promise.resolve({
                         ...channel,
                         isTextBased: () => channel.type === 0, // Example type check
                         send: jest.fn().mockResolvedValue(undefined),
                     } as any);
                 }
                 // Return null if channel not found
                 return Promise.resolve(null);
            }),
            // Add other ChannelManager properties if needed
        },
        // Add other Guild properties if needed
    } as unknown as Partial<Guild>; // Cast to unknown first

    // Create a more complete User mock including toString and valueOf
     const mockUser: Partial<User> = {
        id: userId,
        tag: 'testuser#1234',
        username: 'testuser',
        bot: false,
        displayAvatarURL: jest.fn(() => 'mock_avatar_url'),
        flags: { bitfield: 0 } as any, // Add a basic flags mock
        // Ensure toString returns the correct template literal type
        toString: jest.fn((): `<@${string}>` => `<@${userId}>`),
        // Add a basic valueOf mock
        valueOf: jest.fn(() => userId),
    };


    return {
        user: mockUser as User, // Assign the more complete mock
        guildId: guildId,
        guild: mockGuild as Guild,
        member: mockGuildMember as GuildMember,
        reply: jest.fn().mockResolvedValue(undefined),
        // Add other ButtonInteraction properties if needed like `deferReply`, `editReply`
    } as unknown as Partial<ButtonInteraction>; // Cast final object
};

// --- Tests ---

describe('dutyButtons', () => {
    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Prisma mocks
        (prisma.dutySession.findFirst as jest.Mock).mockReset();
        (prisma.dutySession.create as jest.Mock).mockReset();
        (prisma.dutySession.findMany as jest.Mock).mockReset();
        (prisma.dutySession.updateMany as jest.Mock).mockReset();
        (prisma.dutySession.count as jest.Mock).mockReset();
        (prisma.guildSettings.findUnique as jest.Mock).mockReset();
        // Reset Embed mocks
        mockEmbedSetColor.mockClear().mockReturnThis();
        mockEmbedSetTitle.mockClear().mockReturnThis();
        mockEmbedSetDescription.mockClear().mockReturnThis();
        mockEmbedSetFooter.mockClear().mockReturnThis();
        mockEmbedSetTimestamp.mockClear().mockReturnThis();
        mockEmbedSetThumbnail.mockClear().mockReturnThis();
    });

    describe('handleDutyOn', () => {
        const userId = 'user123';
        const guildId = 'guild456';
        const dutyRoleId = 'dutyRole789';
        const onDutyRoleId = 'onDutyRoleABC';
        const notificationChannelId = 'notifyChannelDEF';

        it('should reply with error if user is already on duty', async () => {
            const mockInteraction = createMockInteraction(userId, guildId) as ButtonInteraction;
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue({ id: 'session1', userId, guildId, startTime: new Date(), endTime: null });

            await handleDutyOn(mockInteraction);

            expect(prisma.dutySession.findFirst).toHaveBeenCalledWith({
                where: { userId, guildId, endTime: null },
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)], // Check EmbedBuilder was used
                ephemeral: true,
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('❌ Már szolgálatban vagy!');
            expect(prisma.dutySession.create).not.toHaveBeenCalled();
        });

        it('should reply with error if duty role is required and user lacks it', async () => {
            const mockInteraction = createMockInteraction(userId, guildId, [], []) as ButtonInteraction; // No roles, no admin perm
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null); // Not on duty
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId, onDutyRoleId: null, dutyNotificationsChannelId: null }); // Duty role required

            await handleDutyOn(mockInteraction);

            expect(prisma.guildSettings.findUnique).toHaveBeenCalledWith({ where: { guildId } });
            expect((mockInteraction.member as GuildMember).roles.cache.has(dutyRoleId)).toBe(false);
            expect((mockInteraction.member as GuildMember).permissions.has('Administrator')).toBe(false);
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                ephemeral: true,
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('❌ Jogosultság megtagadva');
            expect(prisma.dutySession.create).not.toHaveBeenCalled();
        });

        it('should allow user with duty role to start duty', async () => {
             const mockInteraction = createMockInteraction(userId, guildId, [dutyRoleId], []) as ButtonInteraction; // Has duty role
             const startTime = new Date();
             const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId, onDutyRoleId: null, dutyNotificationsChannelId: null });
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00'); // Mock formatted time

            await handleDutyOn(mockInteraction);

            expect(prisma.dutySession.create).toHaveBeenCalledWith({ data: { userId, guildId } });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                // Not ephemeral if no notification channel
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔰 Szolgálat megkezdve');
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`### <@${userId}> szolgálatba lépett`));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`🆔 Azonosító: ${newSessionId}`));
        });

        it('should allow user with Administrator permission to start duty (even without role)', async () => {
             const mockInteraction = createMockInteraction(userId, guildId, [], ['Administrator']) as ButtonInteraction; // No role, but Admin
             const startTime = new Date();
             const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId, onDutyRoleId: null, dutyNotificationsChannelId: null }); // Duty role configured
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            await handleDutyOn(mockInteraction);

            expect((mockInteraction.member as GuildMember).permissions.has('Administrator')).toBe(true);
            expect(prisma.dutySession.create).toHaveBeenCalledWith({ data: { userId, guildId } });
            expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔰 Szolgálat megkezdve');
        });

        it('should start duty if no duty role is configured', async () => {
             const mockInteraction = createMockInteraction(userId, guildId, [], []) as ButtonInteraction; // No roles, no admin
             const startTime = new Date();
             const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId: null, dutyNotificationsChannelId: null }); // No duty role required
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            await handleDutyOn(mockInteraction);

            expect(prisma.guildSettings.findUnique).toHaveBeenCalledWith({ where: { guildId } });
            expect(prisma.dutySession.create).toHaveBeenCalledWith({ data: { userId, guildId } });
            expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔰 Szolgálat megkezdve');
        });

        it('should add on-duty role if configured and successful', async () => {
            const guildRoles = [{ id: onDutyRoleId, name: 'On Duty', position: 1 }];
            const botRoles = [{ id: 'botRole', name: 'Bot', position: 5 }]; // Bot role higher than target
            const mockInteraction = createMockInteraction(userId, guildId, [], [], guildRoles, botRoles) as ButtonInteraction;
            const startTime = new Date();
            const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId, dutyNotificationsChannelId: null });
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            await handleDutyOn(mockInteraction);

            expect(prisma.dutySession.create).toHaveBeenCalled();
            expect((mockInteraction.guild?.roles.fetch as jest.Mock)).toHaveBeenCalledWith(onDutyRoleId);
            expect((mockInteraction.member as GuildMember).roles.add).toHaveBeenCalledWith({ id: onDutyRoleId, name: 'On Duty', position: 1 });
            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`✅ Szolgálati rang hozzáadva: <@&${onDutyRoleId}> (On Duty)`));
            // Expect logger.info to be called with the string message and potentially other metadata
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully added role On Duty (${onDutyRoleId})`), expect.any(Object));
        });

         it('should handle error if on-duty role does not exist', async () => {
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], []) as ButtonInteraction; // No roles defined in guild
            const startTime = new Date();
            const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId, dutyNotificationsChannelId: null });
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');
            // Mock role fetch to resolve to null (role deleted)
            (mockInteraction.guild?.roles.fetch as jest.Mock).mockResolvedValue(null);


            await handleDutyOn(mockInteraction);

            expect(prisma.dutySession.create).toHaveBeenCalled();
            expect((mockInteraction.guild?.roles.fetch as jest.Mock)).toHaveBeenCalledWith(onDutyRoleId);
            expect((mockInteraction.member as GuildMember).roles.add).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`⚠️ Nem sikerült a szolgálati rang hozzáadása: a szerep nem létezik`));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Role with ID ${onDutyRoleId} does not exist`));
        });

        it('should handle error if bot lacks permission to add role', async () => {
            const guildRoles = [{ id: onDutyRoleId, name: 'On Duty', position: 10 }]; // Target role higher
            const botRoles = [{ id: 'botRole', name: 'Bot', position: 5 }]; // Bot role lower
            const mockInteraction = createMockInteraction(userId, guildId, [], [], guildRoles, botRoles) as ButtonInteraction;
            const startTime = new Date();
            const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId, dutyNotificationsChannelId: null });
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            await handleDutyOn(mockInteraction);

            expect(prisma.dutySession.create).toHaveBeenCalled();
            expect((mockInteraction.guild?.roles.fetch as jest.Mock)).toHaveBeenCalledWith(onDutyRoleId);
            expect((mockInteraction.guild?.members.fetchMe as jest.Mock)).toHaveBeenCalled();
            expect((mockInteraction.member as GuildMember).roles.add).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`⚠️ Nem sikerült a szolgálati rang hozzáadása: a bot szerepe alacsonyabb`));
            // Expect logger.error to be called with the string message and potentially other metadata
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Bot cannot add role On Duty (${onDutyRoleId}) as it is positioned higher`), expect.any(Object));
        });

        it('should send notification to channel if configured', async () => {
            const channels = [{ id: notificationChannelId, name: 'duty-log', type: 0 }]; // Text channel
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], [], channels) as ButtonInteraction;
            const startTime = new Date();
            const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId: null, dutyNotificationsChannelId: notificationChannelId }); // Corrected variable name
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            await handleDutyOn(mockInteraction);

            // Get the mock fetch function
            const fetchMock = mockInteraction.guild?.channels.fetch as jest.Mock;
            expect(fetchMock).toHaveBeenCalledWith(notificationChannelId);

            // Access the *result* of the fetch call made inside handleDutyOn
            // fetchMock.mock.results[0].value is the promise, .then() or await to get the channel
            const channelSendMock = (await fetchMock.mock.results[0].value).send;

            expect(prisma.dutySession.create).toHaveBeenCalled();
            expect(channelSendMock).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
            // Should also send ephemeral confirmation to user
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                ephemeral: true,
            });
             // Check the ephemeral reply embed title
            // We check the last calls to the globally mocked EmbedBuilder methods
            expect(mockEmbedSetTitle).toHaveBeenLastCalledWith('🔰 Szolgálat megkezdve');
            expect(mockEmbedSetDescription).toHaveBeenLastCalledWith('A szolgálati időd mérése megkezdődött.');
        });

        it('should reply directly if notification channel is not text-based', async () => {
            const channels = [{ id: notificationChannelId, name: 'duty-log-voice', type: 2 }]; // Voice channel
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], [], channels) as ButtonInteraction;
            const startTime = new Date();
            const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId: null, dutyNotificationsChannelId: notificationChannelId }); // Corrected variable name
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            // Mock channel fetch to return the non-text channel
            (mockInteraction.guild?.channels.fetch as jest.Mock).mockResolvedValue({
                id: notificationChannelId,
                name: 'duty-log-voice',
                type: 2,
                isTextBased: () => false, // Explicitly mock isTextBased
                send: jest.fn() // Include send mock even if not expected to be called
            });

            await handleDutyOn(mockInteraction);

            // Get the mock fetch function to check call args
            const fetchMock = mockInteraction.guild?.channels.fetch as jest.Mock;
            expect(fetchMock).toHaveBeenCalledWith(notificationChannelId);

            // Access the resolved channel object from the fetch call inside the function
             const fetchedChannel = await fetchMock.mock.results[0].value;
             // Check that send was NOT called on this object
             expect(fetchedChannel.send).not.toHaveBeenCalled();

            expect(prisma.dutySession.create).toHaveBeenCalled();
            // Expect logger.error to be called with the string message and potentially other metadata
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Channel with ID ${notificationChannelId} is not a text channel`), expect.any(Object));
            // Should reply directly with the main embed
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                // Not ephemeral
            });
            // Check the direct reply embed title
            expect(mockEmbedSetTitle).toHaveBeenLastCalledWith('🔰 Szolgálat megkezdve');
        });

         it('should reply directly if sending to notification channel fails', async () => {
            const channels = [{ id: notificationChannelId, name: 'duty-log', type: 0 }]; // Text channel
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], [], channels) as ButtonInteraction;
            const startTime = new Date();
            const newSessionId = 'newSessionXYZ';
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: null, onDutyRoleId: null, dutyNotificationsChannelId: notificationChannelId }); // Corrected variable name
            (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: newSessionId, userId, guildId, startTime, endTime: null });
            (formatDateTime as jest.Mock).mockReturnValue('2024-01-01 12:00');

            // Mock channel fetch and make send fail
            const mockChannel = {
                id: notificationChannelId,
                isTextBased: () => true,
                send: jest.fn().mockRejectedValue(new Error('Discord API Error')),
            };
            (mockInteraction.guild?.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);


            await handleDutyOn(mockInteraction);

            expect(prisma.dutySession.create).toHaveBeenCalled();
            expect(mockInteraction.guild?.channels.fetch).toHaveBeenCalledWith(notificationChannelId);
            expect(mockChannel.send).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error sending to notification channel ${notificationChannelId}`), expect.any(Object));
            // Should fall back to replying directly
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                // Not ephemeral
            });
            expect(mockEmbedSetTitle).toHaveBeenLastCalledWith('🔰 Szolgálat megkezdve');
        });

    });

    describe('handleDutyOff', () => {
        const userId = 'user123';
        const guildId = 'guild456';
        const onDutyRoleId = 'onDutyRoleABC';
        const notificationChannelId = 'notifyChannelDEF';

        it('should reply with error if user is not on duty', async () => {
            const mockInteraction = createMockInteraction(userId, guildId) as ButtonInteraction;
            // Mock findMany to return an empty array (no active sessions)
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([]);

            await handleDutyOff(mockInteraction);

            expect(prisma.dutySession.findMany).toHaveBeenCalledWith({
                where: { userId, guildId, endTime: null },
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                ephemeral: true,
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('❌ Nem vagy szolgálatban!');
            expect(prisma.dutySession.updateMany).not.toHaveBeenCalled(); // Ensure session wasn't updated
        });

        it('should end the duty session successfully', async () => {
            const mockInteraction = createMockInteraction(userId, guildId) as ButtonInteraction;
            const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]); // Found active session
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null, dutyNotificationsChannelId: null }); // No role/channel
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(5); // Assume 5 total completed now
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString()); // Simple format

            await handleDutyOff(mockInteraction);

            expect(prisma.dutySession.findMany).toHaveBeenCalledWith({ where: { userId, guildId, endTime: null } });
            expect(prisma.dutySession.updateMany).toHaveBeenCalledWith({
                where: { userId, guildId, endTime: null },
                data: { endTime: expect.any(Date) },
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                // Not ephemeral if no notification channel
            });
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('🛑 Szolgálat befejezve');
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`### <@${userId}> befejezte a szolgálatot`));
            // Use regex for approximate duration check
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringMatching(/Időtartam: 1ó 0p \d{1,2}mp/));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Összes befejezett szolgálat: 5`)); // Check total count
        });

        it('should remove the on-duty role if configured', async () => {
            const guildRoles = [{ id: onDutyRoleId, name: 'On Duty', position: 1 }];
            const botRoles = [{ id: 'botRole', name: 'Bot', position: 5 }]; // Bot role higher than target
            const mockInteraction = createMockInteraction(userId, guildId, [onDutyRoleId], [], guildRoles, botRoles) as ButtonInteraction;
            const startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId, dutyNotificationsChannelId: null });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());

            await handleDutyOff(mockInteraction);

            expect(prisma.dutySession.updateMany).toHaveBeenCalled();
            expect((mockInteraction.guild?.roles.fetch as jest.Mock)).toHaveBeenCalledWith(onDutyRoleId);
            expect((mockInteraction.member as GuildMember).roles.remove).toHaveBeenCalledWith({ id: onDutyRoleId, name: 'On Duty', position: 1 });
            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`✅ Szolgálati rang eltávolítva: <@&${onDutyRoleId}> (On Duty)`));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed role On Duty (${onDutyRoleId})`), expect.any(Object));
        });

        it('should handle error if on-duty role does not exist for removal', async () => {
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], []) as ButtonInteraction; // No roles defined in guild
            const startTime = new Date(Date.now() - 10 * 60 * 1000); // 10 mins ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId, dutyNotificationsChannelId: null });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());
            // Mock role fetch to resolve to null
            (mockInteraction.guild?.roles.fetch as jest.Mock).mockResolvedValue(null);

            await handleDutyOff(mockInteraction);

            expect(prisma.dutySession.updateMany).toHaveBeenCalled();
            expect((mockInteraction.guild?.roles.fetch as jest.Mock)).toHaveBeenCalledWith(onDutyRoleId);
            expect((mockInteraction.member as GuildMember).roles.remove).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`⚠️ Nem sikerült a szolgálati rang eltávolítása: a szerep nem létezik`));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Role with ID ${onDutyRoleId} does not exist`));
        });

        it('should handle error if bot lacks permission to remove role', async () => {
            const guildRoles = [{ id: onDutyRoleId, name: 'On Duty', position: 10 }]; // Target role higher
            const botRoles = [{ id: 'botRole', name: 'Bot', position: 5 }]; // Bot role lower
            const mockInteraction = createMockInteraction(userId, guildId, [onDutyRoleId], [], guildRoles, botRoles) as ButtonInteraction;
            const startTime = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId, dutyNotificationsChannelId: null });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());

            await handleDutyOff(mockInteraction);

            expect(prisma.dutySession.updateMany).toHaveBeenCalled();
            expect((mockInteraction.guild?.roles.fetch as jest.Mock)).toHaveBeenCalledWith(onDutyRoleId);
            expect((mockInteraction.guild?.members.fetchMe as jest.Mock)).toHaveBeenCalled();
            expect((mockInteraction.member as GuildMember).roles.remove).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`⚠️ Nem sikerült a szolgálati rang eltávolítása: a bot szerepe alacsonyabb`));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Bot cannot remove role On Duty (${onDutyRoleId}) as it is positioned higher`), expect.any(Object));
        });

        it('should send notification to channel if configured', async () => {
            const channels = [{ id: notificationChannelId, name: 'duty-log', type: 0 }]; // Text channel
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], [], channels) as ButtonInteraction;
            const startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null, dutyNotificationsChannelId: notificationChannelId });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());

            await handleDutyOff(mockInteraction);

            const fetchMock = mockInteraction.guild?.channels.fetch as jest.Mock;
            expect(fetchMock).toHaveBeenCalledWith(notificationChannelId);
            const channelSendMock = (await fetchMock.mock.results[0].value).send;

            expect(prisma.dutySession.updateMany).toHaveBeenCalled();
            expect(channelSendMock).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
            // Should also send ephemeral confirmation to user
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                ephemeral: true,
            });
            // Check the ephemeral reply embed title
            expect(mockEmbedSetTitle).toHaveBeenLastCalledWith('🛑 Szolgálat befejezve');
            expect(mockEmbedSetDescription).toHaveBeenLastCalledWith('A szolgálati időd rögzítésre került.');
        });

        it('should reply directly if notification channel is not text-based', async () => {
            const channels = [{ id: notificationChannelId, name: 'duty-log-voice', type: 2 }]; // Voice channel
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], [], channels) as ButtonInteraction;
            const startTime = new Date(Date.now() - 20 * 60 * 1000); // 20 mins ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null, dutyNotificationsChannelId: notificationChannelId });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());

             // Mock channel fetch to return the non-text channel
            (mockInteraction.guild?.channels.fetch as jest.Mock).mockResolvedValue({
                id: notificationChannelId,
                name: 'duty-log-voice',
                type: 2,
                isTextBased: () => false, // Explicitly mock isTextBased
                send: jest.fn() // Include send mock even if not expected to be called
            });

            await handleDutyOff(mockInteraction);

            const fetchMock = mockInteraction.guild?.channels.fetch as jest.Mock;
            expect(fetchMock).toHaveBeenCalledWith(notificationChannelId);
            const fetchedChannel = await fetchMock.mock.results[0].value;
            expect(fetchedChannel.send).not.toHaveBeenCalled();

            expect(prisma.dutySession.updateMany).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Channel with ID ${notificationChannelId} is not a text channel`), expect.any(Object));
            // Should reply directly with the main embed
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                // Not ephemeral
            });
            expect(mockEmbedSetTitle).toHaveBeenLastCalledWith('🛑 Szolgálat befejezve');
        });

        it('should reply directly if sending to notification channel fails', async () => {
            const channels = [{ id: notificationChannelId, name: 'duty-log', type: 0 }]; // Text channel
            const mockInteraction = createMockInteraction(userId, guildId, [], [], [], [], channels) as ButtonInteraction;
            const startTime = new Date(Date.now() - 25 * 60 * 1000); // 25 mins ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null, dutyNotificationsChannelId: notificationChannelId });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());

            // Mock channel fetch and make send fail
            const mockChannel = {
                id: notificationChannelId,
                isTextBased: () => true,
                send: jest.fn().mockRejectedValue(new Error('Discord API Error')),
            };
            (mockInteraction.guild?.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

            await handleDutyOff(mockInteraction);

            expect(prisma.dutySession.updateMany).toHaveBeenCalled();
            expect(mockInteraction.guild?.channels.fetch).toHaveBeenCalledWith(notificationChannelId);
            expect(mockChannel.send).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error sending to notification channel ${notificationChannelId}`), expect.any(Object));
            // Should fall back to replying directly
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
                // Not ephemeral
            });
            expect(mockEmbedSetTitle).toHaveBeenLastCalledWith('🛑 Szolgálat befejezve');
        });

        it('should calculate and display duration correctly (e.g., 1h 30m 15s)', async () => {
            const mockInteraction = createMockInteraction(userId, guildId) as ButtonInteraction;
            const durationMs = (1 * 60 * 60 * 1000) + (30 * 60 * 1000) + (15 * 1000); // 1h 30m 15s
            const startTime = new Date(Date.now() - durationMs);
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null, dutyNotificationsChannelId: null });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(1);
            (formatDateTime as jest.Mock).mockImplementation((date: Date) => date.toISOString());

            await handleDutyOff(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Időtartam: 1ó 30p 15mp`));
        });

        it('should display total completed sessions correctly', async () => {
            const mockInteraction = createMockInteraction(userId, guildId) as ButtonInteraction;
            const startTime = new Date(Date.now() - 60 * 1000); // 1 min ago
            const activeSession = { id: 'session1', userId, guildId, startTime, endTime: null };
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([activeSession]);
            (prisma.dutySession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null, dutyNotificationsChannelId: null });
            (prisma.dutySession.count as jest.Mock).mockResolvedValue(10); // Expect 10 total completed

            await handleDutyOff(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Összes befejezett szolgálat: 10`));
        });
    });

    describe('handleShowTime', () => {
        const userId = 'user123';
        const guildId = 'guild456';
        const onDutyRoleId = 'onDutyRoleABC';
        let mockInteraction: Partial<ButtonInteraction>;
        let mockReply: jest.Mock;

        beforeEach(() => {
            mockReply = jest.fn().mockResolvedValue(undefined); // Ensure reply mock resolves
            // Create a more complete User mock including toString and valueOf
            const mockUser: Partial<User> = {
                id: userId,
                tag: 'testuser#1234',
                username: 'testuser',
                bot: false,
                displayAvatarURL: jest.fn(() => 'mock_avatar_url'),
                flags: { bitfield: 0 } as any, // Add a basic flags mock
                toString: jest.fn((): `<@${string}>` => `<@${userId}>`), // Mock toString
                valueOf: jest.fn(() => userId), // Mock valueOf
            };
            mockInteraction = createMockInteraction(userId, guildId, [], [], [{ id: onDutyRoleId, name: 'On Duty', position: 1 }]) as ButtonInteraction; // Pass role for default setup
            mockInteraction.user = mockUser as User; // Assign the more complete mock
            mockInteraction.reply = mockReply;


            // Mock Prisma calls
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([
                // Mock some completed sessions
                { id: 's1', userId: 'user123', guildId: 'guild456', startTime: new Date(Date.now() - 5 * 60 * 60 * 1000), endTime: new Date(Date.now() - 1 * 60 * 60 * 1000) }, // 4 hours long
                { id: 's2', userId: 'user123', guildId: 'guild456', startTime: new Date(Date.now() - 10 * 60 * 60 * 1000), endTime: new Date(Date.now() - 8 * 60 * 60 * 1000) }, // 2 hours long
            ]);
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue(null); // Default: No active session
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId }); // Mock settings with role ID
        });

        it('should show stats with no active session', async () => {
            await handleShowTime(mockInteraction as ButtonInteraction);

            expect(prisma.dutySession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user123', guildId: 'guild456', endTime: { not: null } } }));
            expect(prisma.dutySession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user123', guildId: 'guild456', endTime: null } }));
            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockReply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));

            // Check embed content via mock calls
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('📊 Szolgálati idő statisztika');
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Összesítés - <@user123>'));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Összes szolgálati idő: 6ó 0p')); // 4 + 2 hours
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Befejezett szolgálatok: 2'));
            expect(mockEmbedSetDescription).not.toHaveBeenCalledWith(expect.stringContaining('Aktív szolgálat'));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Legutóbbi szolgálatok'));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Szolgálati rang: <@&${onDutyRoleId}> (On Duty)`));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Átlagos szolgálati idő: 3ó 0p'));
        });

        it('should show stats with an active session', async () => {
            const activeStartTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
            (prisma.dutySession.findFirst as jest.Mock).mockResolvedValue({
                id: 'sActive', userId: 'user123', guildId: 'guild456', startTime: activeStartTime, endTime: null
            });

            await handleShowTime(mockInteraction as ButtonInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('🔴 Aktív szolgálat'));
            // Use regex for approximate time check due to potential slight timing differences in tests
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringMatching(/Jelenlegi időtartam: 0ó 30p \d{1,2}mp/));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('🆔 Azonosító: sActive'));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Összes szolgálati idő: 6ó 0p')); // Still 6 hours completed
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Befejezett szolgálatok: 2'));
        });

        it('should show stats with no completed sessions', async () => {
            (prisma.dutySession.findMany as jest.Mock).mockResolvedValue([]); // No completed sessions

            await handleShowTime(mockInteraction as ButtonInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Összes szolgálati idő: 0ó 0p'));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Befejezett szolgálatok: 0'));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Nincsenek korábbi szolgálati időszakok.'));
            expect(mockEmbedSetDescription).not.toHaveBeenCalledWith(expect.stringContaining('Átlagos szolgálati idő'));
        });

         it('should handle case where onDutyRoleId is not set in settings', async () => {
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, onDutyRoleId: null }); // No role configured

            await handleShowTime(mockInteraction as ButtonInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Szolgálati rang: Nincs beállítva'));
        });

         it('should handle error fetching onDutyRole', async () => {
            // Ensure the mock interaction's guild role fetch rejects
            (mockInteraction.guild?.roles.fetch as jest.Mock).mockRejectedValue(new Error("Fetch failed"));

            await handleShowTime(mockInteraction as ButtonInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Szolgálati rang: Beállítva, de hiba történt az információ lekérésekor'));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error fetching onDutyRole ${onDutyRoleId}`), expect.any(Object));
        });

        it('should handle case where fetched onDutyRole is null', async () => {
            // Ensure the mock interaction's guild role fetch resolves to null
            (mockInteraction.guild?.roles.fetch as jest.Mock).mockResolvedValue(null);

            await handleShowTime(mockInteraction as ButtonInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Szolgálati rang: Érvénytelen (ID: ${onDutyRoleId})`));
        });
    });

});
