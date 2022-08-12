import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  EmbedField,
  ModalBuilder,
  SelectMenuBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Course, Meeting, Section, SectionType } from "../soc/entities";
import { termCodes } from "../soc/umichApi";
import client, { ensureUserExists } from "../storage";
import { fetchGuildNickname, stripMarkdown, stripMarkdownTag, truncateText, zeroPad } from "../utils";
import { Module, SlashCommand } from "./module";
import { sharedClient } from "../soc/umichApi";
import { formatTime, parseCleanIntendedTerm } from "./classLookup";
import { setTimeout as wait } from "timers/promises";
import { defaultTerm, splitDescription } from "../soc/umich";
import { strict as assert } from "assert";

const ephemeralMessageLifetime = 1000 * 60 * 15;
let activeScheduleDisplays: {
  userId: string;
  term: number;
  interaction: ChatInputCommandInteraction;
  expire: Date;
}[] = [];

const scheduleRecord: Module = {
  name: "scheduleRecord",
  async setup(client) {
    // schedule-setup's modal submissions
    client.on("interactionCreate", async (intx) => {
      if (intx.isButton()) {
        const tokens = intx.customId.split(":");
        if (tokens[0] === "schedule-add-section-button") {
          const term = tokens[1] as keyof typeof termCodes;
          assert(Object.keys(termCodes).includes(term));
          const modal = new ModalBuilder()
            .setCustomId(`schedule-add-section-submit:${term}`)
            .setTitle(`Add section for ${term}`);

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

          await intx.showModal(modal);
        } else if (tokens[0] === "schedule-remove-section-button") {
          const term = tokens[1] as keyof typeof termCodes;
          assert(Object.keys(termCodes).includes(term));

          const enrollments = await getEnrollments(BigInt(intx.user.id), termCodes[term]);

          await intx.reply({
            ephemeral: true,
            content: `Pick a class section to remove from your ${term} schedule.`,
            components: [
              new ActionRowBuilder<SelectMenuBuilder>({
                components: [
                  new SelectMenuBuilder({
                    customId: `schedule-remove-section-submit:${term}`,
                    options: await Promise.all(
                      enrollments.map(async (enr) => {
                        const days = Array.from(
                          enr[0].meetings.map((mtg) => mtg.days).reduce((a, b) => new Set([...a, ...b]), new Set())
                        ).join(", ");

                        let descriptionCut = "";
                        const fullDescription = await sharedClient.getCourseDescription(enr[1], termCodes[term]);
                        if (fullDescription !== null) {
                          descriptionCut = truncateText(splitDescription(fullDescription).title, 95 - days.length);
                        }
                        return {
                          label: `${enr[1].toString()} Section ${zeroPad(enr[0].number)} (${enr[0].type})`,
                          description: days.length === 0 ? descriptionCut : `${descriptionCut} (${days})`,
                          // format: [course, section number] to ease database operation
                          value: JSON.stringify([enr[1].toString(), enr[0].number]),
                        };
                      })
                    ),
                  }),
                ],
              }),
            ],
          });
        }
      } else if (intx.isModalSubmit()) {
        const tokens = intx.customId.split(":");
        if (tokens[0] === "schedule-add-section-submit") {
          const term = tokens[1] as keyof typeof termCodes;
          assert(Object.keys(termCodes).includes(term));
          const course = Course.parse(intx.fields.getTextInputValue("courseCode"));
          const section = Number(intx.fields.getTextInputValue("section"));

          if (course === null) {
            await intx.reply({
              ephemeral: true,
              content: stripMarkdownTag`:x: \`${intx.fields.getTextInputValue(
                "courseCode"
              )}\` is not a properly formatted course code.`,
            });
            return;
          }
          if (isNaN(section) || section - Math.floor(section) > 1e-6) {
            await intx.reply({
              ephemeral: true,
              content: stripMarkdownTag`:x: \`${intx.fields.getTextInputValue("section")}\` is not an integer.`,
            });
            return;
          }

          const sectionInfo = await sharedClient.getSectionBySectionNumber(course, section, termCodes[term]);
          if (sectionInfo === null) {
            await intx.reply({
              ephemeral: true,
              content: `:x: That section does not exist during ${term}.\n_Note: Do not put midterm sections (type "MID") into your schedule here._`,
            });
            return;
          }

          await ensureUserExists(
            intx.user.id,
            (await fetchGuildNickname(intx.client, intx.user.id)) ?? intx.user.username
          );
          await addEnrollment(BigInt(intx.user.id), termCodes[term], course, section);
          await intx.reply({
            ephemeral: true,
            content: `:white_check_mark: Successfully added ${course}, section ${zeroPad(section)} (${
              sectionInfo.type
            }) to your ${term} schedule.`,
          });
          await updateDisplayedSchedules(intx.user.id, term);
        }
      } else if (intx.isSelectMenu()) {
        const tokens = intx.customId.split(":");
        if (tokens[0] === "schedule-remove-section-submit") {
          const term = tokens[1] as keyof typeof termCodes;
          if (!Object.keys(termCodes).includes(term)) return;
          const [courseRaw, sectionNumberRaw] = JSON.parse(intx.values[0]);
          const course = Course.parse(courseRaw);
          if (course === null) return;
          const sectionNumber = parseInt(sectionNumberRaw);
          if (isNaN(sectionNumber)) return;

          await removeEnrollment(BigInt(intx.user.id), termCodes[term], course, sectionNumber);

          await intx.update({
            content: `:white_check_mark: Successfully removed ${course}, section ${zeroPad(
              sectionNumber
            )} from your ${term} schedule.`,
            components: [],
          });
          await updateDisplayedSchedules(intx.user.id, term);
        }
      }
    });
  },
  commands: [
    class ScheduleCommand extends SlashCommand {
      name = "schedule";
      description = "See and edit your class schedule";

      build(bx: SlashCommandBuilder) {
        bx.addStringOption((opt) =>
          opt
            .setName("term")
            .setDescription("The academic term of the schedule to see and edit. Current default: " + defaultTerm)
            .setChoices(...Object.keys(termCodes).map((name) => ({ name, value: name })))
            .setRequired(false)
        );
      }

      async run(ix: ChatInputCommandInteraction) {
        await ix.deferReply({ ephemeral: true });
        await ensureUserExists(ix.user.id, (await fetchGuildNickname(ix.client, ix.user.id)) ?? ix.user.username);
        const term = parseCleanIntendedTerm(ix);
        const classes = await getEnrollments(BigInt(ix.user.id), termCodes[term]);
        const actionRow = scheduleEditActionRow(classes, term);

        await ix.editReply({
          embeds: [await scheduleEmbed(classes, term)],
          components: [actionRow],
        });

        activeScheduleDisplays.push({
          userId: ix.user.id,
          term: termCodes[term],
          interaction: ix,
          expire: new Date(Date.now() + ephemeralMessageLifetime),
        });
        // Wait for this interaction to time out.
        // Other interactions can edit this interaction's reply to reflect changes in the meantime.
        await wait(ephemeralMessageLifetime);
        await ix.editReply({
          content: `This interaction has expired. Run \`/schedule\` again to view and edit your ${term} schedule.`,
        });

        activeScheduleDisplays = activeScheduleDisplays.filter((x) => x.interaction !== ix);
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
            `This command sets your entire schedule for a term. It does not just add the classes you specify---it removes all those you don't specify.\n` +
            `To clear your schedule, use \`/schedule-clear\`.`
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
              ),
              embeds: done
                ? [await scheduleEmbed(progressData.filter(Array.isArray) as [Section<true>, Course][], term)]
                : [],
            });

            if (done) {
              await updateDisplayedSchedules(ix.user.id, term);
            } else {
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
    class ScheduleClearCommand extends SlashCommand {
      name = "schedule-clear";
      description = "Clears your entire schedule for a given term.";
      build(builder: SlashCommandBuilder) {
        builder.addStringOption((opt) =>
          opt
            .setName("term")
            .setDescription(
              `The academic term for which you want to clear your schedule. Current default: ${defaultTerm}`
            )
            .setChoices(...Object.keys(termCodes).map((name) => ({ name, value: name })))
            .setRequired(false)
        );
      }

      async run(ix: ChatInputCommandInteraction) {
        const term = parseCleanIntendedTerm(ix);
        await clearEnrollment(BigInt(ix.user.id), termCodes[term]);
        await ix.reply({
          ephemeral: true,
          content: `Successfully cleared your schedule for ${term}.`,
        });
        await updateDisplayedSchedules(ix.user.id, term);
      }
    },
  ],
};

