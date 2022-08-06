"""Abstractions for storing persistent data. Currently achieved via SQLite and PonyORM."""

from datetime import datetime
from pony import orm
from env import env

db = orm.Database()


class User(db.Entity):
    id = orm.PrimaryKey(int, size=64)
    username = orm.Required(str)
    """The user's Discord snowflake."""
    messages = orm.Set("Message")


class Message(db.Entity):
    """A message on Discord."""

    id = orm.PrimaryKey(int, size=64)
    """The message's Discord snowflake."""
    author = orm.Required(User)
    length = orm.Required(int)
    channel = orm.Required(int, size=64)
    time = orm.Required(datetime)
    """The snowflake of the channel in which this message was sent."""


if env == "dev":
    orm.set_sql_debug(True)

db.bind(provider="sqlite", filename=f"storage-{env}.sqlite", create_db=True)
db.generate_mapping(create_tables=True)


def user_exists(user_id: int):
    return len(orm.select(p for p in User if p.id == user_id)[:]) > 0


def ensure_user_created(user_id: int, username: str):
    if not user_exists(user_id):
        User(id=user_id, username=username)
