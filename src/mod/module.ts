import { Client, CommandInteraction, SlashCommandBuilder } from "discord.js";

export interface Module {
  name: string;

  /**
   * Register event listeners for the Discord.js client before connection
   * @param client The Discord.js client being set up
   */
  setup?(client: Client): Promise<void>;

  /**
   * Slash commands provided by this module
   */
  commands?: SlashCommandBuilder[];

  /**
   * Handle an invocation of a command in `commands`
   * @param interaction Interaction to respond to
   */
  interact?(interaction: CommandInteraction): Promise<void>;
}
