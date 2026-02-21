const fs = require('fs');
const path = require('path');

// Recreate public/ to work around Vercel's read-only mount,
// then write placeholder data files and copy static assets.

const publicDir = path.join(process.cwd(), 'public');
const staticDir = path.join(process.cwd(), 'static');

try {
  // Remove and recreate public/ (Vercel mounts it read-only for new files)
  try { fs.rmSync(publicDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(publicDir, { recursive: true });

  // Placeholder data files
  const empty = JSON.stringify({
    agents: [], commands: [], settings: [],
    hooks: [], mcps: [], templates: [], skills: []
  });
  fs.writeFileSync(path.join(publicDir, 'components.json'), empty, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'trending-data.json'), '[]', 'utf8');

  // Copy static assets (logo, favicon) from static/ into public/
  if (fs.existsSync(staticDir)) {
    for (const file of fs.readdirSync(staticDir)) {
      fs.copyFileSync(path.join(staticDir, file), path.join(publicDir, file));
    }
  }

  console.log('prebuild: public/ ready with data placeholders and static assets');
} catch (err) {
  console.warn('prebuild: error:', err.message);
}
