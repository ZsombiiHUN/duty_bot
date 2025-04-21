import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsBitField,
    Collection,
    Role,
    User,
    Guild,
    GuildMember,
    CacheType,
    ApplicationCommandOptionType, // Import necessary types
    Channel,
    TextChannel, // For channel type checks
    CommandInteractionOptionResolver
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { execute, data } from '../dutyadmin'; // Adjust path as needed
// Mock the helper functions from the original file if they aren't exported/imported from utils
// If they are in utils, mock the utils file instead. Assuming they are local for now.
// jest.mock('../dutyadmin', () => ({
//     ...jest.requireActual('../dutyadmin'),
//     parseDateTime: jest.fn(),
//     formatDateTime: jest.fn(),
//     parseDate: jest.fn(),
//     formatDate: jest.fn(),
//     padZero: jest.fn((num) => num < 10 ? `0${num}` : num.toString()), // Keep simple implementation
// }));
// OR mock utils if helpers are there:
jest.mock('../../utils/dateTimeUtils', () => ({
    parseDateTime: jest.fn(),
    formatDateTime: jest.fn((date: Date) => date ? date.toISOString() : 'Invalid Date'), // Simple mock format
    parseDate: jest.fn(),
    formatDate: jest.fn((date: Date) => date ? date.toISOString().split('T')[0] : 'Invalid Date'), // Simple mock format
    padZero: jest.fn((num: number) => num < 10 ? `0${num}` : num.toString()),
}));


// --- Mocks ---

// Mock Prisma Client
jest.mock('@prisma/client', () => {
    const mockPrismaClient = {
        guildSettings: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        dutySession: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn(), // Added for export subcommand
        },
        // Mock other models if used
    };
    return { PrismaClient: jest.fn(() => mockPrismaClient) };
});
const prisma = new PrismaClient(); // Get the mocked instance

// Mock EmbedBuilder
const mockEmbedSetColor = jest.fn().mockReturnThis();
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetDescription = jest.fn().mockReturnThis();
const mockEmbedSetTimestamp = jest.fn().mockReturnThis();
const mockEmbedAddFields = jest.fn().mockReturnThis(); // Added for summary/metrics
const mockEmbedSetFooter = jest.fn().mockReturnThis(); // Added for export

jest.mock('discord.js', () => {
    const originalModule = jest.requireActual('discord.js');
    return {
        ...originalModule,
        EmbedBuilder: jest.fn(() => ({
            setColor: mockEmbedSetColor,
            setTitle: mockEmbedSetTitle,
            setDescription: mockEmbedSetDescription,
            setTimestamp: mockEmbedSetTimestamp,
            addFields: mockEmbedAddFields,
            setFooter: mockEmbedSetFooter,
        })),
        PermissionsBitField: originalModule.PermissionsBitField,
        Collection: originalModule.Collection,
        ApplicationCommandOptionType: originalModule.ApplicationCommandOptionType, // Ensure this is exported
    };
});

// Mock environment variables
const mockDutyRoleId = 'mockDutyRoleIdEnv123';
process.env.DUTY_ROLE_ID = mockDutyRoleId;

