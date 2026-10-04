import { join, resolve, toFileUrl } from "@std/path";
import logger from "./logger.js";

const parseCommandFiles = async (cmdPath, commands) => {
  const entries = Array.from(Deno.readDirSync(cmdPath));

  for (const folder of entries.filter((e) => e.isDirectory)) {
    await parseCommandFiles(join(cmdPath, folder.name), commands);
  }

  for (const file of entries.filter((e) => e.name.endsWith(".js"))) {
    const commandModule = await import(toFileUrl(resolve(cmdPath, file.name)).href);
    const command = commandModule.default || commandModule;

    commands.set(command.data.name, command);
  }
};

export default async (cmdPath, commands) => {
  if (typeof commands === "object" && typeof commands.set === "function") {
    await parseCommandFiles(cmdPath, commands);
  } else {
    logger.error("Invalid collection provided");
  }
};
