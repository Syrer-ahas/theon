from pathlib import Path
import json, base64
exec(Path('tmp/pdfs/build_application.py').read_text(encoding='utf-8').split("cv=OUT/")[0])

jobs=[
 {'key':'dm','company':'dm-drogerie markt','address':['Schiffdorfer Chaussee 18','27574 Bremerhaven'],'to':None,'sector':'Einzelhandel','interest':'Bei dm möchte ich kennenlernen, wie Waren eingeräumt und präsentiert werden und wie Ihr Team Kunden bei Fragen zu Drogerieprodukten unterstützt. Besonders interessieren mich die verschiedenen Aufgaben im Markt und die Zusammenarbeit im Team.'},
 {'key':'Lidl','company':'Lidl Deutschland - Karriere-Team','address':['Betreffender Markt: Elbestraße 124','27570 Bremerhaven-Geestemünde'],'to':'bewerbung@lidl.de','sector':'Einzelhandel','interest':'In Ihrer Filiale in der Elbestraße 124 in Bremerhaven-Geestemünde möchte ich kennenlernen, wie Waren eingeräumt werden, Aktionsartikel präsentiert werden und das Team den Verkaufsalltag organisiert. Bitte leiten Sie meine Anfrage an die zuständige Filiale oder Regionalgesellschaft weiter.'},
 {'key':'James_Marquardt','company':'James Marquardt & Co. GmbH','address':['Rudloffstraße 126','27568 Bremerhaven'],'to':'bewerbung@jamesmarquardt.de','sector':'Handwerk','interest':'Ich möchte den Beruf des Anlagenmechanikers für Sanitär-, Heizungs- und Klimatechnik kennenlernen. Besonders interessieren mich die Installation und Wartung von Heizungsanlagen sowie die Arbeit an Sanitäranlagen. Gerne möchte ich unter Anleitung Einblicke in die Aufgaben Ihres Teams gewinnen.'},
 {'key':'Lloyd_Werft','company':'Lloyd Werft Bremerhaven GmbH','address':['Personalabteilung','Brückenstraße 25','27568 Bremerhaven'],'to':'personal@lloydwerft.com','sector':'Handwerk','interest':'Ich möchte praktische Einblicke in den Schiffbau und in handwerkliche Tätigkeiten im Metallbereich gewinnen. Besonders interessiert mich, wie Bauteile gefertigt und montiert werden. Gerne würde ich in Ihrer Ausbildungswerkstatt oder einem für Schüler geeigneten Bereich den Arbeitsalltag kennenlernen.'}
]
handcv=OUT/'Lebenslauf_Handwerk_Alkhidir_Al_Ahmad.pdf'
c=canvas.Canvas(str(handcv),pagesize=A4);c.setTitle('Lebenslauf Handwerk - Alkhidir Al Ahmad');c.setAuthor('Alkhidir Al Ahmad')
header(c,'Schülerpraktikum im Handwerk | 16.11.2026 - 27.11.2026')
y=H-131;y=section(c,'Persönliche Angaben',y)
for k,v in [('Anschrift','Verdener Straße 15, 27570 Bremerhaven'),('Telefon','+49 1520 6860558'),('E-Mail','alkhidirea@gmail.com'),('Geburtsdatum','17.03.2012'),('Geburtsort','Al Hasaka, Syrien')]:
 text(c,60,y,k,10,True);text(c,180,y,v);y-=23
y-=21;y=section(c,'Schulbildung',y)
text(c,60,y,'2021 - heute',11,True);text(c,180,y,'Wilhelm-Raabe-Schule, Bremerhaven');y-=23
text(c,180,y,'Aktuell: Klasse 9D');y-=23
text(c,180,y,'Voraussichtlicher Schulabschluss: Februar 2028',10);y-=42
y=section(c,'Praktikumsziel',y)
y=para(c,'Ich möchte handwerkliche Berufe kennenlernen und erste praktische Erfahrungen sammeln. Mein Ziel ist es, die Arbeit im Betrieb zu beobachten, den Umgang mit Werkzeugen und Materialien unter Anleitung kennenzulernen und Einblicke in den Berufsalltag zu gewinnen.',y+10)
y-=12;y=section(c,'Kenntnisse und Fähigkeiten',y)
for s in ['Pünktlich und zuverlässig','Sorgfältige Arbeitsweise','Freundlicher Umgang mit anderen','Deutsch und Englisch: gute Kenntnisse']:
 text(c,60,y,s);y-=23
