"""Collect basic statistics on messaging activity per user."""

from datetime import datetime
from storage import *
import discord
from client import client

mod = client.module("MessageStats")


@mod.on_message
@orm.db_session
async def on_message(msg: discord.Message):
    if msg.content != "":
        ensure_user_created(msg.author.id, msg.author.name)
        Message(
            id=msg.id,
            author=msg.author.id,
            length=len(msg.content),
            channel=msg.channel.id,
            time=datetime.now(),
        )
        db.commit()


@client.tree.command()
async def mymessagestats(interaction: discord.Interaction):
    with orm.db_session:
        msg_count = orm.count(m for m in Message if m.author.id == interaction.user.id)
    await interaction.response.send_message(
        f"You have sent {msg_count} message" + ("" if msg_count == 1 else "s"),
        ephemeral=True,
    )