// Helper to create a mock ChatInputCommandInteraction
const createMockChatInteraction = (
    userId: string,
    guildId: string,
    subcommand: string,
    options: Record<string, any> = {}, // Simple key-value for options
    memberPermissions: bigint[] = []
): Partial<ChatInputCommandInteraction> => {

    const mockGuildMember = {
        id: userId,
        user: { id: userId, tag: 'testuser#1234' } as User,
        roles: { cache: new Collection<string, Role>() }, // Assume no roles unless specified
        permissions: {
            has: jest.fn((perm: bigint | Readonly<PermissionsBitField>) => {
                const permBigInt = typeof perm === 'bigint' ? perm : perm.bitfield;
                return memberPermissions.includes(permBigInt);
            }),
        } as unknown as PermissionsBitField,
    } as GuildMember;

    const mockGuild = {
        id: guildId,
        members: {
            cache: { get: jest.fn().mockReturnValue(mockGuildMember) },
            fetch: jest.fn().mockResolvedValue(mockGuildMember), // For fetching users in export
            fetchMe: jest.fn().mockResolvedValue({ // Mock fetchMe for permission checks
                roles: { highest: { position: 10 } } // Assume bot has high role position
            } as Partial<GuildMember>),
        },
        roles: {
            fetch: jest.fn().mockImplementation(async (id?: string) => { // Mock role fetching
                if (id === 'validRoleId') return { id: 'validRoleId', name: 'Valid Role', position: 5 } as Role;
                if (id === 'higherRoleId') return { id: 'higherRoleId', name: 'Higher Role', position: 15 } as Role;
                return null; // Or reject for not found
            }),
        },
        channels: {
             fetch: jest.fn().mockImplementation(async (id?: string) => { // Mock channel fetching
                 if (id === 'validChannelId') return { id: 'validChannelId', name: 'valid-channel', isTextBased: () => true, send: jest.fn() } as unknown as TextChannel;
                 if (id === 'nonTextChannelId') return { id: 'nonTextChannelId', name: 'voice-channel', isTextBased: () => false } as unknown as Channel;
                 return null;
             }),
        }
    } as unknown as Guild;

    // Mock options resolver
    const mockOptionsResolver = {
        getSubcommand: jest.fn(() => subcommand),
        getString: jest.fn((name: string) => options[name] ?? null),
        getInteger: jest.fn((name: string) => options[name] ?? null),
        getBoolean: jest.fn((name: string) => options[name] ?? null),
        getUser: jest.fn((name: string) => options[name] ?? null),
        getRole: jest.fn((name: string) => options[name] ?? null),
        getChannel: jest.fn((name: string) => options[name] ?? null),
        getNumber: jest.fn((name: string) => options[name] ?? null), // Added for requirements
    } as unknown as CommandInteractionOptionResolver<CacheType>;


    return {
        user: mockGuildMember.user,
        guildId: guildId,
        guild: mockGuild,
        member: mockGuildMember,
        options: mockOptionsResolver,
        reply: jest.fn().mockResolvedValue(undefined),
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
        isChatInputCommand: () => true, // Necessary for type guard
    } as Partial<ChatInputCommandInteraction>;
};

