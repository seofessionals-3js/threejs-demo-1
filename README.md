# seofessionals three.js Demo 1

Eine Explosionsaxonometrie eines Holzhauses, mit Tusche geplottet. Beim Scrollen landen die sechs Schichten nacheinander in Bauabfolge. Dann weitet sich das Objektiv, bis die Zeichnung zum Raum wird, die Glastür gleitet auf, und Sie gehen hinein und hinauf auf die Galerie.

[**Live ansehen**](https://seofessionals-3js.github.io/seofessionals-threejs-demo-1/?dir=a) · [**Startprompt**](PROMPT.md) · [**Alle Demos**](https://seofessionals-3js.github.io/seofessionals-threejs-demos/)

Drei Varianten mit demselben Code:

- `?dir=a` Das Planblatt: das Holzhaus (die Hauptdemo)
- `?dir=b` Die Abwicklung: die Wandansichten einer Küche falten sich zu einem Raum, in den Sie hineingehen
- `?dir=c` Geschossweise: ein fünfgeschossiger Holzbau stapelt sich um seinen Kern

## So funktioniert es

- **Eine Axonometrie ist ein langes Objektiv.** Die Zeichnung ist das echte 3D-Haus, gesehen durch ein 1,5°-Objektiv aus etwa 1,26 km Entfernung. Wird das Objektiv geweitet und der Bildausschnitt gehalten (Dolly-Zoom), laufen die Linien zusammen, und aus der Axonometrie wird eine Perspektive auf Augenhöhe.
- **Die Schichten bewegen sich nach Ebene.** Bodenplatte, Wände, Sparren und Dach heben sich mit ihrer Ebene. Verglasung und Fassade gleiten entlang ihrer eigenen Wand heraus. Landet eine Schicht, sinkt alles darüber mit.
- **Der Plotter-Loader** ist eine Zeichenfront in jedem Material (`patchLine`, `patchFill` in `core.js`): Nichts jenseits der Front wird gezeichnet, und Linien nahe der Front erscheinen in Bernstein.
- **Es bleibt eine Zeichnung.** Kanten sind Bildschirmlinien in drei Stärken, die Flächen sind hell mit prozeduraler Maserung und gebackenem Licht. Keine Lichter, keine Schatten.
- **Der Rundgang** bewegt sich geradlinig zwischen Augenpunkten, mit einer Bildunterschrift an jeder Station und einem kleinen Grundriss in der Ecke.

## Dateien

`index.html`, `sketch.css`, `main.js` (Loader, Scrollen, Radar), `core.js` (Renderer, Plotter, Materialien, Kamera), `dir-a.js`, `dir-b.js`, `dir-c.js` (eine Datei pro Variante). Etwa 95 KB für die Hauptdemo.

`?p=0.6` friert den Scrollfortschritt bei 60 % ein.

## Lokal starten

Die Seiten nutzen JavaScript-Module und brauchen deshalb einen lokalen Server. Ein Doppelklick auf `index.html` funktioniert nicht.

```bash
python -m http.server 8000
```

Dann http://localhost:8000/ öffnen. Am besten auf einem Laptop mit aktuellem Browser.

## Herkunft und Lizenz

Basiert auf „Exploded House“ aus [flat-to-3d](https://github.com/Sam1983Aing/flat-to-3d) von Samnang Aing, veröffentlicht unter der MIT-Lizenz, und für seofessionals ins Deutsche übersetzt. Die Lizenz liegt unverändert in [LICENSE](LICENSE).

Alle Büros, Häuser, Adressen und Kontaktdaten in der Demo sind erfunden. three.js (MIT) wird von einem CDN geladen, die Schriften Chakra Petch und IBM Plex Mono von Google Fonts (SIL Open Font License).
