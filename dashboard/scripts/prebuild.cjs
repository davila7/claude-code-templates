const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

// List public/ contents to debug
try {
  console.log('public/ contents:', fs.readdirSync(publicDir));
  console.log('public/ stat:', fs.lstatSync(publicDir).isSymbolicLink() ? 'symlink' : 'directory');
} catch (e) {
  console.error('readdir public failed:', e.message);
}

const componentsFile = path.join(publicDir, 'components.json');
if (!fs.existsSync(componentsFile)) {
  const empty = JSON.stringify({
    agents: [], commands: [], settings: [],
    hooks: [], mcps: [], templates: [], skills: []
  });
  // Use Buffer.from to bypass Node v24 writeFileUtf8 binding
  fs.writeFileSync(componentsFile, Buffer.from(empty));
  console.log('Created placeholder components.json');
}

const trendingFile = path.join(publicDir, 'trending-data.json');
if (!fs.existsSync(trendingFile)) {
  fs.writeFileSync(trendingFile, Buffer.from('[]'));
  console.log('Created placeholder trending-data.json');
}
