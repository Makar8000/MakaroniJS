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

const etroParams = {
  dmg: 'Damage (Expected)',
  gcd: 'GCD',
  statOrder: [
    // Weapon
    12, 13,
    // Primary
    1, 2, 4, 5,
    // Vitality
    3,
    // Critical Hit
    27,
    // Direct Hit
    22,
    // Determination
    44,
    // SPS & SKS
    45, 46,
    // Piety & Tenacity
    19, 6,
  ],
};

const embedOptions = {
  color: 0xB460A6,
  name: 'Etro Data',
  title: 'Non-Augmented Pieces',
  thumbnailUrl: 'https://i.imgur.com/huoF8gA.png',
  iconUrl: 'https://raw.githubusercontent.com/anoyetta/ACT.Hojoring/master/source/ACT.SpecialSpellTimer/ACT.SpecialSpellTimer.Core/resources/icon/Job/',
  damageName: 'Damage per 100 Potency',
  foodName: 'Food',
};

module.exports = {
  // Etro
  etroApiUrl: 'http://etro.gg/api/gearsets/',
  etroFoodApiUrl: 'https://etro.gg/api/food/',
  defaultEtroSet,
  tokenTypes,
  etroParams,
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
  embedOptions,
  etroUrl: 'https://etro.gg/gearset/',
};