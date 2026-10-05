import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: 'Raster- und Vektorbilder',
    summary: 'Warum Fotos beim Vergrößern unscharf werden, Logos aber nicht.',
    group: 'Die Grundlagen',
    body: `Es gibt zwei grundlegend verschiedene Arten, ein Bild auf einem Computer zu speichern.

## Rasterbilder

Ein Rasterbild ist ein Raster aus winzigen farbigen Quadraten, den Pixeln. Ein Foto vom Telefon ist vielleicht 4.000 Pixel breit und 3.000 hoch, das sind zwölf Millionen Pixel, jedes mit seiner eigenen Farbe. JPEG, PNG, WebP, AVIF, HEIC und GIF sind alles Rasterformate.

Rasterbilder eignen sich ideal für Fotos, bei denen sich jedes Pixel ein wenig vom nächsten unterscheiden kann. Ihre Grenze ist, dass die Zahl der Pixel feststeht. Wer ein Rasterbild verkleinert, wirft Pixel weg. Wer es vergrößert, muss Pixel erfinden, die nie da waren. Deshalb wirkt ein kleines Bild, das auf Bildschirmgröße gezogen wird, weich oder klötzchenhaft. Keine Software kann Details zurückholen, die nie aufgenommen wurden.

## Vektorbilder

Ein Vektorbild speichert keine Pixel. Es speichert Anweisungen: Zeichne hier einen Kreis, eine Kurve von diesem Punkt zu jenem, fülle diese Form mit Orange. SVG ist das verbreitetste Vektorformat im Web. Weil die Formen mathematisch beschrieben sind, lässt sich ein Vektorbild in jeder Größe zeichnen und bleibt vollkommen scharf.

Vektoren eignen sich für Logos, Symbole, Diagramme und Text. Für Fotos eignen sie sich nicht, denn ein Foto hat keine klaren Formen, die sich beschreiben ließen.

## Wie Universal Images damit umgeht

Universal Images arbeitet mit Rasterbildern. Wenn Sie eine SVG-Datei hinzufügen, zeichnet die App sie einmal in Pixel um, damit sie sich wie jedes andere Bild zuschneiden, skalieren und umwandeln lässt. Das Ergebnis ist ein Rasterbild. Wählen Sie die benötigte Größe also vor dem Export. Wenn Sie ein Logo in mehreren Größen brauchen, behalten Sie die ursprüngliche SVG-Datei und exportieren Sie jede Größe daraus, statt einen kleinen Export zu vergrößern.

## Eine nützliche Regel

- Verkleinern Sie nach Belieben. Ein verkleinertes Rasterbild sieht meist gut aus.
- Vergrößern Sie Rasterbilder möglichst nicht über ihre ursprüngliche Größe hinaus. Die App kann das zwar, echte Details kann sie aber nicht hinzufügen.
- Wenn Sie ein Vektororiginal haben, behalten Sie es. Es ist die Vorlage für alles Weitere.`,
  },
  {
    id: 'image-formats',
    title: 'JPEG, PNG, WebP, AVIF und HEIC: Welches Format wofür?',
    summary: 'Was jedes Format gut kann, und welches Sie beim Speichern wählen sollten.',
    group: 'Die Grundlagen',
    body: `Bildformate sind verschiedene Arten, Pixel in eine Datei zu packen. Jedes wägt anders ab zwischen Dateigröße, Qualität, Transparenz und wie breit es unterstützt wird.

## Die Formate

- **JPEG** ist das klassische Format für Fotos. Es nutzt verlustbehaftete Komprimierung, die Dateien klein hält, indem sie Details verwirft, die dem Auge kaum auffallen. Transparenz unterstützt es nicht. Fast alles kann ein JPEG öffnen.
- **PNG** nutzt verlustfreie Komprimierung, jedes Pixel bleibt also exakt erhalten. Es unterstützt Transparenz. Ideal ist es für Bildschirmfotos, Grafiken mit scharfen Kanten und Text sowie Freisteller. Als PNG gespeicherte Fotos sind meist viel größer als dasselbe Foto als JPEG.
- **WebP** ist ein neueres Format, das für das Web entwickelt wurde. Es kann verlustbehaftet oder verlustfrei sein und unterstützt Transparenz. Bei Fotos ist es in der Regel kleiner als ein JPEG ähnlicher Qualität. Alle aktuellen großen Browser unterstützen es, manche ältere Software aber nicht.
- **AVIF** ist noch neuer und ergibt bei ähnlicher Qualität oft kleinere Dateien als WebP. Die Unterstützung wächst, ist aber weniger verbreitet, und nicht jeder Browser kann AVIF-Dateien erstellen.
- **HEIC** ist das Format, das viele iPhones für Fotos verwenden. Es ist effizient, aber viele Websites und Windows-Programme können es nicht öffnen.
- **GIF** ist ein altes Format mit höchstens 256 Farben, am bekanntesten für kurze Animationen.

## Was Universal Images öffnen und speichern kann

Die App öffnet JPEG, PNG, WebP, AVIF, HEIC, GIF und SVG. Sie speichert als JPEG, PNG, WebP oder AVIF. AVIF wird nur angeboten, wenn Ihr Gerät es erstellen kann.

HEIC-Fotos werden beim Öffnen in ein JPEG hoher Qualität umgewandelt, damit der Rest der App mit ihnen arbeiten kann. Aus einem animierten GIF wird ein einzelnes Standbild.

## Was sollten Sie wählen?

- **Ein Foto, das Sie mit irgendwem irgendwo teilen:** JPEG.
- **Ein Foto für Ihre eigene Website:** WebP, oder AVIF, wenn Ihre Website es unterstützt.
- **Ein Logo, ein Bildschirmfoto oder alles mit Text:** PNG.
- **Ein Freisteller mit transparentem Hintergrund:** PNG oder WebP. JPEG kann keine Transparenz speichern.
- **Ein iPhone-Foto, das jemand nicht öffnen kann:** in JPEG umwandeln.

Die App zeigt eine Schätzung der Dateigröße an, während Sie Format und Qualität ändern. Es lohnt sich also, zwei oder drei Möglichkeiten auszuprobieren und zu vergleichen.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: 'Pixel, Auflösung und DPI',
    summary: 'Was Bildgröße auf dem Bildschirm und auf Papier wirklich bedeutet.',
    group: 'Die Grundlagen',
    body: `Mit dem Wort Auflösung meinen Menschen ganz unterschiedliche Dinge, und das sorgt für viel Verwirrung. Hier steht, worauf es tatsächlich ankommt.

## Entscheidend sind die Pixelmaße

Die wichtigste Angabe zu einem digitalen Bild sind seine Pixelmaße: wie viele Pixel breit und wie viele hoch, zum Beispiel 1920 mal 1080. Diese Zahl sagt Ihnen, wie viele Details das Bild enthält. Universal Images zeigt Pixelmaße an und arbeitet damit.

## DPI ist nur eine Anweisung für den Druck

DPI oder PPI bedeutet Punkte bzw. Pixel pro Zoll (inch). Es ist ein Vermerk, den manche Bilddateien enthalten und der einem Drucker sagt, wie groß er die Pixel drucken soll. An den Pixeln selbst ändert er nichts. Ein Bild mit 3.000 mal 2.000 Pixeln enthält genau dieselben Details, ob in seiner Datei 72 DPI oder 300 DPI steht. Der einzige Unterschied ist, wie groß es auf dem Papier herauskommt.

Auf dem Bildschirm wird die DPI-Angabe ignoriert. Ein Bildschirm zeigt einfach Pixel an.

## Die benötigte Größe berechnen

Für den Druck gilt als gängige Richtlinie etwa 300 Pixel pro Zoll bei Fotos, die man aus der Nähe betrachtet, und weniger bei Dingen, die man aus der Entfernung sieht, etwa Plakaten. Um die nötigen Pixel zu berechnen, multiplizieren Sie die Druckgröße in Zoll mit den Pixeln pro Zoll. Ein Zoll sind 2,54 cm.

1. Ein Foto von 6 mal 4 Zoll braucht bei 300 Pixeln pro Zoll 1800 mal 1200 Pixel.
2. Eine A4-Seite misst etwa 8,3 mal 11,7 Zoll und braucht bei 300 Pixeln pro Zoll also ungefähr 2480 mal 3508 Pixel.

Für Bildschirme und das Web überlegen Sie, wie viel Platz das Bild einnehmen wird. Ein Bild, das auf einer Webseite 800 Pixel breit angezeigt wird, braucht selten mehr als etwa das Doppelte, um auf Bildschirmen mit hoher Pixeldichte scharf zu bleiben. Alles darüber macht die Seite nur langsamer.

## Seitenverhältnis

Das Seitenverhältnis ist die Form des Bildes: die Breite im Vergleich zur Höhe, etwa 16:9 oder 1:1. Wenn Sie Breite und Höhe unterschiedlich stark ändern, wird das Bild gestaucht oder gedehnt. Universal Images hält das Verhältnis fest, sofern Sie nichts anderes wählen, und seine Vorlagen für soziale Medien schneiden das Bild auf die Form der jeweiligen Plattform zu, statt es zu verzerren.`,
  },
  {
    id: 'what-compression-does',
    title: 'Was macht Komprimierung eigentlich?',
    summary: 'Verlustbehaftete und verlustfreie Komprimierung, und was der Qualitätsregler ändert.',
    group: 'Die Grundlagen',
    body: `Ein unkomprimiertes Foto ist riesig. Zwölf Millionen Pixel, von denen jedes mehrere Bytes für seine Farbe braucht, ergeben Dutzende Megabytes. Mit Komprimierung machen Bildformate das handhabbar.

## Verlustfreie Komprimierung

Verlustfreie Komprimierung findet Muster und Wiederholungen und schreibt sie effizienter auf, ein wenig so, als schriebe man „100 blaue Pixel“, statt jedes einzeln aufzuzählen. Beim Öffnen des Bildes kehrt jedes Pixel genau so zurück, wie es war. PNG ist verlustfrei. Das funktioniert sehr gut bei Grafiken mit großen einfarbigen Flächen und viel weniger gut bei Fotos, in denen benachbarte Pixel selten identisch sind.

## Verlustbehaftete Komprimierung

Verlustbehaftete Komprimierung geht weiter und wirft Informationen weg, die Menschen kaum bemerken, etwa sehr feine Abstufungen in Farbe oder Struktur. JPEG sowie WebP und AVIF in ihren üblichen Modi sind verlustbehaftet. Das Ergebnis kann eine Datei sein, die um ein Vielfaches kleiner ist als das Original, mit kaum sichtbarem Unterschied. Die verworfenen Informationen sind für immer verloren.

## Der Qualitätsregler

Wenn Sie als JPEG, WebP oder AVIF speichern, legt der Qualitätsregler fest, wie viel der Encoder verwerfen darf. Höhere Qualität bedeutet eine größere Datei, in der mehr Details erhalten bleiben. Niedrigere Qualität bedeutet eine kleinere Datei und irgendwann sichtbare Probleme:

- klötzchenartige Quadrate in gleichmäßigen Flächen wie dem Himmel
- verwaschene feine Details, etwa bei Haaren oder Gras
- schwache Wellen um scharfe Kanten und Text

Der Zusammenhang ist nicht gleichmäßig. Ein Schritt nach unten ganz oben auf der Skala spart oft viel Platz ohne sichtbaren Unterschied, während ein Schritt nahe dem unteren Ende wenig spart und deutlich schlechter aussieht. PNG ist verlustfrei und hat daher keine Qualitätseinstellung.

## Praktische Tipps

- **Zuerst skalieren.** Die Pixelmaße auf das zu verkleinern, was Sie wirklich brauchen, spart meist weit mehr, als die Qualität zu senken.
- **Achten Sie auf die Schätzung.** Universal Images aktualisiert die erwartete Dateigröße, während Sie den Regler bewegen. Sehen Sie sich die Vorschau an und suchen Sie dann die niedrigste Einstellung, mit der Sie zufrieden sind.
- **Nicht immer wieder speichern.** Jedes verlustbehaftete Speichern verwirft ein wenig mehr. Wenn Sie weitere Änderungen vornehmen müssen, gehen Sie zurück zum Original, statt eine bereits komprimierte Kopie erneut zu bearbeiten.`,
  },
  {
    id: 'how-universal-images-works',
    title: 'So funktioniert Universal Images',
    summary: 'Wo die Arbeit stattfindet, was die KI-Werkzeuge tun, und wo ihre Grenzen liegen.',
    group: 'So funktioniert es',
    body: `Universal Images erledigt die gesamte Bildbearbeitung auf Ihrem eigenen Gerät. Es gibt keinen Server, der die Bilder verarbeitet. Wenn Sie ein Bild hinzufügen, liest die App die Datei, und jeder weitere Schritt geschieht in der App selbst.

## Skalieren und umwandeln

Die App zeichnet Ihr Bild in der gewählten Größe auf eine interne Leinwand und speichert es dann im gewählten Format und in der gewählten Qualität. Wenn sie ein Bild stark verkleinert, tut sie das in mehreren Halbierungsschritten statt auf einmal. So vermeidet sie die gezackten, flimmernden Kanten, die eine einzige große Verkleinerung erzeugen kann.

Zuschneiden funktioniert genauso: Nur der Teil innerhalb des Zuschnitts wird in das neue Bild gezeichnet. Die Vorlagen für soziale Medien schneiden das Bild zu und passen seine Größe an die Form der jeweiligen Plattform an, und Sie können es verschieben, um festzulegen, was im Bildausschnitt bleibt.

Der Stapelexport wendet Ihre gewählten Format- und Größeneinstellungen auf alle hinzugefügten Bilder an und lädt sie zusammen als eine ZIP-Datei herunter.

## Hintergrund entfernen

Hintergrund entfernen nutzt ein KI-Modell, das das Motiv von seinem Hintergrund trennt. Das Modell läuft auf Ihrem Gerät. Beim ersten Gebrauch muss die App das Modell unter Umständen herunterladen. Es ist groß und wird danach von Ihrem Gerät aufbewahrt, damit spätere Anwendungen schneller gehen. Dieser Download ist das Modell selbst, für alle dasselbe; Ihr Bild wird nirgendwohin gesendet.

Am besten funktioniert es bei einem klaren Motiv vor einem deutlich abgesetzten Hintergrund. Feine Haare, Glas und unruhige Szenen können es verwirren. Prüfen Sie deshalb die Kanten, bevor Sie das Ergebnis verwenden.

## Gesichter unkenntlich machen

Gesichter unkenntlich machen nutzt ein kleines Modell zur Gesichtserkennung, das ebenfalls auf Ihrem Gerät läuft, um Gesichter zu finden und sie dann weichzuzeichnen oder zu verpixeln. Sie können einzelne Gesichter ein- oder ausschalten und die Stärke ändern.

Die automatische Erkennung ist eine Hilfe, keine Garantie. Sie kann Gesichter übersehen, die klein, weit entfernt, abgewandt oder teilweise verdeckt sind. Sehen Sie sich das Ergebnis vor dem Teilen immer an, und verwenden Sie eine starke Einstellung: Eine leichte Unschärfe oder große, weiche Pixel können ein Gesicht erkennbar lassen.

## Bereiche mit Balken abdecken

Schwärzen legt deckende Balken über das Bild: Ziehen Sie über eine Stelle, um sie abzudecken, oder tippen Sie, um einen Balken abzulegen, den Sie dann verschieben oder in der Größe ändern. Das eignet sich für einen Namen, ein Kennzeichen, einen Bildschirm oder ein Gesicht, das die Erkennung übersehen hat. Die Farbe wählen Sie im Abschnitt „Redact areas“.

Während Sie bearbeiten, liegen die Balken obenauf und lassen sich noch verschieben; Ihr Original bleibt unverändert. Im heruntergeladenen Bild, in der Online-Sicherung und in Collagen sind sie fest in die Pixel eingezeichnet, sodass sich darunter nichts wiederherstellen lässt. Eine Sicherungsdatei von Universal Images ist anders: Sie enthält das Original mit noch verschiebbaren Balken. Teilen Sie daher nur das heruntergeladene Bild.

## Collagen

Das Collagen-Werkzeug ordnet mehrere Fotos nebeneinander, übereinander oder in einem Raster an, mit einstellbaren Abständen, Ecken und Hintergrund. Sie können die Collage herunterladen oder sie wieder zu Ihren Bildern hinzufügen, um sie zu skalieren oder umzuwandeln.

## Offline arbeiten

Skalieren, Zuschneiden, Umwandeln und das Lesen von Metadaten funktionieren ganz ohne Verbindung. Hintergrund entfernen und Gesichter unkenntlich machen brauchen nur für den ersten Download ihrer Modelle eine Verbindung.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: 'Foto-Metadaten und Standortdaten',
    summary: 'Was ein Foto darüber verraten kann, wo und wann es aufgenommen wurde, und wie Sie das entfernen.',
    group: 'Datenschutz und Sicherheit',
    body: `Die meisten Fotos enthalten mehr als nur das Bild. Kameras und Telefone schreiben zusätzliche Informationen in die Datei, die sogenannten Metadaten. Die verbreitetste Art heißt EXIF. Sie kann enthalten:

- Datum und Uhrzeit der Aufnahme
- Hersteller und Modell der Kamera oder des Telefons, manchmal eine Seriennummer
- Kameraeinstellungen wie Belichtung und Brennweite
- die Software, mit der das Foto bearbeitet wurde, und manchmal den Namen eines Urhebers oder Eigentümers
- **GPS-Koordinaten**, die zeigen, wo das Foto aufgenommen wurde, oft auf wenige Meter genau
- ein kleines Vorschaubild, das das ursprüngliche Bild noch zeigen kann, nachdem das Hauptbild zugeschnitten oder bearbeitet wurde

Vieles davon bleibt erhalten, wenn ein Foto per E-Mail oder als Datei verschickt wird. Manche Websites und Apps entfernen es beim Hochladen, viele aber nicht, und Sie können nicht immer erkennen, welche.

## Sehen, was ein Foto enthält

Universal Images kann Ihnen die Metadaten eines Fotos anzeigen und hebt die Teile hervor, die auf eine Person, einen Ort oder ein Gerät hinweisen. Enthält das Foto GPS-Koordinaten, zeichnet die App eine kleine Karte, die das Land zeigt und wo darin das Foto aufgenommen wurde.

Diese Karte wird aus Ländergrenzen gezeichnet, die mit der App mitgeliefert werden. Wenn sie angezeigt wird, erfährt also niemand, wo das Foto aufgenommen wurde. Wenn Sie mehr Details möchten, gibt es eine Schaltfläche, um auf die Region und den nächsten Ort heranzuzoomen. Ein Tippen darauf lädt eine Grenzdatei für dieses eine Land. In der Webversion der App bedeutet das, sie von der Website von Universal Images herunterzuladen. Die Anfrage nennt das Land, enthält aber keine Koordinaten, und sie geschieht nur, wenn Sie auf die Schaltfläche tippen. Die App schlägt nie eine Straßenadresse nach.

## Metadaten entfernen

Es gibt zwei Wege zu einer bereinigten Kopie:

- **Metadaten entfernen** im Metadaten-Bereich entfernt die Metadaten aus JPEG-, PNG- und WebP-Dateien, ohne das Bild neu zu komprimieren, die Bildqualität bleibt also unberührt. Farbinformationen, die für die korrekte Darstellung des Bildes nötig sind, bleiben erhalten.
- **Jeder Export** aus der App ist ein neu erstelltes Bild. Skalieren, Umwandeln, Zuschneiden oder einfach das Herunterladen über die App ergibt eine Datei, die die EXIF-Daten des Originals nicht enthält, auch nicht den Standort.

Eine Ausnahme sollten Sie kennen: Die Sicherung über Auf dem Desktop speichern behält absichtlich Ihr Originalbild, damit Sie später weiterbearbeiten können. Hatte das Original Standortdaten, hat die Sicherung sie auch. Entfernen Sie zuerst die Metadaten, wenn Ihnen das wichtig ist.`,
  },
  {
    id: 'what-leaves-your-device',
    title: 'Was Ihr Gerät verlässt',
    summary: 'Was genau auf Ihrem Gerät bleibt, und die wenigen Dinge, die online gehen.',
    group: 'Datenschutz und Sicherheit',
    body: `Universal Images ist so gebaut, dass Ihre Bilder bei Ihnen bleiben. Hier steht genau, was passiert.

## Bleibt auf Ihrem Gerät

- **Ihre Bilder.** Öffnen, Zuschneiden, Skalieren, Umwandeln, Metadaten entfernen, Collagen erstellen, Hintergründe entfernen und Gesichter unkenntlich machen geschieht alles auf Ihrem Gerät. Ihre Bilder werden nicht zur Verarbeitung hochgeladen.
- **Downloads und Sicherungen.** Herunterladen speichert das Ergebnis auf Ihrem Gerät. Auf dem Desktop speichern erstellt eine Sicherungsdatei, die Sie selbst aufbewahren.

## Downloads, die keine Uploads sind

Wenn Sie Hintergrund entfernen oder Gesichter unkenntlich machen zum ersten Mal verwenden, lädt die App das nötige KI-Modell unter Umständen aus einem Content Delivery Network herunter. Das Modell ist eine feste Datei, für alle dieselbe. Diese Server sehen, wie bei jedem Download, eine gewöhnliche Anfrage von Ihrer Verbindung, erhalten aber nicht Ihr Bild. Das Bild wird vom Modell auf Ihrem Gerät verarbeitet.

Wenn Sie die Standortkarte bis auf Regionsebene heranzoomen, lädt die Webversion der App die Grenzdatei eines Landes von der Website von Universal Images herunter. Diese Anfrage nennt das Land, nicht die Koordinaten des Fotos.

## Nur wenn Sie es wählen: online speichern

Wenn Sie sich mit Ihrer Universal ID anmelden und ein Bild bei UNI·SIM speichern, lädt die App das fertige Bild hoch, dasselbe, das Sie über die Schaltfläche Herunterladen bekommen würden, damit Sie es auf einem anderen Gerät wieder abrufen können. Bilder online zu speichern ist mit einer Universal ID kostenlos. Kostenlose Konten haben ein großzügiges Limit; sollten Sie es einmal erreichen, löschen Sie ein Bild, das Sie nicht mehr brauchen. Wenn Sie ein Bild löschen, wird es aus dem Speicher entfernt.

Das ist gewöhnlicher Cloud-Speicher und keine Ende-zu-Ende-Verschlüsselung. Die Daten sind bei der Übertragung und im Ruhezustand verschlüsselt, und der Zugriff ist auf Ihr Konto beschränkt, aber die Schlüssel liegen bei uns. Wenn Ihnen das bei einem bestimmten Bild wichtig ist, speichern Sie es nicht; die App funktioniert vollständig ohne Konto.

## Was jede Universal-App sendet

Solange die App geöffnet ist, sendet sie unserem Server ein kleines Signal, dass sie in Gebrauch ist, damit das Menü anzeigen kann, wie viele Menschen sie nutzen. Dieses Signal enthält den Namen der App, die Art des Geräts (Web, Telefon oder Desktop), eine auf diesem Gerät erzeugte Zufalls-ID und, wenn Sie angemeldet sind, Ihr Konto. Wenn Sie angemeldet sind, vermerkt die App außerdem für die Aktivitätsseite Ihres Kontos, dass Sie sie geöffnet haben. Keines von beiden enthält etwas über Ihre Bilder: weder ihre Namen noch ihre Größen oder Inhalte.

Die App enthält keine Analyse-, Tracking- oder Werbedienste von Drittanbietern.`,
  },
]

export default articles
