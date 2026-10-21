import './env';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { handleCommand, registerCommands } from './commands';
import { startScheduler } from './scheduler';
import { removeGuild } from './store';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is missing — copy .env.example to .env and add your bot token.');
  process.exit(1);
}

// Only the Guilds intent: slash commands need no privileged intents.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag} in ${c.guilds.cache.size} server(s)`);
  await registerCommands(c);
  startScheduler(c);
});

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;
  try {
    await handleCommand(i);
  } catch (e) {
    console.error(`/${i.commandName} failed:`, e);
    const msg = { content: "Something went wrong fetching F1 data — try again in a minute.", flags: MessageFlags.Ephemeral } as const;
    if (i.deferred || i.replied) await i.editReply({ content: msg.content }).catch(() => {});
    else await i.reply(msg).catch(() => {});
  }
});

client.on(Events.GuildDelete, (g) => removeGuild(g.id));

client.login(token);
