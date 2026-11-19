# Startprompt · three.js Demo 1

Der Prompt, mit dem ich anfangen würde, um diese Demo nachzubauen. Er liefert nicht genau diese Seite, sondern eine erste Version der Idee. Danach beginnt die eigentliche Arbeit.

Ersetzen Sie die Teile in `[eckigen Klammern]` durch Ihr eigenes Thema.

```text
Ich möchte eine scrollgesteuerte Landingpage bauen für [einen Holzhausbauer, einen Fertighaushersteller, Ihr Thema].

Die Idee: Die Seite öffnet mit einer Explosionsaxonometrie, der Zeichnung, die man von
Wettbewerbsplänen kennt. Ein [Holzhaus mit Satteldach] schwebt in sechs Schichten über seinem
eigenen Erdgeschossgrundriss: [Bodenplatte, Wände, Verglasung, Fassade, Sparren, Dach]. Tusche
auf hellem Papier, nummerierte Beschriftungen in einer Spalte rechts und gepunktete Linien von
jeder Schicht zu ihrem Landepunkt.

Der Scrollablauf, der Reihe nach:
1. Der Loader ist ein Plotter. Eine Stiftfront fährt das Modell vom Boden bis zum Dach hoch,
   erst Linien in Bernstein, dann Tusche, dann die Flächen. Die Überschrift gleitet herein.
2. Die Schichten landen nacheinander in Bauabfolge. Alles über einer Schicht sinkt mit ihr.
   Die landende Schicht wird bernsteinfarben, und ihre Beschriftung leuchtet auf.
3. Die Kamera kommt zur [Veranda] herunter. Das Objektiv weitet sich, bis die Zeichnung zu
   einem Raum auf Augenhöhe wird, und die Glastür gleitet auf.
4. Der Rundgang: [der Esstisch, der Ofen, die Leiter hinauf zur Galerie], mit einer
   Bildunterschrift an jeder Station, zum Schluss ein Blick zurück durch das Haus.

Worauf es mir ankommt:
- Die Axonometrie ist kein Bild. Sie ist das echte 3D-Modell, gesehen durch ein 1,5-Grad-
  Objektiv aus etwa einem Kilometer Entfernung. Wird das Objektiv beim Heranfahren geweitet
  (Dolly-Zoom), entsteht eine Perspektive auf Augenhöhe.
- Bodenplatte, Wände und Dach schweben nach oben. Verglasung und Fassade gleiten seitlich aus
  ihrer eigenen Wand heraus.
- Innen bleibt es eine Zeichnung: Kanten als Bildschirmlinien in drei Stärken, helle Flächen
  mit Maserung, die im Code gezeichnet wird.
- Innen bleibt die Kamera waagerecht, und ein kleiner Grundriss in der Ecke zeigt, wo man steht.
- Der Look: ein CAD-Bildschirm. Papier #f2efe7, Tusche #1d1c19, ein Bernstein-Akzent #e85d04,
  Chakra Petch für Überschriften, IBM Plex Mono für Beschriftungen, ein dünner Rahmen mit
  Eckmarken.
- three.js 0.169 von einem CDN, einfache Dateien, kein Build-Schritt. Ein einziger Scrollwert
  von 0 bis 1 steuert alles. Keine Bilddateien.

Bevor du Code schreibst, schlage das Haus mit Maßen vor, die ich mir vorstellen kann, und den
Kameraweg Station für Station, und warte auf meine Antwort. Dann baue in Etappen. Nur die
erste Etappe: der Plotter-Loader, das Landen der Schichten und der Dolly-Zoom zur [Veranda].
Nimm es auf und zeig es mir, bevor du weitermachst.
```

Der letzte Absatz ist genauso wichtig wie die Idee. Ohne ihn bekommen Sie eine fertige Seite, die Sie nicht selbst ausgewählt haben.
