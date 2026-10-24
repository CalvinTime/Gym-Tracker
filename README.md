# GymTracker - McFit gym80 Offline-First PWA

> 100% kostenlose, lokale **Offline-First Gym-Tracker Web-App**, optimiert für Einhand-Bedienung auf Android/Samsung Galaxy Smartphones sowie Desktop-Browser. Speziell entwickelt für die Biomechanik und Gerätestaffelung von McFit & gym80.

---

## ⚡ Highlights & Features

- **100% Offline-First:** Alle Daten verbleiben lokal in der Browser-IndexedDB via Dexie.js. Kein Server, kein Tracking, keine Registrierungspflicht.
- **Dark-OLED Theme:** `#000000` Hintergrund für maximale Energieeffizienz auf AMOLED-Displays und blendfreie Lesbarkeit im Fitnessstudio.
- **Studio-spezifische Physik (gym80 & McFit):**
  - Berücksichtigung realer Flaschenzug-Übersetzungen (1:2 Flaschenzug an verstellbaren gym80 Kabeltürmen vs. 1:1 Direktzug bei Latzug/Rudern).
  - 1-Klick **+2,5 kg gym80 Micro-Addon**-Zuschaltung am Gewichtsblock.
  - Exakte Kurzhantelstaffelung (1–10 kg in 1-kg-Schritten, 12–50 kg in 2-kg-Schritten).
  - Integrierter **Scheibenrechner** für Langhanteln und Plate-Loaded-Geräte.
- **Gym-Floor Ergonomie (Samsung Galaxy Einhand-Bedienung):**
  - Mindestens 48–56 px große Touch-Targets für ermüdete Hände nach harten Sätzen.
  - Custom Gym-Keypad am unteren Bildschirmrand mit deutschem Komma (`,`), Schnelltasten (`-2,5 / +2,5`, `-1 / +1`) und **"Weiter / Satz abhaken"**-Flow.
  - Live-Ruhetimer (+15s / -15s Schnelltasten) und permanente Anzeige *"Zeit seit letztem Satz"*.
  - 1-Tap editierbare Sitz- und Gerätenotizen (*"Sitz 4, Polster 2"*).
  - **Tagesform-Toggle:** Progression einfrieren bei Schlafmangel oder Reha.
  - Automatische Erkennung neuer Bestmarken (PR für Gewicht, Wdh, e1RM, e10RM, Satzvolumen).
- **Wissenschaftliche Progression & Analyse:**
  - Double Progression Engine mit Soll-vs-Ist-Trennung.
  - Wöchentliches Muskelvolumen (Direkt vs. Fraktional) mit MEV/MAV-Schwellenwerten.
  - SVG-Kraftverlaufsgraphen.
- **Datensicherheit:**
  - 1-Klick JSON-Export/Import für vollständige lokale Backups.
  - CSV-Import für Strong-, Hevy- und FitNotes-Historien.

---

## 📱 Installation auf dem Smartphone (Samsung Galaxy / Android)

1. Öffne die Live-URL im Browser (**Samsung Internet** oder **Google Chrome**).
2. Öffne das Menü (3 Punkte oben rechts).
3. Tippe auf **"App installieren"** oder **"Zum Startbildschirm hinzufügen"**.
4. Die App startet nun im echten Vollbildmodus ohne Browserleiste und funktioniert auch im Flugmodus oder Funkloch zu 100%.

---

## 🛠 Tech Stack

- **Framework:** React 19, TypeScript (Strict Mode), Vite
- **Storage:** Dexie.js (IndexedDB)
- **Icons:** Lucide React
- **Testing:** Vitest mit `fake-indexeddb` (54 automatisierte Tests)
- **Deployment:** GitHub Pages & GitHub Actions

---

## 💻 Lokale Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev

# Tests ausführen
npm test

# Production Build erstellen
npm run build
```

---

## 📄 Lizenz

MIT – 100% kostenlos und Open Source.