async function updateDisplayedSchedules(userId: string, term: keyof typeof termCodes) {
  await Promise.all(
    activeScheduleDisplays
      .filter((disp) => disp.userId === userId && disp.term === termCodes[term])
      .map(async (disp) => {
        const enrollments = await getEnrollments(BigInt(userId), termCodes[term]);
        disp.interaction.editReply({
          embeds: [await scheduleEmbed(enrollments, term)],
          components: [scheduleEditActionRow(enrollments, term)],
        });
      })
  );
}

function scheduleEditActionRow(classes: unknown[], term: keyof typeof termCodes) {
  return new ActionRowBuilder<ButtonBuilder>({
    components: [
      {
        type: ComponentType.Button,
        customId: `schedule-add-section-button:${term}`,
        label: "Add class",
        emoji: "➕",
        style: ButtonStyle.Primary,
        disabled: classes.length >= 20,
      },
      {
        type: ComponentType.Button,
        customId: `schedule-remove-section-button:${term}`,
        label: "Remove class",
        emoji: "➖",
        style: ButtonStyle.Danger,
        disabled: classes.length === 0,
      },
    ],
  });
}

async function getEnrollments(user: bigint, term: number): Promise<[Section<true>, Course][]> {
  const rows = await client.enrollment.findMany({
    where: {
      studentId: user,
      term,
    },
    select: {
      courseCode: true,
      section: true,
    },
  });
  return await Promise.all(
    rows.map(async ({ courseCode, section }) => {
      const course = Course.parse(courseCode);
      assert(course !== null, `Invalid course stored in database: ${courseCode}`);
      return [await sharedClient.getSectionBySectionNumber(course, section, term), course] as [Section<true>, Course];
    })
  );
}

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

