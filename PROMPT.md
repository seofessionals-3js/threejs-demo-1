# Startprompt · three.js Demo 6

Der Prompt, mit dem ich anfangen würde, um diese Demo nachzubauen. Er liefert nicht genau diese Seite, sondern eine erste Version der Idee. Danach beginnt die eigentliche Arbeit.

Ersetzen Sie die Teile in `[eckigen Klammern]` durch Ihr eigenes Thema.

```text
Ich möchte eine scrollgesteuerte Landingpage bauen für [einen Holzhausbauer, einen Fertighaushersteller, Ihr Thema].

Die Idee: Die Seite öffnet mit einer Explosionsaxonometrie, der Zeichnung, die man von
Wettbewerbsplänen kennt. Ein [zweigeschossiges Haus mit Satteldach] schwebt in sieben Schichten
über seinem eigenen Erdgeschossgrundriss: [Bodenplatte, Erdgeschoss, Obergeschoss, Verglasung,
Fassade, Sparren, Dach]. Weiße Tusche auf schwarzem Blatt, nummerierte Beschriftungen in einer
Spalte rechts und gepunktete Linien von jeder Schicht zu ihrem Landepunkt.

Der Scrollablauf, der Reihe nach:
1. Der Loader ist ein Plotter. Eine Stiftfront fährt das Modell vom Boden bis zum Dach hoch,
   erst Linien in Rot, dann weiße Tusche, dann die Flächen. Die Überschrift gleitet herein.
2. Die Schichten landen nacheinander in Bauabfolge. Alles über einer Schicht sinkt mit ihr.
   Die landende Schicht wird rot, und ihre Beschriftung leuchtet auf.
3. Die Kamera kommt zur [Terrasse] herunter. Das Objektiv weitet sich, bis die Zeichnung zu
   einem Raum auf Augenhöhe wird, und die große Glasschiebetür gleitet auf.
4. Der Rundgang: [Wohnen am Kamin, die Küche, die Treppe hinauf ins Dachstudio], mit einer
   Bildunterschrift an jeder Station, zum Schluss ein Blick zurück unter dem First.

Worauf es mir ankommt:
- Die Axonometrie ist kein Bild. Sie ist das echte 3D-Modell, gesehen durch ein 1,5-Grad-
  Objektiv aus etwa einem Kilometer Entfernung. Wird das Objektiv beim Heranfahren geweitet
  (Dolly-Zoom), entsteht eine Perspektive auf Augenhöhe.
- Bodenplatte, beide Geschosse und Dach schweben nach oben. Verglasung und Fassade gleiten
  seitlich aus ihrer eigenen Wand heraus, jeweils mit ihrem Geschoss.
- Innen bleibt es eine Zeichnung: weiße Kanten als Bildschirmlinien in drei Stärken, dunkle
  Flächen mit Maserung, die im Code gezeichnet wird.
- Nichts durchdringt sich: Die Kamera geht nur durch echte Öffnungen und hält Abstand zu
  Wänden und Möbeln, kein Bauteil steckt in einem anderen.
- Innen bleibt die Kamera waagerecht, und ein kleiner Grundriss in der Ecke zeigt, wo man
  steht, erst im Erdgeschoss, dann im Obergeschoss.
- Der Look: ein CAD-Bildschirm bei Nacht. Blatt #0c0c0e, Tusche #f1eeea, ein roter Akzent #e5202e,
  Chakra Petch für Überschriften, IBM Plex Mono für Beschriftungen, ein dünner Rahmen mit
  Eckmarken.
- three.js 0.169 von einem CDN, einfache Dateien, kein Build-Schritt. Ein einziger Scrollwert
  von 0 bis 1 steuert alles. Keine Bilddateien.

Bevor du Code schreibst, schlage das Haus mit Maßen vor, die ich mir vorstellen kann, und den
Kameraweg Station für Station, und warte auf meine Antwort. Dann baue in Etappen. Nur die
erste Etappe: der Plotter-Loader, das Landen der Schichten und der Dolly-Zoom zur [Terrasse].
Nimm es auf und zeig es mir, bevor du weitermachst.
```

Der letzte Absatz ist genauso wichtig wie die Idee. Ohne ihn bekommen Sie eine fertige Seite, die Sie nicht selbst ausgewählt haben.
