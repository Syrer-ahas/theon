import json, urllib.request, concurrent.futures, io
from PIL import Image, ImageDraw
from pathlib import Path
groups={
 'engine':[134331352815131,118005143625874,111756072971748,75310307985292,91808986107752,131615545563759,102009423419834,134109822406396],
 'fuel':[84232098260150,132939146125098,104116604623427,98426013538862,76714991956957,124858499256322,70887273567125,91058611220798],
 'wheel':[83406601105133,101706907888782,86838437176044,137394249138424],
 'block':[88568057566935,71349671193384,112007338220385,102166082502590,89938825379811,92074510981309,127694440100266,88014119527469,89902047081108,82863419283397]}
ids=[i for group in groups.values() for i in group]
url='https://thumbnails.roblox.com/v1/assets?assetIds='+','.join(map(str,ids))+'&size=150x150&format=Png&isCircular=false'
data=json.load(urllib.request.urlopen(url))['data']
def get(entry):
 return entry['targetId'],Image.open(io.BytesIO(urllib.request.urlopen(entry['imageUrl']).read())).convert('RGBA')
images=dict(concurrent.futures.ThreadPoolExecutor(8).map(get,data))
sheet=Image.new('RGB',(1600,760),(100,100,100));draw=ImageDraw.Draw(sheet)
for row,(category,items) in enumerate(groups.items()):
 for col,asset in enumerate(items):
  tile=images[asset];sheet.paste(tile,(col*160,row*190),tile)
  draw.text((col*160+4,row*190+151),category+' '+str(col+1),fill='white')
  draw.text((col*160+4,row*190+168),str(asset),fill='white')
sheet.save(Path(__file__).parent/'icon-reference.png')
