import { SlashCommandBuilder } from 'discord.js'
import { Module } from './module'
import db from '../storage'

const messageStats: Module = {
    name: 'MessageStats',
    commands: [
        new SlashCommandBuilder()
            .setName("mymessagestats")
            .setDescription("Check basic statistics about the messages I have sent here.")
    ],
    async interact(interaction) {
        if (interaction.commandName === 'mymessagestats') {
            const count = await db.message.count({where: {author: {equals: BigInt(interaction.user.id)}}})
            await interaction.reply({
                content: `You have sent ${count} message${count === 1 ? '' : 's'}`,
                ephemeral: true
            })
        }
    }
}

export default messageStats