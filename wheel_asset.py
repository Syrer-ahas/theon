from PIL import Image, ImageDraw, ImageFont, ImageFilter
from math import sin, cos, radians

S = 1536
C = S // 2
R = 605
colors = ['#FF6A72', '#FFAD42', '#F5D65A', '#72D6A0', '#49C9D0', '#637FF7', '#A773F1', '#EA73B9']
rewards = [('100', 'COINS'), ('250', 'COINS'), ('500', 'COINS'), ('1,000', 'COINS'), ('25', 'GEMS'), ('750', 'COINS'), ('50', 'GEMS'), ('150', 'COINS')]

def font(size, bold=True):
    path = 'C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf'
    return ImageFont.truetype(path, size)

im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)

# Inset shadows and a narrow metal rim give the dial the weight of a physical object.
d.ellipse((C-R-51, C-R-51, C+R+51, C+R+51), fill='#111E37')
d.ellipse((C-R-37, C-R-37, C+R+37, C+R+37), fill='#7A8CAA')
d.ellipse((C-R-29, C-R-29, C+R+29, C+R+29), fill='#D9E5F0')
d.ellipse((C-R-18, C-R-18, C+R+18, C+R+18), fill='#253555')

for i, color in enumerate(colors):
    a = -112.5 + i * 45
    d.pieslice((C-R, C-R, C+R, C+R), a, a+45.1, fill=color)

# Thin radial dividers and inner concentric line.
for i in range(8):
    a = radians(-112.5 + i * 45)
    x = C + R*cos(a)
    y = C + R*sin(a)
    d.line((C, C, x, y), fill='#F9FCFF', width=8)
    d.line((C, C, x, y), fill='#28314D', width=3)
d.ellipse((C-R+25, C-R+25, C+R-25, C+R-25), outline='#FFFFFF', width=4)

# The pearl studs sit on their own ring, outside the color blocks.
for i in range(40):
    a = radians(i * 9)
    x = C + (R+36)*cos(a)
    y = C + (R+36)*sin(a)
    rad = 7 if i % 5 else 11
    d.ellipse((x-rad, y-rad, x+rad, y+rad), fill='#FFF5D2')

for i, (amount, kind) in enumerate(rewards):
    a = radians(-90 + i * 45)
    x = C + 391*cos(a)
    y = C + 391*sin(a)
    ink = '#18223C'
    d.text((x, y-28), amount, anchor='mm', font=font(69 if len(amount) < 4 else 56), fill=ink, stroke_width=0)
    d.text((x, y+35), kind, anchor='mm', font=font(27), fill=ink)

# Raised hub: dark enamel, silver highlight, and a small flash.
d.ellipse((C-136, C-136, C+136, C+136), fill='#263553', outline='#EDF3F7', width=13)
d.ellipse((C-109, C-109, C+109, C+109), fill='#121E36', outline='#526985', width=5)
d.text((C, C-8), 'CF', anchor='mm', font=font(108), fill='#FFFFFF')
d.text((C, C+65), 'LUCK', anchor='mm', font=font(23), fill='#9CB7D5')

im.resize((1024,1024), Image.Resampling.LANCZOS).save('wheel_dial.png', optimize=True)
