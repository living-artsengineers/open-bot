import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  ComponentType,
  EmbedBuilder,
  EmbedField,
  ModalBuilder,
  SelectMenuBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  userMention,
} from "discord.js";
import { Course, Meeting, Section, SectionType } from "../soc/entities";
import { termCodes } from "../soc/umichApi";
import client, { ensureUserExists } from "../storage";
import {
  fetchInteractionUserNickname,
  reverseLookup,
  stripMarkdown,
  stripMarkdownTag,
  truncateText,
  zeroPad,
  formatTime,
  groupItems,
} from "../utils";
import { Module, SlashCommand } from "./module";
import { sharedClient } from "../soc/umichApi";
import { parseCleanIntendedTerm } from "./classLookup";
import { setTimeout as wait } from "timers/promises";
import { defaultTerm, splitDescription } from "../soc/umich";
import { strict as assert } from "assert";
import { Enrollment } from "@prisma/client";
import { ScheduleRenderer } from "./scheduleRecord/scheduleRenderer";
import { join } from "path";
import * as store from "./scheduleRecord/scheduleStorage";

type Term = keyof typeof termCodes;

const ephemeralMessageLifetime = 1000 * 60 * 14;
const ignoredClasses: [Course, number][] = [
  [new Course("UARTS", 150), 1],
  [new Course("ENGR", 100), 210],
];

let activeScheduleDisplays: {
  userId: string;
  term: number;
  interaction: ChatInputCommandInteraction;
  expire: Date;
}[] = [];