y-=23;y=section(c,'Hobbys und Interessen',y);text(c,60,y,'Fußball und Sport');text(c,60,55,'Bremerhaven, 03.10.2026',10);c.save()

payloads=[]
for j in jobs:
 p=OUT/f'Bewerbung_{j["key"]}_Alkhidir_Al_Ahmad.pdf'
 c=canvas.Canvas(str(p),pagesize=A4);c.setTitle('Bewerbung Schülerpraktikum - '+j['company']);c.setAuthor('Alkhidir Al Ahmad')
 header(c,'Verdener Straße 15 | 27570 Bremerhaven');text(c,60,H-116,'+49 1520 6860558 | alkhidirea@gmail.com',10)
 y=H-158
 for s in [j['company']]+j['address']:
  text(c,60,y,s,10);y-=16
 c.setFont('Arial',10);c.drawRightString(W-60,y-12,'Bremerhaven, 03.10.2026');y-=54
 y=para(c,'<b>Bewerbung um ein Schülerpraktikum vom 16.11. bis 27.11.2026</b>',y,12,17)
 y=para(c,'Sehr geehrte Damen und Herren,',y)
 for s in [
  'ich bewerbe mich um ein Schülerpraktikum in Ihrem Unternehmen vom 16. bis 27. November 2026. Zurzeit besuche ich die Klasse 9D der Wilhelm-Raabe-Schule in Bremerhaven. Es handelt sich um ein zweiwöchiges Schulpraktikum zur Berufsorientierung.',
  j['interest'],
  'Ich bin freundlich, pünktlich und zuverlässig. Ich arbeite sorgfältig und lerne gerne neue Aufgaben. Meine guten Deutsch- und Englischkenntnisse helfen mir im Umgang mit anderen. Gerne unterstütze ich Ihr Team bei Aufgaben, die für ein Schülerpraktikum geeignet sind.',
  'Bitte teilen Sie mir mit, ob Sie in dem genannten Zeitraum einen Praktikumsplatz anbieten können. Über die Möglichkeit, Ihr Unternehmen kennenzulernen, und eine Einladung zu einem persönlichen Gespräch würde ich mich sehr freuen.'
 ]: y=para(c,s,y)
 y=para(c,'Mit freundlichen Grüßen<br/><br/><b>Alkhidir Al Ahmad</b>',y);text(c,60,y-3,'Anlage: Lebenslauf',10);assert y>55;c.save()
 if j['to']:
  cv=handcv if j['sector']=='Handwerk' else OUT/'Lebenslauf_Alkhidir_Al_Ahmad.pdf'
  intro='Bitte leiten Sie meine Anfrage an die für Bremerhaven-Geestemünde zuständigen Kolleginnen und Kollegen weiter.' if j['key']=='Lidl' else 'Bitte teilen Sie mir mit, ob Sie in diesem Zeitraum einen Schülerpraktikumsplatz anbieten können.'
  content=f'<p>Sehr geehrte Damen und Herren,</p><p>ich bewerbe mich um ein Schülerpraktikum vom <strong>16. bis 27. November 2026</strong> in Ihrem Unternehmen in Bremerhaven. Ich besuche die Klasse 9D der Wilhelm-Raabe-Schule; es handelt sich um ein zweiwöchiges Schulpraktikum zur Berufsorientierung.</p><p>{j["interest"]}</p><p>Mein angepasstes Anschreiben und meinen Lebenslauf finden Sie als PDF im Anhang. {intro} Über eine Rückmeldung freue ich mich.</p><p>Mit freundlichen Grüßen<br>Alkhidir Al Ahmad<br>+49 1520 6860558<br>alkhidirea@gmail.com</p>'
  payloads.append({'key':j['key'],'args':{'from_address':'alkhidirea@gmail.com','to':j['to'],'subject':f'Schülerpraktikum 16.–27.11.2026 – Bremerhaven – Alkhidir Al Ahmad','payload':{'mime_type':'multipart/mixed','parts':[{'mime_type':'text/html','charset':'UTF-8','body':{'content':content}}]+[{'mime_type':'application/pdf','filename':a.name,'content_disposition':'attachment','body':{'base64_url_content':base64.urlsafe_b64encode(a.read_bytes()).decode().rstrip('=')}} for a in [p,cv]]},'response_fields':['id','thread_id','label_ids']}})
(ROOT/'tmp/pdfs/followup_payloads.json').write_text(json.dumps(payloads,ensure_ascii=False),encoding='utf-8')
print('Erstellt: 4 Anschreiben und 1 Lebenslauf für Handwerk.')
