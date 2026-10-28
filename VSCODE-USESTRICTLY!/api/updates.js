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
    version: "1.0.5",
    previousVersion: "1.0.4",
    releaseDate: new Date().toISOString(),
    releaseNotes: "• Gemini fallback API key with strict gemini-2.0-flash free tier support\n• Intelligent multi-key rate-limit rotation across all Groq & Gemini fallbacks\n• Fixed ReShade library discovery bug for remote users (resolved \"The ReShade library was not found\")\n• Dynamic update button auto-hiding when up to date\n• Bottom application version & status indicator\n• Standalone preset generation with drop-in instructions\n• Global OTA auto-updates with hot-swapping",
    asarFileName: "app.asar",
    downloadUrl: "https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar",
    fallbackUrl: "https://www.tacticalweb.online/downloads/updates/app.asar",
    sizeBytes: 61035000,
    sizeMb: "58.2 MB",
    sha256: null
  });
};
