from pathlib import Path
exec(Path('tmp/pdfs/build_application.py').read_text(encoding='utf-8').split('cv=OUT/')[0])
import html

jobs=[
 {'key':'CI_Gate','name':'CI-Gate Development & Consulting GmbH','to':'bewerbung@ci-gate.de','field':'IT','place':'Bremerhaven','interest':'IT-Systeme und Softwareentwicklung','detail':'wie Ihr Team digitale Lösungen für Kunden entwickelt und IT-Systeme betreut','source':'https://cigate.eu/jobs'},
 {'key':'netactive','name':'netactive GmbH','to':'info@netactive.de','field':'IT','place':'Bremerhaven','interest':'IT-Systemintegration','detail':'wie Sie Computer, Netzwerke und IT-Dienste für Kunden einrichten und betreuen','source':'https://netactive.de/karriere'},
 {'key':'Benthin','name':'Benthin GmbH','to':'jobs@benthin.de','field':'IT','place':'Bremerhaven','interest':'Fachinformatik und Anwendungsentwicklung','detail':'wie Ihre IT-Abteilung Software entwickelt und Computertechnik im Unternehmen einsetzt','source':'https://www.benthin.com/fachinformatiker'},
 {'key':'EUROGATE','name':'EUROGATE','to':'bewerbungen@eurogategroup.eu','field':'IT','place':'Bremerhaven','interest':'Informatik im Hafen','detail':'wie Software und IT-Systeme den Betrieb eines großen Containerterminals unterstützen','source':'https://www1.eurogate.de/karriere/ausbildungsprofil/ausbildung-fachinformatikerin-anwendungsentwicklung-m-w-d/'},
 {'key':'bremenports','name':'bremenports GmbH & Co. KG','to':'bewerbung@bremenports.de','field':'METALL','place':'Bremerhaven','interest':'Industriemechanik und Hafentechnik','detail':'wie Maschinen und technische Hafenanlagen gewartet und instand gehalten werden','source':'https://www.bremenports.de/karriere/lernen'},
 {'key':'Heise_Werft','name':'Heise Werft GmbH','to':'salge@heise-werft.de','field':'METALL','place':'Bremerhaven','interest':'Industriemechanik und Schiffsreparatur','detail':'wie Bauteile in der Werft hergestellt, montiert und repariert werden','source':'https://heise-werft.de/stellenangebote/'},
 {'key':'EundA','name':'E+A Elektrotechnik und Aggregatebau','to':'vertrieb@eunda.de','field':'METALL','place':'Bremerhaven','interest':'Elektrotechnik und elektrische Maschinen','detail':'wie Elektromotoren und Generatoren in Ihren Werkstätten geprüft und repariert werden','source':'https://www.eunda.de/karriere/'},
 {'key':'BREDO','name':'BREDO DRY DOCKS GmbH','to':'bewerbung@bredo.de','field':'METALL','place':'Bremerhaven','interest':'Industriemechanik und Schiffbau','detail':'wie Maschinen und Bauteile bei der Schiffsreparatur gewartet und instand gesetzt werden','source':'https://www.bredo.de/jobs'},
 {'key':'Fairplay','name':'FAIRPLAY TOWAGE Group','to':'bewerbung@fairplay-towage.com','field':'METALL','place':'Bremerhaven','interest':'Industriemechanik im maritimen Bereich','detail':'wie technische Anlagen an Land und an Bord von Schiffen gewartet werden','source':'https://fairplay-towage.group/de/ausbildung-zum-industriemechaniker-m-w-d/'},
 {'key':'Huth','name':'Huth Metall + Zaunbau GmbH','to':'bewerbung@huth.team','field':'METALL','place':'Bremerhaven','interest':'Metallbau und Schlosserei','detail':'wie Bauteile aus Metall für Tore, Geländer und andere Konstruktionen gefertigt und montiert werden','source':'https://www.huth.team/karriere/'},
 {'key':'HP_Stahlbau','name':'H+P Stahl- und Maschinenbau GmbH','to':'info@hp-stahlbau.de','field':'METALL','place':'Bremerhaven','interest':'Konstruktionsmechanik und Stahlbau','detail':'wie Metallbauteile bearbeitet und zu Konstruktionen zusammengefügt werden','source':'https://www.hp-stahlbau.de/karriere/'},
 {'key':'USM','name':'Unterweser Stahl- und Maschinenbau GmbH','to':'bewerbung@hr-gruppe.de','field':'METALL','place':'Bremerhaven','interest':'Metallbau und Maschinenbau','detail':'wie Stahlkonstruktionen und Bauteile für den Wasser- und Maschinenbau entstehen','source':'https://www.usm-bhv.de/karriere/stellenangebote/metallbauer-konstruktionstechnik-m-w-d-usm-bremerhaven-ausbildung'},
 {'key':'North_Repair','name':'North Repair Service GmbH','to':'info@northrepair-service.de','field':'METALL','place':'Bremerhaven','interest':'Schiffbau und Metallbau','detail':'wie Fachkräfte Metallteile und Schiffskomponenten bearbeiten und instand setzen','source':'https://northrepair-service.de/jobs'},
 {'key':'Werner','name':'Werner Automobile GmbH, Nutzfahrzeug-Service','to':'gabriele.meyer@wernerautomobile.de','field':'KFZ','place':'Bremerhaven','interest':'Kfz-Mechatronik für Nutzfahrzeuge','detail':'wie Lastwagen und andere Nutzfahrzeuge gewartet und repariert werden','source':'https://www.make-it-in-germany.com/de/arbeiten-in-deutschland/jobboerse/job/job-10000-1206034489-S'},
 {'key':'Bobrink','name':'Bobrink Gruppe, Standort Bremerhaven-Süd','to':'bewerbung@bobrink-gruppe.de','field':'KFZ','place':'Bremerhaven-Süd','interest':'Kfz-Mechatronik','detail':'wie Ihr Werkstattteam Fahrzeuge prüft, wartet und Fehler findet','source':'https://www.bobrink.de/unternehmen/karriere/kfz-mechatroniker/'},
 {'key':'Ordemann','name':'Ordemann GmbH, Dachdeckerei','to':'dachdeckerei@ordemann.de','field':'DACH','place':'Beverstedt','interest':'Dachdeckerhandwerk','detail':'wie Dächer eingedeckt und abgedichtet werden und wie Ihr Team Arbeiten auf der Baustelle vorbereitet','source':'https://www.ordemann.de/de/dachdeckerei/ausbildung/'},
 {'key':'Kunert','name':'Kunert Bedachungen','to':'info@kunert-bedachungen.de','field':'DACH','place':'Bremerhaven','interest':'Dachdeckerhandwerk','detail':'wie Dächer repariert, neu eingedeckt und Flachdächer abgedichtet werden','source':'https://kunert-bedachungen.de/kontakt'},
 {'key':'INOXI','name':'INOXI Segelmacherei','to':'info@inoxi.de','field':'TEXTIL','place':'Bremerhaven','interest':'Segelmacherhandwerk','detail':'wie Segel und Schutzplanen aus modernen Geweben zugeschnitten und verarbeitet werden','source':'https://www.inoxi.de/UeBER-INOXI/JOBS/'},
 {'key':'Roenner_IT','name':'Rönner Verwaltungsgesellschaft mbH, IT','to':'k.balcke@hr-gruppe.de','field':'IT','place':'Bremerhaven','interest':'IT-Systemadministration','detail':'wie die IT-Systeme einer großen Unternehmensgruppe betreut und geschützt werden','source':'https://www.hr-gruppe.de/karriere/offene-stellen/stellenangebot?cHash=466201b17a1a1bc9ed3f5906f2f7f5f7&tx_hrjobs_hrgruppejobsdetailview%5Baction%5D=detail&tx_hrjobs_hrgruppejobsdetailview%5Bcontroller%5D=Job&tx_hrjobs_hrgruppejobsdetailview%5Bjob%5D=30'},
 {'key':'Datacon','name':'Datacon GmbH & Co. KG','to':'karriere@datacon.biz','field':'IT','place':'Bremerhaven','interest':'IT und Digitalisierung','detail':'wie Anwendungen und digitale Lösungen im Unternehmen eingesetzt und weiterentwickelt werden','source':'https://www.seier-gruppe.de/karriere/jobanzeige/job-details/werkstudent-it--application-management-digitalisierung-ki-m-w-d'}
]
assert len(jobs)==20 and len({j['to'] for j in jobs})==20

