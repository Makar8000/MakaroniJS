const { EmbedBuilder } = require('discord.js');

const createSuccess = (reminder, user) => {
  const fields = [{ name: 'ID', value: `${reminder.id}`, inline: true }];
  if (reminder.mention) {
    fields.push({ name: 'Mention', value: `${reminder.mention}`, inline: true });
  }
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setAuthor({
      name: user.displayName,
      iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
    })
    .setTitle('Reminder scheduled successfully!')
    .setDescription(`<t:${reminder.unixTs}:F>\n(<t:${reminder.unixTs}:R>)`)
    .addFields(fields)
    .setFooter({ text: `To cancel, use: /reminde cancel ${reminder.id}` });
  return embed;
};

const listSuccess = (reminders, user) => {
  const fields = [];
  for (const rem of reminders) {
    fields.push({ name: 'ID', value: `${rem.id}`, inline: true });
    fields.push({ name: 'Time', value: `<t:${rem.unixTs}:F>`, inline: true });
    if (rem.mention) {
      fields.push({ name: 'Mention', value: `${rem.mention}`, inline: true });
    }
    fields.push({ name: 'Message', value: `${rem.message}`, inline: false });
  }
  const embed = new EmbedBuilder()
    .setColor(0x7289DA)
    .setAuthor({
      name: user.displayName,
      iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
    })
    // .setTitle('Reminder List')
    .setDescription('See below for a list of Reminders.')
    .addFields(fields)
    .setFooter({ text: 'To cancel a reminder, use: /reminde cancel <id>' });
  return embed;
};

module.exports = {
  invalidTime: (time) => `The time specified is either invalid or occured in the past:\n<t:${time}:F> (<t:${time}:R>)\n\nThe expected timeformat is Unix timestamp in seconds. You can use <https://hammertime.cyou/> to generate a timestamp.`,
  errorSchedule: (time) => `An error has occured when trying to schedule your reminder:\n<t:${time}:F> (<t:${time}:R>)\n\nPlease make sure your timestamp is correct. The expected timeformat is Unix timestamp in seconds. You can use <https://hammertime.cyou/> to generate a timestamp.`,
  createSuccess,
  cancelFail: (id) => `The reminder with ID \`${id}\` is invalid. Try running \`/remind list\` to get a list of your reminders and their IDs.`,
  cancelSuccess: (id) => `The reminder with ID \`${id}\` was successfully canceled.`,
  listFail: () => 'You currently do not have any reminders scheduled.',
  listSuccess,
};