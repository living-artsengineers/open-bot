import {
  ApplicationCommandDataResolvable,
  ApplicationCommandOptionChoiceData,
  ApplicationCommandType,
  AutocompleteInteraction,
  BaseInteraction,
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  ContextMenuCommandType,
  SlashCommandBuilder,
} from "discord.js";

/**
 * @example
 * ```ts
 * const test: InteractionCommand[] = [
 *   new class extends ContextMenuCommand {
 *     name = "test";
 *     type = ApplicationCommandType.Message;
 *
 *     async run(ix: ContextMenuCommandInteraction) {
 *       ix.reply("test");
 *     }
 *   },
 *   new class extends SlashCommand {
 *     name = "test-slash";
 *     description = "test slash command";
 *
 *     async run(ix: ChatInputCommandInteraction) {
 *       ix.reply("test");
 *     }
 *
 *     build(builder: SlashCommandBuilder) {
 *       builder.addStringOption(opt => opt
 *           .setName("foo")
 *           .setDescription("bar"));
 *     }
 *   }
 * ]
 * ```
 */
export abstract class InteractionCommand<
  T extends BaseInteraction = BaseInteraction,
  B extends ApplicationCommandDataResolvable = ApplicationCommandDataResolvable
> {
  abstract _test(ix: BaseInteraction): ix is T;
  abstract _build(): B;
  /**
   * Allows checking for end-user errors in the command. If this returns a string, it will be sent to the user as
   * a warning, and the command will not be executed further.
   */
  check(_ix: T): void | string | Promise<void | string> {
    void _ix;
  }
  /**
   * Allows the command to perform any necessary manipulation of the builder.
   */
  build(_builder: B): B | void {
    void _builder;
  }
  /**
   * Called when the command is executed.
   */
  abstract run(ix: T): Promise<void>;
}

export abstract class ContextMenuCommand extends InteractionCommand<
  ContextMenuCommandInteraction,
  ContextMenuCommandBuilder
> {
  abstract readonly name: string;
  abstract readonly type: ApplicationCommandType;

  _test(ix: CommandInteraction): ix is ContextMenuCommandInteraction {
    return ix.isContextMenuCommand() && ix.commandName === this.name;
  }

  _build() {
    return new ContextMenuCommandBuilder().setName(this.name).setType(this.type as ContextMenuCommandType);
  }
}

export abstract class SlashCommand extends InteractionCommand<ChatInputCommandInteraction, SlashCommandBuilder> {
  abstract readonly name: string;
  abstract readonly description: string;

  _test(ix: CommandInteraction): ix is ChatInputCommandInteraction {
    return ix.isChatInputCommand() && ix.commandName === this.name;
  }

  _build() {
    return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
  }
}

export abstract class AutocompletingSlashCommand extends InteractionCommand<
  ChatInputCommandInteraction | AutocompleteInteraction,
  SlashCommandBuilder
> {
  abstract readonly name: string;
  abstract readonly description: string;

  _test(ix: BaseInteraction): ix is ChatInputCommandInteraction | AutocompleteInteraction {
    return (ix.isChatInputCommand() || ix.isAutocomplete()) && ix.commandName === this.name;
  }

  _build() {
    return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
  }

  async run(ix: ChatInputCommandInteraction | AutocompleteInteraction): Promise<void> {
    if (ix.isAutocomplete()) {
      try {
        const completions = await this.autocomplete(ix);
        if (completions !== null) {
          await ix.respond(completions);
        }
      } catch (e) {
        console.error(e);
        await ix.respond([]);
      }
    } else if (ix.isChatInputCommand()) {
      await this.execute(ix);
    }
  }

  abstract execute(ix: ChatInputCommandInteraction): Promise<void>;
  abstract autocomplete(ix: AutocompleteInteraction): Promise<ApplicationCommandOptionChoiceData[] | null>;
}

type Constructable<T, A extends unknown[]> = new (...args: A[]) => T;

export interface Module {
  name: string;

  /**
   * Register event listeners for the Discord.js client before connection
   * @param client The Discord.js client being set up
   */
  setup?(client: Client): Promise<void>;

  /**
   * Commands provided by this module
   */
  commands?: Constructable<InteractionCommand, []>[];
}
