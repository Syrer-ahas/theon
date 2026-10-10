from pathlib import Path
exec(Path('tmp/pdfs/build_application.py').read_text(encoding='utf-8').split('cv=OUT/')[0])
import html, subprocess
rows=[
 ('MWB','MWB Elektrotechnik Service GmbH','Rudloffstraße 49','27568 Bremerhaven','bewerbung@mwb-elektrotechnik.de','Elektrotechnik','Ich möchte den Beruf des Elektronikers und den Arbeitsalltag in einem elektrotechnischen Betrieb kennenlernen. Besonders interessieren mich technische Anlagen, die Fehlersuche und die Zusammenarbeit in der Werkstatt. Bei Ihnen würde ich gerne beobachten, wie Fachkräfte elektrische Anlagen prüfen und instand halten, und bei geeigneten Aufgaben unter Anleitung mithelfen.'),
 ('Schmidt_Koch','Schmidt + Koch GmbH - Autohaus Bremerhaven','Stresemannstraße 122','27576 Bremerhaven','bewerbung@schmidt-und-koch.de','Kfz-Mechatronik','Ich interessiere mich für den Beruf des Kfz-Mechatronikers und möchte den Arbeitsalltag in Ihrer Werkstatt in Bremerhaven kennenlernen. Besonders spannend finde ich, wie Fahrzeuge gewartet, Fehler erkannt und Reparaturen vorbereitet werden. Gerne würde ich Ihren Fachkräften über die Schulter schauen und bei geeigneten Aufgaben unter Anleitung mithelfen.'),
 ('Muth_Bahr','Muth & Bahr Haustechnik GmbH','Schillerstraße 12','27570 Bremerhaven','buero@muth-bahr.de','Sanitär-, Heizungs- und Klimatechnik','Ich möchte den Beruf des Anlagenmechanikers für Sanitär-, Heizungs- und Klimatechnik kennenlernen. An Ihrem Betrieb in Geestemünde interessieren mich besonders die Arbeiten an Heizungsanlagen, Wärmepumpen und Badezimmern. Gerne würde ich erfahren, wie Montage und Wartung vorbereitet werden, und Ihr Team bei geeigneten Aufgaben unter Anleitung unterstützen.'),
 ('Heinen_Energy','Heinen-Energy','Sommerstraße 4','27568 Bremerhaven','kontakt@heinen-energy.de','Sanitär-, Heizungs- und Klimatechnik','Ich interessiere mich für den Beruf des Anlagenmechanikers für Sanitär-, Heizungs- und Klimatechnik. Bei Ihnen möchte ich kennenlernen, wie Heizungs- und Sanitäranlagen installiert, gewartet und modernisiert werden. Besonders interessiert mich, wie Ihr Team technische Probleme löst und die Arbeit bei Kunden organisiert. Bei geeigneten Aufgaben würde ich gerne unter Anleitung mithelfen.'),
 ('Ahrens','Ahrens Hoch- & Tiefbau GmbH','Bahnhofstraße 25','27572 Bremerhaven','bewerbung@ahrens-gmbh.de','Maurer- und Hochbauarbeiten','Ich möchte praktische Bauberufe kennenlernen, insbesondere den Beruf des Maurers oder Hochbaufacharbeiters. Ihre Arbeiten im Hoch-, Beton- und Sanierungsbau interessieren mich, weil dabei sichtbare Ergebnisse entstehen. Gerne würde ich erfahren, wie Materialien und Werkzeuge eingesetzt und Bauarbeiten vorbereitet werden, und bei für Schüler geeigneten Aufgaben unter Anleitung mithelfen.')
]
cv=OUT/'Lebenslauf_Handwerk_Alkhidir_Al_Ahmad.pdf'
assert cv.exists()
manifest=[]
for key,name,street,city,email,area,motivation in rows:
 letter=OUT/f'Bewerbung_{key}_Alkhidir_Al_Ahmad.pdf'
 c=canvas.Canvas(str(letter),pagesize=A4)
 c.setTitle(f'Bewerbung Schülerpraktikum - {name}');c.setAuthor('Alkhidir Al Ahmad')
 header(c,'Verdener Straße 15 | 27570 Bremerhaven')
 text(c,60,H-116,'+49 1520 6860558 | alkhidirea@gmail.com',10)
 y=H-156
 # Split long company names to preserve the right margin.
 companylines=['Schmidt + Koch GmbH','Autohaus Bremerhaven'] if key=='Schmidt_Koch' else [html.escape(name)]
 for s in companylines+[street,city]:
  y=para(c,s,y,11,15);y+=15
 c.setFont('Arial',10);c.drawRightString(W-60,y-18,'Bremerhaven, 03.10.2026')
 y-=54
 y=para(c,'<b>Bewerbung um ein Schülerpraktikum vom 16.11. bis 27.11.2026</b>',y,12,17)
 y=para(c,'Sehr geehrte Damen und Herren,',y)
 paragraphs=[
  'ich bewerbe mich um ein zweiwöchiges Schülerpraktikum in Ihrem Betrieb in Bremerhaven. Zurzeit besuche ich die Klasse 9D der Wilhelm-Raabe-Schule. Das Schulpraktikum findet vom 16. bis 27. November 2026 statt.',
  motivation,
  'Ich bin pünktlich, zuverlässig und arbeite sorgfältig. Neue Aufgaben lerne ich gerne. Ein freundlicher Umgang und gute Zusammenarbeit sind mir wichtig. Ich möchte das Praktikum nutzen, um erste praktische Erfahrungen zu sammeln und herauszufinden, welcher handwerkliche Beruf zu mir passt.',
  'Bitte teilen Sie mir mit, ob Sie mir in diesem Zeitraum einen geeigneten Schülerpraktikumsplatz anbieten können. Über eine Rückmeldung und die Möglichkeit eines persönlichen Gesprächs freue ich mich.'
 ]
 for s in paragraphs:y=para(c,s,y,11,15)
 y=para(c,'Mit freundlichen Grüßen<br/><br/><b>Alkhidir Al Ahmad</b>',y)
 text(c,60,y-2,'Anlage: Lebenslauf',10)
 assert y>55,(key,y)
 c.save()
 forward=' Bitte leiten Sie meine Unterlagen bei Bedarf an die zuständige Praktikumsbetreuung des Autohauses Bremerhaven weiter.' if key=='Schmidt_Koch' else ''
 body=f'<p>Sehr geehrte Damen und Herren,</p><p>ich bewerbe mich um ein <strong>Schülerpraktikum vom 16. bis 27. November 2026</strong> in Ihrem Betrieb in Bremerhaven im Bereich <strong>{html.escape(area)}</strong>.</p><p>Ich besuche die Klasse 9D der Wilhelm-Raabe-Schule und möchte einen handwerklichen Beruf kennenlernen. Mein individuell angepasstes Bewerbungsschreiben und meinen Lebenslauf finden Sie als PDF im Anhang.</p><p>Bitte teilen Sie mir mit, ob für diesen Zeitraum ein geeigneter Praktikumsplatz möglich ist.{forward} Über eine Rückmeldung freue ich mich.</p><p>Mit freundlichen Grüßen<br>Alkhidir Al Ahmad<br>Telefon: +49 1520 6860558<br>E-Mail: alkhidirea@gmail.com</p>'
 payload={'from_address':'alkhidirea@gmail.com','to':email,'subject':f'Bewerbung Schülerpraktikum 16.-27.11.2026 - {area} - Alkhidir Al Ahmad','payload':{'mime_type':'multipart/mixed','parts':[{'mime_type':'text/html','charset':'UTF-8','body':{'content':body}},*[{'mime_type':'application/pdf','filename':p.name,'content_disposition':'attachment','body':{'base64_url_content':base64.urlsafe_b64encode(p.read_bytes()).decode().rstrip('=')}} for p in [letter,cv]]]},'response_fields':['id','thread_id','label_ids']}
 payloadfile=ROOT/f'tmp/pdfs/payload_{key}.json'
 payloadfile.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
 subprocess.run(['C:/Users/alkhi/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe','-scale-to','1100','-singlefile','-png',str(letter),str(ROOT/f'tmp/pdfs/qa_{key}')],check=True)
 manifest.append({'key':key,'company':name,'email':email,'area':area,'letter':str(letter),'payload':str(payloadfile),'bottom':y})
(ROOT/'tmp/pdfs/five_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
