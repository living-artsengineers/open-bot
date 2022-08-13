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
import { Course, EnrollmentStatus, Section } from "../soc/entities";
import { termCodes } from "../soc/umichApi";
import { stripMarkdownTag } from "../utils";
import { AutocompletingSlashCommand, Module } from "./module";
import { sharedClient as umClient } from "../soc/umichApi";
import { splitDescription, defaultTerm } from "../soc/umich";

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
        )
          .addIntegerOption((opt) =>
            opt
              .setName("section-number")
              .setDescription("The desired section number, like 210")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("term")
              .setDescription(`Academic term in which to look up the section (current default: ${defaultTerm})`)
              .addChoices(...Object.keys(termCodes).map((name) => ({ name, value: name })))
              .setRequired(false)
          );
      }

      async autocomplete(ix: AutocompleteInteraction): Promise<ApplicationCommandOptionChoiceData[] | null> {
        const term = parseCleanIntendedTerm(ix);
        const termCatalog = await getTermCatalog(termCodes[term]);

        const option = ix.options.getFocused(true);
        if (option.name === "course-code") {
          // Consider optimizing this
          const possibleCourse = Course.parse(option.value);
          return Object.keys(termCatalog)
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
          if (!(course.toString() in termCatalog)) return [];
          return termCatalog[course.toString() as keyof typeof termCatalog]
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
          const term = parseCleanIntendedTerm(ix);
          const section = await umClient.getSectionBySectionNumber(course, inputSection, termCodes[term]);
          if (section === null) {
            await ix.reply({
              ephemeral: true,
              content: stripMarkdownTag`:x: Section ${inputSection} of ${course.toString()} does not exist during ${term}.`,
            });
            return;
          }

          const embed = await buildEmbed(course, section, term);
          await ix.reply({
            embeds: [embed.toJSON()],
          });
        } catch (e) {
          await ix.reply({
            ephemeral: true,
            content: `Something went wrong: \`\`\`${e}\`\`\``,
          });
          console.error(e);
        }
      }
    },
  ],
};

export function parseCleanIntendedTerm(
  ix: ChatInputCommandInteraction | AutocompleteInteraction
): keyof typeof termCodes {
  const termRaw = ix.options.getString("term", false) ?? defaultTerm;
  const term = Object.keys(termCodes).includes(termRaw) ? (termRaw as keyof typeof termCodes) : defaultTerm;
  return term;
}

async function buildEmbed(course: Course, section: Section<true>, term: keyof typeof termCodes) {
  const descr = await umClient.getCourseDescription(course, termCodes[term]);
  const embed = new EmbedBuilder()
    .setTitle(`${course.toString()}: ${section.type} Section ${section.number}`)
    .addFields(
      {
        name: "Term",
        value: term,
        inline: true,
      },
      {
        name: "Credits",
        value: section.credits.toString(),
        inline: true,
      },
      {
        name: "Enrollment",
        value: `${enrollmentStatusSymbols[section.enrollStatus]} ${section.enrolled} / ${section.capacity} (${
          section.enrollStatus
        })`,
        inline: true,
      }
    );

  if (descr !== null) {
    const { title, details } = splitDescription(descr);
    embed.setAuthor({
      name: title.substring(0, 256),
      url: `https://atlas.ai.umich.edu/course/${encodeURIComponent(course.toString())}/`,
      iconURL: "https://atlas.ai.umich.edu/static/images/logo/atlas-favicon-32x32.1292451fcaad.png",
    });
    if (details !== null && details.length > 0) {
      embed.setDescription(details);
    }
  }

  if (section.instructors.length > 0) {
    // Apparently this is possible
    const tooManyInstructors = section.instructors.length > 10;
    embed.addFields({
      name: `Instructor${section.instructors.length === 1 ? "" : "s"}`,
      value:
        section.instructors
          .slice(0, 10)
          .map(
            (instr) =>
              `${instr.firstName} ${instr.lastName} ([${instr.uniqname}](https://atlas.ai.umich.edu/instructor/${instr.uniqname}/))`
          )
          .join("\n") + (tooManyInstructors ? "\n..." : ""),
      inline: true,
    });
  }

  embed.addFields({
    name: `Meeting${section.meetings.length === 1 ? "" : "s"}`,
    value:
      section.meetings.length === 0
        ? "None"
        : section.meetings
            .map(
              (mtg) =>
                `${Array.from(mtg.days).join(", ")} from ${formatTime(mtg.startTime)} to ${formatTime(
                  mtg.endTime
                )} in ${mtg.location === null ? "_unknown_" : formatLocation(mtg.location)}`
            )
            .join("\n"),
  });

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

export function formatTime(dur: Duration | null): string {
  if (dur === null) return "TBA";
  const date = DateTime.fromObject({ hour: dur.hours, minute: dur.minutes });
  return date.setLocale("en-US").toLocaleString(DateTime.TIME_SIMPLE);
}

async function getTermCatalog(term: number): Promise<{ [code: string]: number[] }> {
  return await import(`../soc/sections-${term}.json`);
}

const enrollmentStatusSymbols = {
  [EnrollmentStatus.Open]: ":green_circle:",
  [EnrollmentStatus.WaitList]: ":yellow_circle:",
  [EnrollmentStatus.Closed]: ":red_circle:",
};

export default classLookup;
