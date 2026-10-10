const fs=require('fs'),path=require('path');
const {Resvg}=require('../InterfacePanels/render-tools/node_modules/@resvg/resvg-js');
const {PNG}=require('../InterfacePanels/render-tools/node_modules/pngjs');
const {DOMParser,XMLSerializer}=require('../InterfacePanels/render-tools/node_modules/@xmldom/xmldom');
function nativeSvg(file){return `<svg xmlns="http://www.w3.org/2000/svg" width="4069" height="1360" viewBox="0 0 4069 1360"><image width="4069" height="1360" href="data:image/png;base64,${fs.readFileSync(path.join(__dirname,file)).toString('base64')}"/></svg>`;}
function render(svg,width){return new Resvg(svg,{fitTo:{mode:'width',value:width},font:{loadSystemFonts:false}}).render().asPng();}
const panelSvg=nativeSvg('Frame9-native-panel.png');
const panelPng=render(panelSvg,4096);
fs.writeFileSync(path.join(__dirname,'Frame9/Panel.png'),panelPng);
fs.writeFileSync(path.join(__dirname,'Frame9/Panel.svg'),panelSvg);
const ref=PNG.sync.read(render(nativeSvg('Frame9-native-reference.png'),1000));
const panel=PNG.sync.read(render(panelSvg,1000));
const root=new DOMParser().parseFromString(fs.readFileSync(path.join(__dirname,'Frame9/Button1.svg'),'utf8'),'image/svg+xml').documentElement;
root.setAttribute('viewBox','0 0 4069 1360');root.setAttribute('width','4069');root.setAttribute('height','1360');
const overlay=PNG.sync.read(render(new XMLSerializer().serializeToString(root),1000));
const composite=new PNG({width:ref.width,height:ref.height});
let total=0,max=0,above8=0;
for(let i=0;i<ref.data.length;i+=4){
 const a=overlay.data[i+3]/255,b=panel.data[i+3]/255,oa=a+b*(1-a);let worst=0;
 for(let c=0;c<4;c++){
  const value=c===3?oa*255:(oa?(overlay.data[i+c]*a+panel.data[i+c]*b*(1-a))/oa:0);
  composite.data[i+c]=Math.round(value);
  const difference=Math.abs(composite.data[i+c]-ref.data[i+c]);
  total+=difference;max=Math.max(max,difference);worst=Math.max(worst,difference);
 }
 if(worst>8)above8++;
}
fs.writeFileSync(path.join(__dirname,'Frame9-reference.png'),PNG.sync.write(ref));
fs.writeFileSync(path.join(__dirname,'Frame9-panel-preview.png'),PNG.sync.write(panel));
fs.writeFileSync(path.join(__dirname,'Frame9-assembled-preview.png'),PNG.sync.write(composite));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
const entry=manifest.parts.find(p=>p.gui==='Frame9'&&p.name==='Panel');entry.bytes=panelPng.length;entry.source='Figma native PNG at 2x';
manifest.verification={meanChannelError:total/ref.data.length,maxError:max,pixelsAbove8:above8,pixels:ref.width*ref.height};
fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest));
