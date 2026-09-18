# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.4  
**Aktueller Entwicklungsstand:** v6.8.5  
**Status v6.8.5:** 🟡 VORBEREITET / LIVE-TEST AUSSTEHEND  
**Datum:** 18.09.2026

---

## 1. Verbindliche Basis

**v6.8.4 = bestätigte stabile Live-Version**

v6.8.4 bleibt bis zur erfolgreichen Live-Bestätigung von v6.8.5 die verbindliche Rollback-Basis.

---

## 2. Entwicklung v6.8.5 – Profilbild-Übersicht

Im Bereich **Mitarbeiter** gibt es für den Master Admin einen neuen Button **„📋 Foto-Liste“** direkt neben dem Foto-Ordner.

Die Liste:
- ist ausschließlich für Master Admin sichtbar,
- enthält alle registrierten Mitarbeiter, auch neu registrierte noch nicht freigeschaltete Konten,
- ist nach Dienstnummer sortiert,
- zeigt Dienstnummer, Vorname und Nachname,
- markiert Mitarbeiter ohne eigenes Profilbild als offen,
- markiert Mitarbeiter mit eigenem Profilbild automatisch mit ✅,
- aktualisiert sich automatisch über den bestehenden Live-Listener von `data/users`,
- setzt den Status wieder auf offen, wenn ein Profilbild auf das Standardlogo zurückgesetzt wird.

Es wird dafür **kein neuer Firebase-Datenpfad** angelegt. Der Status wird direkt aus dem bestehenden Feld `photoUrl` abgeleitet.

---

## 3. Entwicklung v6.8.5 – Mitarbeiterhinweis an mehrere Empfänger

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

Für v6.8.5 wurden **keine Firebase Rules geändert**.

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

## 5. Geänderte Dateien v6.8.5

- `app.js`
- `index.html`
- `style.css`
- `PROJECT_STATUS.md`

Unverändert:
- `database.rules.final.json`
- `mdlogo.png`

---

## 6. Live-Test v6.8.5

Nach Veröffentlichung prüfen:

1. Master Admin: Im Bereich Mitarbeiter ist **„📋 Foto-Liste“** sichtbar.
2. Nicht-Master: Der Button und die Foto-Liste sind nicht sichtbar.
3. Foto-Liste: Dienstnummer, Vorname und Nachname werden korrekt und nach DN sortiert angezeigt.
4. Mitarbeiter ohne eigenes Foto werden als offen angezeigt.
5. Über **„Foto einstellen“** ein Bild hinterlegen: Eintrag springt automatisch auf ✅.
6. Foto auf Standardlogo zurücksetzen: Eintrag wird automatisch wieder offen.
7. Neues Testkonto registrieren: Das Konto erscheint automatisch in der Foto-Liste des Master Admin.
8. Mitarbeiterhinweis öffnen: Mehrere Empfänger können per Checkbox ausgewählt werden.
9. Empfängeranzeige beginnt mit der Dienstnummer.
10. Einen Hinweis gleichzeitig an mindestens zwei Mitarbeiter senden.
11. Beide Empfänger erhalten jeweils ihren eigenen Hinweis.
12. Beide Lesebestätigungen funktionieren weiterhin getrennt.
13. Berechtigungen, normaler Newsfeed und bisherige Mitarbeiteransicht kurz gegenprüfen.

---

## 7. Rollback

Bis zur erfolgreichen Live-Bestätigung:

**v6.8.4 = stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback nicht verändert werden, da v6.8.5 keine Rules-Änderung enthält.
