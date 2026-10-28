// ============================================================================
// Tactical IDE — Real Web Browsing & Page Inspection Service
// Real search engines, direct URL navigation, offscreen JS page inspection,
// untrusted content isolation, and grounded source citations.
// ============================================================================

const https = require('https');
const http = require('http');
const querystring = require('querystring');
const { URL } = require('url');

let electronBrowserWindow = null;
try {
  const electron = require('electron');
  electronBrowserWindow = electron.BrowserWindow || null;
} catch (e) {
  electronBrowserWindow = null;
}

/**
 * Validates that a URL is safe to fetch (prevents SSRF, private IP scanning, metadata endpoint access).
 */
function isSafeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP and HTTPS protocols are allowed.' };
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' || // AWS / Cloud metadata
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return { safe: false, reason: 'Navigation to private, loopback, or metadata addresses is blocked.' };
    }
    return { safe: true, url: parsed.toString() };
  } catch (err) {
    return { safe: false, reason: 'Invalid URL format.' };
  }
}

/**
 * Sanitizes untrusted text extracted from the web to prevent prompt injection or script execution.
 */
function sanitizeUntrustedWebText(text) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // remove non-printable ASCII
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Neutralize common prompt injection directives embedded in third-party web content
  const injectionPatterns = [
    /ignore\s+(?:all\s+)?previous\s+(?:instructions|prompts)/gi,
    /system\s*:\s*you\s+are\s+now/gi,
    /disregard\s+(?:any\s+)?prior\s+guidelines/gi
  ];
  for (const pat of injectionPatterns) {
    sanitized = sanitized.replace(pat, '[POTENTIAL_PROMPT_INJECTION_FILTERED]');
  }

  return sanitized;
}

/**
 * Performs a real web search using DuckDuckGo Lite & instant search engines.
 * Returns verified result links, titles, and snippets.
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<{ success: boolean, query: string, sources: Array<{ title: string, url: string, snippet: string }> }>}
 */
function searchWeb(query, maxResults = 5) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return Promise.resolve({ success: false, query: '', sources: [], error: 'Search query cannot be empty.' });
  }

  return new Promise((resolve) => {
    const postData = querystring.stringify({ q: cleanQuery });
    const req = https.request('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8500
    }, (res) => {
      let html = '';
      res.on('data', (c) => { html += c; });
      res.on('end', () => {
        const sources = [];
        try {
          const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
          const snippets = [...html.matchAll(/<td class=['"]result-snippet['"]>([\s\S]*?)<\/td>/gi)].map(s => s[1].replace(/<[^>]+>/g, '').trim());

          let sIdx = 0;
          for (const l of links) {
            let url = l[1];
            if (url.includes('uddg=')) {
              try {
                const u = new URL(url.startsWith('http') ? url : 'https:' + url);
                url = decodeURIComponent(u.searchParams.get('uddg'));
              } catch (e) {}
            }

            const title = l[2].replace(/<[^>]+>/g, '').trim();
            if (url.startsWith('http') && !url.includes('duckduckgo.com') && title && title.length > 2) {
              const snippet = snippets[sIdx] || '';
              sources.push({
                title: sanitizeUntrustedWebText(title).slice(0, 100),
                url,
                snippet: sanitizeUntrustedWebText(snippet).slice(0, 220)
              });
              sIdx++;
              if (sources.length >= maxResults) break;
            }
          }

          if (sources.length > 0) {
            return resolve({ success: true, query: cleanQuery, sources });
          }
        } catch (e) {}

        // Fallback: Wikipedia search API if DuckDuckGo Lite had zero matches
        searchWikipediaFallback(cleanQuery, maxResults).then(resolve);
      });
    });

    req.on('error', () => {
      searchWikipediaFallback(cleanQuery, maxResults).then(resolve);
    });

    req.on('timeout', () => {
      req.destroy();
      searchWikipediaFallback(cleanQuery, maxResults).then(resolve);
    });

    req.write(postData);
    req.end();
  });
}

function searchWikipediaFallback(query, maxResults = 4) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
    const req = https.get(url, { headers: { 'User-Agent': 'SparxIDE/1.0 (contact@tacticalstudio.dev)' }, timeout: 6000 }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const titles = parsed[1] || [];
          const snippets = parsed[2] || [];
          const urls = parsed[3] || [];
          const sources = [];
          for (let i = 0; i < titles.length; i++) {
            if (urls[i]) {
              sources.push({
                title: titles[i],
                url: urls[i],
                snippet: snippets[i] || ''
              });
            }
          }
          resolve({ success: sources.length > 0, query, sources });
        } catch (e) {
          resolve({ success: false, query, sources: [], error: 'Search providers unreachable.' });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, query, sources: [], error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, query, sources: [], error: 'Search timed out.' }); });
  });
}

