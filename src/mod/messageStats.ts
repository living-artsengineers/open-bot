import { ChatInputCommandInteraction, Events, GatewayIntentBits } from 'discord.js'
import host from '../host'
import db, { ensureUserExists } from '../storage'

const mod = host.module('MessageStats', [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages])

mod.when(Events.MessageCreate, async (msg) => {
  if (!msg.inGuild()) return
  await ensureUserExists(msg.author.id, msg.member?.nickname ?? msg.author.username)
  const row = {
    author: BigInt(msg.author.id),
    length: msg.content.trim().length,
    channel: BigInt(msg.channelId),
    time: new Date()
  }
  await db.message.upsert({
    create: {
      id: Number(msg.id),
      ...row
    },
    update: row,
    where: {
      id: Number(msg.id)
    }
  })
})

mod.slash('mymessagestats', 'Check the number of messages from me recorded by the bot', {
  build: build => build.setDMPermission(false),
  async run (interaction: ChatInputCommandInteraction) {
    const count = await db.message.count({
      where: { author: { equals: BigInt(interaction.user.id) } }
    })
    await interaction.reply({
      content: `You have sent ${count} message${count === 1 ? '' : 's'}`,
      ephemeral: true
    })
  }
})
