const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const srcDir = path.resolve(__dirname, '..');
const stagingDir = 'C:\\Users\\alkhi\\AppData\\Local\\Temp\\sparx-patch-staging';
const destAsar = 'C:\\Users\\alkhi\\AppData\\Local\\Programs\\Sparx\\resources\\app.asar';
const updatesAsar = path.resolve(__dirname, '..', '..', 'downloads', 'updates', 'app.asar');
const updateJsonPath = path.resolve(__dirname, '..', '..', 'downloads', 'updates', 'update.json');
const tempAsar = 'C:\\Users\\alkhi\\AppData\\Local\\Temp\\Sparx-fresh.asar';

console.log('[1/6] Syncing files from workspace to staging dir...');
const filesToSync = [
  'style.css',
  'install_tactical.html',
  'main.js',
  'renderer.js',
  'index.html',
  'updateService.js',
  'lspdfrService.js',
  'preload.js',
  'package.json'
];

for (const file of filesToSync) {
  const src = path.join(srcDir, file);
  const dst = path.join(stagingDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`  -> Synced ${file}`);
  }
}

// Ensure assets are synced
const assetsSrcDir = path.join(srcDir, 'assets');
const assetsDstDir = path.join(stagingDir, 'assets');
if (fs.existsSync(assetsSrcDir)) {
  fs.cpSync(assetsSrcDir, assetsDstDir, { recursive: true });
  console.log('  -> Synced assets directory (including TACTICAL REALISEM V2.ini)');
}

// Clean monaco dev and esm folders in staging to reduce asar from 130MB to 58MB (under GitHub 100MB limit)
console.log('[2/6] Trimming redundant Monaco development/esm bloat for GitHub push...');
const monacoDir = path.join(stagingDir, 'node_modules', 'monaco-editor');
if (fs.existsSync(monacoDir)) {
  const devDir = path.join(monacoDir, 'dev');
  const esmDir = path.join(monacoDir, 'esm');
  if (fs.existsSync(devDir)) {
    fs.rmSync(devDir, { recursive: true, force: true });
    console.log('  -> Removed monaco dev folder (saved ~44MB)');
  }
  if (fs.existsSync(esmDir)) {
    fs.rmSync(esmDir, { recursive: true, force: true });
    console.log('  -> Removed monaco esm folder (saved ~28MB)');
  }
}

console.log('[3/6] Packing asar bundle using npx asar...');
execSync(`npx asar pack "${stagingDir}" "${tempAsar}" --unpack "**/node_modules/node-pty/**/*"`, { stdio: 'inherit' });

console.log('[4/6] Stopping any running Sparx instances...');
try {
  execSync('powershell -NoProfile -Command "Stop-Process -Name \'Sparx\' -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
} catch (e) {}

console.log('[5/6] Deploying fresh asar to installed app location and updates cache...');
if (fs.existsSync(destAsar)) {
  fs.copyFileSync(tempAsar, destAsar);
  console.log(`  -> Installed: ${destAsar} (${(fs.statSync(destAsar).size / 1024 / 1024).toFixed(1)} MB)`);
}

// Ensure updates directory exists
const updatesDir = path.dirname(updatesAsar);
if (!fs.existsSync(updatesDir)) {
  fs.mkdirSync(updatesDir, { recursive: true });
}

fs.copyFileSync(tempAsar, updatesAsar);
console.log(`  -> Updates Cache: ${updatesAsar} (${(fs.statSync(updatesAsar).size / 1024 / 1024).toFixed(1)} MB)`);

console.log('[6/6] Updating update.json metadata to v1.0.5...');
const hash = crypto.createHash('sha256').update(fs.readFileSync(tempAsar)).digest('hex');
const size = fs.statSync(tempAsar).size;
const sizeMb = `${(size / 1024 / 1024).toFixed(1)} MB`;

const manifest = {
  version: '1.0.5',
  previousVersion: '1.0.4',
  releaseDate: new Date().toISOString(),
  releaseNotes: [
    '• Gemini fallback API key with strict gemini-2.0-flash free tier support',
    '• Intelligent multi-key rate-limit rotation across all Groq & Gemini fallbacks',
    '• Fixed ReShade library discovery bug for remote users (resolved "The ReShade library was not found")',
    '• Dynamic update button auto-hiding when up to date',
    '• Bottom application version & status indicator',
    '• Standalone preset generation with drop-in instructions',
    '• Global OTA auto-updates with hot-swapping'
  ].join('\n'),
  asarFileName: 'app.asar',
  downloadUrl: 'https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar',
  fallbackUrl: 'https://www.tacticalweb.online/downloads/updates/app.asar',
  sizeBytes: size,
  sizeMb,
  sha256: hash
};

fs.writeFileSync(updateJsonPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`  -> Updated update.json (version: ${manifest.version}, hash: ${hash.slice(0, 8)}..., size: ${sizeMb})`);

// Update package.json version to 1.0.5
const desktopPkgPath = path.join(srcDir, 'package.json');
if (fs.existsSync(desktopPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));
  pkg.version = '1.0.5';
  fs.writeFileSync(desktopPkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  console.log('  -> Updated tactical-desktop/package.json to v1.0.5');
}

const rootPkgPath = path.resolve(__dirname, '..', '..', 'package.json');
if (fs.existsSync(rootPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  pkg.version = '1.0.5';
  fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  console.log('  -> Updated root package.json to v1.0.5');
}

console.log('\n[SUCCESS] Sync, pack, and installation completed cleanly!');
