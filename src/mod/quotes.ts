import { Conversation, Quote, User } from "@prisma/client";
import assert = require("assert");
import {
  ApplicationCommandType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  time,
  CacheType,
} from "discord.js";
import client, { ensureUserExists } from "../storage";
import { Module, ContextMenuCommand, SlashCommand } from "./module";

function stripMarkdown(s: string): string {
  return s.replace(/(\*|_|~|`|\[|\]|\(|\)|\||\\)/g, "\\$1").replace(/\s+/g, " ");
}

function stripMarkdownTag(strings: TemplateStringsArray, ...expr: unknown[]) {
  return strings.reduce((acc, s, i) => acc + s + (i < expr.length ? stripMarkdown(String(expr[i])) : ""), "");
}

function conversationEmbed(
  cx: Conversation & {
    quotes: (Pick<Quote, "content" | "id"> & {
      speaker: Pick<User, "username">;
    })[];
  }
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(cx.quotes.map((q) => stripMarkdownTag`_${q.content}_  ―${q.speaker.username}`).join("\n"))
    .setDescription(time(cx.date, "D"))
    .setFooter({
      text: stripMarkdownTag`C#${cx.id} Q#${cx.quotes.map((q) => q.id).join("-")}`,
    });
}

const conversationFetchSelector = {
  quotes: {
    select: {
      id: true,
      speaker: {
        select: {
          username: true,
        },
      },
      content: true,
    },
  },
};

const quotes: Module = {
  name: "Quotes",
  commands: [
    new (class extends ContextMenuCommand {
      name = "Quote";
      type = ApplicationCommandType.Message;

      override check(ix: MessageContextMenuCommandInteraction) {
        if (ix.targetMessage.content.trim().length === 0) {
          return ":warning: You can't quote an empty message!";
        }
      }

      async run(ix: MessageContextMenuCommandInteraction) {
        // if (!ix.isMessageContextMenuCommand()) return;
        await ensureUserExists(ix.targetMessage.author.id, ix.targetMessage.author.username);
        const authorId = BigInt(ix.targetMessage.author.id);
        const conv = await createQuote(ix.targetMessage.cleanContent, authorId);
        await ix.reply({
          embeds: [conversationEmbed(conv)],
        });
      }
    })(),

    new (class extends SlashCommand {
      name = "read-conversation";
      description = "Read the entire conversation with the given C#ID.";

      override build(builder: SlashCommandBuilder) {
        builder.addIntegerOption((opt) =>
          opt.setName("cid").setDescription("Conversation ID (C#???)").setRequired(true)
        );
      }

      async run(ix: ChatInputCommandInteraction) {
        const cid = ix.options.getInteger("cid", true);
        const conv = await fetchConversation(cid);
        if (conv === null) {
          await ix.reply({
            ephemeral: true,
            content: `No conversation exists with C#${cid}`,
          });
          return;
        }
        await ix.reply({
          embeds: [conversationEmbed(conv)],
        });
      }
    })(),

    new (class extends SlashCommand {
      name = "add-quote";
      description = "Add a quote to a new or existing conversation.";

      override build(builder: SlashCommandBuilder) {
        builder
          .addStringOption((opt) => opt.setName("content").setDescription("The statement to quote").setRequired(true))

          .addUserOption((opt) =>
            opt.setName("speaker").setDescription("The person who made the statement").setRequired(true)
          )

          .addIntegerOption((opt) =>
            opt
              .setName("conversation-id")
              .setDescription("The conversation to append this quote to, if it exists")
              .setRequired(false)
          );
      }

      async run(ix: ChatInputCommandInteraction) {
        const content = ix.options.getString("content", true);
        const speaker = ix.options.getUser("speaker", true);
        const conversationId = ix.options.getInteger("conversation-id", false) ?? undefined;
        await ensureUserExists(speaker.id, speaker.username);
        const conv = await createQuote(content, BigInt(speaker.id), conversationId);
        await ix.reply({
          embeds: [conversationEmbed(conv)],
        });
      }
    })(),

    new (class extends SlashCommand {
      name = "random-conversation";
      description = "Read a random quoted conversation.";

      async run(ix: ChatInputCommandInteraction<CacheType>) {
        const convRecord = await client.$queryRawUnsafe<Pick<Conversation, "id">>(
          "SELECT id FROM Conversation ORDER BY RANDOM() LIMIT 1"
        );
        if (convRecord === null) {
          await ix.reply({
            ephemeral: true,
            content: "No conversations exist!",
          });
        }
        const conv = await fetchConversation(convRecord.id);
        assert(conv !== null);
        await ix.reply({
          embeds: [conversationEmbed(conv)],
        });
      }
    })(),
  ],
};

async function createQuote(content: string, authorId: bigint, conversationId?: number) {
  const quote = await client.quote.create({
    data: {
      content,
      conversation: {
        create:
          conversationId === undefined
            ? {
                date: new Date(),
              }
            : undefined,
        connect:
          conversationId === undefined
            ? undefined
            : {
                id: conversationId,
              },
      },
      speaker: {
        connect: {
          id: authorId,
        },
      },
    },
  });
  return await client.conversation.findFirstOrThrow({
    where: {
      id: quote.conversationId,
    },
    include: conversationFetchSelector,
  });
}

async function fetchConversation(cid: number) {
  return await client.conversation.findFirst({
    where: { id: cid },
    include: conversationFetchSelector,
  });
}

export default quotes;
