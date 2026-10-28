// ============================================================================
// Sparx In-App Auto-Update & Global Publishing Subsystem
// Enables direct in-app updating over the air (OTA) for all users globally
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { app } = require('electron');

const GLOBAL_UPDATE_MANIFEST_URLS = [
  'https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/update.json',
  'https://www.tacticalweb.online/downloads/updates/update.json',
  'https://tacticalweb.online/downloads/updates/update.json'
];

function getAppVersion() {
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) return pkg.version;
    }
  } catch (e) {}
  return (app && typeof app.getVersion === 'function') ? app.getVersion() : '1.0.3';
}

function getUpdatesDir() {
  const os = require('os');
  const userDownloads = (app && typeof app.getPath === 'function') ? app.getPath('downloads') : path.join(os.homedir(), 'Downloads');
  const userData = (app && typeof app.getPath === 'function') ? app.getPath('userData') : path.join(os.homedir(), 'AppData', 'Roaming', 'Sparx');

  const candidateDirs = [
    'C:/Users/alkhi/Downloads/VSCODE-USESTRICTLY!/downloads/updates',
    path.join(userDownloads, 'updates'),
    path.join(userData, 'updates'),
    path.resolve(__dirname, '..', 'downloads', 'updates'),
    path.join(process.resourcesPath || '', '..', 'downloads', 'updates')
  ];

  for (const dir of candidateDirs) {
    if (dir && fs.existsSync(path.join(dir, 'update.json'))) {
      return dir;
    }
  }

  // Fallback to primary workspace or user data updates folder
  const primary = 'C:/Users/alkhi/Downloads/VSCODE-USESTRICTLY!/downloads/updates';
  if (fs.existsSync(path.dirname(primary))) {
    fs.mkdirSync(primary, { recursive: true });
    return primary;
  }
  const fallback = path.join(userData, 'updates');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function getUpdateManifestPath() {
  return path.join(getUpdatesDir(), 'update.json');
}

function calculateFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Compare two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  const p1 = String(v1 || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2 || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Fetch JSON from a remote URL with redirect support
 */
function fetchRemoteJson(url, maxRedirects = 3) {
  return new Promise((resolve) => {
    if (!url || maxRedirects < 0) return resolve(null);
    try {
      const client = url.startsWith('http:') ? http : https;
      const req = client.get(url, { headers: { 'User-Agent': 'Sparx-Desktop-Updater/1.0' }, timeout: 7000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return resolve(fetchRemoteJson(nextUrl, maxRedirects - 1));
        }
        if (res.statusCode !== 200) return resolve(null);
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Download a remote binary file over HTTPS with redirect following and progress reporting
 */
function downloadRemoteFile(url, targetPath, onProgress, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects while downloading update.'));
    try {
      const client = url.startsWith('http:') ? http : https;
      const req = client.get(url, { headers: { 'User-Agent': 'Sparx-Desktop-Updater/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return resolve(downloadRemoteFile(nextUrl, targetPath, onProgress, maxRedirects - 1));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Server returned HTTP ${res.statusCode} while downloading update.`));
        }
        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
        let copied = 0;
        const fileStream = fs.createWriteStream(targetPath);

        res.on('data', (chunk) => {
          copied += chunk.length;
          if (typeof onProgress === 'function') {
            const percent = totalSize > 0 ? Math.min(100, Math.round((copied / totalSize) * 100)) : 50;
            onProgress({
              percent,
              copiedBytes: copied,
              totalBytes: totalSize || copied,
              speed: 'Global CDN'
            });
          }
        });

        res.on('error', (err) => {
          try { fs.unlinkSync(targetPath); } catch (e) {}
          reject(err);
        });

        fileStream.on('error', (err) => {
          try { fs.unlinkSync(targetPath); } catch (e) {}
          reject(err);
        });

        fileStream.on('finish', () => {
          resolve({ targetPath, totalBytes: copied });
        });

        res.pipe(fileStream);
      });

      req.on('error', reject);
      req.setTimeout(120000, () => {
        req.destroy(new Error('Connection timed out downloading update.'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Check if an update is available (Global Remote First, Local Fallback)
 */
async function checkForUpdates() {
  const currentVersion = getAppVersion();

  // 1. Check global remote distribution URLs first so users anywhere in the world get the latest release
  for (const remoteUrl of GLOBAL_UPDATE_MANIFEST_URLS) {
    try {
      const manifest = await fetchRemoteJson(remoteUrl);
      if (manifest && manifest.version) {
        const latestVersion = manifest.version;
        const isNewer = compareVersions(latestVersion, currentVersion) > 0;
        if (isNewer) {
          return {
            updateAvailable: true,
            currentVersion,
            latestVersion,
            releaseNotes: manifest.releaseNotes || '• Fixed ReShade preset generator bug (resolved sharpen is not defined)\n• Photorealistic & Dark Vibrant Neo-Noir shader engine upgrades\n• Instant 1-click global in-app updates with hot reload\n• Performance optimizations and bug fixes.',
            releaseDate: manifest.releaseDate || new Date().toISOString(),
            downloadUrl: manifest.downloadUrl || 'https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar',
            asarFileName: manifest.asarFileName || 'app.asar',
            sizeBytes: manifest.sizeBytes || 60971488,
            sizeMb: manifest.sizeMb || '58.1 MB',
            sha256: manifest.sha256 || null
          };
        } else {
          return {
            updateAvailable: false,
            currentVersion,
            latestVersion,
            message: `Sparx is up to date (v${currentVersion}).`
          };
        }
      }
    } catch (e) {}
  }

  // 2. Fall back to local manifest path (for offline or local development testing)
  const manifestPath = getUpdateManifestPath();
  if (fs.existsSync(manifestPath)) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      const latestVersion = manifest.version || '1.0.0';
      const isNewer = compareVersions(latestVersion, currentVersion) > 0;
      const asarFile = path.join(getUpdatesDir(), manifest.asarFileName || 'app.asar');
      const exists = fs.existsSync(asarFile);

      if (isNewer && exists) {
        const st = fs.statSync(asarFile);
        return {
          updateAvailable: true,
          currentVersion,
          latestVersion,
          releaseNotes: manifest.releaseNotes || 'Performance improvements and new autonomous modding features.',
          releaseDate: manifest.releaseDate || new Date().toISOString(),
          asarPath: asarFile,
          sizeBytes: st.size,
          sizeMb: `${(st.size / 1024 / 1024).toFixed(1)} MB`,
          sha256: manifest.sha256 || null
        };
      }
    } catch (e) {}
  }

  return {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    message: `Sparx is up to date (v${currentVersion}).`
  };
}

/**
 * Downloads / stages the update file (from Global HTTPS or local source)
 */
async function downloadUpdate(onProgress) {
  const check = await checkForUpdates();
  if (!check.updateAvailable || (!check.asarPath && !check.downloadUrl)) {
    throw new Error('No update is available to download.');
  }

  const os = require('os');
  const userData = (app && typeof app.getPath === 'function') ? app.getPath('userData') : path.join(os.homedir(), 'AppData', 'Roaming', 'Sparx');
  const updatesDir = path.join(userData, 'updates');
  if (!fs.existsSync(updatesDir)) {
    fs.mkdirSync(updatesDir, { recursive: true });
  }
  const stagedTarget = path.join(updatesDir, 'app.asar.staged');

  if (check.downloadUrl && check.downloadUrl.startsWith('http')) {
    // Stream over HTTPS directly from Global CDN / GitHub
    console.log(`[UpdateService] Streaming global OTA update from ${check.downloadUrl}...`);
    await downloadRemoteFile(check.downloadUrl, stagedTarget, onProgress);
  } else if (check.asarPath && fs.existsSync(check.asarPath)) {
    // Local copy
    const sourcePath = check.asarPath;
    const totalSize = check.sizeBytes || fs.statSync(sourcePath).size;
    let copied = 0;
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(stagedTarget);
      readStream.on('data', (chunk) => {
        copied += chunk.length;
        if (typeof onProgress === 'function') {
          const percent = Math.min(100, Math.round((copied / totalSize) * 100));
          onProgress({
            percent,
            copiedBytes: copied,
            totalBytes: totalSize,
            speed: 'Fast Local Cache'
          });
        }
      });
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      readStream.pipe(writeStream);
    });
  } else {
    throw new Error('Update payload location is invalid or unreachable.');
  }

  // SHA256 Verification if present
  if (check.sha256 && fs.existsSync(stagedTarget)) {
    const downloadedHash = calculateFileSha256(stagedTarget);
    if (downloadedHash && downloadedHash.toLowerCase() !== check.sha256.toLowerCase()) {
      try { fs.unlinkSync(stagedTarget); } catch (e) {}
      throw new Error('Downloaded update checksum verification failed. Please try again.');
    }
  }

  return {
    success: true,
    stagedPath: stagedTarget,
    latestVersion: check.latestVersion,
    sizeMb: check.sizeMb
  };
}

/**
 * Apply the staged update into the running app's resources/app.asar and relaunch
 */
async function applyUpdateAndRelaunch() {
  const os = require('os');
  const userData = (app && typeof app.getPath === 'function') ? app.getPath('userData') : path.join(os.homedir(), 'AppData', 'Roaming', 'Sparx');
  const candidateStaged = [
    path.join(userData, 'updates', 'app.asar.staged'),
    path.join(getUpdatesDir(), 'app.asar.staged')
  ];

  let stagedPath = null;
  for (const c of candidateStaged) {
    if (fs.existsSync(c)) { stagedPath = c; break; }
  }

  if (!stagedPath) {
    throw new Error('No downloaded update found. Please download the update first.');
  }

  // Resolve active app.asar locations
  const targetLocations = [
    'C:/Users/alkhi/AppData/Local/Programs/Sparx/resources/app.asar',
    'C:/Users/alkhi/AppData/Local/Programs/Tactical Studio/resources/app.asar'
  ];

  if (process.resourcesPath) {
    const livePath = path.join(process.resourcesPath, 'app.asar');
    if (!targetLocations.includes(livePath)) {
      targetLocations.unshift(livePath);
    }
  }

  let replacedCount = 0;
  for (const loc of targetLocations) {
    if (fs.existsSync(path.dirname(loc))) {
      try {
        fs.copyFileSync(stagedPath, loc);
        replacedCount++;
        console.log(`[UpdateService] Successfully updated ${loc}`);
      } catch (err) {
        console.warn(`[UpdateService] Notice updating ${loc}:`, err.message);
      }
    }
  }

  if (replacedCount === 0) {
    throw new Error('Target installation path could not be located to apply update.');
  }

  // Clean staged file
  try { fs.unlinkSync(stagedPath); } catch (e) {}

  // Relaunch the application if Electron is available
  if (app && typeof app.relaunch === 'function') {
    console.log('[UpdateService] Relaunching Sparx with updated build...');
    app.relaunch();
    app.exit(0);
  }

  return { success: true, replacedCount };
}

/**
 * Publish a new update bundle (creates update.json and packages latest app.asar)
 */
async function publishUpdate({ version: requestedVersion, releaseNotes, asarSourcePath } = {}) {
  const currentVer = getAppVersion();
  let nextVer = requestedVersion || '1.0.3';

  const updatesDir = getUpdatesDir();
  const targetAsar = path.join(updatesDir, 'app.asar');

  // Determine source asar to publish
  let src = asarSourcePath;
  if (!src || !fs.existsSync(src)) {
    const candidates = [
      'C:/Users/alkhi/AppData/Local/Programs/Sparx/resources/app.asar',
      'C:/Users/alkhi/AppData/Local/Temp/Sparx-test.asar',
      'C:/Users/alkhi/AppData/Local/Temp/Sparx-fresh.asar',
      path.join(process.resourcesPath || '', 'app.asar')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) { src = c; break; }
    }
  }

  if (!src || !fs.existsSync(src)) {
    throw new Error('Source app.asar could not be located to publish update.');
  }

  console.log(`[UpdateService] Publishing ${src} as v${nextVer}...`);
  fs.copyFileSync(src, targetAsar);

  const st = fs.statSync(targetAsar);
  const sha256 = calculateFileSha256(targetAsar);

  const manifest = {
    version: nextVer,
    previousVersion: currentVer,
    releaseDate: new Date().toISOString(),
    releaseNotes: releaseNotes || [
      '• Fixed ReShade preset generator bug (resolved "sharpen is not defined")',
      '• Enhanced ReShade photorealistic & Dark Vibrant Noir engine',
      '• Enforced zero dither dots across PD80 and QuantV shaders',
      '• Instant global over-the-air auto-updates with hot-swapping',
      '• Performance improvements and bug fixes'
    ].join('\n'),
    asarFileName: 'app.asar',
    downloadUrl: 'https://raw.githubusercontent.com/Syrer-ahas/theon/main/downloads/updates/app.asar',
    fallbackUrl: 'https://www.tacticalweb.online/downloads/updates/app.asar',
    sizeBytes: st.size,
    sizeMb: `${(st.size / 1024 / 1024).toFixed(1)} MB`,
    sha256
  };

  const manifestPath = getUpdateManifestPath();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Also update package.json version
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = nextVer;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    }
  } catch (e) {}

  console.log(`[UpdateService] Update v${nextVer} successfully published to ${manifestPath}!`);

  return {
    success: true,
    version: nextVer,
    manifestPath,
    asarPath: targetAsar,
    downloadUrl: manifest.downloadUrl,
    sizeMb: manifest.sizeMb,
    sha256
  };
}

module.exports = {
  getAppVersion,
  checkForUpdates,
  downloadUpdate,
  applyUpdateAndRelaunch,
  publishUpdate,
  getUpdatesDir
};
