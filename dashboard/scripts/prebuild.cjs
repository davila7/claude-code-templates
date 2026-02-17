const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');
console.log('cwd:', process.cwd());
console.log('publicDir:', publicDir);
console.log('publicDir exists before mkdir:', fs.existsSync(publicDir));

try {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('publicDir exists after mkdir:', fs.existsSync(publicDir));
} catch (e) {
  console.error('mkdirSync failed:', e.message);
}

// List what's in cwd
try {
  console.log('cwd contents:', fs.readdirSync(process.cwd()));
} catch (e) {
  console.error('readdir cwd failed:', e.message);
}

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
