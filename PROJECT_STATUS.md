# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.3  
**Aktueller Entwicklungsstand:** v6.8.3  
**Status v6.8.3:** ✅ LIVE / STABIL BESTÄTIGT  
**Datum:** 18.09.2026

---

## 1. Verbindliche Basis

Die aktuell bestätigte stabile Live-Version ist:

**v6.8.3**

Die Zwischenänderungen aus v6.8.2 sind vollständig in v6.8.3 enthalten. v6.8.1 bleibt die vorherige stabile Rückfallbasis; v6.8.0e bleibt zusätzlich als ältere dokumentierte Rückfallbasis erhalten.

---

## 2. Bereits enthaltene Verbesserungen

### Prüfungen

- Fragen mit einer richtigen Antwort lassen optisch keine Lösungshilfe erkennen.
- Alle Antwortfelder sehen für Prüflinge gleich aus.
- Bei Einzelauswahl kann technisch trotzdem nur eine Antwort gleichzeitig gesetzt werden.
- Echte Mehrfachfragen erlauben mehrere Antworten.
- Der Hinweis zur Mehrfachauswahl wurde aus der Prüflingsansicht entfernt.
- Die Punkteberechnung und historische Prüfungsergebnisse bleiben unverändert.
- Prüfungen werden ausschließlich in Firebase verwaltet; die Flugausbildungsprüfung ist nicht mehr dauerhaft in `app.js` eingebaut.

### Sitzung / Inaktivität

- Inaktivitätsgrenze: **30 Minuten**.
- Anschließend weiterhin **30 Sekunden Rückfrage**.
- Ohne Bestätigung erfolgt die vollständige Abmeldung.

---

## 3. Aufräumrunde v6.8.3

### Hauptnavigation

- **Hover-Navigation:** Auf Desktop-Geräten mit Maus öffnen sich die Gruppen „Mitarbeiter“ und „Wissen & Dokumente“ bereits beim Darüberfahren. Auf Touch-Geräten bleibt die Klick-/Tap-Bedienung erhalten.

Der Kalender bleibt ausdrücklich als eigener Hauptpunkt direkt sichtbar.

Direkt erreichbar bleiben außerdem:
- Dokumentation & Einsatz
- Statistik & Archiv
- Ausbildung
- News
- Chief Ebene (bei Berechtigung)
- Einstellungen

Zusammengefasst wurden:
- **Mitarbeiter:** Mitarbeiter Kartei, Hierarchie, Gehaltstabelle
- **Wissen & Dokumente:** Funk & Codes, Commands, Links & Dokumente, Sanktionskatalog

Die Gruppen sind auf Desktop als kompakte Menüs und auf mobilen Geräten als aufklappbare Bereiche umgesetzt.

### Ausbildung

- „Mitglieder & Rollen“ wurde verständlicher in „Mitarbeiterfreigabe“ umbenannt.
- Die Beschreibung grenzt Mitarbeiterfreigabe und Ausbildungsrollen klarer voneinander ab.

### Admin-Zentralverwaltung

Die Reihenfolge orientiert sich stärker am täglichen Arbeitsablauf:

1. Mitarbeiter
2. Rollen & Rechte
3. Sitzungen & Updates
4. Systemprotokoll
5. Wartung
6. Backup & Gefahrenzone

Zusätzlich:
- Backup/Wiederherstellung/Fachdaten-Reset ist im UI nur noch für Master Admins sichtbar.
- Der Systemtab wird auch programmatisch gegen Nicht-Master geschützt.
- Der Fachdaten-Reset ist als deutliche Gefahrenzone gekennzeichnet.
- Bei reiner Wartungsberechtigung werden fremde Verwaltungsbereiche ausgeblendet.
- Rollenberechtigungen sind in einklappbare Themenbereiche gegliedert.

### Konsistenzkorrekturen

- Der Inaktivitätshinweis zeigt jetzt ebenfalls korrekt **30 Minuten** statt des alten Textes mit 20 Minuten.
- Backup-Dateien tragen automatisch die aktuelle `APP_VERSION` statt einer fest eingetragenen alten Versionsnummer.
- Cache- und Dateiversionen sind einheitlich auf **v6.8.3** gesetzt.

---

## 4. Sicherheit / Firebase

Für v6.8.3 wurden keine Firebase Rules geändert.

Unverändert bleiben:
- Firebase Auth
- Registrierung und Login
- authIndex / loginDirectory
- Benutzerkonten
- Rollenlogik und Berechtigungsmodell
- Passwörter
- vorhandene Prüfungen und Prüfungsergebnisse
- bestehende Live-Daten

Es ist keine Datenmigration erforderlich.

---

## 5. Dateien v6.8.3

Geändert:
- `app.js`
- `index.html`
- `style.css`
- `PROJECT_STATUS.md`

Unverändert:
- `database.rules.final.json`
- `mdlogo.png`
- `wuensche_und_bugs.md`

---

## 6. Live-Test – erfolgreich abgeschlossen

Am 18.09.2026 wurden die vorgesehenen Live-Tests erfolgreich bestätigt:

- Login / Dienstantritt
- Hauptnavigation Desktop inklusive Hover-Menüs
- Hauptnavigation Mobil / schmales Fenster
- Kalender weiterhin direkt erreichbar
- beide neuen Navigationsgruppen
- Ausbildung / Prüfungen
- Single- und Multiple-Choice-Verhalten
- Mitarbeiterfreigabe
- Admin-Mitarbeiter
- Rollen & Rechte inklusive Einklappen
- Sitzungen & Updates als Master Admin
- Systemprotokoll
- Wartungsmodus
- Backup & Gefahrenzone nur als Master Admin
- normaler Nicht-Master-Admin sieht keine Backup-/Reset-Funktionen
- Inaktivitätswarnung nach 30 Minuten
- Dienst beenden / Presence

---

## 7. Google-Dokumente

Die hinterlegten Links bleiben unverändert. Die tatsächlichen Google-Freigaberechte können nicht aus dem Quellcode geprüft werden.

Empfehlung: EHK, CLS, Psychologie, Dienstvorschriften und Sanktionskatalog jeweils einmal in einem privaten/Inkognito-Browser ohne Google-Anmeldung öffnen.

---

## 8. Rollback

**v6.8.1 = vorherige stabile Rollback-Basis**

v6.8.2 war ein Zwischenstand und ist vollständig in v6.8.3 aufgegangen. v6.8.0e bleibt als ältere dokumentierte Rückfallbasis erhalten.

Firebase Rules müssen bei einem reinen Web-Rollback dieser Runde nicht verändert werden.

---

## 9. Stabil-Markierung

**v6.8.3 – ✅ LIVE / STABIL BESTÄTIGT**

Bestätigt am **18.09.2026** nach erfolgreichem Test der Navigation, Unterseiten, Prüfungen, Admin-Bereiche, Backup/Gefahrenzone, Presence, Dienstende und Inaktivitätssteuerung.
