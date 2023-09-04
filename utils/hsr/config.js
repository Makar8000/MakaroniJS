const repoConfig = {
  OWNER: 'Dimbreath',
  REPO: 'StarRailData',
  BRANCH: 'master',
  FILES: {
    InclinationType: 'ExcelOutput/InclinationType.json',
    InclinationText: 'ExcelOutput/InclinationText.json',
    TalkSentenceConfig: 'ExcelOutput/TalkSentenceConfig.json',
    TextMapEN: 'TextMap/TextMapEN.json',
  },
  SCHEDULE: '*/3 * * * *',
  KEYS: {
    userList: 'inclinationCheckUsers',
    jobName: 'inclinationTypes',
  },
  CHARACTER_LIMIT: 1500,
};

module.exports = {
  repoConfig,
  messages: {
    subscribeSuccess: 'You have successfully subscribed to notifications.',
    subscribeError: 'There was an error when trying to subscribe. Maybe you are already subscribed?',
    unsubscribeSuccess: 'You have successfully unsubscribed.',
    unsubscribeError: 'There was an error when trying to unsubscribe. Maybe you are not currently subscribed?',
  },
};