/**
 * Inspects a real webpage and extracts its accessible text content and metadata.
 * Uses an offscreen hidden Electron BrowserWindow when available to execute JavaScript and render dynamic pages.
 * @param {string} rawUrl
 * @param {Object} options
 * @param {boolean} options.renderJs
 * @param {number} options.timeoutMs
 * @returns {Promise<{ success: boolean, url: string, title?: string, content?: string, links?: Array<{text: string, href: string}>, blocked?: boolean, error?: string }>}
 */
async function readWebPage(rawUrl, options = {}) {
  const { renderJs = true, timeoutMs = 11000 } = options;
  const safety = isSafeUrl(rawUrl);
  if (!safety.safe) {
    return {
      success: false,
      url: rawUrl,
      error: `Navigation blocked by security policy: ${safety.reason}`
    };
  }

  const targetUrl = safety.url;

  // Primary Path: Offscreen Electron Window for dynamic, JS-rendered execution
  if (renderJs && electronBrowserWindow) {
    let win = null;
    let isFinished = false;

    try {
      win = new electronBrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          javascript: true,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          images: false,
          webSecurity: true
        }
      });

      const navPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!isFinished) {
            isFinished = true;
            reject(new Error(`Navigation timed out after ${timeoutMs}ms.`));
          }
        }, timeoutMs);

        win.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
          if (!isFinished) {
            isFinished = true;
            clearTimeout(timer);
            // Treat abort as non-fatal if DOM ready
            reject(new Error(`Failed to load page: ${errorDescription} (${errorCode})`));
          }
        });

        win.webContents.once('did-finish-load', () => {
          if (!isFinished) {
            isFinished = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });

      await Promise.race([
        win.loadURL(targetUrl, {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }),
        navPromise
      ]);

      // Allow 250ms for client-side JS rendering hydration
      await new Promise(r => setTimeout(r, 250));

      const extracted = await win.webContents.executeJavaScript(`
        (() => {
          try {
            const clone = document.body ? document.body.cloneNode(true) : document.documentElement.cloneNode(true);
            const removeTags = ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe', 'nav', 'footer', 'aside', 'header'];
            removeTags.forEach(tag => {
              clone.querySelectorAll(tag).forEach(el => el.remove());
            });
            const title = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            const rawText = clone.innerText || clone.textContent || '';
            const text = rawText.replace(/\\s+/g, ' ').trim().slice(0, 8000);
            const links = Array.from(document.querySelectorAll('a[href]'))
              .map(a => ({ text: (a.textContent || '').trim(), href: a.href }))
              .filter(l => l.text && l.href && l.href.startsWith('http') && !l.href.includes('javascript:'))
              .slice(0, 15);
            return { title, metaDesc, text, links, htmlLength: document.documentElement.outerHTML.length };
          } catch (e) {
            return { title: document.title || '', text: (document.body ? document.body.innerText : '').slice(0, 5000), links: [] };
          }
        })()
      `);

      const cleanTitle = (extracted.title || targetUrl).trim();
      const cleanContent = sanitizeUntrustedWebText(extracted.text);

      // Check for anti-bot / Cloudflare / Access Denied blocks
      const lower = cleanContent.toLowerCase();
      if (
        lower.includes('access denied') ||
        lower.includes('attention required! | cloudflare') ||
        lower.includes('checking your browser before accessing') ||
        lower.includes('just a moment...') ||
        lower.includes('403 forbidden') ||
        (cleanContent.length < 120 && (lower.includes('sign in') || lower.includes('log in to continue')))
      ) {
        return {
          success: false,
          blocked: true,
          url: targetUrl,
          title: cleanTitle,
          error: `Site blocked automated access (Cloudflare or Access Verification challenge). Content requires manual user interaction in your default browser.`
        };
      }

      if (!cleanContent) {
        return {
          success: false,
          url: targetUrl,
          title: cleanTitle,
          error: `Page loaded but contained no readable text body.`
        };
      }

      return {
        success: true,
        url: targetUrl,
        title: cleanTitle,
        metaDescription: extracted.metaDesc || '',
        content: cleanContent,
        links: extracted.links || []
      };
    } catch (err) {
      // Fall through to fast HTTP request if Electron window fails
      console.warn('[BrowserService] Offscreen window navigation error, falling back to HTTP:', err.message);
    } finally {
      if (win) {
        try {
          win.destroy();
        } catch (e) {}
        win = null;
      }
    }
  }

  // Secondary Fallback: Standard HTTP/HTTPS Stream Fetch
  return new Promise((resolve) => {
    const client = targetUrl.startsWith('https:') ? https : http;
    const req = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: timeoutMs
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          try {
            redirectUrl = new URL(redirectUrl, targetUrl).toString();
          } catch (e) {}
        }
        return readWebPage(redirectUrl, { renderJs: false, timeoutMs }).then(resolve);
      }

      if (res.statusCode === 403 || res.statusCode === 401) {
        return resolve({
          success: false,
          blocked: true,
          url: targetUrl,
          error: `Site returned HTTP ${res.statusCode} (Access Denied / Authentication Required).`
        });
      }

      if (res.statusCode >= 400) {
        return resolve({
          success: false,
          url: targetUrl,
          error: `Server returned HTTP error ${res.statusCode}.`
        });
      }

      let rawHtml = '';
      res.on('data', chunk => rawHtml += chunk);
      res.on('end', () => {
        const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : targetUrl;

        // Strip non-content tags
        let bodyHtml = rawHtml
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
          .replace(/<svg[\s\S]*?<\/svg>/gi, '');

        const text = sanitizeUntrustedWebText(bodyHtml).slice(0, 6000);
        if (!text) {
          return resolve({ success: false, url: targetUrl, title, error: 'Page contained no readable body text.' });
        }

        resolve({
          success: true,
          url: targetUrl,
          title,
          content: text
        });
      });
    });

    req.on('error', (err) => resolve({ success: false, url: targetUrl, error: `Network error: ${err.message}` }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, url: targetUrl, error: 'Request timed out.' });
    });
  });
}

