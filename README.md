# three.js Demo 1

Eine Explosionsaxonometrie eines zweigeschossigen Hauses, mit weißer Tusche auf ein schwarzes Blatt geplottet. Beim Scrollen landen die sieben Schichten nacheinander in Bauabfolge. Dann weitet sich das Objektiv, bis die Zeichnung zum Raum wird, die große Glasschiebetür gleitet auf, und Sie gehen hinein, die Treppe hinauf und bis unter den First.

[**Live ansehen**](https://seofessionals-3js.github.io/threejs-demo-1/?dir=a) · [**Startprompt**](PROMPT.md) · [**Alle Demos**](https://seofessionals-3js.github.io/threejs-demos/)

Drei Varianten mit demselben Code:

- `?dir=a` Das Planblatt: Haus Karbon, zwei Geschosse unter einem Satteldach (die Hauptdemo)
- `?dir=b` Die Abwicklung: die Wandansichten einer Küche falten sich zu einem Raum, in den Sie hineingehen
- `?dir=c` Geschossweise: ein fünfgeschossiger Holzbau stapelt sich um seinen Kern

## Das Haus in Variante A

10,0 × 7,2 m, zwei Ebenen, 128 m². Unten ein offener Raum: Wohnen am Kaminblock aus Sichtbeton, Küche mit Kochinsel, Esstisch für sechs. Die Ostseite ist eine Glasfront mit zwei roten Schiebeflügeln, zusammen 3,40 m breit. An der Westwand führt eine Faltwerktreppe mit Stahlstäben ins Dachstudio: Bücherwand unter der Traufe, Arbeitsplatz am Bandfenster, das Bett unter dem Giebelfenster.

Sieben Schichten: Boden, Erdgeschoss, Obergeschoss, Verglasung, Fassade, Dachtragwerk, Dach.

## So funktioniert es

- **Eine Axonometrie ist ein langes Objektiv.** Die Zeichnung ist das echte 3D-Haus, gesehen durch ein 1,5°-Objektiv aus etwa 1,5 km Entfernung. Wird das Objektiv geweitet und der Bildausschnitt gehalten (Dolly-Zoom), laufen die Linien zusammen, und aus der Axonometrie wird eine Perspektive auf Augenhöhe.
- **Die Schichten bewegen sich nach Ebene.** Bodenplatte, beide Geschosse, Sparren und Dach heben sich mit ihrer Ebene. Verglasung und Fassade gehören zu ihrem Geschoss und gleiten entlang ihrer eigenen Wand heraus. Landet eine Schicht, sinkt alles darüber mit.
- **Der Plotter-Loader** ist eine Zeichenfront in jedem Material (`patchLine`, `patchFill` in `core.js`): Nichts jenseits der Front wird gezeichnet, und Linien nahe der Front erscheinen in Rot.
- **Es bleibt eine Zeichnung.** Kanten sind Bildschirmlinien in drei Stärken, weiß auf dunklen Flächen. Die Flächen tragen prozedurale Maserung, Schalungsfugen, Stehfalze und Gewebe sowie gebackenes Licht. Keine Lichter, keine Schatten. Nur das Kaminfeuer bewegt sich von selbst.
- **Der Rundgang** folgt einer weichen Kurve durch die Stationen statt gerader Strecken, mit einer Bildunterschrift an jeder Station. Der kleine Grundriss in der Ecke wechselt beim Hinaufgehen vom Erdgeschoss zum Obergeschoss.
- **Nichts durchdringt sich.** Die Kamera hält auf dem ganzen Weg mindestens 40 cm Abstand zu jeder Fläche. Sparren, Dachpaneele und Firstblech sind am First lotrecht geschnitten statt ineinandergeschoben, und lange Kanten werden in kurze Stücke geteilt (`shortSegs` in `core.js`), damit keine Linie durch eine Wand scheint.

## Farben

Schwarz, Weiß und Rot, in allen drei Varianten.

| | Farbe | Verwendung |
|---|---|---|
| Blatt | `#0c0c0e` | Hintergrund, Papier |
| Flächen | `#161618` bis `#6a645d` | Kohlelärche, Zink, Wände, Räuchereiche, Beton, Sparren |
| Tusche | `#f1eeea` | Linien, Schrift |
| Weiß | `#e7e4df` | Polster, Steinplatten, Leuchten |
| Rot | `#e5202e` | Stift, landende Schicht, Türrahmen, Akzente |

Die Varianten B und C sind beleuchtete Szenen. Dort stellt eine Farbkorrektur im Material (`patchFill`) alles auf neutrale Grautöne und lässt nur warme, satte Farben als Rot stehen.

## Dateien

`index.html`, `sketch.css`, `main.js` (Loader, Scrollen, Radar), `core.js` (Renderer, Plotter, Materialien, Kamera), `dir-a.js`, `dir-b.js`, `dir-c.js` (eine Datei pro Variante). Etwa 118 KB für die Hauptdemo.

`?p=0.6` friert den Scrollfortschritt bei 60 % ein.

## Lokal starten

Die Seiten nutzen JavaScript-Module und brauchen deshalb einen lokalen Server. Ein Doppelklick auf `index.html` funktioniert nicht.

```bash
python -m http.server 8000
```

Dann http://localhost:8000/ öffnen. Am besten auf einem Laptop mit aktuellem Browser.

## Herkunft und Lizenz

Basiert auf „Exploded House“ aus [flat-to-3d](https://github.com/Sam1983Aing/flat-to-3d) von Samnang Aing, veröffentlicht unter der MIT-Lizenz, und ins Deutsche übersetzt. Das Haus in Variante A ist neu entworfen, Aufbau, Animationen und Effekte folgen der Vorlage. Die Lizenz liegt unverändert in [LICENSE](LICENSE).

Alle Büros, Häuser, Adressen und Kontaktdaten in der Demo sind erfunden. three.js (MIT) wird von einem CDN geladen, die Schriften Chakra Petch und IBM Plex Mono von Google Fonts (SIL Open Font License).
