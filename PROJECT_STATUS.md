# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.4  
**Aktueller Entwicklungsstand:** v6.8.4  
**Status v6.8.4:** ✅ LIVE / STABIL BESTÄTIGT  
**Datum:** 18.09.2026

---

## 1. Verbindliche Basis

**v6.8.4 = bestätigte stabile Live-Version**

v6.8.3 bleibt die vorherige stabile Rollback-Basis.

---

## 2. Neue Funktion v6.8.4 – Persönliche Mitarbeiterhinweise

Die Funktion ist bewusst **kein Chat und kein internes Nachrichtensystem**.

Berechtigte Rollen können im bestehenden Newsfeed einen persönlichen Hinweis an genau einen Mitarbeiter senden.

Der Empfänger:
- bekommt einen neuen offenen Hinweis beim Login als Pop-up,
- bekommt ihn auch während einer bereits laufenden Sitzung live angezeigt,
- muss ihn über **„Zur Kenntnis genommen“** bestätigen,
- kann nicht antworten,
- sieht seine Hinweise zusätzlich im Newsfeed.

Mehrere offene Hinweise werden nacheinander angezeigt.

Optional kann beim Erstellen ein Ablaufdatum gesetzt werden. Abgelaufene, nicht bestätigte Hinweise werden nicht mehr als Pop-up erzwungen, bleiben aber sichtbar, bis sie gelöscht werden.

---

## 3. Rollenberechtigungen

Neu in **Rollen & Rechte → News & Schwarzes Brett**:

- **canSendEmployeeNotices** – Mitarbeiterhinweise senden
- **canViewEmployeeNoticeRead** – Lesestatus kontrollieren
- **delEmployeeNotices** – Mitarbeiterhinweise löschen

Master Admin besitzt alle drei Rechte automatisch.

Standardvorgabe:
- Master Admin: senden / Lesestatus / löschen
- Chief Ebene: senden / Lesestatus / löschen
- Ausbildungsleitung: senden / Lesestatus
- Personalabteilung: senden / Lesestatus
- andere Rollen: standardmäßig keine Rechte

Die Rechte können über die bestehende Rollenmatrix geändert werden. Beim Speichern einer Rolle werden die Server-Berechtigungen der Mitarbeiter wie bisher synchronisiert.

Das Löschrecht ist nicht an eine alte sichtbare „Admin“-Rolle gekoppelt, sondern an die neue konfigurierbare Berechtigung.

---

## 4. Newsfeed

Neu im bestehenden Newsfeed:

- Button **„📨 Mitarbeiterhinweis“** für berechtigte Rollen
- Formular mit Mitarbeiter, Betreff, Text und optionalem Ablaufdatum
- Bereich **„Meine Mitarbeiterhinweise“** für den Empfänger
- Bereich **„Mitarbeiterhinweise – Übersicht“** für Rollen mit Lesestatus-/Löschrecht
- Lesestatus mit Datum/Uhrzeit
- Mülleimer-Symbol für Rollen mit Löschrecht

Der normale Newsfeed, News-Vorschläge und die bisherigen News-Lesebestätigungen bleiben getrennt und unverändert.

---

## 5. Firebase

Neuer Datenpfad:

`data/employeeNotices/{recipientId}/{noticeId}`

Firebase Rules wurden erweitert:
- Mitarbeiter dürfen nur ihre eigenen persönlichen Hinweise lesen.
- Nur Rollen mit `canSendEmployeeNotices` oder Master Admin dürfen neue Hinweise erstellen.
- Nur der jeweilige Empfänger darf seinen Hinweis bestätigen.
- Rollen mit `canViewEmployeeNoticeRead` dürfen Übersicht und Lesestatus sehen.
- Rollen mit `delEmployeeNotices` oder Master Admin dürfen Hinweise löschen.
- Wartungsmodus wird berücksichtigt.

**Wichtig:** `database.rules.final.json` muss vor dem Live-Test in Firebase veröffentlicht werden.

Keine bestehende Datenstruktur wird umgebaut. Es ist **keine Datenmigration** erforderlich.

---

## 6. Zusätzlich korrigiert

Der alte sichtbare Prüfungshinweis **„Mehrfachauswahl möglich“** wurde aus dem Untertitel des laufenden Prüfungslaufs entfernt.

---

## 7. Geänderte Dateien

- `app.js`
- `index.html`
- `style.css`
- `database.rules.final.json`
- `PROJECT_STATUS.md`

Unverändert:
- `mdlogo.png`
- `wuensche_und_bugs.md`

---

## 8. Veröffentlichung / Reihenfolge

Vor Veröffentlichung:
1. über die stabile v6.8.3-Seite ein aktuelles JSON-Backup herunterladen,
2. v6.8.3 als Rollback beibehalten.

Danach:
1. **Firebase Rules aus `database.rules.final.json` veröffentlichen**
2. `index.html`, `app.js`, `style.css` veröffentlichen
3. Browser hart neu laden
4. v6.8.4 live testen
5. erst nach erfolgreichem Test v6.8.4 über „Sitzungen & Updates“ als Live-Version bekanntgeben

---

## 9. Live-Test v6.8.4 – erfolgreich abgeschlossen

Am 18.09.2026 wurden die vorgesehenen Live-Tests erfolgreich bestätigt:

- drei neue Rollenrechte sichtbar
- Mitarbeiterhinweis an eingeloggten Mitarbeiter live zugestellt
- Bestätigung „Zur Kenntnis genommen“ funktioniert
- Lesestatus mit Datum/Uhrzeit funktioniert
- offener Hinweis erscheint nach erneutem Login
- Löschen über Mülleimer funktioniert und synchronisiert beim Empfänger
- unberechtigte Rollen sehen weder Senden-Button noch Lesestatus-Übersicht
- normaler Newsfeed funktioniert weiterhin
- normale News-Lesebestätigung funktioniert weiterhin
- Prüfung zeigt keinen Hinweis „Mehrfachauswahl möglich“ mehr

---

## 10. Rollback

**v6.8.3 = vorherige stabile Rollback-Basis**

Bei reinem Web-Rollback auf v6.8.3 kann der neue Firebase-Pfad `employeeNotices` bestehen bleiben. Für einen vollständigen Rückbau können zusätzlich die vorherigen Firebase Rules wiederhergestellt werden.


---

## 11. Stabil-Markierung

**v6.8.4 – ✅ LIVE / STABIL BESTÄTIGT**

Bestätigt am **18.09.2026** nach erfolgreichem Live-Test der Mitarbeiterhinweise, Lesebestätigung, Berechtigungen, Löschfunktion, Login-Pop-up, bestehendem Newsfeed und Prüfungsanzeige.
