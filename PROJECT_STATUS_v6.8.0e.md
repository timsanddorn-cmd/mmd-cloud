# MMD Cloud – PROJECT STATUS

**Aktueller Stand:** v6.8.0e  
**Status:** ✅ LIVE / STABIL BESTÄTIGT  
**Datum der Bestätigung:** 17.09.2026

---

## 1. Aktuelle stabile Version

Die aktuell veröffentlichte, getestete und bestätigte Version ist:

**v6.8.0e**

Diese Version ist ab sofort die verbindliche Ausgangsbasis für alle weiteren Änderungen.

Ältere Stände wie v6.6.0, v6.7.0, v6.8.0c und v6.8.0d dürfen nicht als aktuelle Grundlage verwendet werden.

---

## 2. Live-Status

Folgende Punkte sind für v6.8.0e bestätigt:

- ✅ `index.html` auf GitHub veröffentlicht
- ✅ `app.js` auf GitHub veröffentlicht
- ✅ `style.css` auf GitHub veröffentlicht
- ✅ GitHub-Dateien geprüft
- ✅ `database.rules.final.json` in Firebase veröffentlicht
- ✅ Registrierung mit einem neuen Benutzer erfolgreich live getestet
- ✅ Registrierungs-Hotfix funktioniert
- ✅ v6.8.0e ist die neue stabile Basis

GitHub Repository:

`timsanddorn-cmd/mmd-cloud`

---

## 3. Registrierungs-Hotfix v6.8.0e

v6.8.0e behebt das Problem, dass bei der Registrierung zwar Daten eingegeben werden konnten, der Registrierungsprozess aber nicht erfolgreich abgeschlossen wurde.

Der Hotfix stellt sicher, dass ein neuer Benutzer bei der Selbstregistrierung nur mit folgenden Eigenschaften angelegt werden darf:

- Status: `pending`
- Rolle: `mitarbeiter`
- keine privilegierten Rollen
- keine zusätzlichen administrativen Rechte

Die Firebase Realtime Database Rules wurden passend dazu angepasst und veröffentlicht.

Die Registrierung wurde anschließend erfolgreich live getestet.

---

## 4. Sicherheitsstatus

Sicherheitskritische Bereiche bleiben geschützt:

- Firebase Auth
- Registrierung
- Login
- `authIndex`
- `loginDirectory`
- stabile Account-IDs
- Benutzerverwaltung
- Rollen
- Rechte
- Passwortfunktionen
- Firebase Realtime Database Rules
- Migrationen

Firebase bleibt zentraler Bestandteil des Systems.

Bestehende Rules dürfen bei zukünftigen Änderungen nicht pauschal gelockert werden.

---

## 5. Rollen und Rechte

Wichtige bestätigte Regeln:

- Master Admin besitzt feste Vollrechte.
- `isMasterAdmin` bleibt Master-only.
- `delUsers` bleibt Master-only.
- Chief darf Rollen unterhalb der Chief-Ebene verwalten, aber nicht Chief oder Master vergeben.
- Ausbildungsleitung darf nur `ausbildungsleitung`, `ausbilder` und `mitarbeiter` vergeben.
- Personalabteilung hat dieselbe eingeschränkte Rollenzuweisung.
- Mehrere Rollen kombinieren ihre Rechte.
- Es gibt keine Deny-Rolle.
- Checkbox an = Recht vorhanden.
- Checkbox aus = Recht nicht vorhanden.
- `cls` und `ehk` bleiben interne Rollen-IDs.
- Sichtbare Bezeichnungen sind `💉 CLS` und `🩺 EHK`.
- CLS und EHK sind keine Ausbilderrollen.

---

## 6. Kalender

Für freigeschaltete Mitarbeiter gilt:

- eigene Termine erstellen
- eigene Termine bearbeiten
- eigene Termine löschen

`delCalendar` bedeutet zusätzlich:

- Termine anderer Benutzer verwalten

---

