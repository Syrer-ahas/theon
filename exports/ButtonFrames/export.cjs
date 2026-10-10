const fs = require('fs');
const path = require('path');
const { DOMParser, XMLSerializer } = require('../InterfacePanels/render-tools/node_modules/@xmldom/xmldom');
const { Resvg } = require('../InterfacePanels/render-tools/node_modules/@resvg/resvg-js');
const { PNG } = require('../InterfacePanels/render-tools/node_modules/pngjs');
const children = n => Array.from(n.childNodes || []).filter(n => n.nodeType === 1);
const xml = new XMLSerializer();
const read = name => new DOMParser().parseFromString(fs.readFileSync(path.join(__dirname, name), 'utf8'), 'image/svg+xml').documentElement;
function render(root, width) {
 return new Resvg(xml.serializeToString(root), {fitTo:{mode:'width',value:width},font:{loadSystemFonts:false}}).render().asPng();
}
const full = read('Frame9-source.svg');
const content = children(full).find(n => n.tagName === 'g');
const nodes = children(content);
const firstButton = nodes.findIndex(n => n.tagName === 'g' && n.getAttribute('filter') === 'url(#filter0_f_102_7)');
if(firstButton < 0) throw new Error('Cannot identify Frame9 button');
const panel = full.cloneNode(true);
const panelContent = children(panel).find(n => n.tagName === 'g');
for(const node of children(panelContent).slice(firstButton)) panelContent.removeChild(node);
const button = full.cloneNode(false);
const buttonContent = content.cloneNode(false);
for(const node of nodes.slice(firstButton)) buttonContent.appendChild(node.cloneNode(true));
button.appendChild(buttonContent);
for(const defs of children(full).filter(n => n.tagName === 'defs')) button.appendChild(defs.cloneNode(true));
const crop = {x:3052,y:913,width:964,height:419};
const croppedButton = button.cloneNode(true);
croppedButton.setAttribute('viewBox',`${crop.x} ${crop.y} ${crop.width} ${crop.height}`);
croppedButton.setAttribute('width',String(crop.width));
croppedButton.setAttribute('height',String(crop.height));
const entries = [
 {name:'Button1',gui:'Buttons',svg:read('Button1-source.svg'),x:1019,y:0,width:964,height:419},
 {name:'Button2',gui:'Buttons',svg:read('Button2-source.svg'),x:0,y:0,width:964,height:419},
 {name:'Panel',gui:'Frame9',svg:panel,x:0,y:0,width:4069,height:1360},
 {name:'Button1',gui:'Frame9',svg:croppedButton,...crop},
];
const manifest=[];
for(const e of entries) {
 const dir=path.join(__dirname,e.gui);fs.mkdirSync(dir,{recursive:true});
 const png=render(e.svg,4096),decoded=PNG.sync.read(png);
 const file=`${e.gui}/${e.name}.png`;
 fs.writeFileSync(path.join(__dirname,file),png);
 fs.writeFileSync(path.join(dir,`${e.name}.svg`),xml.serializeToString(e.svg));
 manifest.push({gui:e.gui,name:e.name,x:e.x,y:e.y,width:e.width,height:e.height,file,textureWidth:decoded.width,textureHeight:decoded.height,bytes:png.length});
}
const ref=PNG.sync.read(render(full,1000));
const background=PNG.sync.read(render(panel,1000));
const overlay=PNG.sync.read(render(button,1000));
let error=0,maxError=0,above3=0;
for(let i=0;i<ref.data.length;i+=4){
 const a=overlay.data[i+3]/255,b=background.data[i+3]/255,oa=a+b*(1-a);
 let worst=0;
 for(let c=0;c<4;c++){
  const value=c===3?oa*255:overlay.data[i+c]*a+background.data[i+c]*b*(1-a);
  const expected=c===3?ref.data[i+c]:ref.data[i+c]*ref.data[i+3]/255;
  const difference=Math.abs(value-expected);
  error+=difference;maxError=Math.max(maxError,difference);worst=Math.max(worst,difference);
 }
 if(worst>3)above3++;
}
const verification={meanChannelError:error/ref.data.length,maxError,pixelsAbove3:above3};
if(verification.meanChannelError>0.3 || above3>ref.width*ref.height*0.005)throw new Error('Decomposition mismatch '+JSON.stringify(verification));
fs.writeFileSync(path.join(__dirname,'Frame9-reference.png'),PNG.sync.write(ref));
fs.writeFileSync(path.join(__dirname,'Frame9-panel-preview.png'),PNG.sync.write(background));
fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify({parts:manifest,verification},null,2));
console.log(JSON.stringify({parts:manifest,verification}));
