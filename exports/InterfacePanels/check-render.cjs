const { chromium } = require('./render-tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page = await browser.newPage({viewport:{width:1000,height:704},deviceScaleFactor:1});
  const svg=fs.readFileSync(__dirname+'/Settings-source.svg','utf8').replace('width="4193" height="2952"','width="1000" height="704"');
  await page.setContent('<html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>'+svg+'</body></html>');
  await page.screenshot({path:__dirname+'/Settings-browser-reference.png',omitBackground:true});
  await browser.close();
})();
