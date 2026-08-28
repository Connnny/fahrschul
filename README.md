# 🚗 Fahrschul Assistent

Eine lokale Web-App für Fahrschüler (Klasse B): **Fragennummer eingeben → Frage, richtige Antwort(en) und Erklärung anzeigen.**

Enthält den **kompletten aktuellen amtlichen Fragenkatalog für Klasse B** (Stand 01.04.2025):
**1.167 Fragen** (606 Grundstoff + 561 Zusatzstoff) – mit offizieller Klassen-Zuordnung,
aktuellen Texten und Erklärungen, aufbereitet aus den öffentlichen Erklärungs-Seiten von
[fuehrerschein-bestehen.de](https://www.fuehrerschein-bestehen.de).

## Funktionen

- **🔍 Suche** (Suchfeld immer sichtbar im Kopfbereich): Fragennummer eingeben
  (z. B. `1.4.41-175`) → **Trefferliste**, mit **Enter** oder Klick öffnest du die Frage.
  - Offizielle Nummer (`1.4.41-175`), nur Kapitel (`1.4.41`), ohne Trennzeichen (`1102051`),
    Teilnummer inkl. Varianten `-M`/`-B` (`1.2.36-015` → `1.2.36-015-M`), Endziffern-Fallback
    (`41175` → `1.4.41-175`) oder laufende Nummer (`944` / `Frage 944` / `Nr. 944`).
  - Volltextsuche über Fragentext, Erklärung, Kapitel- und Themenname (z. B. „Bremsweg").
  - **Kein Auto-Sprung beim Tippen** – erst Enter oder Klick öffnet eine Frage.
  - In der geöffneten Frage deckt **Enter** die Antwort auf.
- **📚 Themen**: Katalog nach Themenbereich → Kapitel durchblättern.
- **🎲 Zufall**: Zufällige Frage zum Selbsttest.
- **⭐ Favoriten**: Fragen markieren und sammeln (lokaler Browser-Speicher).
- **Antwort-Feedback**: Richtige Antworten grün, selbst gewählte falsche rot, Punkte-Badge,
  **Erklärung pro Antwort** (wie beim Original) + 🧠-Zusammenfassung, Bild-Antworten und Videofragen.
- Direktlink: `index.html?q=1.4.41-175` öffnet die App mit dieser Frage.

## Starten

**Am einfachsten:** `index.html` im Browser öffnen (Doppelklick) – alles läuft lokal.
Nur Bilder/Videos werden aus dem Internet geladen (Quell-CDN).

**Oder mit lokalem Server** (empfohlen):

```
python -m http.server 8090
```

Dann http://localhost:8090 öffnen.

---

## 🧩 Chrome-Extension (Split-Screen mit dem Fahrschul-Portal)

Die Extension öffnet ein **Seiten-Panel** (Split-Screen am Browserrand) und erkennt die
**aktuelle Frage automatisch – ganz ohne Klick**. Die **Antwort erscheint erst, wenn du
im Portal „Weiter" drückst** (danach zeigt das Panel die Lösung mit Erklärung pro Antwort).
Zusätzlich gibt es im Panel eine Suchfunktion sowie die bisherige Funktion:
Klick auf den „Antwort"-Knopf der Seite blendet die Lösung direkt am Ende der Frage ein.

**Einrichten:**

```
node tools/build-extension.mjs        # kopiert Katalog + Logik in den Ordner
```

1. In Chrome öffnen: `chrome://extensions`
2. Oben rechts **Entwicklermodus** aktivieren
3. **„Entpackte Erweiterung laden"** → Ordner `chrome-extension` wählen
4. **Klick aufs Extension-Symbol** öffnet das Seiten-Panel (Split-Screen)

*Hinweis: Eine Chrome-Extension läuft im Browser – in der Android-App selbst nicht.
Das Panel funktioniert auf jeder Webseite mit Fragennummern.*

Tests: `node tools/e2e-extension.mjs` (Content-Script) + `node tools/e2e-sidepanel.mjs` (Panel).

---

## 🤖 Telegram-Bot (Antwort + Erklärung per Nachricht)

Schick dem Bot eine Nummer und du bekommst Frage, richtige Antwort und Erklärung zurück:

- offizielle Nummer: `1.4.41-175`
- laufende Nummer: `944` oder `Frage 944`
- Suchbegriff: `Bremsweg`

**Einrichten (einmalig, ~3 Minuten):**

1. In Telegram @BotFather öffnen, `/newbot`, Namen wählen → du bekommst einen **Token**
2. Token in die Datei `tools/bot-token.txt` schreiben (nur der Token, ohne Leerzeichen)
3. Bot starten (Long-Polling – kein Server/HTTPS nötig):

```
node tools/telegram-bot.mjs
```

4. In Telegram den Bot anschreiben und loslegen.

**Schnellstart:** Auf dem Desktop liegt `start.bat` – ein Doppelklick startet den Bot.

*Hinweis: Der Bot läuft nur, solange dein PC an ist und das Skript läuft.
Für Dauerbetrieb müsste er auf einem Server laufen (z. B. Raspberry Pi, VPS).*

Test der Logik: `node tools/test-bot.mjs`

---

## 📱 iOS-App (PWA – ohne Mac bauen!)

**Ehrliche Einordnung:** Eine echte native iOS-App (App Store / TestFlight) braucht einen
**Mac mit Xcode** und eine Apple-Entwickler-ID – das geht auf Windows nicht.
**Aber:** Mit einer **PWA** (Progressive Web App) bekommst du auf dem iPhone genau das
App-Erlebnis: eigenes Icon auf dem Home-Screen, Vollbild, **100 % offline und lokal**
(der komplette Katalog liegt auf dem Gerät, kein Server zur Laufzeit nötig).

Die Übungs-App im Ordner `ios-app/` funktioniert so:
- **Eine Zufallsfrage pro Runde** (Klasse B, aktueller Katalog)
- Antwort antippen oder eintippen (Zahleneingabe-Fragen)
- **Falsch? → Sofort wird erklärt, was richtig und was falsch war** (Erklärung pro Antwort)

**Bauen & aufs iPhone bringen:**

```
node tools/build-pwa.mjs        # kopiert Katalog + Icons in ios-app/
python -m http.server 8090 --bind 0.0.0.0     # Server im WLAN freigeben
```

1. iPhone im **gleichen WLAN** wie der PC
2. Safari öffnen → `http://10.0.1.10:8090/ios-app/`
3. **Teilen-Button** (□↑) → **„Zum Home-Bildschirm"** → hinzufügen
4. App-Icon auf dem Home-Screen öffnen – läuft wie eine native App

**Hinweis zur Offline-Fähigkeit:** iOS registriert Service Worker nur auf **HTTPS**.
Über das WLAN-LAN (http) funktioniert die App im Safari-Cache – für garantierte
Offline-Nutzung die `ios-app` zusätzlich auf einen kostenlosen HTTPS-Hoster legen
(z. B. GitHub Pages / Cloudflare Pages): Die Daten bleiben trotzdem auf dem Gerät,
nur der einmalige Download kommt vom Hoster.

Test des Quiz-Flows: `node tools/e2e-pwa.mjs`

---

## 🖥️ Auf dem VPS hosten (öffentlich + Bot 24/7)

Nutzt du einen VPS statt einem lokalen PC, gibt es ein fertiges Deploy-Paket:

- **Web-App + iOS-PWA** mit automatischem **HTTPS** (Caddy) → iOS-Offline funktioniert garantiert
- **Telegram-Bot** als Systemdienst (läuft 24/7, startet neu bei Abstürzen)
- **cloudflared-Tunnel** als Schnelltest ohne Domain

Alles unter [`deploy/`](deploy/README.md) – Anleitung und fertige Dateien
(`install.sh`, `Caddyfile`, `fahrschul-bot.service`).

---

## Projektstruktur

```
index.html              Einstieg (Web-App)
css/style.css           Styling (Web-App)
js/core.js              Such- und Datenlogik (ohne DOM, getestet)
js/app.js               Oberfläche (Web-App)
data/questions.js       generierter Klasse-B-Katalog (Stand 01.04.2025)
data/klasse-b-ids.json  Liste der Klasse-B-Fragennummern
data/_source/           Rohdaten (2021-Katalog, gescrapte Seiten, Sitemap)
chrome-extension/       Chrome-Extension (Side-Panel Split-Screen, content-script)
ios-app/                Übungs-App fürs iPhone (PWA: Quiz mit Erklärungen, offline)
tools/scrape-fsb.mjs    Scraper: Erklärungs-Seiten → data/_source/fsb-current.jsonl
tools/build-from-fsb.mjs  Baut daraus data/questions.js (B-Filter + aktueller Inhalt)
tools/build-extension.mjs Kopiert Katalog in die Chrome-Extension
tools/build-pwa.mjs     Kopiert Katalog + Icons in die PWA (ios-app)
tools/make-icons.ps1    Erzeugt App-Icons (Lenkrad)
tools/telegram-bot.mjs  Telegram-Bot (Long-Polling)
tools/smoke-test.cjs    Logik-Tests (node tools/smoke-test.cjs)
tools/test-bot.mjs      Bot-Logik-Tests (node tools/test-bot.mjs)
tools/e2e-test.mjs      Browser-End-to-End-Test der Web-App
tools/e2e-extension.mjs Test des Content-Scripts (Headless-Chrome)
tools/e2e-pwa.mjs       Test der PWA-Quiz-App
deploy/                 VPS-Paket (Caddyfile, systemd-Dienst, install.sh, Anleitung)
testpage.html           Testseite für den Extension-Test
```

Nach Aktualisierung der Quellen neu bauen:

```
node tools/scrape-fsb.mjs        # lädt alle Erklärungs-Seiten (resumierbar)
node tools/build-from-fsb.mjs    # erzeugt data/questions.js (Klasse B)
```

## Datenqualität

- **Klassen-Zuordnung:** pro Frage aus dem Stoffgebiet der Erklärungs-Seite
  („Grundstoff" gilt für alle Klassen; „Zusatzstoff B …" nur für B). Veraltete Fragen
  („seit … nicht mehr im Fragenkatalog") werden ausgeschlossen.
- Ergebnis: **1.167 B-Fragen** – offizieller Stand (Grundstoff 605 / Zusatzstoff 563,
  geringfügige Abweichung durch Varianten-Zählung).
- Die Erklärungen stammen aus den öffentlichen Seiten von fuehrerschein-bestehen.de
  (eigene Texte dieser Seite, nur zur privaten Lernunterstützung).

## Hinweise

- **Fragennummern deiner Fahrschul-App:** Apps zeigen teils eigene laufende Nummern
  (z. B. „Frage 7161" bei 360° online). Diese sind app-intern und nicht öffentlich ableitbar –
  nutze einfach die **offizielle Nummer**, die in den meisten Apps klein mit angezeigt wird
  (z. B. `1.2.36-015`). Die Suche danach funktioniert hier zuverlässig.
- Nur zur Lernunterstützung. Für die offizielle Prüfungsvorbereitung die aktuellen amtlichen
  Unterlagen der Fahrschule bzw. offizielle Lern-Apps verwenden.

## Lizenz

Privat für den persönlichen Lerngebrauch erstellt. Fragen und Erklärungen stammen aus den
öffentlichen Seiten von fuehrerschein-bestehen.de (amtlicher Fragenkatalog, TÜV | DEKRA arge tp 21)
bzw. aus dem 2021er-Datensatz [yowmamasita/driving-theory](https://github.com/yowmamasita/driving-theory).
Keine kommerzielle Nutzung.
