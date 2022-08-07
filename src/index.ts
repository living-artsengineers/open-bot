import { Client, GatewayIntentBits, REST, Routes } from 'discord.js'
import { argv } from 'process'
import env from './environment'
import { Module } from './mod/module'
import modules from './mod/registry'

async function setupInteractions() {
    const rest = new REST({version: '10'}).setToken(env.token)
    const commands = Object.values(modules).map(m => m.commands ?? []).flat()
    await rest.put(Routes.applicationGuildCommands(env.appId.toString(), env.guild.toString()), {body: commands})
    console.log('Done setting up interactions')
}

async function main() {
    const client = new Client({intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]})

    const commandMap: {[commandName: string]: Module} = {}
    for (const mod of Object.values(modules)) {
        if (mod.setup !== undefined) {
            mod.setup(client)
        }
        for (const cmd of (mod.commands ?? [])) {
            if (Object.keys(commandMap).includes(cmd.name)) {
                console.warn(`Command conflict! ${cmd.name} is claimed by both "${commandMap[cmd.name].name}" and "${mod.name}". Dispatching to the former.`)
            } else {
                commandMap[cmd.name] = mod
            }
        }
    }

    client.on('interactionCreate', async intx => {
        if (!intx.isChatInputCommand()) return
        const mod = commandMap[intx.commandName]
        if (mod !== undefined) {
            await mod.interact!(intx)
        }
    })

    client.login(env.token)
}

if (argv[argv.length - 1] === 'setup' || env.name === 'dev') {
    setupInteractions()
        .then(main)
        .catch(console.error)
} else {
    main().catch(console.error)
}