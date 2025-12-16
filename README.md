# Mason Password Manager

Ein sicherer, lokaler Passwort-Manager mit Browser-Integration.

## Features

- **AES-256 Verschlüsselung** - Alle Passwörter werden lokal verschlüsselt
- **Passwort Generator** - Erstellt sichere Passwörter mit anpassbaren Optionen
- **Browser-Integration** - Chrome, Firefox und Opera GX Erweiterung
- **Dark Mode UI** - Modernes Design mit grünen Akzenten
- **Keine Cloud** - Alle Daten bleiben lokal auf deinem Computer

## Installation

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Anwendung starten

```bash
npm start
```

### 3. Browser-Erweiterung installieren

#### Chrome / Opera GX:
1. Öffne `chrome://extensions` (Chrome) oder `opera://extensions` (Opera)
2. Aktiviere "Entwicklermodus"
3. Klicke auf "Entpackte Erweiterung laden"
4. Wähle den Ordner `browser-extension`

#### Firefox:
1. Öffne `about:debugging`
2. Klicke auf "Dieses Firefox"
3. Klicke auf "Temporäres Add-on laden"
4. Wähle eine Datei aus dem `browser-extension` Ordner

## Verwendung

### Desktop-App
1. Beim ersten Start: Erstelle ein Master-Passwort
2. Füge Passwörter über den "Neu" Button hinzu
3. Verwende den Generator für sichere Passwörter
4. Sperre den Tresor wenn du fertig bist

### Browser-Erweiterung
1. Stelle sicher, dass die Desktop-App läuft und entsperrt ist
2. Klicke auf das Mason-Icon in der Browser-Toolbar
3. Wähle ein Passwort aus oder suche danach
4. Klicke auf "Ausfüllen" um Login-Daten einzufügen

## Sicherheit

- **AES-256 Verschlüsselung** für alle gespeicherten Passwörter
- **SHA-256 Hash** für das Master-Passwort
- **Automatisches Löschen** der Zwischenablage nach 30 Sekunden
- **Lokale Speicherung** - keine Cloud, keine Synchronisation

## Entwicklung

### Build erstellen

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

---

© All rights reserved by Mas0n1x
