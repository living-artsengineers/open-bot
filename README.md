# LAE OpenBot

**This is Living ArtsEngine's collaborative Discord bot project.** From quote tracking to classmate discovery, many custom bot features are useful to LAE and U-M students. This project is our place to ideate and develop these features for the Living ArtsEngine community. All LAE members are invited to pitch ideas, report issues, and build the OpenBot.

Just figuring out how to use the OpenBot? Check out the [docs](docs/README.md).

## Code

We're using Python because it's widely used, mostly unsurprising (unlike some parts of [JavaScript](https://github.com/denysdovhan/wtfjs)), and beginner-friendly. You can write new modules (offering a cohesive set of features through event handlers and commands), improve existing ones, improve the modular architecture, or anything else.

1. If not done already, send your uniqname in the [Group members thread](https://discord.com/channels/1002274815270465607/1005317489506394202) in `#open-bot-dev` so that the maintainer can invite you to the [Living ArtsEngineers](https://gitlab.umich.edu/living-artsengineers) group.
1. Create a new branch from the `main` branch, then clone it locally
1. Get [`pdm`](https://pdm.fming.dev/latest/) if not already installed
1. Run `pdm install` to install dependencies
1. Make your changes. If you're making a module, check out [existing modules](mod/) for examples, and remember to add it to [mod/\_\_init\_\_.py](mod/__init__.py).
1. Run `black` to format your code, then push it to your branch
1. Start a Merge Request into the `main` branch

## Document reported issues and ideas

Once we identify a specific problem or idea from non-technical discussion, make an issue under this repository to keep track of i ts progress. No rigid rules on the formatting of your issue, but for problems, make sure to describe the problem specifically ("... doesn't work" won't suffice) and tell us how to reproduce the problem. Make sure to attach either the _feature_ tag or the _bug_ tag to each issue as appropriate.