itcv=OUT/'Lebenslauf_IT_Alkhidir_Al_Ahmad.pdf'
c=canvas.Canvas(str(itcv),pagesize=A4)
c.setTitle('Lebenslauf IT - Alkhidir Al Ahmad');c.setAuthor('Alkhidir Al Ahmad')
header(c,'Schülerpraktikum im Bereich Informatik | 16.11.2026 - 27.11.2026')
y=H-131;y=section(c,'Persönliche Angaben',y)
for k,v in [('Anschrift','Verdener Straße 15, 27570 Bremerhaven'),('Telefon','+49 1520 6860558'),('E-Mail','alkhidirea@gmail.com'),('Geburtsdatum','17.03.2012'),('Geburtsort','Al Hasaka, Syrien')]:
 text(c,60,y,k,10,True);text(c,180,y,v);y-=23
y-=19;y=section(c,'Schulbildung',y)
text(c,60,y,'2021 - heute',11,True);text(c,180,y,'Wilhelm-Raabe-Schule, Bremerhaven');y-=23
text(c,180,y,'Aktuell: Klasse 9D');y-=23
text(c,180,y,'Voraussichtlicher Schulabschluss: Februar 2028',10);y-=42
y=section(c,'Berufsorientierung',y)
y=para(c,'Mai 2026: Werkstatttage bei InCoTrain in den Berufsfeldern Medien Bild und Ton, Tischler und Hauswirtschaft (Teilnahmezertifikat vorhanden).',y+6)
y-=5;y=section(c,'Praktikumsziel',y)
y=para(c,'Ich möchte die Arbeit mit Computern und IT-Systemen im Betrieb kennenlernen. Besonders interessieren mich das Einrichten und Betreuen von Technik sowie das Lösen praktischer Probleme unter Anleitung.',y+6)
y-=4;y=section(c,'Stärken und Interessen',y)
for s in ['Pünktlich und zuverlässig','Sorgfältige Arbeitsweise','Freundlicher Umgang mit anderen','Deutsch und Englisch: gute Kenntnisse','Hobbys: Fußball und Sport']:
 text(c,60,y,s);y-=23
