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
    version: "1.0.3",
    previousVersion: "1.0.0",
    releaseDate: "2026-10-28T18:47:20.868Z",
    releaseNotes: "• Fixed ReShade preset generator bug (resolved \"sharpen is not defined\")\n• Enhanced ReShade photorealistic & Dark Vibrant Noir shader engine\n• Enforced zero dither dots across PD80 and QuantV shaders\n• Instant global over-the-air auto-updates with hot-swapping\n• Performance improvements and bug fixes",
    asarFileName: "app.asar",
    downloadUrl: "https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar",
    fallbackUrl: "https://www.tacticalweb.online/downloads/updates/app.asar",
    sizeBytes: 60978001,
    sizeMb: "58.2 MB",
    sha256: "f7a7b8db77def52b129d92acabba03a3b9c13f011f5bc3bc21e33770dc98d961"
  });
};
