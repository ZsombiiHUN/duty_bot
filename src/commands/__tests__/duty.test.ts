import {
    CommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    GuildMember,
    PermissionsBitField,
    Collection,
    Role,
    User,
    Guild,
    ButtonStyle // Import ButtonStyle
} from 'discord.js';
import { execute, data } from '../duty';
import { BUTTON_ID_DUTY_ON, BUTTON_ID_DUTY_OFF, BUTTON_ID_SHOW_TIME } from '../../constants';

// --- Mocks ---

// Mock EmbedBuilder
const mockEmbedSetColor = jest.fn().mockReturnThis();
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetDescription = jest.fn().mockReturnThis();
const mockEmbedSetFooter = jest.fn().mockReturnThis();
const mockEmbedSetTimestamp = jest.fn().mockReturnThis();

// Mock ButtonBuilder
const mockButtonSetCustomId = jest.fn().mockReturnThis();
const mockButtonSetLabel = jest.fn().mockReturnThis();
const mockButtonSetStyle = jest.fn().mockReturnThis();

// Mock ActionRowBuilder
const mockActionRowAddComponents = jest.fn().mockReturnThis();


jest.mock('discord.js', () => {
    const originalModule = jest.requireActual('discord.js');
    return {
        ...originalModule,
        EmbedBuilder: jest.fn(() => ({
            setColor: mockEmbedSetColor,
            setTitle: mockEmbedSetTitle,
            setDescription: mockEmbedSetDescription,
            setFooter: mockEmbedSetFooter,
            setTimestamp: mockEmbedSetTimestamp,
        })),
        ButtonBuilder: jest.fn(() => ({
            setCustomId: mockButtonSetCustomId,
            setLabel: mockButtonSetLabel,
            setStyle: mockButtonSetStyle,
        })),
        ActionRowBuilder: jest.fn(() => ({
            addComponents: mockActionRowAddComponents,
        })),
        PermissionsBitField: originalModule.PermissionsBitField,
        Collection: originalModule.Collection,
        ButtonStyle: originalModule.ButtonStyle,
    };
});

// Mock environment variables
const mockDutyRoleId = 'mockDutyRoleId123';
process.env.DUTY_ROLE_ID = mockDutyRoleId;

// Helper to create a mock interaction
const createMockInteraction = (
    userId: string,
    guildId: string,
    memberRoles: string[] = [],
    memberPermissions: bigint[] = [], // Use bigint for permissions flags
    memberExistsInCache: boolean = true // Added flag
): Partial<CommandInteraction> => {

    // Define mockGuildMember structure first
    const mockGuildMember = {
        id: userId,
        user: {
            id: userId,
            tag: 'testuser#1234',
            displayAvatarURL: jest.fn(() => 'mock_avatar_url'),
        } as unknown as User, // Cast to User
        roles: {
            cache: new Collection(memberRoles.map(id => [id, { id, name: `Role ${id}` } as Role])),
        },
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
            cache: {
                get: jest.fn().mockImplementation((id) => {
                    if (id === userId && memberExistsInCache) return mockGuildMember;
                    return undefined;
                }),
            },
        },
    } as unknown as Guild;

    return {
        user: mockGuildMember.user,
        guildId: guildId,
        guild: mockGuild,
        member: memberExistsInCache ? mockGuildMember : null,
        reply: jest.fn().mockResolvedValue(undefined),
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
        // isCommand removed
        // Add other CommandInteraction properties/methods if needed
    } as Partial<CommandInteraction>;
};


