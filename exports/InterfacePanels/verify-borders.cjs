const fs=require('fs');
const {PNG}=require('./render-tools/node_modules/pngjs');
const manifest=JSON.parse(fs.readFileSync(__dirname+'/manifest.json','utf8'));
const results=[];
for(const gui of manifest){
  const panel=gui.parts.find(p=>p.name==='Panel');
  const close=gui.parts.find(p=>p.name==='CloseButton');
  const png=PNG.sync.read(fs.readFileSync(__dirname+'/'+panel.file));
  const headerOffset=gui.name==='Index'?677:0;
  const y=Math.round((361-panel.y)*png.height/panel.height);
  let checked=0, failures=0;
  for(let x=headerOffset+80;x<close.x-20;x+=2){
    const px=Math.round((x-panel.x)*png.width/panel.width),i=(y*png.width+px)*4;
    checked++;
    if(png.data[i]>3||png.data[i+1]<250||png.data[i+2]<250||png.data[i+3]<250)failures++;
  }
  results.push({gui:gui.name,region:'header bottom cyan outline',checked,failures});
  if(gui.name==='PlotAccess'){
    const button=gui.parts.find(p=>p.kind==='button');
    const b=PNG.sync.read(fs.readFileSync(__dirname+'/'+button.file));
    const by=Math.round((1027-button.y)*b.height/button.height);
    let sampled=0, broken=0;
    for(let x=230;x<3960;x+=2){
      const bx=Math.round((x-button.x)*b.width/button.width),i=(by*b.width+bx)*4;
      sampled++;
      if(b.data[i]>3||b.data[i+1]<250||b.data[i+2]<250||b.data[i+3]<250)broken++;
    }
    results.push({gui:gui.name,region:'button bottom cyan outline',checked:sampled,failures:broken});
  }
}
fs.writeFileSync(__dirname+'/border-verification.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
if(results.some(r=>r.failures))process.exitCode=1;
