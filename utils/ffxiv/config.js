const tokenTypes = Object.freeze({
  WEAPON: 'Ester',
  LEFT: 'Twine(s)',
  RIGHT: 'Dusting(s)',
});

const defaultEtroSet = {
  etroId: null,
  job: null,
  leftTokens: 0,
  rightTokens: 0,
  weaponToken: false,
  raidPieces: [],
};

module.exports = {
  // Etro
  etroApiUrl: 'http://etro.gg/api/gearsets/',
  etroUrl: 'https://etro.gg/gearset/',
  defaultEtroSet,
  tokenTypes,
  augmentTokens: {
    weapon: tokenTypes.WEAPON,
    head: tokenTypes.LEFT,
    body: tokenTypes.LEFT,
    hands: tokenTypes.LEFT,
    legs: tokenTypes.LEFT,
    feet: tokenTypes.LEFT,
    ears: tokenTypes.RIGHT,
    neck: tokenTypes.RIGHT,
    wrists: tokenTypes.RIGHT,
    fingerL: tokenTypes.RIGHT,
    fingerR: tokenTypes.RIGHT,
  },

  // XIVAPI
  apiUrl: 'http://xivapi.com',

  // Embed Config
  thumbnailUrl: 'https://i.imgur.com/huoF8gA.png',
  iconUrl: 'https://raw.githubusercontent.com/anoyetta/ACT.Hojoring/master/source/ACT.SpecialSpellTimer/ACT.SpecialSpellTimer.Core/resources/icon/Job/',
  embedName: 'Etro Data',
  embedTitle: 'Raid Pieces',
  embedColor: 0xB460A6,
};