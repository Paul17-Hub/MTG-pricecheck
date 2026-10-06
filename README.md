# Wantlist prijzen (PWA)

Tabblad **Alle kaarten**: al je wantlist-kaarten in één lijst (met optioneel deck), met hover-plaatje, groot plaatje bij klik,
prijs en koopadvies. Klik op een rij om de uitvoeringen met prijzen te zien. Tabblad **Zoeken**: typ of scan een kaart.
Lijsten voeg je toe met **Lijst importeren**: plak tekst (bijv. `1 Sol Ring` of `1 Sol Ring (CMM) 410`) of kies een CSV-bestand (kolommen worden herkend). Elke prijs heeft een link naar de bron.

Bronnen
- Cardmarket price guide (officieel downloadbestand): Price Trend en 7/30-daggemiddelde.
- Scryfall: kaartdata en plaatjes. Koppeling via het Cardmarket-id.

## Online zetten (gratis, GitHub Pages)
1. Maak een GitHub-repository en zet deze map erin (de map `data/` staat in .gitignore).
2. Repository > Settings > Pages > Source: **GitHub Actions**.
3. Start de workflow één keer handmatig (Actions > "Dagelijkse prijs-sync" > Run workflow). Daarna draait hij elke dag om 05:30 UTC.
4. Open het Pages-adres op je telefoon en kies "Zet op beginscherm". Op je computer kan dat in Chrome of Edge ook.

De app haalt bij openen zelf de nieuwste prijzen op als de laatste sync meer dan ~20 uur geleden is. Daarna staat alles op je toestel.

## Lokaal proberen
    node scripts/sync.mjs                       # maakt data/cards.json (Node 20+)
    python3 -m http.server 8000                 # open http://localhost:8000

## Goed om te weten
- De Cardmarket-prijslijst heeft geen conditie- of taalonderscheid. De getoonde prijs is dus de trend over alle condities en
  GEEN Near Mint- of Excellent-prijs. De link naar de bron opent precies die uitvoering op Cardmarket.
- "Verzending standaard" en "Beurskorting" (standaard 5%) stel je zelf in; de grens voor een goede deal is (trend + verzending) min de korting.
- Foil: alleen kaarten die uitsluitend in foil bestaan krijgen foil-prijzen.
- De wantlist staat per toestel. Gebruik **Back-up** om hem over te zetten.
- Scannen: leest de naam en daarna setcode + kaartnummer linksonder (moderne kaarten) en kiest dan de exacte uitvoering. Werkt alleen via https.
