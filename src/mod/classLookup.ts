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
            .setDescription('The course\'s code, like "UARTS 150"')
            .setRequired(true)
            .setAutocomplete(true)
        ).addIntegerOption((opt) =>
          opt
            .setName("section-number")
            .setDescription("The desired section number, like 210")
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
    .setTitle(`${course.toString()}, ${section.type} Section ${section.number}`)
    .addFields([
      {
        name: `Meeting${section.meetings.length === 1 ? "" : "s"}`,
        value: section.meetings
          .map(
            (mtg) =>
              `${Array.from(mtg.days).join(", ")} from ${formatTime(mtg.startTime)} to ${formatTime(mtg.endTime)} in ${
                mtg.location === null ? "_unknown_" : formatLocation(mtg.location)
              }`
          )
          .join("\n"),
      },
      {
        name: "Enrollment",
        value: `${section.enrolled} / ${section.capacity} (${section.enrollStatus})`,
        inline: true,
      },
    ]);

  if (descr !== null) {
    const { title, details } = splitDescription(descr);
    embed.setAuthor({
      name: title,
      url: `https://atlas.ai.umich.edu/course/${encodeURIComponent(course.toString())}/`,
      iconURL: "https://atlas.ai.umich.edu/static/images/logo/atlas-favicon-32x32.1292451fcaad.png",
    });
    if (details !== null) {
      embed.setDescription(details);
    }
  }

  // We intend that two meetings, one at ARR and another at a resolved location, should not cause a static map to show up
  const meetingLocations = section.meetings.map((mtg) =>
    mtg.location === null ? null : locationOfFacility(mtg.location)
  );
  if (new Set(meetingLocations).size === 1 && meetingLocations[0] !== null) {
    const loc = meetingLocations[0];
    embed.setImage(
      `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/static/pin-l+002277(${loc.lng},${loc.lat})/${loc.lng},${loc.lat},14.8,0/400x300@2x?access_token=${environment.mapboxToken}`
    );
  }
  return embed;
}

function formatLocation(facility: string): string {
  const loc = locationOfFacility(facility);
  if (loc === null) return facility;
  return stripMarkdownTag`[${facility}](https://www.google.com/maps/dir//${encodeURIComponent(loc.address)})`;
}

function splitDescription(description: string): { title: string; details: string | null } {
  const knownSeparators = ["---", "\n\n"];
  for (const sep of knownSeparators) {
    const sepIndex = description.indexOf(sep);
    if (sepIndex !== -1) {
      return {
        title: description.substring(0, sepIndex).trim(),
        details: description.substring(sepIndex + sep.length).trim(),
      };
    }
  }
  return { title: description, details: null };
}

function formatTime(dur: Duration | null): string {
  if (dur === null) return "TBA";
  const date = DateTime.fromObject({ hour: dur.hours, minute: dur.minutes });
  return date.setLocale("en-US").toLocaleString(DateTime.TIME_SIMPLE);
}

export default classLookup;
