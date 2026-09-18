# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5c  
**Aktueller Entwicklungsstand:** v6.8.5c  
**Status v6.8.5c:** ✅ LIVE / STABIL BESTÄTIGT  
**Datum:** 18.09.2026

---

## 1. Verbindliche Basis

**v6.8.5c = bestätigte stabile Live-Version und Rollback-Basis**

v6.8.5c enthält ausschließlich die Korrektur der Accessibility-Warnung bei der Mitarbeiter-Empfängerauswahl. Die sichtbare Beschriftung „Mitarbeiter:“ ist korrekt als Gruppenbeschriftung mit der Checkbox-Gruppe verknüpft. Der Live-Gegencheck wurde erfolgreich abgeschlossen; in den Browser-DevTools werden keine Probleme mehr angezeigt. Es wurden keine Firebase-, Auth-, Rollen-, Berechtigungs- oder Datenänderungen vorgenommen.

**v6.8.5b = vorherige stabile Live-Version**

Der Live-Test von v6.8.5b wurde am 18.09.2026 erfolgreich und ohne funktionale Fehler abgeschlossen.

**v6.8.5c ist damit die aktuelle stabile Rollback-Basis.**

---

## 2. v6.8.5b – Profilbild-Übersicht

Im Bereich **Mitarbeiter** gibt es für den Master Admin einen neuen Button **„📋 Foto-Liste“** direkt neben dem Foto-Ordner.

Die Liste:
- ist ausschließlich für Master Admin sichtbar,
- zeigt bei fehlendem Profilbild direkt den Button **„📨 Foto-Hinweis“**,
- verschickt darüber einen automatisch personalisierten Hinweis mit dem Namen des Mitarbeiters,
- weist zusätzlich auf das **Besprechungsoutfit** hin,
- bittet darum, sich bei Motiv und Position an den bereits vorhandenen Mitarbeiterfotos zu orientieren,
- stellt klar, dass das Foto **nicht selbst bearbeitet werden muss**, weil die Bearbeitung durch **DN 07 Tim Sanddorn** übernommen wird,
- nennt weiterhin **Fabio Leroux** als Unterstützung bei der Aufnahme,
- der versendete Hinweis erscheint automatisch unter **„Mitarbeiterhinweise Übersicht“** und behält die normale Lesebestätigung,
- enthält alle registrierten Mitarbeiter, auch neu registrierte noch nicht freigeschaltete Konten,
- ist nach Dienstnummer sortiert,
- zeigt Dienstnummer, Vorname und Nachname,
- markiert Mitarbeiter ohne eigenes Profilbild als offen,
- markiert Mitarbeiter mit eigenem Profilbild automatisch mit ✅,
- aktualisiert sich automatisch über den bestehenden Live-Listener von `data/users`,
- setzt den Status wieder auf offen, wenn ein Profilbild auf das Standardlogo zurückgesetzt wird.

Es wird dafür **kein neuer Firebase-Datenpfad** angelegt. Der Status wird direkt aus dem bestehenden Feld `photoUrl` abgeleitet.

---

## 3. v6.8.5b – Mitarbeiterhinweis an mehrere Empfänger

Der bestehende Mitarbeiterhinweis bleibt ein persönlicher Hinweis und kein Chat.

Neu:
- mehrere freigeschaltete Mitarbeiter können gleichzeitig ausgewählt werden,
- Auswahl erfolgt über Checkboxen,
- Dienstnummer steht in der Auswahl vorne, z. B. **DN 05 – Mike Gonzalo**,
- Empfänger sind nach Dienstnummer sortiert,
- jeder ausgewählte Mitarbeiter erhält einen eigenen Hinweis,
- jeder Empfänger besitzt weiterhin seine eigene Lesebestätigung,
- Lesestatus und Löschfunktion funktionieren weiterhin pro Mitarbeiter und Hinweis.

Die vorhandene Datenstruktur bleibt unverändert:

`data/employeeNotices/{recipientId}/{noticeId}`

Mehrere Hinweise werden beim Senden gesammelt in einem Firebase-Update geschrieben.

---

## 4. Sicherheit / Firebase

Für v6.8.5b wurden **keine Firebase Rules geändert**.

Unverändert bleiben insbesondere:
- Firebase Auth
- Registrierung und Login
- `authIndex`
- `loginDirectory`
- stabile Account-IDs
- Rollen und Berechtigungen
- Benutzerverwaltung
- bestehende Realtime-Database-Rules

Die Foto-Liste ist zusätzlich in der Oberfläche und in der JavaScript-Funktion auf Master Admin begrenzt.

---

## 5. Geänderte Dateien v6.8.5b

- `app.js`
- `index.html`
- `style.css`
- `PROJECT_STATUS.md`

Unverändert:
- `database.rules.final.json`
- `mdlogo.png`

---

## 6. Live-Test v6.8.5b

Die Überschrift **„Mitarbeiterhinweise – Übersicht“** wurde außerdem zu **„Mitarbeiterhinweise Übersicht“** geändert.

Der Live-Test wurde am **18.09.2026 erfolgreich abgeschlossen**.

Bestätigt wurden:
1. Master Admin sieht **„📋 Foto-Liste“**.
2. Nicht-Master sieht Button und Foto-Liste nicht.
3. Foto-Liste zeigt Dienstnummer, Vorname und Nachname korrekt und nach DN sortiert.
4. Mitarbeiter ohne eigenes Foto werden als offen angezeigt.
5. Eigenes Foto über **„Foto einstellen“** setzt den Status automatisch auf ✅.
6. Zurücksetzen auf das Standardlogo setzt den Status wieder auf offen.
7. Neu registrierte Konten erscheinen automatisch in der Foto-Liste.
8. **„📨 Foto-Hinweis“** erzeugt den vorgesehenen personalisierten Mitarbeiterhinweis.
9. Der Hinweis erscheint unter **„Mitarbeiterhinweise Übersicht“**.
10. Lesebestätigung mit Datum/Uhrzeit funktioniert.
11. Mehrere Empfänger können per Checkbox ausgewählt werden.
12. Die Empfängeranzeige beginnt mit der Dienstnummer.
13. Ein Hinweis kann gleichzeitig an mindestens zwei Mitarbeiter gesendet werden.
14. Jeder Empfänger erhält einen eigenen Hinweis.
15. Die Lesebestätigungen funktionieren weiterhin getrennt.
16. Berechtigungen, normaler Newsfeed und bisherige Mitarbeiteransicht wurden erfolgreich gegengeprüft.

Hinweis:
- Die zuvor angezeigte Accessibility-/Verbesserungswarnung **„No label associated with a form field“** wurde mit v6.8.5c behoben.
- Der Live-Gegencheck zeigt keine Probleme mehr in den Browser-DevTools.

---

## 7. Rollback

**v6.8.5c = aktuelle stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback auf diesen Stand nicht verändert werden, da v6.8.5b keine Rules-Änderung enthält.
