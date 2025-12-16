# Mason Password Manager

Ein sicherer, lokaler Passwort-Manager mit Browser-Integration.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

## Features

### Sicherheit
- **AES-256 Verschlüsselung** - Alle Passwörter, Notizen und Karten werden lokal verschlüsselt
- **SHA-256 Hash** für das Master-Passwort
- **Passwort-Leak-Check** - Prüfung gegen bekannte Datenlecks (Have I Been Pwned)
- **Sicherheits-Analyse** - Erkennt schwache, wiederverwendete und geleakte Passwörter
- **Auto-Lock Timer** - Automatisches Sperren nach einstellbarer Inaktivitätszeit
- **Automatisches Löschen** der Zwischenablage nach 30 Sekunden
- **Lokale Speicherung** - Keine Cloud, keine Synchronisation, volle Kontrolle

### Passwort-Verwaltung
- **Passwort Generator** - Erstellt sichere Passwörter mit anpassbaren Optionen (Länge, Zeichen)
- **Kategorien/Ordner** - Passwörter in Gruppen sortieren (Arbeit, Privat, Finanzen, etc.)
- **Tags/Labels** - Flexible Kennzeichnung für bessere Organisation
- **Favoriten** - Häufig genutzte Passwörter schneller erreichen
- **Passwort-Ablaufdatum** - Erinnerung wenn Passwörter zu alt werden
- **Passwort-Verlauf** - Alte Passwörter einer Seite einsehen (letzte 10 Änderungen)
- **QR-Code Export** - Einzelne Passwörter per QR teilen

### Zusätzliche Tresore
- **Sichere Notizen** - Verschlüsselte Textnotizen für sensible Informationen
- **Kreditkarten-Speicher** - Kartendaten sicher verwalten (Visa, Mastercard, Amex)

### Import & Export
- **CSV Import** - Passwörter aus anderen Managern importieren
- **JSON Export** - Passwörter sicher exportieren

### Browser-Integration
- **Chrome / Edge** - Erweiterung für Chromium-basierte Browser
- **Firefox** - Kompatible Erweiterung
- **Opera GX** - Volle Unterstützung

### Benutzeroberfläche
- **Dark/Light Mode** - Wechselbares Theme
- **Modernes Design** - Mit grünen Akzenten
- **Filter & Suche** - Schnelles Finden von Einträgen

## Installation

### 1. Abhängigkeiten installieren

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
1. Öffne `chrome://extensions` (Chrome/Edge) oder `opera://extensions` (Opera)
2. Aktiviere "Entwicklermodus"
3. Klicke auf "Entpackte Erweiterung laden"
4. Wähle den Ordner `browser-extension`

#### Firefox:
1. Öffne `about:debugging`
2. Klicke auf "Dieses Firefox"
3. Klicke auf "Temporäres Add-on laden"
4. Wähle die `manifest.json` aus dem `browser-extension` Ordner

## Verwendung

### Desktop-App

1. **Erster Start**: Erstelle ein sicheres Master-Passwort (mind. 8 Zeichen)
2. **Passwörter hinzufügen**: Klicke auf "Neu" und fülle die Details aus
3. **Passwort Generator**: Nutze den eingebauten Generator für sichere Passwörter
4. **Organisation**: Verwende Kategorien, Tags und Favoriten
5. **Sicherheits-Check**: Analysiere deine Passwörter auf Schwachstellen
6. **Tresor sperren**: Sperre den Tresor wenn du fertig bist

### Sichere Notizen

1. Wechsle zur "Notizen" Ansicht in der Navigation
2. Klicke auf "Neue Notiz"
3. Gib Titel und Inhalt ein
4. Die Notiz wird automatisch verschlüsselt gespeichert

### Kreditkarten

1. Wechsle zur "Karten" Ansicht in der Navigation
2. Klicke auf "Neue Karte"
3. Gib Kartenname, Inhaber, Nummer, Ablaufdatum und CVV ein
4. Wähle den Kartentyp (Visa, Mastercard, Amex, Andere)

### Sicherheits-Analyse

1. Wechsle zur "Sicherheit" Ansicht
2. Klicke auf "Analyse starten"
3. Überprüfe die Ergebnisse:
   - **Schwache Passwörter**: Zu kurz oder zu einfach
   - **Wiederverwendete Passwörter**: Gleiches Passwort bei mehreren Einträgen
   - **Geleakte Passwörter**: In bekannten Datenlecks gefunden
4. E-Mail-Check: Prüfe ob deine E-Mail in Datenlecks vorkommt

### Browser-Erweiterung

1. Stelle sicher, dass die Desktop-App läuft und entsperrt ist
2. Klicke auf das Mason-Icon in der Browser-Toolbar
3. Wähle ein Passwort aus oder suche danach
4. Klicke auf "Ausfüllen" um Login-Daten einzufügen

## Einstellungen

### Theme wechseln
- Gehe zu Einstellungen
- Wähle zwischen Dark Mode und Light Mode

### Auto-Lock konfigurieren
- Gehe zu Einstellungen
- Wähle die Inaktivitätszeit (1, 5, 15, 30 Minuten oder Aus)
- Der Tresor sperrt sich automatisch nach der eingestellten Zeit

## Tastenkürzel

| Aktion | Kürzel |
|--------|--------|
| Neues Passwort | In der App: "Neu" Button |
| Suchen | Suchfeld in der Toolbar |
| Tresor sperren | "Sperren" Button |

## Technologie

- **Electron** - Desktop-App Framework
- **Node.js** - JavaScript Runtime
- **crypto-js** - AES-256 Verschlüsselung
- **electron-store** - Sichere lokale Datenspeicherung
- **Have I Been Pwned API** - Passwort-Leak-Prüfung (k-anonymity)

## Sicherheitshinweise

- Wähle ein starkes Master-Passwort (mind. 12 Zeichen empfohlen)
- Aktiviere den Auto-Lock Timer
- Führe regelmäßig Sicherheits-Analysen durch
- Ändere geleakte Passwörter sofort
- Mache regelmäßig Backups deiner Daten

## Datenschutz

- Alle Daten werden ausschließlich lokal gespeichert
- Keine Telemetrie oder Analytics
- Keine Verbindung zu Cloud-Diensten
- Passwort-Checks nutzen k-Anonymity (dein Passwort wird nie übertragen)

## Bekannte Einschränkungen

- Die E-Mail-Breach-Prüfung über die HIBP API erfordert einen API-Schlüssel für vollständige Funktionalität. Alternativ können E-Mails manuell auf [haveibeenpwned.com](https://haveibeenpwned.com) geprüft werden.

---

© All rights reserved by Mas0n1x