text(c,60,55,'Bremerhaven, 04.10.2026',10)
assert y>60;y and c.save()

handcv=OUT/'Lebenslauf_Handwerk_Alkhidir_Al_Ahmad.pdf'
assert handcv.exists()
manifest=[]
for j in jobs:
 p=OUT/f'Bewerbung_{j["key"]}_Alkhidir_Al_Ahmad.pdf'
 c=canvas.Canvas(str(p),pagesize=A4)
 c.setTitle('Bewerbung Schülerpraktikum - '+j['name']);c.setAuthor('Alkhidir Al Ahmad')
 header(c,'Verdener Straße 15 | 27570 Bremerhaven')
 text(c,60,H-116,'+49 1520 6860558 | alkhidirea@gmail.com',10)
 y=H-155
 for line in [j['name'],j['place']]:
  y=para(c,html.escape(line),y,10.5,14,width=475)+15
 c.setFont('Arial',10);c.drawRightString(W-60,y-15,'Bremerhaven, 04.10.2026');y-=51
 y=para(c,'<b>Bewerbung um ein Schülerpraktikum vom 16.11. bis 27.11.2026</b>',y,12,17)
 y=para(c,'Sehr geehrte Damen und Herren,',y)
 ps=[
 'ich bewerbe mich um ein zweiwöchiges Schülerpraktikum in Ihrem Unternehmen vom 16. bis 27. November 2026. Zurzeit besuche ich die Klasse 9D der Wilhelm-Raabe-Schule in Bremerhaven.',
 f'Ich interessiere mich für {html.escape(j["interest"])}. Bei Ihnen möchte ich kennenlernen, {html.escape(j["detail"])}. Dabei würde ich gerne zuschauen und bei geeigneten Aufgaben unter Anleitung mithelfen.',
 'Im Mai 2026 habe ich an Werkstatttagen zur Berufsorientierung teilgenommen. Dort habe ich unter anderem die Bereiche Medien Bild und Ton sowie Tischler kennengelernt. Ich bin pünktlich, zuverlässig und arbeite sorgfältig. Neue Aufgaben lerne ich gerne.',
 'Bitte teilen Sie mir mit, ob Sie in dem genannten Zeitraum einen passenden Schülerpraktikumsplatz anbieten können. Über eine Rückmeldung und ein persönliches Gespräch freue ich mich.'
 ]
 for s in ps:y=para(c,s,y,11,15)
 y=para(c,'Mit freundlichen Grüßen<br/><br/><b>Alkhidir Al Ahmad</b>',y)
 text(c,60,y-1,'Anlage: Lebenslauf',10)
 assert y>55,(j['key'],y)
 c.save()
 cv=itcv if j['field']=='IT' else handcv
 forwarding=' Bitte leiten Sie meine Anfrage an die Praktikumsbetreuung am Standort Bremerhaven weiter.' if j['key'] in ('EUROGATE','Werner','Bobrink','USM') else ''
 body=f'<p>Sehr geehrte Damen und Herren,</p><p>ich bewerbe mich um ein <strong>Schülerpraktikum vom 16. bis 27. November 2026</strong> im Bereich <strong>{html.escape(j["interest"])}</strong> bei {html.escape(j["name"])}. Ich besuche die Klasse 9D der Wilhelm-Raabe-Schule in Bremerhaven.</p><p>Mich interessiert, {html.escape(j["detail"])}. Das individuell angepasste Anschreiben und meinen Lebenslauf finden Sie im Anhang.</p><p>Bitte teilen Sie mir mit, ob ein Praktikum in diesem Zeitraum möglich ist.{forwarding} Über eine Rückmeldung freue ich mich.</p><p>Mit freundlichen Grüßen<br>Alkhidir Al Ahmad<br>+49 1520 6860558<br>alkhidirea@gmail.com</p>'
 payload={'from_address':'alkhidirea@gmail.com','to':j['to'],'subject':f'Schülerpraktikum 16.-27.11.2026 - {j["interest"]} - Alkhidir Al Ahmad','payload':{'mime_type':'multipart/mixed','parts':[{'mime_type':'text/html','charset':'UTF-8','body':{'content':body}},*[{'mime_type':'application/pdf','filename':f.name,'content_disposition':'attachment','body':{'base64_url_content':base64.urlsafe_b64encode(f.read_bytes()).decode().rstrip('=')}} for f in (p,cv)]]},'response_fields':['id','thread_id','label_ids']}
 payloadfile=ROOT/f'tmp/pdfs/send20_{j["key"]}.json'
 payloadfile.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
 manifest.append({**j,'letter':str(p),'cv':str(cv),'payload':str(payloadfile),'bottom':y})
(ROOT/'tmp/pdfs/twenty_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'count':len(manifest),'letter_bottoms':{j['key']:j['bottom'] for j in manifest},'itcv':str(itcv)},ensure_ascii=False))
