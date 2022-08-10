import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  EmbedField,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Course, Meeting, Section, SectionType } from "../soc/entities";
import { termCodes } from "../soc/umichApi";
import client, { ensureUserExists } from "../storage";
import { fetchGuildNickname, stripMarkdown, stripMarkdownTag, zeroPad } from "../utils";
import { Module, SlashCommand } from "./module";
import { sharedClient } from "../soc/umichApi";
import { formatTime, parseCleanIntendedTerm } from "./classLookup";
import { defaultTerm, splitDescription } from "../soc/umich";

const scheduleRecord: Module = {
  name: "scheduleRecord",
  commands: [
    class extends SlashCommand {
      name = "schedule-setup";
      description = "Interactively add classes to your schedule";

      async run(ix: ChatInputCommandInteraction) {
        const modal = new ModalBuilder().setCustomId("schedule-recorder").setTitle("Add section");

        modal.addComponents(
          new ActionRowBuilder({
            components: [
              new TextInputBuilder({
                customId: "courseCode",
                label: "Course code",
                style: TextInputStyle.Short,
                required: true,
                placeholder: 'Example: "UARTS 150"',
              }),
            ],
          }),
          new ActionRowBuilder({
            components: [
              new TextInputBuilder({
                customId: "section",
                label: "Section number",
                style: TextInputStyle.Short,
                required: true,
                placeholder: 'Example: "210"',
              }),
            ],
          })
        );

        await ix.showModal(modal);
      }
    },
    class extends SlashCommand {
      name = "schedule-set-classes";
      description = "Set the entire list of class numbers representing your schedule";

      build(builder: SlashCommandBuilder) {
        builder
          .addStringOption((opt) =>
            opt
              .setName("class-numbers")
              .setDescription(
                'Class numbers of classes in your schedule, separated by spaces. Example: "14228 19413 22410"'
              )
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("term")
              .setDescription(`The term in which you are enrolled in this class. Current default: ${defaultTerm}`)
              .setChoices(...Object.keys(termCodes).map((name) => ({ name, value: name })))
              .setRequired(false)
          );
      }

      async check(ix: ChatInputCommandInteraction) {
        const numbers = ix.options
          .getString("class-numbers", true)
          .split(/\s+/)
          .filter((str) => str.trim().length > 0);
        if (numbers.length < 2) {
          return (
            `:x: Too few classes (2 minimum, ${numbers.length} supplied). ` +
            `This command sets your entire schedule for a term. It does not just add the classes you specify---it removes all those you don't specify.`
          );
        }
        if (numbers.length > 20) {
          return `:x: Too many classes (20 max, ${numbers.length} supplied)`;
        }
        for (const num of numbers) {
          if (isNaN(parseInt(num, 10))) {
            return stripMarkdownTag`:x: \`${num}\` is not a valid integer.`;
          }
        }
      }

      async run(ix: ChatInputCommandInteraction) {
        const classNumbers = Array.from(
          new Set(
            ix.options
              .getString("class-numbers", true)
              .split(/\s+/)
              .filter((str) => str.trim().length > 0)
              .map((x) => parseInt(x, 10))
          )
        ).sort();

        await ix.reply({
          ephemeral: true,
          content: "Resolving classes...",
        });

        const progressData: ([Section<true>, Course] | Error | null)[] = new Array(classNumbers.length).fill(null);
        const replyUpdates = async () => {
          try {
            const done = !progressData.includes(null);
            const body = classNumbers
              .map((num, i) => {
                const progress = progressData[i];
                if (progress instanceof Error) {
                  return `\`${num}\` :red_circle: Failed: ${progress.message}`;
                } else if (progress !== null) {
                  return `\`${num}\` :green_circle: ${progress[1].toString()}, ${progress[0].type} ${zeroPad(
                    progress[0].number
                  )}`;
                } else {
                  return `\`${num}\` :hourglass:`;
                }
              })
              .join("\n");

            await ix.editReply({
              content: `${done ? "Finished setting your schedule." : "Resolving classes..."}\n${body}`.substring(
                0,
                1024
              ), // Discord message size limit, exceedable if you have >13 classes or so
              embeds: done
                ? [await scheduleEmbed(progressData.filter(Array.isArray) as [Section<true>, Course][], term)]
                : [],
            });

            if (!done) {
              setTimeout(replyUpdates, 250);
            }
          } catch (e) {
            console.error(e);
            await ix.followUp({
              ephemeral: true,
              content: `Something went wrong on my end. Sorry!\n\`\`\`${e}\`\`\``,
            });
          }
        };
        // No awaiting on purpose
        replyUpdates();

        const term = parseCleanIntendedTerm(ix);
        await ensureUserExists(ix.user.id, (await fetchGuildNickname(ix.client, ix.user.id)) ?? ix.user.username);
        await clearEnrollment(BigInt(ix.user.id), termCodes[term]);
        await Promise.all(
          classNumbers.map(async (num, i) => {
            try {
              const sectionData = await sharedClient.fetchSectionByClassNumber(num, termCodes[term]);
              if (sectionData === null) {
                progressData[i] = new Error("Class does not exist during " + term);
                return;
              }
              if (sectionData[0].type === SectionType.MID) {
                progressData[i] = new Error("Class is a midterm section. Ignoring it");
                return;
              }
              // Can be optimized into createMany
              await addEnrollment(BigInt(ix.user.id), termCodes[term], sectionData[1], sectionData[0].number);
              progressData[i] = sectionData;
            } catch (e) {
              progressData[i] = e instanceof Error ? e : new Error(JSON.stringify(e));
            }
          })
        );
      }
    },
  ],
};

async function clearEnrollment(user: bigint, term: number) {
  await client.enrollment.deleteMany({
    where: {
      studentId: user,
      term,
    },
  });
}

async function addEnrollment(user: bigint, term: number, course: Course, section: number) {
  const rowData = {
    studentId: user,
    term,
    courseCode: course.toString(),
    section,
  };

  const existing = await client.enrollment.findFirst({ where: rowData });
  if (existing !== null) return;
  await client.enrollment.create({ data: rowData });
}

export default scheduleRecord;

async function scheduleEmbed(classes: [Section<true>, Course][], term: keyof typeof termCodes): Promise<EmbedBuilder> {
  async function classToField([section, course]: [Section<true>, Course]): Promise<EmbedField> {
    function meetingToLine(mtg: Meeting<true>) {
      return `${Array.from(mtg.days).join(", ")} from ${formatTime(mtg.startTime)} to ${formatTime(mtg.endTime)}${
        mtg.location === null ? "" : ` in ${mtg.location}`
      }\n`;
    }
    const instructorList =
      section.instructors.length === 0
        ? "No known instructors"
        : (section.instructors.length === 1 ? "Instructor: " : "Instructors: ") +
          section.instructors.map((i) => `${i.firstName} ${i.lastName}`).join(", ");
    const courseDescription = await sharedClient.getCourseDescription(course, termCodes[term]);
    const courseTitle =
      courseDescription === null
        ? ""
        : stripMarkdown(splitDescription(courseDescription).title).substring(0, 800) + "\n";

    const fieldContent = `${courseTitle}${section.meetings.map(meetingToLine).join("")}${instructorList}`;
    return {
      name: `${course.toString()}: ${section.type} ${zeroPad(section.number)}`,
      value: fieldContent,
      inline: false,
    };
  }

  return new EmbedBuilder({
    title: `Your ${term} Schedule`,
    fields: await Promise.all(classes.map(classToField)),
  });
}
