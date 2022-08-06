"""Core definitions for modules."""

import abc
from typing import Callable, TYPE_CHECKING


if TYPE_CHECKING:
    from client import OpenBotClient


class OpenBotModule(abc.ABC):
    client: "OpenBotClient"
    name: str

    def __init__(self, client: "OpenBotClient", name: str) -> None:
        self.client = client
        self.name = name

    # Check https://discordpy.readthedocs.io/en/stable/api.html for reference

    def on_ready(self, func: Callable):
        self.client.hooks.on_ready.append((self, func))
        return func

    def on_message(self, func: Callable):
        self.client.hooks.on_message.append((self, func))
        return func

    def on_reaction_add(self, func: Callable):
        self.client.hooks.on_reaction_add.append((self, func))
        return func
