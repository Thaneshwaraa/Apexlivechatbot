# ApexLive Discord bot

![ApexLive banner](assets/banner.png)

Formula 1 race reminders, results and standings for your Discord server. Companion to the
[ApexLive website](https://thaneshwaraa.github.io/Apexlive/).

**[Add it to your server →](https://discord.com/oauth2/authorize?client_id=1562349844318654505&scope=bot+applications.commands&permissions=268585984)**

## What it does

**Automatic posts** (after an admin runs `/alerts setup`):

| When | Post |
| --- | --- |
| Race | 1 day, 1 hour and 10 min before, plus "lights out" when it starts |
| Sprint, Qualifying, Sprint Qualifying | 1 hour and 10 min before, plus when it starts |
| Practice (optional) | 10 min before |
| Results | Race, sprint and qualifying classification once published (checked every 5 min) |

Times are shown in IST by default, with a live "in 2 hours" countdown. Set `DISPLAY_TZ` to another
timezone (e.g. `Europe/London`), or to `local` for each reader's own timezone.

**Slash commands**

- `/next`: the next (or live) session and the whole weekend schedule
- `/schedule`: upcoming races, with calendar subscription links
- `/standings [drivers|constructors]`
- `/results [race|sprint|qualifying] [round]`
- `/notify`: join or leave the reminder ping role
- `/alerts setup | status | test | off`: server admins only (Manage Server)

Data comes from [Jolpica-F1](https://github.com/jolpica/jolpica-f1), a free Ergast-compatible API
that needs no key.

## Add it to your server

1. Open the invite link: **[Add ApexLive to Discord](https://discord.com/oauth2/authorize?client_id=1562349844318654505&scope=bot+applications.commands&permissions=268585984)**
2. Choose your server and click **Authorize**. You need the **Manage Server** permission there.
3. In the channel you want updates in, run:

   ```
   /alerts setup channel:#f1-updates
   ```

   Add `role:@F1 Alerts` to ping a role, and `practice:True` for practice reminders.
4. Run `/alerts test` to check the bot can post there.

Members can then type `/notify` to get pinged for reminders. For that to work, the bot's role must
be **above** the ping role in Server Settings → Roles.

The bot only needs these permissions: View Channels, Send Messages, Embed Links, Mention Everyone
(to ping the role) and Manage Roles (for `/notify`). For a private channel, also allow the bot to
view and send messages in that channel's permissions.

## Hosting (maintainers)

To run the bot yourself, put its token in `.env` (see `.env.example`), then `npm install` and
`npm start`. It has to run all the time. Any always-on machine works, such as a small VPS, a Raspberry Pi, or
a host like Railway or Fly.io. To keep it running with pm2:

```bash
npm i -g pm2 && pm2 start npm --name apexlive-bot -- start && pm2 save
```

### bot-hosting.net and other Pterodactyl panels

Run `npm run package`. It creates `apexlive-bot.zip`, which holds `dist/index.js` (the whole bot in
one file), `package.json` and `package-lock.json`. Upload the zip in the panel's **Files** tab and
unarchive it. Then add `DISCORD_TOKEN` in **Environment** (or a `.env` file), set the entry file to
`dist/index.js`, choose Node 20 or newer, and start the server. After a code change, run
`npm run package` again and upload the new `dist/index.js`.

Settings and the list of reminders already sent are saved in `data/state.json`. Keep that file
between restarts. Reminders missed by more than 10 minutes while the bot was offline are skipped,
not posted late.

## Project layout

```
src/
  index.ts       Discord client, command routing
  commands.ts    slash command definitions and handlers
  scheduler.ts   reminder and results jobs
  embeds.ts      message cards
  f1.ts          cached F1 data access
  store.ts       JSON settings / sent-state file
  env.ts         loads .env
  shared/        Jolpica client, session schedule, team registry
assets/          banner and icon for the Developer Portal
```

Unofficial fan project, not associated with Formula 1, the FIA, any team or Discord. F1, FORMULA 1
and related marks are trademarks of Formula One Licensing B.V.
[Terms](https://thaneshwaraa.github.io/Apexlive/discord/terms/) ·
[Privacy](https://thaneshwaraa.github.io/Apexlive/discord/privacy/)
