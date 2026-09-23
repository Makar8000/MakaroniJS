import fs from 'fs';
import common from './common.js';

const writeKeyvData = async ({ inputFile, outputFile, namespace, key }) => {
  const data = await common.getKeyvData({ inputFile, namespace, key });
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
};

writeKeyvData({
  inputFile: './data/hsr.json',
  outputFile: './data/exported/hsr.json',
  namespace: 'hsr',
  key: 'inclinationCheckUsers',
});