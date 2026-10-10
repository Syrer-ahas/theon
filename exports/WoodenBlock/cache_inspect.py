import sqlite3,io
from PIL import Image,ImageDraw
from pathlib import Path
c=sqlite3.connect('file:C:/Users/alkhi/AppData/Local/Roblox/rbx-storage.db?mode=ro',uri=True)
p=Path(__file__).parent/'cache';p.mkdir(exist_ok=True)
imgs=[]
for k,v in c.execute('select id,content from files where instr(content,?)>0',(b'\x89PNG\r\n\x1a\n',)):
 pos=v.find(b'\x89PNG\r\n\x1a\n')
 if pos>60:continue
 try:
  im=Image.open(io.BytesIO(v[pos:]));w,h=im.size
  if w!=h or w<128:continue
  out=p/(k.hex()+'.png');out.write_bytes(v[pos:]);imgs.append((out,im.copy()))
 except:pass
print('square images',len(imgs))
for page in range((len(imgs)+119)//120):
 canvas=Image.new('RGB',(1200,1200),(45,45,45));d=ImageDraw.Draw(canvas)
 for j,(f,im) in enumerate(imgs[page*120:(page+1)*120]):
  x=(j%12)*100;y=(j//12)*120;im.thumbnail((94,94));canvas.paste(im,(x,y));d.text((x,y+96),str(page*120+j),fill='white')
 canvas.save(p/f'sheet{page}.jpg')
(p/'index.txt').write_text('\n'.join(str(x[0]) for x in imgs))