const scheduleRecord: Module = {
  name: "scheduleRecord",
  async setup(client) {
    // schedule-setup's modal submissions and button clicks
    client.on("interactionCreate", async (intx) => {
      if (intx.isButton()) {
        const tokens = intx.customId.split(":");
        if (tokens[0] === "schedule-add-section-button") {
          const term = tokens[1] as Term;
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
          const term = tokens[1] as Term;
          assert(Object.keys(termCodes).includes(term));

          const enrollments = await store.getEnrollments(BigInt(intx.user.id), termCodes[term]);

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
        } else if (tokens[0] === "schedule-peers-button") {
          const term = tokens[1] as Term;
          if (!Object.keys(termCodes).includes(term)) return;
          const termCode = termCodes[term];
          if (!(await store.hasEnrollments(BigInt(intx.user.id), termCode))) {
            await intx.reply({
              ephemeral: true,
              content: `:x: Your ${term} schedule is empty. Use \`/schedule\` or \`/schedule-set-classes\` to add classes to it.`,
            });
            return;
          }
          const studentId = BigInt(intx.user.id);
          const peerInfo = await fetchPeerInfo(studentId, termCode);

          await intx.reply({
            ephemeral: true,
            embeds: await peerEmbeds(peerInfo, term),
          });
        }
      } else if (intx.isModalSubmit()) {
        const tokens = intx.customId.split(":");
        if (tokens[0] === "schedule-add-section-submit") {
          const term = tokens[1] as Term;
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
              content:
                `:x: Section ${section} does not exist for ${course.toString()} during ${term}.\n` +
                `_Note: Do not put Evening Exam sections (type "MID") into your schedule here._`,
            });
            return;
          }

          await ensureUserExists(intx.user.id, await fetchInteractionUserNickname(intx));
          const alreadyInCourse = await store.enrolledIn(BigInt(intx.user.id), termCodes[term], course);
          const enrollment = await store.addEnrollment(BigInt(intx.user.id), termCodes[term], course, section);
          if (enrollment !== undefined) {
            await intx.reply({
              ephemeral: true,
              content: `:white_check_mark: Successfully added ${course}, section ${zeroPad(section)} (${
                sectionInfo.type
              }) to your ${term} schedule.`,
            });
            await updateDisplayedSchedules(intx.user.id, term);
            await sendNotifications(intx.client, await peerNotifications(enrollment, alreadyInCourse));
          } else {
            await intx.reply({
              ephemeral: true,
              content: `:eyes: ${course}, section ${zeroPad(section)} is already in your ${term} schedule.`,
            });
          }
        }
      } else if (intx.isSelectMenu()) {
        const tokens = intx.customId.split(":");
        if (tokens[0] === "schedule-remove-section-submit") {
          const term = tokens[1] as Term;
          if (!Object.keys(termCodes).includes(term)) return;
          const [courseRaw, sectionNumberRaw] = JSON.parse(intx.values[0]);
          const course = Course.parse(courseRaw);
          if (course === null) return;
          const sectionNumber = parseInt(sectionNumberRaw);
          if (isNaN(sectionNumber)) return;

          await store.removeEnrollment(BigInt(intx.user.id), termCodes[term], course, sectionNumber);

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
        await ensureUserExists(ix.user.id, await fetchInteractionUserNickname(ix));
        const term = parseCleanIntendedTerm(ix);
        const classes = await store.getEnrollments(BigInt(ix.user.id), termCodes[term]);
        const actionRow = scheduleActionRow(classes, term);

        await ix.editReply({
          ...(await scheduleEmbed(ix.user.id, classes, term)),
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
        try {
          await ix.editReply({
            content: `This interaction has expired. Run \`/schedule\` again to view and edit your ${term} schedule.`,
            embeds: [],
          });
        } catch (e) {
          // Yes, swallow exceptions for failing to edit old replies
          console.error(e);
        }

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

            if (done) {
              const sectionsCourses = progressData.filter(Array.isArray) as [Section<true>, Course][];
              await ix.editReply({
                content: `Finished setting your schedule.\n${body}`.substring(0, 1024),
                ...(await scheduleEmbed(ix.user.id, sectionsCourses, term)),
                components: [scheduleActionRow(sectionsCourses, term)],
              });
              await updateDisplayedSchedules(ix.user.id, term);
              activeScheduleDisplays.push({
                userId: ix.user.id,
                term: termCodes[term],
                interaction: ix,
                expire: new Date(Date.now() + ephemeralMessageLifetime),
              });
            } else {
              await ix.editReply({
                content: `Resolving classes...\n${body}`.substring(0, 1024),
              });
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
        await replyUpdates();

        const term = parseCleanIntendedTerm(ix);
        await ensureUserExists(ix.user.id, await fetchInteractionUserNickname(ix));
        await store.clearEnrollment(BigInt(ix.user.id), termCodes[term]);
        const addedEnrollments = await Promise.all(
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
              const enrollment = await store.addEnrollment(
                BigInt(ix.user.id),
                termCodes[term],
                sectionData[1],
                sectionData[0].number
              );
              progressData[i] = sectionData;
              return enrollment;
            } catch (e) {
              progressData[i] = e instanceof Error ? e : new Error(JSON.stringify(e));
              return null;
            }
          })
        );
        const notifiedCourses = new Set<string>();
        for (const enrollment of addedEnrollments) {
          if (enrollment !== null && enrollment !== undefined) {
            await sendNotifications(
              ix.client,
              await peerNotifications(enrollment, notifiedCourses.has(enrollment.courseCode))
            );
            notifiedCourses.add(enrollment.courseCode);
          }
        }
      }
    },
    class ScheduleShowPeersCommand extends SlashCommand {
      name = "schedule-peers";
      description = "Find others who are taking or have taken the classes you're taking.";

      build(builder: SlashCommandBuilder) {
        builder.addStringOption((opt) =>
          opt
            .setName("term")
            .setDescription(`The term for which you want to find academic peers. Current default: ${defaultTerm}`)
            .setChoices(...Object.keys(termCodes).map((name) => ({ name, value: name })))
            .setRequired(false)
        );
      }

      async check(ix: ChatInputCommandInteraction) {
        const term = ix.options.getString("term", false) ?? defaultTerm;
        if (!Object.keys(termCodes).includes(term)) {
          return `:x: ${term} is not a valid term.`;
        }
        if (!(await store.hasEnrollments(BigInt(ix.user.id), termCodes[term as Term]))) {
          return `:x: Your ${term} schedule is empty. Use \`/schedule\` or \`/schedule-set-classes\` to add classes to it.`;
        }
      }

      async run(ix: ChatInputCommandInteraction) {
        const term = (ix.options.getString("term", false) ?? defaultTerm) as Term;
        await ix.reply({
          ephemeral: true,
          embeds: await peerEmbeds(await fetchPeerInfo(BigInt(ix.user.id), termCodes[term]), term),
        });
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
        await store.clearEnrollment(BigInt(ix.user.id), termCodes[term]);
        await ix.reply({
          ephemeral: true,
          content: `Successfully cleared your schedule for ${term}.`,
        });
        await updateDisplayedSchedules(ix.user.id, term);
      }
    },
    class SetPeerNotificationCommand extends SlashCommand {
      name = "schedule-notify";
      description = "Indicate whether you want to be notified about new academic peers.";

      build(builder: SlashCommandBuilder) {
        builder.addBooleanOption((opt) =>
          opt
            .setName("notify")
            .setDescription("Whether you want to be notified about new academic peers")
            .setRequired(true)
        );
      }

      async run(ix: ChatInputCommandInteraction): Promise<void> {
        await ensureUserExists(ix.user.id, await fetchInteractionUserNickname(ix));
        const user = await client.user.update({
          where: { id: BigInt(ix.user.id) },
          data: { notifyPeers: ix.options.getBoolean("notify", true) },
        });
        await ix.reply({
          ephemeral: true,
          content: `Got it. You will ${user.notifyPeers ? "" : "not "}be notified about new academic peers.`,
        });
      }
    },
    class ScheduleShareCommand extends SlashCommand {
      name = "schedule-share";
      description = "Sends a DM of your schedule to another user";
      build(builder: SlashCommandBuilder) {
        builder
          .addUserOption((opt) =>
            opt
              .setName("recipient")
              .setDescription("The users who will receive a DM of your schedule")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("term")
              .setDescription(`The academic term of the schedule you want to share. Current default: ${defaultTerm}`)
              .addChoices(...Object.keys(termCodes).map((name) => ({ name, value: name })))
              .setRequired(false)
          );
      }

      async check(ix: ChatInputCommandInteraction) {
        const term = ix.options.getString("term", false) ?? defaultTerm;
        if (!Object.keys(termCodes).includes(term)) {
          return `:x: ${term} is not a valid term.`;
        }
        await ensureUserExists(ix.user.id, await fetchInteractionUserNickname(ix));
      }

      async run(ix: ChatInputCommandInteraction) {
        await ix.deferReply({ ephemeral: true });
        const senderNickname = await fetchInteractionUserNickname(ix);
        const term = ix.options.getString("term", false) ?? defaultTerm;
        const termCode = termCodes[term as keyof typeof termCodes];
        const enrollments = await store.getEnrollments(BigInt(ix.user.id), termCode);
        const renderer = new ScheduleRenderer(enrollments);
        const filename = `${ix.user.id}-${termCode}-schedule.png`;
        const filepath = join("assets", filename);
        await renderer.render(filepath);

        const recipient = ix.options.getUser("recipient", true);
        try {
          await recipient.send({
            content: `${senderNickname} has sent you their ${term} schedule`,
            files: [new AttachmentBuilder(filepath)],
          });
          const replySuffix = enrollments.length === 0 ? ", but it is empty." : ".";
          await ix.editReply({
            content: `${userMention(recipient.id)} has successfully received your ${term} schedule${replySuffix}`,
          });
        } catch (e) {
          console.error(e);
          await ix.editReply({
            content: `:x: Failed to send your ${term} schedule to ${userMention(
              recipient.id
            )}. Maybe they do not allow DMs from server members.`,
          });
        }
      }
    },
  ],
};

