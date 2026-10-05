import { join, resolve, toFileUrl } from "@std/path";
import type { Collection } from "discord.js";
import logger from "./logger.ts";

/**
 * Recursively imports every `.ts` module under `dir` and returns their default exports.
 * Modules rejected by `isValid` are skipped with a warning.
 */
export const loadModules = async <T>(dir: string, isValid: (m: unknown) => m is T): Promise<T[]> => {
  const entries = Array.from(Deno.readDirSync(dir));
  const modules: T[] = [];

  for (const folder of entries.filter((e) => e.isDirectory)) {
    modules.push(...await loadModules(join(dir, folder.name), isValid));
  }

  for (const file of entries.filter((e) => e.name.endsWith(".ts"))) {
    const path = resolve(dir, file.name);
    const mod = await import(toFileUrl(path).href);
    const exported = mod.default || mod;
    if (isValid(exported)) {
      modules.push(exported);
    } else {
      logger.warn(`The module at ${path} is missing a required property and was skipped.`);
    }
  }
  return modules;
};

const isCommand = <T>(m: unknown): m is T => typeof m === "object" && m !== null && "data" in m && "execute" in m;

export default async <T extends { data: { name: string } }>(cmdPath: string, commands: Collection<string, T>) => {
  for (const command of await loadModules<T>(cmdPath, isCommand<T>)) {
    commands.set(command.data.name, command);
  }
};
