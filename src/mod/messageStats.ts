import { SlashCommandBuilder } from "discord.js";
import { Module } from "./module";
import db, { ensureUserExists } from "../storage";

const messageStats: Module = {
  name: "MessageStats",
  async setup(client) {
    client.on("messageCreate", async (msg) => {
      await ensureUserExists(msg.author.id, msg.author.username);
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
    new SlashCommandBuilder()
      .setName("mymessagestats")
      .setDescription(
        "Check basic statistics about the messages I have sent here."
      ),
  ],
  async interact(interaction) {
    if (interaction.commandName === "mymessagestats") {
      const count = await db.message.count({
        where: { author: { equals: BigInt(interaction.user.id) } },
      });
      await interaction.reply({
        content: `You have sent ${count} message${count === 1 ? "" : "s"}`,
        ephemeral: true,
      });
    }
  },
};

export default messageStats;
