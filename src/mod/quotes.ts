import { Conversation, Quote, User } from '@prisma/client'
import assert = require('assert')
import {
  ApplicationCommandType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  CacheType,
  GatewayIntentBits
} from 'discord.js'
import client, { ensureUserExists } from '../storage'
import { fetchGuildNickname, stripMarkdownTag } from '../utils'
import host from '../host'

function conversationEmbed (
  cx: Conversation & {
    quotes: Array<Pick<Quote, 'content' | 'id'> & {
      speaker: Pick<User, 'username'>
    }>
  }
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(cx.quotes.map((q) => stripMarkdownTag`_${q.content}_  ―${q.speaker.username}`).join('\n'))
    .setTimestamp(cx.date)
    .setFooter({
      text: stripMarkdownTag`C#${cx.id} Q#${cx.quotes.map((q) => q.id).join('-')}`
    })
}

const conversationFetchSelector = {
  quotes: {
    select: {
      id: true,
      speaker: {
        select: {
          username: true
        }
      },
      content: true
    }
  }
}

const mod = host.module('quotes', [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages])

mod.menu('Quote', ApplicationCommandType.Message, {
  check (ix): string | undefined {
    if (ix.targetMessage.content.trim().length === 0) {
      return ":warning: You can't quote an empty message!"
    }
  },

  async run (ix: MessageContextMenuCommandInteraction) {
    await ensureUserExists(
      ix.targetMessage.author.id,
      ix.targetMessage.member?.nickname ??
        (await fetchGuildNickname(ix.client, ix.targetMessage.author.id)) ??
        ix.targetMessage.author.username
    )
    const authorId = BigInt(ix.targetMessage.author.id)
    const conv = await createQuote(ix.targetMessage.cleanContent, authorId)
    await ix.reply({
      embeds: [conversationEmbed(conv)]
    })
  }
})

mod.slash('read-conversation', 'Read the entire conversation with the given C#ID.', {
  build: builder =>
    builder.addIntegerOption((opt) =>
      opt.setName('cid').setDescription('Conversation ID (C#???)').setRequired(true)
    ),
  async run (ix: ChatInputCommandInteraction) {
    const cid = ix.options.getInteger('cid', true)
    const conv = await fetchConversation(cid)
    if (conv === null) {
      await ix.reply({
        ephemeral: true,
        content: `No conversation exists with C#${cid}`
      })
      return
    }
    await ix.reply({
      embeds: [conversationEmbed(conv)]
    })
  }
})

mod.slash('add-quote', 'Add a quote to a new or existing conversation.', {
  build: (builder: SlashCommandBuilder) => builder
    .addStringOption((opt) => opt
      .setName('content')
      .setDescription('The statement to quote')
      .setRequired(true))

    .addUserOption((opt) => opt
      .setName('speaker')
      .setDescription('The person who made the statement')
      .setRequired(true))

    .addIntegerOption((opt) => opt
      .setName('conversation-id')
      .setDescription('The conversation to append this quote to, if it exists')
      .setRequired(false)),

  async run (ix: ChatInputCommandInteraction) {
    const content = ix.options.getString('content', true)
    const speaker = ix.options.getUser('speaker', true)
    const conversationId = ix.options.getInteger('conversation-id', false) ?? undefined

    await ensureUserExists(speaker.id, (await fetchGuildNickname(ix.client, speaker.id)) ?? speaker.username)
    const conv = await createQuote(content, BigInt(speaker.id), conversationId)
    await ix.reply({
      embeds: [conversationEmbed(conv)]
    })
  }
})

mod.slash('random-conversation', 'Read a random quoted conversation.', async (ix: ChatInputCommandInteraction<CacheType>) => {
  // See: https://github.com/prisma/prisma/discussions/5886
  // TL;DR: Prisma doesn't give us an efficient way to fetch one random row
  const convRecord = await client.$queryRawUnsafe<Array<Pick<Conversation, 'id'>>>(
    'SELECT id FROM Conversation ORDER BY RANDOM() LIMIT 1'
  )
  if (convRecord.length === 0) {
    await ix.reply({
      ephemeral: true,
      content: 'No conversations exist!'
    })
  }
  const conv = await fetchConversation(convRecord[0].id)
  assert(conv !== null)
  await ix.reply({
    embeds: [conversationEmbed(conv)]
  })
})

async function createQuote (content: string, authorId: bigint, conversationId?: number): Promise<Conversation & {
  quotes: Array<Pick<Quote, 'content' | 'id'> & {
    speaker: Pick<User, 'username'>
  }>
}> {
  const quote = await client.quote.create({
    data: {
      content,
      conversation: {
        create:
          conversationId === undefined
            ? {
                date: new Date()
              }
            : undefined,
        connect:
          conversationId === undefined
            ? undefined
            : {
                id: conversationId
              }
      },
      speaker: {
        connect: {
          id: authorId
        }
      }
    }
  })
  return await client.conversation.findFirstOrThrow({
    where: {
      id: quote.conversationId
    },
    include: conversationFetchSelector
  })
}

async function fetchConversation (cid: number): Promise<Conversation & {
  quotes: Array<Pick<Quote, 'content' | 'id'> & {
    speaker: Pick<User, 'username'>
  }>
} | null> {
  return await client.conversation.findFirst({
    where: { id: cid },
    include: conversationFetchSelector
  })
}