// --- Tests ---
describe('/duty command', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockEmbedSetColor.mockClear().mockReturnThis();
        mockEmbedSetTitle.mockClear().mockReturnThis();
        mockEmbedSetDescription.mockClear().mockReturnThis();
        mockEmbedSetFooter.mockClear().mockReturnThis();
        mockEmbedSetTimestamp.mockClear().mockReturnThis();
        mockButtonSetCustomId.mockClear().mockReturnThis();
        mockButtonSetLabel.mockClear().mockReturnThis();
        mockButtonSetStyle.mockClear().mockReturnThis();
        mockActionRowAddComponents.mockClear().mockReturnThis();
    });

    it('should have the correct name and description', () => {
        expect(data.name).toBe('duty');
        expect(data.description).toBe('Szolgálat');
        expect(data.default_member_permissions).toEqual(PermissionsBitField.Flags.Administrator.toString());
    });

    it('should reply with an error if user lacks permissions', async () => {
        const mockInteraction = createMockInteraction('user123', 'guild1', [], []) as CommandInteraction;

        await execute(mockInteraction);

        expect(mockInteraction.guild?.members.cache.get).toHaveBeenCalledWith('user123');
        const member = mockInteraction.member as GuildMember;
        expect(member.roles.cache.has(mockDutyRoleId)).toBe(false);
        expect(member.permissions.has(PermissionsBitField.Flags.Administrator)).toBe(false);

        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            embeds: [expect.any(Object)],
            ephemeral: true,
        });
        expect(mockEmbedSetTitle).toHaveBeenCalledWith('❌ Jogosultság hiányzik');
        expect(mockEmbedSetDescription).toHaveBeenCalledWith('Nincs jogosultságod használni ezt a parancsot!');
    });

    it('should allow access if user has the duty role', async () => {
        const mockInteraction = createMockInteraction('user123', 'guild1', [mockDutyRoleId], []) as CommandInteraction;

        await execute(mockInteraction);

        expect(mockInteraction.guild?.members.cache.get).toHaveBeenCalledWith('user123');
        const member = mockInteraction.member as GuildMember;
        expect(member.roles.cache.has(mockDutyRoleId)).toBe(true);

        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            embeds: [expect.any(Object)],
            components: [expect.any(Object)],
        });
        expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔰 Szolgálati irányítópult');
    });

    it('should allow access if user has Administrator permissions', async () => {
        const mockInteraction = createMockInteraction('user123', 'guild1', [], [PermissionsBitField.Flags.Administrator]) as CommandInteraction;

        await execute(mockInteraction);

        expect(mockInteraction.guild?.members.cache.get).toHaveBeenCalledWith('user123');
        const member = mockInteraction.member as GuildMember;
        expect(member.roles.cache.has(mockDutyRoleId)).toBe(false);
        expect(member.permissions.has(PermissionsBitField.Flags.Administrator)).toBe(true);

        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            embeds: [expect.any(Object)],
            components: [expect.any(Object)],
        });
        expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔰 Szolgálati irányítópult');
    });

    it('should reply with the duty dashboard embed and buttons', async () => {
        const mockInteraction = createMockInteraction('user123', 'guild1', [mockDutyRoleId], []) as CommandInteraction;

        await execute(mockInteraction);

        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);

        // Check Embed
        expect(EmbedBuilder).toHaveBeenCalledTimes(1);
        expect(mockEmbedSetColor).toHaveBeenCalledWith(0x3F51B5);
        expect(mockEmbedSetTitle).toHaveBeenCalledWith('🔰 Szolgálati irányítópult');
        expect(mockEmbedSetDescription).toHaveBeenCalledWith(expect.stringContaining('Szolgálati idő kezelése'));
        expect(mockEmbedSetFooter).toHaveBeenCalledWith({ text: 'További funkciókért használd a /dutyuser és /dutystats parancsokat.' });
        expect(mockEmbedSetTimestamp).toHaveBeenCalledTimes(1);

        // Check ActionRow and Buttons
        expect(ActionRowBuilder).toHaveBeenCalledTimes(1);
        expect(ButtonBuilder).toHaveBeenCalledTimes(3);
        expect(mockActionRowAddComponents).toHaveBeenCalledTimes(1);

        // Check the arguments passed to addComponents (which are the ButtonBuilder instances)
        // Removed the redeclared variable here
        const addedComponents = mockActionRowAddComponents.mock.calls[0][0];
        expect(addedComponents).toHaveLength(3);

        expect(mockButtonSetCustomId).toHaveBeenNthCalledWith(1, BUTTON_ID_DUTY_ON);
        expect(mockButtonSetLabel).toHaveBeenNthCalledWith(1, '🟢 Szolgálat kezdése');
        expect(mockButtonSetStyle).toHaveBeenNthCalledWith(1, ButtonStyle.Success);

        expect(mockButtonSetCustomId).toHaveBeenNthCalledWith(2, BUTTON_ID_DUTY_OFF);
        expect(mockButtonSetLabel).toHaveBeenNthCalledWith(2, '🔴 Szolgálat befejezése');
        expect(mockButtonSetStyle).toHaveBeenNthCalledWith(2, ButtonStyle.Danger);

        expect(mockButtonSetCustomId).toHaveBeenNthCalledWith(3, BUTTON_ID_SHOW_TIME);
        expect(mockButtonSetLabel).toHaveBeenNthCalledWith(3, '📊 Szolgálati idő');
        expect(mockButtonSetStyle).toHaveBeenNthCalledWith(3, ButtonStyle.Primary);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            embeds: [expect.any(Object)],
            components: [expect.any(Object)],
        });
    });

    it('should handle case where member is not found in cache', async () => {
        const mockInteraction = createMockInteraction('user123', 'guild1', [], [], false) as CommandInteraction;

        await execute(mockInteraction);

        expect(mockInteraction.guild?.members.cache.get).toHaveBeenCalledWith('user123');

        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
            embeds: expect.any(Array),
            ephemeral: true,
        }));
        expect(mockEmbedSetTitle).toHaveBeenCalledWith('❌ Jogosultság hiányzik');
    });
});