/**
 * End-to-end web research workflow: runs search, opens top result pages, extracts real content,
 * and compiles evidence-based citations.
 * @param {string} query
 * @param {Object} options
 * @returns {Promise<{ success: boolean, query: string, sources: Array<any>, findings: Array<any>, summaryMd: string }>}
 */
async function performWebResearch(query, options = {}) {
  const searchRes = await searchWeb(query, options.maxResults || 4);
  if (!searchRes.success || !searchRes.sources || searchRes.sources.length === 0) {
    return {
      success: false,
      query,
      sources: [],
      findings: [],
      summaryMd: `Could not complete web search for **"${query}"**: ${searchRes.error || 'No relevant sources found.'}`
    };
  }

  // Inspect top 2 pages to extract real grounding content
  const pagesToInspect = searchRes.sources.slice(0, 2);
  const findings = [];

  for (const src of pagesToInspect) {
    try {
      const pageData = await readWebPage(src.url, { renderJs: true, timeoutMs: 9000 });
      if (pageData.success && pageData.content) {
        findings.push({
          title: pageData.title || src.title,
          url: src.url,
          text: pageData.content.slice(0, 2200),
          snippet: src.snippet
        });
      } else {
        findings.push({
          title: src.title,
          url: src.url,
          text: src.snippet || '',
          snippet: src.snippet,
          note: pageData.error || 'Snippet index evidence'
        });
      }
    } catch (e) {
      findings.push({
        title: src.title,
        url: src.url,
        text: src.snippet || '',
        snippet: src.snippet
      });
    }
  }

  return {
    success: true,
    query,
    sources: searchRes.sources,
    findings
  };
}

module.exports = {
  isSafeUrl,
  sanitizeUntrustedWebText,
  searchWeb,
  readWebPage,
  performWebResearch
};
