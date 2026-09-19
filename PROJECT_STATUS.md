# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5j  
**Aktueller Entwicklungsstand:** v6.8.6  
**Status v6.8.6:** 🟡 LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 20.09.2026

---

## 1. Verbindliche Basis

**v6.8.5j = bestätigte stabile Live-Version und aktuelle Rollback-Basis**

v6.8.6 baut direkt auf dem bestätigten Stand v6.8.5j auf und erweitert ausschließlich Bedienkomfort, Übersicht und Schutz vor versehentlich verlorenen Eingaben.

Firebase Auth, Registrierung, Login, stabile Account-IDs, Rollenmodell, Berechtigungen, Datenpfade und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.6 – Komfortpaket 1–7

### Admin-Kontrollzentrum
Der Admin-Bereich startet mit einer Übersicht der wichtigsten offenen Punkte:
- offene Registrierungen,
- fehlende Profilbilder,
- offene Passwortumstellungen,
- aktive Browser,
- Wartungsstatus,
- aktuelle und verteilte Browser-Version.

Die Kacheln führen direkt zum jeweils passenden Verwaltungsbereich.

### Schutz vor ungespeicherten Änderungen
Bei wichtigen Bearbeitungen wird vor dem Verwerfen nicht gespeicherter Eingaben gewarnt. Der Schutz gilt insbesondere für:
- Rollen & Rechte,
- Mitarbeiter bearbeiten,
- Kalendertermine,
- News-Beiträge und News-Vorschläge,
- Verlassen der Seite bei noch offenen Änderungen.

### Mitarbeiterfilter
Die Mitarbeiterkartei besitzt zusätzliche Filter für:
- Status,
- Profilbild vorhanden / fehlt,
- Rolle.

Die bestehende Suche nach DN oder Name bleibt erhalten.

### Nächste Termine
Oberhalb des Monatskalenders werden bis zu fünf der nächsten für den angemeldeten Mitarbeiter sichtbaren Termine angezeigt. Termine können direkt aus dieser Übersicht geöffnet werden.

### Benachrichtigungszähler
Zusätzlich zum bereits vorhandenen News-Zähler werden kleine Zähler angezeigt für:
- offene Kalendereinladungen,
- offene Mitarbeiterregistrierungen im Admin-/Mitarbeiterbereich.

### Backup-Vorschau
Vor einer Wiederherstellung wird das ausgewählte Backup zuerst geprüft und übersichtlich angezeigt:
- Dateiname,
- Erstellungszeit,
- gespeicherte MMD-Cloud-Version,
- Anzahl wichtiger Datensätze wie Mitarbeiter, Termine, Prüfungen, News und weitere Bereiche.

Erst nach dieser Vorschau kann die Wiederherstellung endgültig bestätigt werden. Die bestehende Schutzlogik für Auth-Zuordnungen und aktuelle Zugänge bleibt unverändert.

### MMD-Hinweise statt unnötiger Browser-Popups
Mehrere erfolgreiche Alltagsaktionen zeigen jetzt dezente Hinweise unten rechts, ohne den Arbeitsfluss mit einem Browser-Popup zu blockieren. Fehlermeldungen und sicherheitsrelevante Bestätigungen bleiben weiterhin deutlich sichtbar.

---

## 3. Sicherheit / Firebase

Für v6.8.6 wurden **keine Firebase Rules geändert**.

Unverändert bleiben insbesondere:
- Firebase Auth,
- Registrierung und Login,
- `authIndex`,
- `loginDirectory`,
- stabile Account-IDs,
- Benutzer- und Rollenstruktur,
- bestehende Rechteprüfung,
- bestehende Datenpfade,
- bestehende Backup-Schutzlogik für aktuelle Auth-Konten.

Eine Datenmigration ist nicht erforderlich.

---

## 4. Live-Gegencheck v6.8.6

Noch zu prüfen:
1. Admin öffnet standardmäßig im Kontrollzentrum und alle sichtbaren Kacheln führen korrekt zum Ziel,
2. Admin-Rechte und Master-Admin-only Bereiche bleiben unverändert geschützt,
3. Warnung bei ungespeicherten Rollen-, Mitarbeiter-, Kalender- und News-Änderungen funktioniert,
4. Mitarbeiterfilter lassen sich kombinieren und zurücksetzen,
5. Mitarbeiter ohne Verwaltungsrecht sehen weiterhin nur die für sie vorgesehenen Mitarbeiter,
6. nächste Termine entsprechen der bisherigen Kalender-Sichtbarkeit,
7. offene Kalendereinladungen und Registrierungen werden korrekt gezählt,
8. Backup-Datei wird vor einer Wiederherstellung nur angezeigt und noch nicht geschrieben,
9. endgültige Backup-Wiederherstellung behält aktuelle Auth-Zuordnungen wie bisher,
10. neue MMD-Hinweise erscheinen ohne die jeweilige Aktion zu blockieren,
11. bestehende News-, Foto-, Kalender-, Rollen- und Browser-Update-Funktionen arbeiten weiterhin.

---

## 5. Rollback

**v6.8.5j = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback auf v6.8.5j nicht verändert werden.
