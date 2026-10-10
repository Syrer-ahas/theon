from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
import json, base64

ROOT = Path('C:/Users/alkhi/Downloads/VSCODE-USESTRICTLY!')
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='ArialBold', italic='Arial', boldItalic='ArialBold')
W,H=A4
ink=HexColor('#172635')
def text(c,x,y,t,size=11,bold=False,color=ink):
 c.setFillColor(color);c.setFont('ArialBold' if bold else 'Arial',size);c.drawString(x,y,t)
def para(c,t,y,size=11,leading=16,width=475):
 p=Paragraph(t,ParagraphStyle('body',fontName='Arial',fontSize=size,leading=leading,textColor=ink))
 _,h=p.wrap(width,H);p.drawOn(c,60,y-h);return y-h-15
def header(c,label):
 text(c,60,H-60,'Alkhidir Al Ahmad',23,True)
 text(c,60,H-81,label,11)
 c.setStrokeColor(HexColor('#bcc7d0'));c.line(60,H-96,W-60,H-96)
def section(c,title,y):
 text(c,60,y,title,13,True);return y-25

cv=OUT/'Lebenslauf_Alkhidir_Al_Ahmad.pdf'
c=canvas.Canvas(str(cv),pagesize=A4)
c.setTitle('Lebenslauf - Alkhidir Al Ahmad');c.setAuthor('Alkhidir Al Ahmad')
header(c,'Schülerpraktikum im Einzelhandel | 16.11.2026 - 27.11.2026')
y=H-131
y=section(c,'Persönliche Angaben',y)
for k,v in [('Anschrift','Verdener Straße 15, 27570 Bremerhaven'),('Telefon','+49 1520 6860558'),('E-Mail','alkhidirea@gmail.com'),('Geburtsdatum','17.03.2012'),('Geburtsort','Al Hasaka, Syrien')]:
 text(c,60,y,k,10,True);text(c,180,y,v);y-=23
y-=21
y=section(c,'Schulbildung',y)
text(c,60,y,'2021 - heute',11,True);text(c,180,y,'Wilhelm-Raabe-Schule, Bremerhaven');y-=23
text(c,180,y,'Aktuell: Klasse 9D');y-=48
y=section(c,'Praktikumsziel',y)
y=para(c,'Ich möchte den Arbeitsalltag im Einzelhandel kennenlernen und erste praktische Erfahrungen sammeln. Besonders interessieren mich der Kontakt mit Kunden, die Warenpräsentation und die Organisation der Abläufe in einem Lebensmittelmarkt.',y+10)
y-=12
y=section(c,'Kenntnisse und Fähigkeiten',y)
for s in ['Pünktlich und zuverlässig','Sorgfältige Arbeitsweise','Freundlicher Umgang mit anderen','Deutsch und Englisch: gute Kenntnisse']:
 text(c,60,y,s);y-=23
y-=23;y=section(c,'Hobbys und Interessen',y)
text(c,60,y,'Fußball und Sport')
text(c,60,55,'Bremerhaven, 03.10.2026',10)
c.save()

letter=OUT/'Bewerbung_EDEKA_Center_Streubel_Alkhidir_Al_Ahmad.pdf'
c=canvas.Canvas(str(letter),pagesize=A4)
c.setTitle('Bewerbung Schülerpraktikum - EDEKA Center Streubel');c.setAuthor('Alkhidir Al Ahmad')
header(c,'Verdener Straße 15 | 27570 Bremerhaven')
text(c,60,H-116,'+49 1520 6860558 | alkhidirea@gmail.com',10)
y=H-160
for s in ['EDEKA Center Streubel','z. Hd. der Marktleitung / Praktikumsbetreuung','Georg-Seebeck-Straße 56/58','27570 Bremerhaven']:
 text(c,60,y,s,11);y-=16
c.setFont('Arial',10);c.drawRightString(W-60,y-13,'Bremerhaven, 03.10.2026')
y-=55
y=para(c,'<b>Bewerbung um ein Schülerpraktikum vom 16.11. bis 27.11.2026</b>',y,12,17)
y=para(c,'Sehr geehrte Damen und Herren,',y)
for s in [
 'ich bewerbe mich um ein Schülerpraktikum in Ihrem EDEKA Center in der Georg-Seebeck-Straße in Bremerhaven-Geestemünde. Zurzeit besuche ich die Klasse 9D der Wilhelm-Raabe-Schule. Das zweiwöchige Schulpraktikum findet vom 16. bis 27. November 2026 statt.',
 'Ich interessiere mich für den Einzelhandel und den Umgang mit Kunden. In Ihrem großen Lebensmittelmarkt möchte ich kennenlernen, wie Waren angenommen, eingeräumt und ansprechend präsentiert werden und wie das Team den Verkaufsalltag organisiert.',
 'Ich bin freundlich, pünktlich und zuverlässig. Neue Aufgaben lerne ich gerne und arbeite sorgfältig. Meine guten Deutsch- und Englischkenntnisse helfen mir im Umgang mit anderen. Gerne unterstütze ich Ihr Team bei Aufgaben, die für ein Schülerpraktikum geeignet sind.',
 'Über die Möglichkeit, in Ihrem Markt erste praktische Erfahrungen zu sammeln, freue ich mich sehr. Bitte teilen Sie mir mit, ob in dem genannten Zeitraum ein Praktikumsplatz möglich ist. Für ein persönliches Gespräch stehe ich gerne zur Verfügung.'
]: y=para(c,s,y)
y=para(c,'Mit freundlichen Grüßen<br/><br/><b>Alkhidir Al Ahmad</b>',y)
text(c,60,y-3,'Anlage: Lebenslauf',10)
assert y > 55, y
c.save()
payload={
 'from_address':'alkhidirea@gmail.com',
 'to':'e801117@minden.edeka.de',
 'subject':'Bewerbung Schülerpraktikum 16.–27.11.2026 – Geestemünde – Alkhidir Al Ahmad',
 'payload':{'mime_type':'multipart/mixed','parts':[
  {'mime_type':'text/html','charset':'UTF-8','body':{'content':'<p>Sehr geehrte Damen und Herren,</p><p>hiermit bewerbe ich mich um ein Schülerpraktikum vom <strong>16. bis 27. November 2026</strong> in Ihrem EDEKA Center in der <strong>Georg-Seebeck-Straße 56/58 in Bremerhaven-Geestemünde</strong>.</p><p>Ich besuche die Klasse 9D der Wilhelm-Raabe-Schule und möchte den Arbeitsalltag im Einzelhandel kennenlernen. Mein Bewerbungsschreiben und meinen Lebenslauf finden Sie als PDF im Anhang.</p><p>Bitte teilen Sie mir mit, ob Sie in diesem Zeitraum einen Schülerpraktikumsplatz anbieten können. Über eine Rückmeldung freue ich mich.</p><p>Mit freundlichen Grüßen<br>Alkhidir Al Ahmad<br>Telefon: +49 1520 6860558<br>E-Mail: alkhidirea@gmail.com</p>'}},
  *[{'mime_type':'application/pdf','filename':p.name,'content_disposition':'attachment','body':{'base64_url_content':base64.urlsafe_b64encode(p.read_bytes()).decode().rstrip('=')}} for p in [letter,cv]]
 ]},'response_fields':['id','thread_id','label_ids','snippet']}
(ROOT/'tmp/pdfs/send_payload.json').write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'files':[str(letter),str(cv)],'letter_bottom':y,'sizes':[letter.stat().st_size,cv.stat().st_size]}))
