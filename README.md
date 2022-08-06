# LAE OpenBot

**This is Living ArtsEngine's collaborative Discord bot project.** From quote tracking to course lookups, many custom bot features are valuable to LAE and U-M students in general. This project is our place to learn, ideate, and develop these features for the Living ArtsEngine community. All LAE members are welcome to submit issues, merge requests, and feature requests.

Just figuring out how to use the OpenBot? Check out the [docs](docs/README.md).

## Getting Started

We're using Python because it's widely used, mostly unsurprising (unlike some parts of [JavaScript](https://github.com/denysdovhan/wtfjs)), and beginner-friendly.

You can contribute in many ways:

### Code

1. Create a new branch based on the `main` branch, then clone it locally
1. Get [`pdm`](https://pdm.fming.dev/latest/) if not already installed
1. Run `pdm install` to install dependencies
1. Make your changes (they can be anything!) If you're making a module, check out [existing modules](mod/) for examples, and remember to add it to [mod/\_\_init\_\_.py](mod/__init__.py).
1. Run `black` to format your code
1. Start a Merge Request into the `main` branch

### Pitch features

To maximize discussion, use the development channel `#the-open-bot` in the LAE 2022-2023 Discord server. Just casually pitch your feature---if someone wants to make it, we'll put it in the [To-dos](https://gitlab.umich.edu/living-artsengineers/open-bot/-/wikis/To-do).

### Report issues

Make an issue under this repository, and we'll take care of it. No rigid rules on the formatting of your issue, but make sure to describe the problem specifically ("... doesn't work" won't suffice) and tell us how to reproduce the problem.