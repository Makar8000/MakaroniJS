import pino from 'pino';
import pretty from 'pino-pretty';

const logger = pino(pretty({
  ignore: 'pid,hostname',
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss Z',
}));

export default logger;