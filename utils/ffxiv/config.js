const tokenTypes = Object.freeze({
  WEAPON: 'Ester',
  LEFT: 'Twine(s)',
  RIGHT: 'Shine(s)',
});

const augmentTokens = Object.freeze({
  weapon: tokenTypes.WEAPON,
  head: tokenTypes.LEFT,
  body: tokenTypes.LEFT,
  hands: tokenTypes.LEFT,
  legs: tokenTypes.LEFT,
  feet: tokenTypes.LEFT,
  ears: tokenTypes.RIGHT,
  neck: tokenTypes.RIGHT,
  wrists: tokenTypes.RIGHT,
  // Rings need to be the last 2 in this list
  fingerL: tokenTypes.RIGHT,
  fingerR: tokenTypes.RIGHT,
});

const tomeCategories = Object.freeze({
  SMALL: 375,
  MEDIUM: 495,
  LARGE: 825,
  WEAPON: 500,
});

const tomeCost = Object.freeze({
  weapon: tomeCategories.WEAPON,
  head: tomeCategories.MEDIUM,
  body: tomeCategories.LARGE,
  hands: tomeCategories.MEDIUM,
  legs: tomeCategories.LARGE,
  feet: tomeCategories.MEDIUM,
  ears: tomeCategories.SMALL,
  neck: tomeCategories.SMALL,
  wrists: tomeCategories.SMALL,
  fingerL: tomeCategories.SMALL,
  fingerR: tomeCategories.SMALL,
});

const defaultEtroSet = Object.freeze({
  etroId: null,
  job: null,
  leftTokens: 0,
  rightTokens: 0,
  weaponToken: false,
  tomes: 0,
  raidPieces: [],
});

const etroParams = Object.freeze({
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
});

const embedOptions = Object.freeze({
  color: 0xB460A6,
  name: 'Etro Data',
  title: 'Non-Tome Pieces',
  iconUrl: 'https://etro.gg/favicon.png',
  thumbnailUrl: 'https://raw.githubusercontent.com/anoyetta/ACT.Hojoring/master/source/ACT.SpecialSpellTimer/ACT.SpecialSpellTimer.Core/resources/icon/Job/',
  damageName: 'Damage per 100 Potency',
  foodName: 'Food',
  noteName: 'Notes',
});

module.exports = {
  // Etro
  etroApiUrl: 'http://etro.gg/api/gearsets/',
  etroFoodApiUrl: 'https://etro.gg/api/food/',
  defaultEtroSet,
  tokenTypes,
  etroParams,
  augmentTokens,
  tomeCost,

  // XIVAPI
  apiUrl: 'http://xivapi.com',

  // Embed Config
  embedOptions,
  etroUrl: 'https://etro.gg/gearset/',
};