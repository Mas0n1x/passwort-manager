# Mason Password Manager

Ein sicherer, lokaler Passwort-Manager mit Browser-Integration.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

## Features

### Sicherheit
- **AES-256 Verschluesselung** - Alle Passwoerter, Notizen und Karten werden lokal verschluesselt
- **SHA-256 Hash** fuer das Master-Passwort
- **Passwort-Leak-Check** - Pruefung gegen bekannte Datenlecks (Have I Been Pwned)
- **Sicherheits-Analyse** - Erkennt schwache, wiederverwendete und geleakte Passwoerter
- **Auto-Lock Timer** - Automatisches Sperren nach einstellbarer Inaktivitaetszeit
- **Automatisches Loeschen** der Zwischenablage nach 30 Sekunden
- **Lokale Speicherung** - Keine Cloud, keine Synchronisation, volle Kontrolle

### Passwort-Verwaltung
- **Passwort Generator** - Erstellt sichere Passwoerter mit anpassbaren Optionen (Laenge, Zeichen)
- **Kategorien/Ordner** - Passwoerter in Gruppen sortieren (Arbeit, Privat, Finanzen, etc.)
- **Tags/Labels** - Flexible Kennzeichnung fuer bessere Organisation
- **Favoriten** - Haeufig genutzte Passwoerter schneller erreichen
- **Passwort-Ablaufdatum** - Erinnerung wenn Passwoerter zu alt werden
- **Passwort-Verlauf** - Alte Passwoerter einer Seite einsehen (letzte 10 Aenderungen)
- **QR-Code Export** - Einzelne Passwoerter per QR teilen
- **Passwort-Statistiken** - Dashboard mit Uebersicht ueber Staerke, Alter und Kategorien
- **Kompakte Ansicht** - Mehr Eintraege auf einen Blick anzeigen

### Zusaetzliche Tresore
- **Sichere Notizen** - Verschluesselte Textnotizen fuer sensible Informationen
- **Kreditkarten-Speicher** - Kartendaten sicher verwalten (Visa, Mastercard, Amex)

### Import & Export
- **Multi-Format Import** - Unterstuetzt verschiedene Passwort-Manager:
  - Chrome/Edge/Brave (CSV)
  - Firefox (CSV)
  - LastPass (CSV)
  - 1Password (CSV/JSON)
  - Bitwarden (CSV/JSON)
  - KeePass (CSV/JSON)
- **JSON Export** - Passwoerter sicher exportieren

### Automatische Backups
- **Auto-Backup** - Automatische taegliche Backups beim Start
- **Manuelle Backups** - Jederzeit ein Backup erstellen
- **Backup-Wiederherstellung** - Einfaches Wiederherstellen aus Backups
- **Backup-Verwaltung** - Alte Backups automatisch bereinigen

### Browser-Integration
- **Chrome / Edge / Brave** - Erweiterung fuer Chromium-basierte Browser
- **Firefox** - Kompatible Erweiterung
- **Opera GX** - Volle Unterstuetzung
- **Automatische URL-Erkennung** - Passwoerter werden automatisch fuer die aktuelle Webseite vorgeschlagen
- **Passwort-Capture** - Neue Logins automatisch erkennen und zum Speichern anbieten
- **One-Click Autofill** - Login-Daten mit einem Klick einfuegen

### System-Integration
- **Autostart mit Windows** - Optional beim Systemstart starten
- **System Tray** - Im Hintergrund laufen und ueber das Tray-Icon zugreifen
- **Minimieren in Tray** - App versteckt sich beim Schliessen im System Tray

### Benutzeroberflaeche
- **Dark/Light Mode** - Wechselbares Theme
- **Modernes Design** - Mit gruenen Akzenten
- **Filter & Suche** - Schnelles Finden von Eintraegen
- **Direkte Passwortaenderung** - Schwache Passwoerter direkt auf der Webseite aendern

## Installation

### 1. Abhaengigkeiten installieren

```bash
npm install
```

### 2. Anwendung starten

```bash
npm start
```

### 3. Build erstellen

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 4. Browser-Erweiterung installieren

#### Chrome / Opera GX / Edge:
1. Oeffne `chrome://extensions` (Chrome/Edge) oder `opera://extensions` (Opera)
2. Aktiviere "Entwicklermodus"
3. Klicke auf "Entpackte Erweiterung laden"
4. Waehle den Ordner `browser-extension`

#### Firefox:
1. Oeffne `about:debugging`
2. Klicke auf "Dieses Firefox"
3. Klicke auf "Temporaeres Add-on laden"
4. Waehle die `manifest.json` aus dem `browser-extension` Ordner

## Verwendung

### Desktop-App

1. **Erster Start**: Erstelle ein sicheres Master-Passwort (mind. 8 Zeichen)
2. **Passwoerter hinzufuegen**: Klicke auf "Neu" und fuelle die Details aus
3. **Passwort Generator**: Nutze den eingebauten Generator fuer sichere Passwoerter
4. **Organisation**: Verwende Kategorien, Tags und Favoriten
5. **Sicherheits-Check**: Analysiere deine Passwoerter auf Schwachstellen
6. **Statistiken**: Pruefe das Dashboard fuer eine Uebersicht deiner Passwoerter
7. **Tresor sperren**: Sperre den Tresor wenn du fertig bist

