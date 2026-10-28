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
    version: "1.0.4",
    previousVersion: "1.0.3",
    releaseDate: "2026-10-28T19:30:21.177Z",
    releaseNotes: "• Fixed ReShade library discovery bug for remote users (resolved \"The ReShade library was not found\")\n• Standalone preset generation with auto-detection for Steam, Epic Games, and Rockstar GTA V\n• Direct standalone .ini and .zip generation with drop-in instructions\n• Global OTA auto-updates with hot-swapping\n• Performance improvements and bug fixes",
    asarFileName: "app.asar",
    downloadUrl: "https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar",
    fallbackUrl: "https://www.tacticalweb.online/downloads/updates/app.asar",
    sizeBytes: 61030094,
    sizeMb: "58.2 MB",
    sha256: "11ba8aa96b8038a63e2055990559f091737f3eb46d1178693017506cfcd1c963"
  });
};
