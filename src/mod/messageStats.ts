import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Module, SlashCommand } from "./module";
import db, { ensureUserExists } from "../storage";

const messageStats: Module = {
  name: "MessageStats",
  async setup(client) {
    client.on("messageCreate", async (msg) => {
      if (!msg.inGuild()) return;
      await ensureUserExists(msg.author.id, msg.member?.nickname ?? msg.author.username);
      await db.message.create({
        data: {
          id: Number(msg.id),
          author: BigInt(msg.author.id),
          length: msg.content.trim().length,
          channel: BigInt(msg.channelId),
          time: new Date(),
        },
      });
    });
  },
  commands: [
    new (class extends SlashCommand {
      name = "mymessagestats";
      description = "Check basic statistics about the messages I have sent here.";

      build(builder: SlashCommandBuilder) {
        builder.setDMPermission(false);
      }

      async run(interaction: ChatInputCommandInteraction) {
        const count = await db.message.count({
          where: { author: { equals: BigInt(interaction.user.id) } },
        });
        await interaction.reply({
          content: `You have sent ${count} message${count === 1 ? "" : "s"}`,
          ephemeral: true,
        });
      }
    })(),
  ],
};

export default messageStats;
