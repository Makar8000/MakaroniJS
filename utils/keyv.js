const fs = require('fs');
const path = require('path');
const common = require(path.join(__dirname, 'common.js'));

const writeKeyvData = async ({ inputFile, outputFile, namespace, key }) => {
  const data = await common.getKeyvData({ inputFile, namespace, key });
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
};

// Below is just an example
writeKeyvData({
  inputFile: path.join(__dirname, '../data/hsr.json'),
  outputFile: path.join(__dirname, '../data/exported/hsr.json'),
  namespace: 'hsr',
  key: 'inclinationCheckUsers',
});