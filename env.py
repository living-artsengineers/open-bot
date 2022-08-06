import json
import sys

with open("env.json", "r") as env_file:
    env_json = json.load(env_file)
    env = env_json["env"] if len(sys.argv) < 2 else sys.argv[-1]
    env_config = env_json[env]