// --- Tests ---
describe('/dutyadmin command', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Prisma mocks
        (prisma.guildSettings.findUnique as jest.Mock).mockReset();
        (prisma.guildSettings.create as jest.Mock).mockReset();
        (prisma.guildSettings.update as jest.Mock).mockReset();
        (prisma.dutySession.create as jest.Mock).mockReset();
        (prisma.dutySession.findUnique as jest.Mock).mockReset();
        (prisma.dutySession.update as jest.Mock).mockReset();
        (prisma.dutySession.delete as jest.Mock).mockReset();
        (prisma.dutySession.findMany as jest.Mock).mockReset();
        (prisma.dutySession.deleteMany as jest.Mock).mockReset();
        // Reset Embed mocks
        mockEmbedSetColor.mockClear().mockReturnThis();
        mockEmbedSetTitle.mockClear().mockReturnThis();
        mockEmbedSetDescription.mockClear().mockReturnThis();
        mockEmbedSetTimestamp.mockClear().mockReturnThis();
        mockEmbedAddFields.mockClear().mockReturnThis();
        mockEmbedSetFooter.mockClear().mockReturnThis();
        // Reset util mocks
        (require('../../utils/dateTimeUtils').parseDateTime as jest.Mock).mockClear();
        (require('../../utils/dateTimeUtils').formatDateTime as jest.Mock).mockClear().mockImplementation((date: Date) => date ? date.toISOString() : 'Invalid Date');
        (require('../../utils/dateTimeUtils').parseDate as jest.Mock).mockClear();
        (require('../../utils/dateTimeUtils').formatDate as jest.Mock).mockClear().mockImplementation((date: Date) => date ? date.toISOString().split('T')[0] : 'Invalid Date');
    });

    it('should have the correct name, description, and permissions', () => {
        expect(data.name).toBe('dutyadmin');
        expect(data.description).toBe('Szolgálati idő adminisztráció');
        expect(data.default_member_permissions).toEqual(PermissionsBitField.Flags.Administrator.toString());
        expect(data.dm_permission).toBe(false);
    });

    it('should deny access if user is not an Administrator', async () => {
        const mockInteraction = createMockChatInteraction('user123', 'guild1', 'add', {}, []) as ChatInputCommandInteraction; // No admin perms

        await execute(mockInteraction);

        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'Ezt a parancsot csak adminisztrátor használhatja!',
            ephemeral: true,
        });
        // Ensure no prisma calls were made
        expect(prisma.guildSettings.findUnique).not.toHaveBeenCalled();
        expect(prisma.dutySession.create).not.toHaveBeenCalled();
    });

    it('should fetch or create guild settings', async () => {
        const mockInteraction = createMockChatInteraction('adminUser', 'guild1', 'add', {}, [PermissionsBitField.Flags.Administrator]) as ChatInputCommandInteraction;
        // Mock settings not found, then created
        (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.guildSettings.create as jest.Mock).mockResolvedValue({ guildId: 'guild1', dutyRoleId: mockDutyRoleId });
        // Mock subcommand execution to prevent further errors in this specific test
        (prisma.dutySession.create as jest.Mock).mockResolvedValue({ id: 1 }); // Mock session creation for 'add'
        (require('../../utils/dateTimeUtils').parseDateTime as jest.Mock).mockReturnValue(new Date()); // Mock date parsing


        await execute(mockInteraction);

        expect(prisma.guildSettings.findUnique).toHaveBeenCalledWith({ where: { guildId: 'guild1' } });
        expect(prisma.guildSettings.create).toHaveBeenCalledWith({
            data: { guildId: 'guild1', dutyRoleId: mockDutyRoleId }
        });
    });

    describe('add subcommand', () => {
        const userId = 'targetUser1';
        const guildId = 'guild1';
        const adminUserId = 'adminUser';
        const startTimeStr = '2024-01-01 10:00';
        const endTimeStr = '2024-01-01 12:00';
        const startTime = new Date(startTimeStr);
        const endTime = new Date(endTimeStr);

        beforeEach(() => {
            // Mock successful date parsing
            (require('../../utils/dateTimeUtils').parseDateTime as jest.Mock)
                .mockImplementation((str: string) => {
                    if (str === startTimeStr) return startTime;
                    if (str === endTimeStr) return endTime;
                    throw new Error('Invalid test date string');
                });
            // Mock settings found
            (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({ guildId, dutyRoleId: mockDutyRoleId });
        });

        it('should add a duty session successfully', async () => {
            const mockUser = { id: userId, tag: 'target#0001' } as User;
            const mockInteraction = createMockChatInteraction(
                adminUserId,
                guildId,
                'add',
                { user: mockUser, start_time: startTimeStr, end_time: endTimeStr },
                [PermissionsBitField.Flags.Administrator]
            ) as ChatInputCommandInteraction;

            const createdSession = { id: 123, userId, guildId, startTime, endTime };
            (prisma.dutySession.create as jest.Mock).mockResolvedValue(createdSession);

            await execute(mockInteraction);

            expect(require('../../utils/dateTimeUtils').parseDateTime).toHaveBeenCalledWith(startTimeStr);
            expect(require('../../utils/dateTimeUtils').parseDateTime).toHaveBeenCalledWith(endTimeStr);
            expect(prisma.dutySession.create).toHaveBeenCalledWith({
                data: { userId, guildId, startTime, endTime },
            });
            expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
            });
            expect(mockEmbedSetColor).toHaveBeenCalledWith(0x00FF00);
            expect(mockEmbedSetTitle).toHaveBeenCalledWith('Szolgálati idő hozzáadva');
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Szolgálati idő rögzítve <@${userId}> számára.`));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`ID: ${createdSession.id}`));
            expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`Időtartam: 2ó 0p`)); // 12:00 - 10:00 = 2h
        });

        it('should reply with error for invalid date format', async () => {
             const mockUser = { id: userId, tag: 'target#0001' } as User;
             const mockInteraction = createMockChatInteraction(
                 adminUserId,
                 guildId,
                 'add',
                 { user: mockUser, start_time: 'invalid-date', end_time: endTimeStr },
                 [PermissionsBitField.Flags.Administrator]
             ) as ChatInputCommandInteraction;

            // Mock parseDateTime to throw for the invalid string
            (require('../../utils/dateTimeUtils').parseDateTime as jest.Mock)
                .mockImplementation((str: string) => {
                    if (str === 'invalid-date') throw new Error('Invalid date format');
                    if (str === endTimeStr) return endTime;
                    return new Date(); // Should not be reached ideally
                });

            await execute(mockInteraction);

            expect(require('../../utils/dateTimeUtils').parseDateTime).toHaveBeenCalledWith('invalid-date');
            expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Érvénytelen dátum/idő formátum. Használd a YYYY-MM-DD HH:MM formátumot.',
                ephemeral: true,
            });
            expect(prisma.dutySession.create).not.toHaveBeenCalled();
        });

        it('should reply with error if start time is after end time', async () => {
             const mockUser = { id: userId, tag: 'target#0001' } as User;
             const mockInteraction = createMockChatInteraction(
                 adminUserId,
                 guildId,
                 'add',
                 { user: mockUser, start_time: endTimeStr, end_time: startTimeStr }, // Swapped times
                 [PermissionsBitField.Flags.Administrator]
             ) as ChatInputCommandInteraction;

            // Mock parsing to return swapped dates
            (require('../../utils/dateTimeUtils').parseDateTime as jest.Mock)
                .mockImplementation((str: string) => {
                    if (str === startTimeStr) return startTime; // end_time option gets startTime
                    if (str === endTimeStr) return endTime;     // start_time option gets endTime
                    throw new Error('Invalid test date string');
                });


            await execute(mockInteraction);

            expect(require('../../utils/dateTimeUtils').parseDateTime).toHaveBeenCalledWith(endTimeStr); // Called for start_time option
            expect(require('../../utils/dateTimeUtils').parseDateTime).toHaveBeenCalledWith(startTimeStr); // Called for end_time option
            expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'A kezdés időpontja nem lehet későbbi, mint a befejezés időpontja.',
                ephemeral: true,
            });
            expect(prisma.dutySession.create).not.toHaveBeenCalled();
        });
    });

    // Add more describe blocks for other subcommands (edit, delete, role, status_role, check, etc.)
    // Example for 'check'
    describe('check subcommand', () => {
         const guildId = 'guild1';
         const adminUserId = 'adminUser';
         const dutyRoleId = 'dutyR1';
         const onDutyRoleId = 'onDutyR2';
         const notificationChannelId = 'validChannelId';

         it('should display settings status correctly when all are configured', async () => {
             const mockInteraction = createMockChatInteraction(
                 adminUserId, guildId, 'check', {}, [PermissionsBitField.Flags.Administrator]
             ) as ChatInputCommandInteraction;

             (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue({
                 guildId,
                 dutyRoleId,
                 onDutyRoleId,
                 dutyNotificationsChannelId: notificationChannelId,
             });
             // Mocks for role/channel fetch are in createMockChatInteraction helper

             await execute(mockInteraction);

             expect(prisma.guildSettings.findUnique).toHaveBeenCalledWith({ where: { guildId } });
             expect(mockInteraction.guild?.roles.fetch).toHaveBeenCalledWith(dutyRoleId);
             expect(mockInteraction.guild?.roles.fetch).toHaveBeenCalledWith(onDutyRoleId);
             expect(mockInteraction.guild?.channels.fetch).toHaveBeenCalledWith(notificationChannelId);
             expect(mockInteraction.guild?.members.fetchMe).toHaveBeenCalled(); // For bot permission check

             expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
             expect(mockInteraction.reply).toHaveBeenCalledWith({
                 embeds: [expect.any(Object)],
                 ephemeral: true,
             });
             expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔍 Szolgálati beállítások ellenőrzése');
             expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`✅ <@&${dutyRoleId}> (Valid Role)`));
             expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`✅ <@&${onDutyRoleId}> (Valid Role)`)); // Assuming 'validRoleId' is used for both in helper
             expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining(`✅ <#${notificationChannelId}> (valid-channel)`));
             expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('✅ A bot rendelkezik a szerepek kezeléséhez szükséges jogosultságokkal')); // Assuming bot has ManageRoles
         });

         it('should display status when settings are not found', async () => {
             const mockInteraction = createMockChatInteraction(
                 adminUserId, guildId, 'check', {}, [PermissionsBitField.Flags.Administrator]
             ) as ChatInputCommandInteraction;

             (prisma.guildSettings.findUnique as jest.Mock).mockResolvedValue(null);

             await execute(mockInteraction);

             expect(prisma.guildSettings.findUnique).toHaveBeenCalledWith({ where: { guildId } });
             expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
             expect(mockInteraction.reply).toHaveBeenCalledWith({
                 content: '⚠️ Nem találhatóak szerver beállítások. Használd a `/dutyadmin role` és `/dutyadmin status_role` parancsokat a beállításhoz.',
                 ephemeral: true,
             });
         });

         // Add more tests for 'check' covering invalid roles, channels, bot permissions etc.
    });

});
