const pino = require('pino');
const pretty = require('pino-pretty');
const logger = pino(pretty({
	ignore: 'pid,hostname',
	translateTime: 'SYS:yyyy-mm-dd HH:MM:ss Z',
}));
module.exports = logger;