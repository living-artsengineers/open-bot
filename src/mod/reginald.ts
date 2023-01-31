import host from '../host'
import { scheduleJob } from 'node-schedule'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import env from '../environment'

const mod = host.module('reginald', [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent])

async function sendReginald (client: Client<true>): Promise<void> {
  const chan = await client.channels.fetch(env.reginaldChannel)
  if (chan?.isTextBased()) {
    await chan.send('https://cdn.discordapp.com/attachments/842850242431942687/1069950238418284564/1633B7A3-63B4-4489-B338-B443090FE7BC.jpg')
  }
}

const refDate = Object.freeze(new Date(2023, 0, 31, 8, 0, 0))

mod.once(Events.ClientReady, async client => {
  // await sendReginald(client)
  scheduleJob('present reginald', '0 8 * * 2', async () => {
    const days = (new Date().getTime() - refDate.getTime()) / 1000 / 60 / 60 / 24
    if (Math.abs(days % 14) < 2) {
      await sendReginald(client)
    }
  })
})
