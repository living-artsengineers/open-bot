import { Client, GatewayIntentBits } from "discord.js";
import env from "./environment";
import modules from "./mod/registry";
import { stripMarkdownTag } from "./utils";

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  for (const [name, mod] of Object.entries(modules)) {
    console.log(`Setting up module: ${name}`);
    await mod.setup?.(client);
  }

  const commandHandlers = Object.values(modules)
    .flatMap((mod) => mod.commands ?? [])
    .map((cmd) => new cmd());

  client.on("interactionCreate", async (intx) => {
    const handler = commandHandlers.find((cmd) => cmd._test(intx));

    if (handler !== undefined) {
      const checkResult = await handler.check(intx);
      if (typeof checkResult === "string" && intx.isRepliable()) {
        intx.reply({ ephemeral: true, content: checkResult });
        return;
      }
      try {
        await handler.run(intx);
      } catch (e) {
        console.error(e);
        if (intx.isRepliable()) {
          intx.reply({
            ephemeral: true,
            content: stripMarkdownTag`Something went wrong on my end. Sorry!\n\`\`\`${e}\`\`\``,
          });
        }
      }
    }
  });

  client.once("ready", async (client) => {
    // TODO: check for differences in commands and update only if necessary
    console.log("Registering commands");

    const data = commandHandlers.map((cmd) => {
      const b = cmd._build();
      cmd.build(b);
      return b;
    });

    await client.application.commands.set(data);
    console.log("Done registering commands");
  });

  await client.login(env.token);
}

main().catch(console.error);
