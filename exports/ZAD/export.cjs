const fs=require('fs'),path=require('path');
const {DOMParser,XMLSerializer}=require('../InterfacePanels/render-tools/node_modules/@xmldom/xmldom');
const {Resvg}=require('../InterfacePanels/render-tools/node_modules/@resvg/resvg-js');
const {PNG}=require('../InterfacePanels/render-tools/node_modules/pngjs');
const xml=new XMLSerializer(),src=new DOMParser().parseFromString(fs.readFileSync(path.join(__dirname,'complete-source.svg'),'utf8'),'image/svg+xml').documentElement;
const nodes=Array.from(src.childNodes).filter(n=>n.nodeType===1),defs=nodes.find(n=>n.tagName==='defs');
// Clipboard SVG omits Figma's soft-light metadata. Bake the visibly blended
// diagonal face stripes into gradients, preserving their original geometry.
const children=n=>Array.from(n.childNodes).filter(n=>n.nodeType===1),all=n=>[n,...children(n).flatMap(all)],flat=all(src),doc=src.ownerDocument;
let serial=0;
for(const rect of flat.filter(n=>n.tagName==='rect'&&n.getAttribute('fill')==='#D9D9D9'&&n.hasAttribute('transform'))){
 const face=flat.slice(0,flat.indexOf(rect)).reverse().find(n=>n.tagName==='rect'&&/^url\(#paint/.test(n.getAttribute('fill')||''));
 const original=flat.find(n=>n.getAttribute('id')===face.getAttribute('fill').slice(5,-1));const stops=children(original),rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255),a=rgb(stops[0].getAttribute('stop-color')),b=rgb(stops[1].getAttribute('stop-color'));
 const id='bakedStripe'+(++serial),gradient=original.cloneNode(false),rotation=/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/.exec(rect.getAttribute('transform'));gradient.setAttribute('id',id);gradient.setAttribute('gradientTransform',`rotate(${-Number(rotation[1])} ${rotation[2]} ${rotation[3]})`);
 for(let i=0;i<=64;i++){const t=i/64,stop=doc.createElement('stop');stop.setAttribute('offset',t);stop.setAttribute('stop-color','#'+a.map((v,c)=>{const bg=v+(b[c]-v)*t;return Math.round(255*(bg+(2*217/255-1)*bg*(1-bg))).toString(16).padStart(2,'0');}).join(''));gradient.appendChild(stop);}defs.appendChild(gradient);rect.setAttribute('fill',`url(#${id})`);
 const inset=Number(face.getAttribute('stroke-width')||0)/2,clip=doc.createElement('clipPath'),box=doc.createElement('rect');clip.setAttribute('id',id+'Clip');for(const attr of ['x','y'])box.setAttribute(attr,Number(face.getAttribute(attr)||0)+inset);for(const attr of ['width','height'])box.setAttribute(attr,Number(face.getAttribute(attr))-inset*2);clip.appendChild(box);defs.appendChild(clip);const wrap=doc.createElement('g');wrap.setAttribute('clip-path',`url(#${id}Clip)`);rect.parentNode.insertBefore(wrap,rect);wrap.appendChild(rect);
}
const render=(r,w)=>new Resvg(xml.serializeToString(r),{fitTo:{mode:'width',value:w},font:{loadSystemFonts:false}}).render().asPng();
const specs=[['Panel',[0,1,2,3,4,5,6,7,8,9],4096,'ImageLabel'],['CloseButton',[10,11,12,13,14,15,16,17,18],1024,'ImageButton'],['VehicleButton',[19,20,21,22,23],2048,'ImageButton'],['WeaponsButton',[24,25,26,27,28],2048,'ImageButton'],['FrameNot1',[29,30],2048,'ImageLabel'],['FrameNot2',[31,32],2048,'ImageLabel'],['ClearPlotButton',[33,34,35,36,37],2048,'ImageButton']];
const manifest={canvas:{width:2233,height:3423},parts:[]},composite=new PNG({width:2233,height:3423});
for(const [name,ids,res,cls] of specs){
 const root=src.cloneNode(false); for(const i of ids)root.appendChild(nodes[i].cloneNode(true));root.appendChild(defs.cloneNode(true));
 const p=PNG.sync.read(render(root,2233));let x=2233,y=3423,r=0,b=0;
 for(let j=0;j<p.height;j++)for(let i=0;i<p.width;i++){let q=(j*p.width+i)*4;if(p.data[q+3]){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}const a=p.data[q+3]/255,old=composite.data[q+3]/255,out=a+old*(1-a);for(let c=0;c<3;c++)composite.data[q+c]=out?(p.data[q+c]*a+composite.data[q+c]*old*(1-a))/out:0;composite.data[q+3]=out*255;}
 x=Math.max(0,x-2);y=Math.max(0,y-2);r=Math.min(2232,r+2);b=Math.min(3422,b+2);const w=r-x+1,h=b-y+1;
 root.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);root.setAttribute('width',w);root.setAttribute('height',h);
 const tex=render(root,Math.round(res*Math.min(1,w/h)));fs.writeFileSync(path.join(__dirname,name+'.png'),tex);fs.writeFileSync(path.join(__dirname,name+'.svg'),xml.serializeToString(root));const sz=PNG.sync.read(tex);
 manifest.parts.push({name,className:cls,x,y,width:w,height:h,textureWidth:sz.width,textureHeight:sz.height});
}
const reference=PNG.sync.read(render(src,2233));let error=0;for(let i=0;i<reference.data.length;i+=4){for(let c=0;c<3;c++)error+=Math.abs(reference.data[i+c]*reference.data[i+3]/255-composite.data[i+c]*composite.data[i+3]/255);error+=Math.abs(reference.data[i+3]-composite.data[i+3]);}
manifest.meanChannelError=error/reference.data.length;if(manifest.meanChannelError>.15)throw Error('Decomposition mismatch '+manifest.meanChannelError);
fs.writeFileSync(path.join(__dirname,'reference.png'),PNG.sync.write(reference));fs.writeFileSync(path.join(__dirname,'preview.png'),render(src,600));fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