async function removeEnrollment(user: bigint, term: number, course: Course, section: number) {
  await client.enrollment.deleteMany({
    where: {
      studentId: user,
      term,
      courseCode: course.toString(),
      section,
    },
  });
}

async function getCoursemates(user: bigint, term: number): Promise<{ [course: string]: bigint[] }> {
  const allCoursemates: { courseCode: string; studentId: bigint }[] =
    await client.$queryRaw`SELECT p.courseCode, p.studentId FROM Enrollment p WHERE p.studentId <> ${user} AND p.term = ${term} AND
      EXISTS (SELECT 1 FROM Enrollment s WHERE s.studentId = ${user} AND p.courseCode = s.courseCode AND p.term = s.term)`;

  return rollUpAsObjectOfArrays(allCoursemates.map((mate) => [mate.courseCode, mate.studentId]));
}

async function getSectionPeers(
  user: bigint,
  term: number
): Promise<{ [course: string]: { id: bigint; section: number }[] }> {
  const allSectionPeers: { courseCode: string; section: number; studentId: bigint }[] =
    await client.$queryRaw`SELECT p.courseCode, p.section, p.studentId FROM Enrollment p WHERE p.studentId <> ${user} AND p.term = ${term} AND
      EXISTS (SELECT 1 FROM Enrollment s WHERE s.studentId = ${user} AND p.courseCode = s.courseCode AND p.term = s.term AND p.section = s.section)`;

  return rollUpAsObjectOfArrays(
    allSectionPeers.map((mate) => [mate.courseCode, { id: mate.studentId, section: mate.section }])
  );
}

async function getCourseAlumni(
  user: bigint,
  term: number
): Promise<{ [course: string]: { id: bigint; term: number }[] }> {
  const alumniList: { studentId: bigint; courseCode: string; term: number }[] =
    await client.$queryRaw`SELECT e.studentId, e.courseCode, e.term FROM Enrollment e WHERE e.studentId <> ${user} AND e.term < ${term} AND
      EXISTS (SELECT 1 FROM Enrollment f WHERE f.studentId = ${user} AND e.courseCode = f.courseCode AND f.term = ${term})`;

  return rollUpAsObjectOfArrays(alumniList.map((alum) => [alum.courseCode, { id: alum.studentId, term: alum.term }]));
}

function rollUpAsObjectOfArrays<K extends string | number | symbol, V>(items: [K, V][]): Record<K, V[]> {
  const out = {} as Record<K, V[]>;
  for (const [key, value] of items) {
    out[key] ??= [];
    out[key].push(value);
  }
  return out;
}
export default scheduleRecord;

function meetingToLine(mtg: Meeting<true>) {
  return `${Array.from(mtg.days).join(", ")} from ${formatTime(mtg.startTime)} to ${formatTime(mtg.endTime)}${
    mtg.location === null ? "" : ` in ${mtg.location}`
  }\n`;
}

async function scheduleEmbed(classes: [Section<true>, Course][], term: keyof typeof termCodes): Promise<EmbedBuilder> {
  async function classToField([section, course]: [Section<true>, Course]): Promise<EmbedField> {
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
    description:
      classes.length === 0 ? 'Your schedule is empty. Click ":heavy_plus_sign: Add class" to add a class.' : undefined,
    fields: await Promise.all(classes.map(classToField)),
  });
}
