# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.0e  
**Vorbereitete nächste Version:** v6.8.1  
**Status v6.8.1:** 🟡 VORBEREITET / NOCH NICHT LIVE-STABIL BESTÄTIGT  
**Datum:** 17.09.2026

---

## 1. Verbindliche Basis

Die zuletzt veröffentlichte, getestete und bestätigte stabile Version bleibt bis zum erfolgreichen Live-Test:

**v6.8.0e**

Sie ist weiterhin die Rollback-Basis für v6.8.1.

v6.8.1 wurde auf Grundlage der bestätigten v6.8.0e-Dateien vorbereitet. Die Version darf erst nach Veröffentlichung aller notwendigen Dateien und erfolgreichem Live-Test als LIVE/STABIL markiert werden.

---

## 2. Inhalt von v6.8.1

### Automatische Inaktivitätsprüfung

Für angemeldete Mitarbeiter gilt:

- Nach 20 Minuten ohne erkannte Benutzeraktivität erscheint eine deutliche Rückfrage.
- Die Rückfrage zeigt einen 30-Sekunden-Countdown.
- Wird innerhalb der 30 Sekunden bestätigt, bleibt die Sitzung aktiv und der 20-Minuten-Timer startet neu.
- Erfolgt keine Bestätigung, wird die MMD-Cloud-Sitzung automatisch beendet.
- Der Presence-Eintrag wird dabei entfernt und der Benutzer verschwindet aus „Im Dienst“.

Als Aktivität zählen Bedienhandlungen auf der Seite wie Maus-, Tastatur-, Touch- und Scroll-Eingaben.

### Presence / „Im Dienst“

- Angemeldete Browser senden regelmäßig ein Lebenszeichen.
- Presence-Einträge enthalten die aktuelle Client-Version.
- Veraltete Presence-Einträge ohne aktuelles Lebenszeichen werden nicht mehr als aktiv angezeigt.
- Der bestehende Firebase-`onDisconnect()`-Schutz bleibt erhalten.

### Master-Admin Sitzungsverwaltung

Neuer Master-only-Bereich:

**🖥️ Sitzungen & Updates**

Dort können aktive MMD-Cloud-Sitzungen eingesehen werden.

Master Admins können fremde aktive Sitzungen gezielt mit „Aus Dienst entfernen“ beenden.

Die Ziel-Sitzung erhält ein zentrales Abmeldesignal, wird aus Firebase Auth abgemeldet und aus „Im Dienst“ entfernt.

### Browser-Aktualisierung

Im Master-only-Bereich kann nach dem Veröffentlichen neuer Webdateien eine neue Live-Version bekanntgegeben werden.

Kompatible bereits geöffnete Browser:

- erkennen eine neuere veröffentlichte Version,
- zeigen 10 Sekunden lang einen Aktualisierungshinweis,
- laden danach automatisch neu,
- behalten dabei grundsätzlich ihre Anmeldung, sofern die Sitzung weiterhin gültig ist.

Wichtig: Die automatische Update-Erkennung steht erst Browsern zur Verfügung, die mindestens v6.8.1 geladen haben. Für die erstmalige Einführung von v6.8.1 müssen bereits geöffnete ältere v6.8.0e-Browser einmal manuell neu geladen werden.

---

## 3. Sicherheitsänderungen

Für v6.8.1 werden die Firebase Realtime Database Rules gezielt erweitert.

Neue bzw. angepasste Bereiche:

- `data/presence`
- `data/sessionControl`
- `data/systemStatus/clientRelease`

Dabei gilt:

- Normale freigeschaltete Mitarbeiter dürfen nur ihren eigenen Presence-Eintrag schreiben bzw. entfernen.
- Master Admins dürfen Presence-Einträge für die Sitzungsverwaltung entfernen.
- `sessionControl` darf nur durch Master Admins geschrieben werden.
- Ein Mitarbeiter darf nur die eigene Sitzungssteuerung lesen.
- `clientRelease` darf nur durch Master Admins veröffentlicht werden.
- Registrierung, Login, `authIndex`, `loginDirectory`, Rollen, Rechte und Passwortlogik werden durch v6.8.1 nicht fachlich verändert.

---

## 4. Dateien für v6.8.1

Zu veröffentlichen:

- `database.rules.final.json`
- `index.html`
- `app.js`
- `style.css`

Unverändert:

- `mdlogo.png`

Dokumentation:

- `PROJECT_STATUS.md`

---

## 5. Sichere Veröffentlichungsreihenfolge

Vor Veröffentlichung:

1. Bestehenden Stand v6.8.0e als Backup / Rollback sichern.
2. Keine bestehenden Live-Daten löschen oder migrieren.

Veröffentlichung:

1. `database.rules.final.json` in Firebase veröffentlichen.
2. `index.html` veröffentlichen.
3. `app.js` veröffentlichen.
4. `style.css` veröffentlichen.
5. Browser hart neu laden / Cache-Version prüfen.
6. Live-Tests durchführen.

Es ist keine Datenmigration bestehender Benutzerkonten erforderlich.

---

## 6. Pflicht-Live-Tests für v6.8.1

Vor der Kennzeichnung als LIVE/STABIL mindestens prüfen:

- normaler Login funktioniert,
- Registrierung eines Testbenutzers funktioniert weiterhin mit `pending` + `mitarbeiter`,
- normaler Klick auf „Dienst beenden“ funktioniert,
- „Im Dienst“ aktualisiert sich korrekt,
- Presence-Lebenszeichen werden aktualisiert,
- Inaktivitätswarnung erscheint nach dem Testintervall bzw. technisch kontrolliert,
- Bestätigung der Warnung verhindert die Abmeldung,
- Ablauf der 30 Sekunden beendet die Sitzung,
- Master Admin sieht „Sitzungen & Updates“,
- Nicht-Master sieht den Master-only-Bereich nicht,
- Master kann eine fremde Test-Sitzung aus dem Dienst entfernen,
- Zielbrowser wird daraufhin abgemeldet,
- Veröffentlichung eines Test-Update-Signals löst bei einem kompatiblen zweiten Browser den 10-Sekunden-Hinweis und Reload aus,
- Login-/Registrierungs-Hotfix v6.8.0e bleibt intakt.

---

## 7. Rollback

Bis v6.8.1 erfolgreich live getestet wurde, bleibt:

**v6.8.0e = verbindliche Rollback-Basis**

Falls v6.8.1 fehlschlägt:

1. v6.8.0e Webdateien wiederherstellen.
2. v6.8.0e Firebase Rules wiederherstellen.
3. Browser neu laden.
4. Login und Registrierung erneut testen.

---

## 8. Stabil-Markierung

Erst nach erfolgreicher Veröffentlichung und den notwendigen Live-Tests darf dieser Status geändert werden auf:

**v6.8.1 – ✅ LIVE / STABIL BESTÄTIGT**

Bis dahin bleibt v6.8.0e die letzte bestätigte stabile Version.