async function sendNotifications(client: Client, notifications: { id: bigint; message: string }[]) {
  await Promise.all(
    notifications.map(async ({ id, message }) => {
      try {
        const user = await client.users.fetch(id.toString());
        await user.send(message);
        console.info(`Messaged ${user.username}: ${message}`);
      } catch (e) {
        // Swallowing on a message-by-message basis so that one failed message doesn't abort everything here
        console.error(`Failed to notify ${id}: ${message}`);
        console.error(e);
      }
    })
  );
}

async function fetchPeerInfo(studentId: bigint, termCode: number) {
  const [coursemates, classmates, alumni] = await Promise.all([
    store.fetchCoursemates(studentId, termCode),
    store.fetchSectionPeers(studentId, termCode),
    store.fetchCourseAlumni(studentId, termCode),
  ]);
  const peerInfo: store.PeerInfo = {
    coursemates,
    classmates,
    alumni,
  };
  return peerInfo;
}

async function updateDisplayedSchedules(userId: string, term: Term) {
  await Promise.all(
    activeScheduleDisplays
      .filter((disp) => disp.userId === userId && disp.term === termCodes[term])
      .map(async (disp) => {
        const enrollments = await store.getEnrollments(BigInt(userId), termCodes[term]);
        disp.interaction.editReply({
          ...(await scheduleEmbed(userId, enrollments, term)),
          components: [scheduleActionRow(enrollments, term)],
        });
      })
  );
}