## 7. Sanktionskatalog

Der Sanktionskatalog ist live und funktionsfähig.

Enthalten sind unter anderem:

- Paragraph
- Verstoß
- 1. Sanktion
- 2. Sanktion
- 3. Sanktion
- Suchfunktion
- allgemeine wichtige Sanktionsregeln
- Live-Bearbeitung für Berechtigte

Berechtigung:

`canEditSanctionsCatalog`

Zentraler Datenbereich:

`data/sanctionsCatalog`

---

## 8. Prüfungen und Musterlösungen

Aktueller Stand:

- Musterlösungen sind vorhanden.
- Berechtigung: `canViewExamSolutions`
- Ausbildungsleitung kann alle Musterlösungen sehen.
- Ausbilder sehen nur Prüfungen, die sie selbst bestanden haben.
- Chief und Master entsprechend ihrer Rechte.
- Historische Prüfungsergebnisse bleiben historische Snapshots.
- Musterlösungen verwenden die aktuelle Prüfung aus Firebase.

---

## 9. Bewertungslogik Prüfungen

Aktuelle Bewertungslogik:

- richtige ausgewählte Antwort = +1 Punkt
- zusätzliche falsche ausgewählte Antwort = −1 Punkt innerhalb derselben Frage
- Mindestwert je Frage = 0 Punkte
- Maximalpunkte je Frage = Anzahl richtiger Antwortmöglichkeiten
- Gesamt-Maximalpunkte = Summe aller richtigen Antwortmöglichkeiten
- Prozent = erreichte Punkte / Maximalpunkte × 100
- Mindest-Bestehensgrenze = 60 %
- höhere konfigurierte Bestehensgrenzen bleiben erhalten

Alte Ergebnisse werden nicht rückwirkend neu berechnet.

---

## 10. Prüfungswiederholung

Nicht bestandene Prüfungen können von berechtigten Personen erneut freigegeben werden.

Dabei gilt:

- der alte Fehlversuch bleibt erhalten
- nichts wird überschrieben
- nichts wird gelöscht
- Ausbilder dürfen nur Prüfungen freigeben, auf die sie selbst Zugriff haben
- alte Ergebnisse ohne `examId` werden nur bei eindeutiger Zuordnung übernommen
- bei Mehrdeutigkeit wird nicht geraten

---

## 11. Aktive Projektdateien

Die zentrale Projektbasis besteht derzeit aus:

- `index.html`
- `app.js`
- `style.css`
- `database.rules.final.json`
- `PROJECT_STATUS.md`
- `LIVE_TESTPLAN_v6.8.0.md`
- `mdlogo.png`

---

## 12. Regeln für zukünftige Änderungen

Für neue Änderungen gilt weiterhin:

1. Aktuelle Live-Dateien sind Source of Truth.
2. Vor sicherheitskritischen Änderungen Backup und Rollback einplanen.
3. Keine bestehenden funktionierenden Bereiche unnötig umbauen.
4. Größere Änderungen erst nach ausdrücklicher Freigabe final erstellen.
5. Bei neuen Funktionen oder größeren Fehlerbehebungen Version sauber erhöhen.
6. Cache-Busting in `index.html` beachten.
7. Changelog vollständig fortführen.
8. `PROJECT_STATUS.md` erst nach erfolgreichem Live-Test auf „live/stabil“ setzen.
9. Bei Firebase-/Rules-Änderungen sichere Veröffentlichungsreihenfolge beachten.

---

## 13. Rollback-Basis

**Rollback-Basis für die nächste Änderung: v6.8.0e**

Falls eine zukünftige Veröffentlichung fehlschlägt, soll auf den bestätigten Stand v6.8.0e zurückgegangen werden.

---

## 14. Nächster Entwicklungsschritt

Aktuell sind keine offenen Fehler aus v6.8.0e bekannt.

Neue Änderungen sollen auf Basis von v6.8.0e geplant und umgesetzt werden.
