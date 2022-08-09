import { ChatInputCommandInteraction, EmbedBuilder, EmbedField, SlashCommandBuilder } from "discord.js";
import { Course } from "../soc/entities";
import { termCodes, UMichSocApiClient } from "../soc/umichApi";
import { stripMarkdownTag } from "../utils";
import { Module, SlashCommand } from "./module";

const umClient = new UMichSocApiClient();

export const classLookup: Module = {
  name: "classLookup",
  commands: [
    class extends SlashCommand {
      name = "lookup-section";
      description = "Look up a given course section.";

      build(br: SlashCommandBuilder) {
        br.addStringOption((opt) =>
          opt.setName("course-code").setDescription("The course's code. Example: 'UARTS 150'").setRequired(true)
        );
        br.addIntegerOption((opt) =>
          opt.setName("section-number").setDescription("The desired section number. Example: 210").setRequired(true)
        );
      }

      override async run(ix: ChatInputCommandInteraction) {
        try {
          const inputCourseCode = ix.options.getString("course-code", true);
          const course = Course.parse(inputCourseCode);
          if (course === null) {
            await ix.reply({
              ephemeral: true,
              content: stripMarkdownTag`:x: ${inputCourseCode} is not a properly formatted course code.`,
            });
            return;
          }
          const inputSection = ix.options.getInteger("section-number", true);
          const section = await umClient.fetchSectionBySectionNumber(course, inputSection, termCodes["Fall 2022"]);
          if (section === null) {
            await ix.reply({
              ephemeral: true,
              content: stripMarkdownTag`:x: Section ${inputSection} of ${course.toString()} does not exist.`,
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle(`${course.toString()}, Section ${section.number}`)
            .setDescription(
              section.meetings
                .map(
                  (mtg) =>
                    `${mtg.startTime?.toFormat("hh:mm") ?? "TBA"} to ${mtg.endTime?.toFormat("hh:mm") ?? "TBA"} in ${
                      mtg.location ?? "TBA"
                    }`
                )
                .join("\n")
            );
          await ix.reply({
            ephemeral: true,
            embeds: [embed.toJSON()],
          });
        } catch (e) {
          await ix.reply({
            ephemeral: true,
            content: "Something went wrong: " + e,
          });
        }
      }
    },
  ],
};

export default classLookup;
