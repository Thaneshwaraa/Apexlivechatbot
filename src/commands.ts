import {
  ChannelType,
  type ChatInputCommandInteraction,
  type Client,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  constructorStandings,
  currentOrNext,
  driverStandings,
  getSeasonYear,
  getSessions,
  latestResult,
  roundResult,
  type ResultKind,
} from './f1';
import {
  constructorStandingsEmbed,
  driverStandingsEmbed,
  nextEmbed,
  reminderEmbed,
  resultEmbed,
  scheduleEmbed,
  SITE_URL,
} from './embeds';
import { sendTo } from './scheduler';
import { getGuild, removeGuild, setGuild } from './store';

export const COMMANDS = [
  new SlashCommandBuilder().setName('next').setDescription('Next F1 session and the full weekend schedule'),
  new SlashCommandBuilder().setName('schedule').setDescription('Upcoming races this season'),
  new SlashCommandBuilder()
    .setName('standings')
    .setDescription('Championship standings')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Drivers or constructors (default: drivers)')
        .addChoices({ name: 'Drivers', value: 'drivers' }, { name: 'Constructors', value: 'constructors' }),
    ),
  new SlashCommandBuilder()
    .setName('results')
    .setDescription('Race, sprint or qualifying results')
    .addStringOption((o) =>
      o
        .setName('session')
        .setDescription('Default: race')
        .addChoices(
          { name: 'Race', value: 'results' },
          { name: 'Sprint', value: 'sprint' },
          { name: 'Qualifying', value: 'qualifying' },
        ),
    )
    .addIntegerOption((o) => o.setName('round').setDescription('Round number (default: latest)').setMinValue(1).setMaxValue(30)),
  new SlashCommandBuilder().setName('notify').setDescription('Turn race-reminder pings on or off for yourself').setDMPermission(false),
  new SlashCommandBuilder()
    .setName('alerts')
    .setDescription('Configure race reminders and results posts for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Post reminders and results to a channel')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Where to post')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addRoleOption((o) => o.setName('role').setDescription('Role to ping for reminders (members can join it with /notify)'))
        .addBooleanOption((o) => o.setName('practice').setDescription('Also remind for practice sessions (default: off)'))
        .addBooleanOption((o) => o.setName('results').setDescription('Post results when published (default: on)')),
    )
    .addSubcommand((s) => s.setName('status').setDescription('Show the current settings'))
    .addSubcommand((s) => s.setName('test').setDescription('Send a sample reminder to the configured channel'))
    .addSubcommand((s) => s.setName('off').setDescription('Stop posting in this server')),
].map((c) => c.toJSON());

export async function registerCommands(client: Client<true>) {
  const devGuild = process.env.DEV_GUILD_ID;
  if (devGuild) {
    await client.application.commands.set(COMMANDS, devGuild);
    console.log(`Registered ${COMMANDS.length} commands in guild ${devGuild}`);
  } else {
    await client.application.commands.set(COMMANDS);
    // Clear any per-server copies left from DEV_GUILD_ID testing, or they'd show twice.
    for (const g of client.guilds.cache.values()) await client.application.commands.set([], g.id).catch(() => {});
    console.log(`Registered ${COMMANDS.length} global commands`);
  }
}

const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export async function handleCommand(i: ChatInputCommandInteraction) {
  switch (i.commandName) {
    case 'next': {
      await i.deferReply();
      const sessions = await getSessions();
      const s = currentOrNext(sessions);
      if (!s) return i.editReply('The season is over — see you next year! 🏁');
      return i.editReply({ embeds: [nextEmbed(s, sessions.filter((x) => x.round === s.round))] });
    }
    case 'schedule': {
      await i.deferReply();
      const races = (await getSessions()).filter((s) => s.name === 'Race' && Date.parse(s.end) > Date.now());
      return i.editReply({ embeds: [scheduleEmbed(await getSeasonYear(), races.slice(0, 8))] });
    }
    case 'standings': {
      await i.deferReply();
      const type = i.options.getString('type') ?? 'drivers';
      const embed =
        type === 'constructors' ? constructorStandingsEmbed(await constructorStandings()) : driverStandingsEmbed(await driverStandings());
      return i.editReply({ embeds: [embed] });
    }
    case 'results': {
      await i.deferReply();
      const kind = (i.options.getString('session') ?? 'results') as ResultKind;
      const round = i.options.getInteger('round');
      const race = round ? await roundResult(await getSeasonYear(), round, kind) : await latestResult(kind);
      if (!race) return i.editReply(round ? `No results for round ${round} yet.` : 'No results yet.');
      return i.editReply({ embeds: [resultEmbed(race, kind)] });
    }
    case 'notify':
      return notify(i);
    case 'alerts':
      return alerts(i);
  }
}

