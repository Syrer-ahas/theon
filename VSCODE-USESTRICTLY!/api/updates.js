const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Load manifest from disk if available, otherwise return embedded manifest
  const manifestPath = path.join(process.cwd(), 'downloads', 'updates', 'update.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return res.status(200).json(data);
    } catch (e) {}
  }

  return res.status(200).json({
    version: "1.0.7",
    previousVersion: "1.0.6",
    releaseDate: new Date().toISOString(),
    releaseNotes: "• Redesigned clean studio IDE UI (Claude / Codex / Qoder inspired, zero neon/glows)\n• Live Context Window meter, token breakdown popover, and history compaction\n• @ file mention autocomplete, multi-file context chips, and editor selection context\n• Agent / Ask / Plan mode selector, model switcher, and persistent conversation history\n• Editor breadcrumbs, bottom IDE status bar, resizable split panes, and Terminal/Problems/Output tabs",
    asarFileName: "app.asar",
    downloadUrl: "https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar",
    fallbackUrl: "https://www.tacticalweb.online/downloads/updates/app.asar",
    sizeBytes: 61035000,
    sizeMb: "58.2 MB",
    sha256: null
  });
};