### Sichere Notizen

1. Wechsle zur "Notizen" Ansicht in der Navigation
2. Klicke auf "Neue Notiz"
3. Gib Titel und Inhalt ein
4. Die Notiz wird automatisch verschluesselt gespeichert

### Kreditkarten

1. Wechsle zur "Karten" Ansicht in der Navigation
2. Klicke auf "Neue Karte"
3. Gib Kartenname, Inhaber, Nummer, Ablaufdatum und CVV ein
4. Waehle den Kartentyp (Visa, Mastercard, Amex, Andere)

### Sicherheits-Analyse

1. Wechsle zur "Sicherheit" Ansicht
2. Klicke auf "Analyse starten"
3. Ueberpruefe die Ergebnisse:
   - **Schwache Passwoerter**: Zu kurz oder zu einfach
   - **Wiederverwendete Passwoerter**: Gleiches Passwort bei mehreren Eintraegen
   - **Geleakte Passwoerter**: In bekannten Datenlecks gefunden
4. **Direkt aendern**: Klicke auf "Webseite" um das Passwort direkt auf der Seite zu aendern
5. E-Mail-Check: Pruefe ob deine E-Mail in Datenlecks vorkommt

### Passwort-Statistiken

1. Wechsle zur "Statistiken" Ansicht in der Navigation
2. Sieh dir die Uebersicht an:
   - **Gesamtanzahl** aller Passwoerter, Notizen und Karten
   - **Staerkeverteilung** - Diagramm zur Passwortstärke
   - **Altersverteilung** - Wie alt sind deine Passwoerter?
   - **Kategorie-Statistiken** - Verteilung nach Kategorien

### Backups

1. Gehe zu Einstellungen
2. **Auto-Backup aktivieren**: Taegliche automatische Backups beim App-Start
3. **Manuelles Backup**: Klicke auf "Backup erstellen"
4. **Backup wiederherstellen**: Klicke auf "Wiederherstellen" und waehle eine Backup-Datei
5. Backups werden verschluesselt im `backups` Ordner gespeichert

### Browser-Erweiterung

1. Stelle sicher, dass die Desktop-App laeuft und entsperrt ist
2. Klicke auf das Mason-Icon in der Browser-Toolbar
3. **Automatische Erkennung**: Passende Passwoerter fuer die aktuelle Seite werden automatisch angezeigt
4. Waehle ein Passwort aus oder suche danach
5. Klicke auf "Ausfuellen" um Login-Daten einzufuegen

### Passwort-Capture

Die Browser-Erweiterung erkennt automatisch wenn du dich auf einer Webseite einloggst:
1. Logge dich auf einer Webseite ein
2. Die Erweiterung zeigt ein Badge "+" an
3. Klicke auf das Mason-Icon
4. Bestatige mit "Speichern" um die Anmeldedaten zu speichern
5. Bei bestehenden Eintraegen wird angeboten das Passwort zu aktualisieren

## Einstellungen

### Theme wechseln
- Gehe zu Einstellungen
- Waehle zwischen Dark Mode und Light Mode

### Auto-Lock konfigurieren
- Gehe zu Einstellungen
- Waehle die Inaktivitaetszeit (1, 5, 15, 30 Minuten oder Aus)
- Der Tresor sperrt sich automatisch nach der eingestellten Zeit

### Autostart mit Windows
- Gehe zu Einstellungen
- Aktiviere "Mit Windows starten"
- Mason startet automatisch beim Windows-Login

### Kompakte Ansicht
- Gehe zu Einstellungen
- Aktiviere "Kompakte Ansicht"
- Mehr Passwoerter werden in der Liste angezeigt

## Tastenkuerzel

| Aktion | Kuerzel |
|--------|--------|
| Neues Passwort | In der App: "Neu" Button |
| Suchen | Suchfeld in der Toolbar |
| Tresor sperren | "Sperren" Button |

## Technologie

- **Electron** - Desktop-App Framework
- **Node.js** - JavaScript Runtime
- **crypto-js** - AES-256 Verschluesselung
- **electron-store** - Sichere lokale Datenspeicherung
- **Have I Been Pwned API** - Passwort-Leak-Pruefung (k-anonymity)

## Sicherheitshinweise

- Waehle ein starkes Master-Passwort (mind. 12 Zeichen empfohlen)
- Aktiviere den Auto-Lock Timer
- Fuehre regelmaessig Sicherheits-Analysen durch
- Aendere geleakte Passwoerter sofort
- Aktiviere automatische Backups
- Speichere Backups an einem sicheren Ort

## Datenschutz

- Alle Daten werden ausschliesslich lokal gespeichert
- Keine Telemetrie oder Analytics
- Keine Verbindung zu Cloud-Diensten
- Passwort-Checks nutzen k-Anonymity (dein Passwort wird nie uebertragen)

## Bekannte Einschraenkungen

- Die E-Mail-Breach-Pruefung ueber die HIBP API erfordert einen API-Schluessel fuer vollstaendige Funktionalitaet. Alternativ koennen E-Mails manuell auf [haveibeenpwned.com](https://haveibeenpwned.com) geprueft werden.

---

(c) All rights reserved by Mas0n1x
