const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });

const componentsFile = path.join(publicDir, 'components.json');
if (!fs.existsSync(componentsFile)) {
  const empty = JSON.stringify({
    agents: [], commands: [], settings: [],
    hooks: [], mcps: [], templates: [], skills: []
  });
  fs.writeFileSync(componentsFile, empty);
  console.log('Created placeholder components.json');
}

const trendingFile = path.join(publicDir, 'trending-data.json');
if (!fs.existsSync(trendingFile)) {
  fs.writeFileSync(trendingFile, '[]');
  console.log('Created placeholder trending-data.json');
}