function scheduleActionRow(classes: unknown[], term: Term) {
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
        customId: `schedule-peers-button:${term}`,
        label: "Find peers",
        emoji: "🔍",
        style: ButtonStyle.Secondary,
        disabled: classes.length === 0,
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

function meetingToLine(mtg: Meeting<true>) {
  return `${Array.from(mtg.days).join(", ")} from ${formatTime(mtg.startTime)} to ${formatTime(mtg.endTime)}${
    mtg.location === null ? "" : ` in ${mtg.location}`
  }\n`;
}

async function peerNotifications(
  enrollment: Enrollment,
  redundant = false
): Promise<{ id: bigint; message: string }[]> {
  if (
    ignoredClasses.some(
      ([course, section]) => course.toString() === enrollment.courseCode && section === enrollment.section
    )
  ) {
    return [];
  }

  const peers = await client.enrollment.findMany({
    where: {
      studentId: { not: enrollment.studentId },
      courseCode: enrollment.courseCode,
      term: { gte: enrollment.term },
      student: {
        notifyPeers: true,
      },
    },
  });
  type DirectMessageCandidate = { id: bigint; message: string; priority: number };
  // Priority: 1 alumni, 2 coursemates, 3 sectionmates
  // Redundant requires priority 3
  function peerNotifications(peer: typeof peers[0]): DirectMessageCandidate[] {
    const relation = peer.term === enrollment.term ? "classmate" : "alumnus";
    const sameSection = peer.section === enrollment.section;
    const priority = peer.term === enrollment.term ? (sameSection ? 3 : 2) : 1;
    const peerMention = userMention(enrollment.studentId.toString());
    const lines: string[] = [];

    if (redundant && priority < 3) {
      return [];
    }

    if (!redundant) {
      lines.push(`You have a new ${relation} in ${peer.courseCode}.`);
    }
    if (relation === "classmate") {
      lines.push(
        `${peerMention} is taking ${enrollment.courseCode} in ${
          reverseLookup(termCodes, enrollment.term) ?? "???"
        } along with you.`
      );
      if (peer.section === enrollment.section) {
        lines.push(`They are also in section ${zeroPad(enrollment.section)}!`);
      }
    } else {
      lines.push(
        `${peerMention} took ${enrollment.courseCode} in ${
          reverseLookup(termCodes, enrollment.term) ?? "an unknown term"
        }.`
      );
    }
    return [{ id: peer.studentId, message: lines.join("\n"), priority }];
  }
  const deduplicator: { [id: string]: DirectMessageCandidate } = {};
  for (const candidate of peers.flatMap(peerNotifications)) {
    const currentTop = deduplicator[candidate.id.toString()];
    if (currentTop === undefined || candidate.priority > currentTop.priority) {
      deduplicator[candidate.id.toString()] = candidate;
    }
  }
  return Object.values(deduplicator);
}

async function peerEmbeds(peers: store.PeerInfo, term: Term): Promise<EmbedBuilder[]> {
  const isOrAre = (amount: number) => (amount === 1 ? "is" : "are");

  const currentPeerEmbed = new EmbedBuilder({
    title: `${term} Academic Peers`,
    description: Object.keys(peers.coursemates).length === 0 ? "No current peers found." : undefined,
    fields: Object.entries(peers.coursemates).map(([courseStr, ids]) => {
      const classmateBySection = store.rollUpAsObjectOfArrays(
        (peers.classmates[courseStr] ?? []).map((mate) => [mate.section, mate.id])
      );
      const classmateInfo = Object.entries(classmateBySection)
        .map(
          ([section, mates]) =>
            `${mates.map((int) => userMention(int.toString())).join(", ")} ${isOrAre(
              mates.length
            )} also in section ${zeroPad(Number(section))}!`
        )
        .join("\n");
      const classmateAddition = classmateInfo.length === 0 ? "" : "\n\n" + classmateInfo;

      return {
        name: courseStr,
        value: ids.map((id) => `<@${id}>`).join(", ") + classmateAddition,
        inline: true,
      };
    }),
  });
  const alumniEmbed = new EmbedBuilder({
    title: `${term} Alumni Peers`,
    description: Object.keys(peers.alumni).length === 0 ? "No alumni peers found." : undefined,
    fields: Object.entries(peers.alumni).map(([courseStr, alums]) => {
      return {
        name: courseStr,
        value: Object.entries(groupItems(alums, (alum) => alum.term.toString()))
          .map(
            ([termCodeStr, alums]) =>
              `${alums.map((alum) => userMention(alum.id.toString())).join(", ")}: ${
                reverseLookup(termCodes, Number(termCodeStr)) ?? "unknown"
              }`
          )
          .join("\n")
          .slice(0, 1024),
      };
    }),
  });
  return [currentPeerEmbed, alumniEmbed];
}

async function scheduleEmbed(
  userId: string,
  classes: [Section<true>, Course][],
  term: Term
): Promise<{ embeds: EmbedBuilder[]; files: AttachmentBuilder[] }> {
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

  const renderer = new ScheduleRenderer(classes);
  const filename = `${userId}-${termCodes[term]}-schedule.png`;
  const filePath = join("assets", filename);
  await renderer.render(filePath);

  const embed = new EmbedBuilder()
    .setTitle(`Your ${term} Schedule`)
    .setDescription(
      classes.length === 0 ? 'Your schedule is empty. Click ":heavy_plus_sign: Add class" to add a class.' : null
    )
    .setFields(await Promise.all(classes.map(classToField)))
    .setImage(`attachment://${filename}`);

  return {
    embeds: [embed],
    files: [new AttachmentBuilder(filePath)],
  };
}

export default scheduleRecord;
