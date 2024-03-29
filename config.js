const bots = {
  MAKARONI: '177245115679637504',
  MEDLIONI: '216338485257175042',
};

const guilds = {
  CANADALAND: '91676956352868352',
};

const channels = {
  SECRET_SANTA: '1168246929503813652',
};

const users = {
  MARK: '85924030661533696',
  CHRIS: '134209083749171200',
};

users.admins = [
  users.MARK,
  bots.MAKARONI,
  bots.MEDLIONI,
];

module.exports = {
  guilds,
  channels,
  bots,
  users: {
    ...users,
    monitorAllowed: [
      ...users.admins,
      users.CHRIS,
    ],
  },
};