async function notify(i: ChatInputCommandInteraction) {
  const cfg = i.guildId ? getGuild(i.guildId) : undefined;
  if (!i.guild || !cfg?.roleId) return i.reply({ content: 'This server has no reminder role set up yet (an admin can add one with `/alerts setup`).', ...ephemeral });
  // Fetching the member and editing roles can take longer than Discord's 3 s reply window.
  await i.deferReply(ephemeral);
  const member = await i.guild.members.fetch(i.user.id);
  const has = member.roles.cache.has(cfg.roleId);
  try {
    if (has) await member.roles.remove(cfg.roleId);
    else await member.roles.add(cfg.roleId);
  } catch {
    return i.editReply("I couldn't change your roles. An admin needs to give me **Manage Roles** and put my role above the reminder role.");
  }
  return i.editReply(has ? "🔕 You won't be pinged for race reminders any more." : "🔔 You'll be pinged for race reminders.");
}

async function alerts(i: ChatInputCommandInteraction) {
  const guildId = i.guildId!;
  const sub = i.options.getSubcommand();
  if (sub === 'setup') {
    const channel = i.options.getChannel('channel', true);
    const role = i.options.getRole('role');
    const prev = getGuild(guildId);
    const cfg = {
      channelId: channel.id,
      roleId: role?.id ?? null,
      practice: i.options.getBoolean('practice') ?? prev?.practice ?? false,
      results: i.options.getBoolean('results') ?? prev?.results ?? true,
    };
    setGuild(guildId, cfg);
    return i.reply({ content: `✅ Saved.\n${describe(cfg)}\n\nTry \`/alerts test\` to check I can post there.`, ...ephemeral });
  }
  const cfg = getGuild(guildId);
  if (sub === 'status') return i.reply({ content: cfg ? describe(cfg) : 'Alerts are off. Turn them on with `/alerts setup`.', ...ephemeral });
  if (sub === 'off') {
    removeGuild(guildId);
    return i.reply({ content: '🔕 Alerts turned off for this server.', ...ephemeral });
  }
  if (sub === 'test') {
    if (!cfg) return i.reply({ content: 'Run `/alerts setup` first.', ...ephemeral });
    await i.deferReply(ephemeral);
    const s = currentOrNext(await getSessions());
    if (!s) return i.editReply('No upcoming sessions to preview.');
    try {
      await sendTo(i.client, cfg, reminderEmbed(s, 60).setAuthor({ name: 'Test reminder' }), false);
      return i.editReply(`Sent a test to <#${cfg.channelId}>.`);
    } catch (e) {
      return i.editReply(`Couldn't post in <#${cfg.channelId}>: ${(e as Error).message}. Check my permissions there.`);
    }
  }
}

function describe(cfg: { channelId: string; roleId: string | null; practice: boolean; results: boolean }) {
  return [
    `**Channel:** <#${cfg.channelId}>`,
    `**Ping role:** ${cfg.roleId ? `<@&${cfg.roleId}>` : 'none'}`,
    `**Reminders:** race 1 day / 1 hour / 10 min before and at lights out; sprint & qualifying 1 hour / 10 min before${cfg.practice ? '; practice 10 min before' : ''}`,
    `**Results posts:** ${cfg.results ? 'on' : 'off'}`,
    `Website: ${SITE_URL}`,
  ].join('\n');
}
