# LAE OpenBot

**This is Living ArtsEngine's collaborative Discord bot project.** From quote tracking to classmate discovery, many custom bot features are useful to LAE and U-M students. This project is our place to ideate and develop these features for the Living ArtsEngine community. All LAE members are invited to pitch ideas, report issues, and build the OpenBot.

Just figuring out how to use the OpenBot? Check out the [docs](docs/README.md).

## Code

We're using Python because it's widely used, mostly unsurprising (unlike some parts of [JavaScript](https://github.com/denysdovhan/wtfjs)), and beginner-friendly. You can write new modules (offering a cohesive set of features through event handlers and commands), improve existing ones, improve the modular architecture, or anything else.

1. If not done already, send your uniqname in the [Group members thread](https://discord.com/channels/1002274815270465607/1005317489506394202) in `#open-bot-dev` so that the maintainer can invite you to the [Living ArtsEngineers](https://gitlab.umich.edu/living-artsengineers) group.
1. Create a new branch from the `main` branch, then clone it locally
1. If not done already, download `env.json` from the pinned messages in `#open-bot-dev` to your local clone, and join _Bot testing_ via the invite there.
1. Get [`pdm`](https://pdm.fming.dev/latest/) if not already installed
1. Run `pdm install` to install dependencies
1. Make your changes. If you're making a module, check out [existing modules](mod/) for examples, and remember to add it to [mod/\_\_init\_\_.py](mod/__init__.py).
1. Test your changes with OpenBotDev in the _Bot testing_ server.
1. Run `black` to format your code, then push it to your branch
1. Start a Merge Request into the `main` branch

### Environments

OpenBot has two deployment environments: development (`dev`) and production (`prod`). Each environment has its own bot identity and server. All development testing takes place in the `dev` environment. Before you manually test your local changes by running `run.py`, download `env.json` from the `#open-bot-dev` channel, and join the _Bot testing_ server (check pinned messages). It configures your local instance to serve the `dev` environment, acting as OpenBotDev in _Bot testing_.

## Document reported issues and ideas

Once we identify a specific problem or idea from non-technical discussion, make an issue under this repository to keep track of its progress. No rigid rules on the formatting of your issue, but for problems, make sure to describe the problem specifically ("... doesn't work" won't suffice) and tell us how to reproduce the problem. Make sure to attach either the _feature_ tag or the _bug_ tag to each issue as appropriate. Check existing issues for examples.