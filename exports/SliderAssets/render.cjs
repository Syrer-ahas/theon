const fs = require('fs');
const path = require('path');
const { Resvg } = require('../InterfacePanels/render-tools/node_modules/@resvg/resvg-js');
const { PNG } = require('../InterfacePanels/render-tools/node_modules/pngjs');
const result = [];
for (const [name, width, height] of [['slider', 1000, 400], ['slide', 400, 400]]) {
  const svg = fs.readFileSync(path.join(__dirname, `${name}-source.svg`), 'utf8');
  const png = new Resvg(svg, {fitTo: {mode: 'width', value: 4096}, font: {loadSystemFonts: false}}).render().asPng();
  fs.writeFileSync(path.join(__dirname, `${name}.png`), png);
  const image = PNG.sync.read(png);
  if (image.data[3] !== 0) throw new Error('Expected transparent corners');
  result.push({name, sourceWidth: width, sourceHeight: height, textureWidth: image.width, textureHeight: image.height, bytes: png.length});
}
const track = PNG.sync.read(new Resvg(fs.readFileSync(path.join(__dirname, 'slider-source.svg'), 'utf8'), {fitTo: {mode:'width',value:1000}}).render().asPng());
const handle = PNG.sync.read(new Resvg(fs.readFileSync(path.join(__dirname, 'slide-source.svg'), 'utf8'), {fitTo: {mode:'width',value:400}}).render().asPng());
for (let y=0; y<400; y++) for (let x=0; x<400; x++) {
 const t=(y*1000+x)*4, h=(y*400+x)*4;
 const a=handle.data[h+3]/255, b=track.data[t+3]/255, out=a+b*(1-a);
 for(let c=0;c<3;c++) track.data[t+c]=out ? Math.round((handle.data[h+c]*a+track.data[t+c]*b*(1-a))/out) : 0;
 track.data[t+3]=Math.round(out*255);
}
fs.writeFileSync(path.join(__dirname, 'assembled-preview.png'), PNG.sync.write(track));
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
