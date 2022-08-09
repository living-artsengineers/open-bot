import {
  ApplicationCommandOptionChoiceData,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { DateTime, Duration } from "luxon";
import { locationOfFacility } from "../campus/umCampus";
import environment from "../environment";
import { Course, Section } from "../soc/entities";
import { termCodes, UMichSocApiClient } from "../soc/umichApi";
import { stripMarkdownTag } from "../utils";
import { AutocompletingSlashCommand, Module } from "./module";
import * as classCatalog from "../soc/sections-2410.json";

const umClient = new UMichSocApiClient();

export const classLookup: Module = {
  name: "classLookup",
  commands: [
    class extends AutocompletingSlashCommand {
      name = "lookup-section";
      description = "Look up a given course section.";

      build(br: SlashCommandBuilder) {
        br.addStringOption((opt) =>
          opt
            .setName("course-code")
            .setDescription('The course\'s code. Example: "UARTS 150"')
            .setRequired(true)
            .setAutocomplete(true)
        ).addIntegerOption((opt) =>
          opt
            .setName("section-number")
            .setDescription("The desired section number. Example: 210")
            .setRequired(true)
            .setAutocomplete(true)
        );
      }

      async autocomplete(ix: AutocompleteInteraction): Promise<ApplicationCommandOptionChoiceData[] | null> {
        const option = ix.options.getFocused(true);
        if (option.name === "course-code") {
          // Consider optimizing this
          const possibleCourse = Course.parse(option.value);
          return Object.keys(classCatalog)
            .sort()
            .filter(
              (code) =>
                code.startsWith(option.value.toUpperCase()) ||
                (possibleCourse !== null && code.startsWith(possibleCourse.toString()))
            )
            .map((code) => ({ name: code, value: code }))
            .slice(0, 25);
        } else if (option.name === "section-number") {
          const course = Course.parse(ix.options.getString("course-code", true));
          if (course === null) return [];
          if (!(course.toString() in classCatalog)) return [];
          return classCatalog[course.toString() as keyof typeof classCatalog]
            .filter((num) => num.toString().startsWith(option.value.replace(/^0+/g, "")))
            .map((section) => ({
              name: section.toString(),
              value: section,
            }))
            .slice(0, 25);
        }
        return null;
      }

      async execute(ix: ChatInputCommandInteraction) {
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

          const embed = await buildEmbed(course, section);
          await ix.reply({
            embeds: [embed.toJSON()],
          });
        } catch (e) {
          await ix.reply({
            ephemeral: true,
            content: "Something went wrong: " + e,
          });
          console.error(e);
        }
      }
    },
  ],
};

async function buildEmbed(course: Course, section: Section<true>) {
  const descr = await umClient.fetchCourseDescription(course, termCodes["Fall 2022"]);
  const embed = new EmbedBuilder()
    .setTitle(`${course.toString()}, Section ${section.number}`)
    .setDescription(descr ?? "No course description available.")
    .addFields(
      section.meetings.map((mtg, i) => ({
        name: `Meeting ${i + 1}`,
        value: `${Array.from(mtg.days).join(", ")}\n${formatDuration(mtg.startTime)} to ${formatDuration(
          mtg.endTime
        )}\n${mtg.location ?? "TBA"}`,
        inline: true,
      }))
    )
    .addFields([
      {
        name: "Enrollment",
        value: `${section.enrolled} / ${section.capacity} (${section.enrollStatus})`,
        inline: true,
      },
    ]);

  if (section.meetings.length === 1 && section.meetings[0].location !== null) {
    const loc = locationOfFacility(section.meetings[0].location);
    if (loc !== null) {
      embed.setImage(
        `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/static/pin-l+002277(${loc.lng},${loc.lat})/${loc.lng},${loc.lat},14.8,0/400x300@2x?access_token=${environment.mapboxToken}`
      );
    }
  }
  return embed;
}

function formatDuration(dur: Duration | null): string {
  if (dur === null) return "TBA";
  const date = DateTime.fromObject({ hour: dur.hours, minute: dur.minutes });
  return date.setLocale("en-US").toLocaleString(DateTime.TIME_SIMPLE);
}

export default classLookup;
