import environment from "../environment";
import { Module } from "./module";

// This module is meant to prevent *accidental* references.
// There's no point in trying to circumvent this filter. That puts you in danger!
// Expect a visit from DPSS and a meeting with MHousing for an alleged CLAM violation. Speaking from experience.
const censoredWords = {
  snipe: /s\s*n\s*i*\s*p\s*e/,
  sniping: /s\s*n\s*i*\s*p\s*i*\s*n\s*g/,
  cockbot: /c\s*o\s*c+\s*(k\s*)*\s*b\s*o\s*t/,
  murder: /m\s*u\s*r+\s*d\s*e\s*r+/,
};

export function censoredWord(message: string): string | null {
  const content = message.toLowerCase();
  for (const word in censoredWords) {
    if (censoredWords[word as keyof typeof censoredWords].test(content)) {
      return word;
    }
  }
  return null;
}

const censorship: Module = {
  name: "Censorship",
  async setup(client) {
    client.on("messageCreate", async (msg) => {
      const badWord = censoredWord(msg.content);
      if (badWord !== null) {
        try {
          await msg.delete();
          const dmChannel = await msg.author.createDM(true);
          await dmChannel.send(
            `⚠ Do not mention ${badWord} in the _official_ Living ArtsEngine server. DPSS moment 🚨\n` +
              `This protects you from being reported to the police by office staff.`
          );
          if (msg.author.id !== environment.adminId) {
            const adminChannel = await client.users.createDM(environment.adminId);
            await adminChannel.send(
              `Censored ${msg.member?.nickname ?? msg.author.username}'s message: \`\`\`${msg.cleanContent}\`\`\``
            );
          }
        } catch (fail) {
          try {
            await (
              await client.users.createDM(environment.adminId)
            ).send(`Failed to delete risky message ${msg.content} from ${msg.author.username}. Error: ${fail}`);
            console.trace("failed censorship");
          } catch (fail) {
            console.error(fail);
            console.trace("failed notification about failed censorship :(");
          }
        }
      }
    });
  },
};

export default censorship;
