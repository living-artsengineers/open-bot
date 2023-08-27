import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, userMention } from "discord.js";
import { Module, SlashCommand } from "./module";
import db, { ensureUserExists } from "../storage";
import { fetchInteractionUserNickname } from "../utils";
import { DateTime } from "luxon";
import environment from "../environment";

const birthdayAnnounce: Module = {
  name: "BirthdayAnnouncement",
  async setup(client) {
    const timeframe = async () => {
      const Today = DateTime.now();
      const birthdayUsers = await db.user.findMany({
        where: {
          Bmonth: Today.month,
          Bday: Today.day,
        },
        select: {
          id: true,
        },
      });
      if (birthdayUsers.length > 0) {
        ((await client.channels.fetch(environment.birthdaychannel)) as TextChannel).send(
          `Everyone wish a happy birthday to ${birthdayUsers
            .map((user: { id: any }) => userMention(user.id))
            .join(", ")}!`
        );
      }
    };

    client.on("ready", timeframe);
    setInterval(timeframe, 8.64e7);
  },
  commands: [
    class extends SlashCommand {
      name = "enterbirthday";
      description = "Enter your birthday in month and day!";

      build(builder: SlashCommandBuilder) {
        builder
          .setDMPermission(true)
          .addIntegerOption((opt) => opt.setName("month").setRequired(true).setDescription("month"))
          .addIntegerOption((opt) => opt.setName("day").setRequired(true).setDescription("day"));
      }

      async run(interaction: ChatInputCommandInteraction) {
        const Month: number = interaction.options.getInteger("month", true);
        const Day: number = interaction.options.getInteger("day", true);
        await ensureUserExists(interaction.user.id, await fetchInteractionUserNickname(interaction));
        await db.user.update({
          where: { id: BigInt(interaction.user.id) },
          data: { Bmonth: Month, Bday: Day },
        });
        await interaction.reply({
          content: `Your birthday is ${Day}/${Month}?`,
          ephemeral: true,
        });
      }
    },
  ],
};

export default birthdayAnnounce;
