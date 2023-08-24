import { ChatInputCommandInteraction, InteractionResponse, SlashCommandBuilder, TextChannel, userMention } from "discord.js";
import { Module, SlashCommand } from "./module";
import db, { ensureUserExists } from "../storage";
import { fetchInteractionUserNickname } from "../utils";
import { DateTime } from "luxon";
import environment from "../environment";

const BirthdayAnnounc: Module = {
  name: "BirthdayAnnouncement",
  async setup(client) {
    const timeframe = async () => {
      const Today = DateTime.now()
      const birthdayUsers = await db.user.findMany({
        where: {
          Bmonth: Today.month,
          Bday: Today.day
        },
        select: {
          id: true
        }
      });
      ((await client.channels.fetch(environment.birthdaychannel)) as TextChannel).send(
        `Everyone wish a happy birthday to ${birthdayUsers.map((user: { id: any; }) => userMention(user.id)).join(', ')}!`)
    }


    client.on("ready", timeframe);
    setInterval(timeframe, 8.64e+7)
  },
  commands: [
    class extends SlashCommand {
      name = "enterbirthday";
      description = "Enter your birthday in month and day!";

      build(builder: SlashCommandBuilder) {
        builder.setDMPermission(true);
        builder.addIntegerOption((opt) => opt.setName("month").setRequired(true).setDescription("month"))
        builder.addIntegerOption((opt) => opt.setName("day").setRequired(true).setDescription("day"))
      }

      async run(interaction: ChatInputCommandInteraction) {
        const Month: number = interaction.options.get("month", true).value as number
        const Day: number = interaction.options.get("day", true).value as number
        await ensureUserExists(interaction.user.id, await fetchInteractionUserNickname(interaction));
        await db.user.update({
          where: { id: interaction.user.id },
          data: { Bmonth: Month, Bday: Day }
        })
        await interaction.reply({
          content: `Your birthday is ${Day}/${Month}?`,
          ephemeral: true,
        });
      }
    },
  ],
};

export default BirthdayAnnounc;




