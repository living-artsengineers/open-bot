"""The core Discord.py client. Bot modules import `client` from this file and reference it in annotations. """
import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Union
from collections.abc import Awaitable
import discord
from discord import app_commands
from env import env_config, env
from module import OpenBotModule

intents = discord.Intents.default()
intents.message_content = True
intents.reactions = True


@dataclass
class ModuleHooks:
    on_ready: List[Tuple[OpenBotModule, Awaitable[None]]] = field(default_factory=list)
    on_message: List[Tuple[OpenBotModule, Awaitable[discord.Message]]] = field(
        default_factory=list
    )
    on_reaction_add: List[
        Tuple[OpenBotModule, Awaitable[discord.Reaction, discord.User]]
    ] = field(default_factory=list)


class OpenBotClient(discord.Client):
    env: Dict[str, Union[int, str]]
    hooks: ModuleHooks

    def __init__(self, env_config: Dict[str, Union[int, str]], *, loop=None, **options):
        super().__init__(intents=intents, loop=loop, **options)
        self.env = env_config
        self.hooks = ModuleHooks()
        self.tree = app_commands.CommandTree(self)

    def module(self, name: str) -> OpenBotModule:
        print('Creating module', name)
        return OpenBotModule(self, name)

    async def on_ready(self):
        print(f"Logged in as {self.user} (ID: {self.user.id})")
        await asyncio.gather(*[hook() for _, hook in self.hooks.on_ready])

    async def on_message(self, message: discord.Message):
        if message.author.id == self.user.id:
            return
        await asyncio.gather(*[hook(message) for _, hook in self.hooks.on_message])

    async def on_reaction_add(self, reaction: discord.Reaction, user: discord.User):
        await asyncio.gather(
            *[hook(reaction, user) for _, hook in self.hooks.on_reaction_add]
        )

    async def setup_hook(self) -> None:
        guild = discord.Object(id=self.env["guild"])
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)

    def run(self):
        return super().run(self.env["token"])


client = OpenBotClient(env_config)
