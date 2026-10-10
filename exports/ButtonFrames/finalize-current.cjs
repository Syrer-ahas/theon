const fs=require('fs'),path=require('path');
const {Resvg}=require('../InterfacePanels/render-tools/node_modules/@resvg/resvg-js');
const {PNG}=require('../InterfacePanels/render-tools/node_modules/pngjs');
const {DOMParser,XMLSerializer}=require('../InterfacePanels/render-tools/node_modules/@xmldom/xmldom');
const dir=__dirname, width=4069,height=1360;
const read=n=>fs.readFileSync(path.join(dir,n));
const png=read('Frame9-current-panel.png'), refpng=read('Frame9-current-reference.png');
const button=read('Frame9/Button1.svg').toString('utf8');
const imageSvg=data=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><image width="'+width+'" height="'+height+'" href="data:image/png;base64,'+data.toString('base64')+'"/></svg>';
const render=(svg,w)=>new Resvg(svg,{fitTo:{mode:'width',value:w},font:{loadSystemFonts:false}}).render().asPng();
const panelSvg=imageSvg(png);
const panel=render(panelSvg,4096), buttonPng=render(button,4096);
fs.writeFileSync(path.join(dir,'Frame9/Panel.png'),panel);
fs.writeFileSync(path.join(dir,'Frame9/Button1.png'),buttonPng);
fs.writeFileSync(path.join(dir,'Frame9/Panel.svg'),panelSvg);
const assembledSvg=panelSvg.replace('</svg>','<g transform="translate(3052 913)">'+button+'</g></svg>');
const reference=PNG.sync.read(render(imageSvg(refpng),1000));
const assembled=PNG.sync.read(render(assembledSvg,1000));
let total=0,max=0,above16=0;
for(let i=0;i<reference.data.length;i+=4){
 let worst=0;
 for(let c=0;c<4;c++){
  const error=Math.abs(reference.data[i+c]-assembled.data[i+c]);
  total+=error;max=Math.max(max,error);worst=Math.max(worst,error);
 }
 if(worst>16)above16++;
}
const verification={meanChannelError:total/reference.data.length,maxError:max,pixelsAbove16:above16,pixels:reference.width*reference.height};
fs.writeFileSync(path.join(dir,'Frame9-assembled-preview.png'),PNG.sync.write(assembled));
fs.writeFileSync(path.join(dir,'Frame9-panel-preview.png'),render(panelSvg,1000));
fs.writeFileSync(path.join(dir,'Frame9-reference.png'),PNG.sync.write(reference));
const manifest={sourceFrame:{width,height},parts:[
 {name:'Panel',class:'ImageLabel',x:0,y:0,width,height,textureWidth:PNG.sync.read(panel).width,textureHeight:PNG.sync.read(panel).height,file:'Frame9/Panel.png'},
 {name:'Button1',class:'ImageButton',x:3052,y:913,width:964,height:419,textureWidth:PNG.sync.read(buttonPng).width,textureHeight:PNG.sync.read(buttonPng).height,file:'Frame9/Button1.png'}],verification};
fs.writeFileSync(path.join(dir,'Frame9/manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest));
if(verification.meanChannelError>1 || above16>reference.width*reference.height*.01)throw Error('Separated export does not match Figma');
