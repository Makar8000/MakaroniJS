import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import logger from './logger.js';

const parseCommandFiles = async (cmdPath, commands) => {
  const commandFiles = fs.readdirSync(cmdPath);
  const jsFiles = commandFiles.filter(file => file.endsWith('.js'));
  const folders = commandFiles.filter(file => !file.endsWith('.js'));

  for (const folder of folders) {
    await parseCommandFiles(path.join(cmdPath, folder), commands);
  }

  for (const file of jsFiles) {
    const absoluteFilePath = path.resolve(path.join(cmdPath, file));
    const fileUrl = pathToFileURL(absoluteFilePath).href;
    const commandModule = await import(fileUrl);
    const command = commandModule.default || commandModule;

    commands.set(command.data.name, command);
  }
};

export default async (cmdPath, commands) => {
  if (typeof commands === 'object' && typeof commands.set === 'function') {
    await parseCommandFiles(cmdPath, commands);
  } else {
    logger.error('Invalid collection provided');
  }
};