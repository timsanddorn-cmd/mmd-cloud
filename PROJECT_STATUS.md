# MMD CLOUD – PROJECT STATUS

## Aktueller Stand
- **Version:** v6.4.0 (vorbereitet)
- **Status:** Dateien erstellt – Veröffentlichung und Live-Test noch offen
- **Datum des letzten bestätigten Updates:** 14.09.2026

## Aktive Projektdateien
- `index.html`
- `app.js`
- `style.css`
- `database.rules.final.json`

## Firebase
- Firebase Authentication mit E-Mail/Passwort ist aktiv.
- Die sichtbare Mitarbeiter-Anmeldung erfolgt weiterhin über Vorname + Nachname + Passwort.
- Technische Firebase-E-Mail-Adressen bleiben für Mitarbeiter unsichtbar.
- Die finalen rollenbasierten Realtime Database Security Rules sind veröffentlicht und aktiv.
- Feste Account-IDs sowie `authIndex` und `loginDirectory` bilden die Benutzerzuordnung.
- Passwörter werden im regulären Betrieb nicht im Klartext in der Realtime Database gespeichert.
- Temporäre Migrationsregeln sind nicht mehr aktiv und dürfen nicht wieder versehentlich veröffentlicht werden.

## Rollen & Berechtigungen
- Master-Admin besitzt die höchsten administrativen Rechte.
- Chief-Ebene übernimmt die vorgesehenen Admin-Funktionen.
- Dauerhaftes Löschen von Mitarbeiterkonten und privilegierte Rollenzuweisungen bleiben Master-Admin vorbehalten.
- Berechtigungen werden sowohl in der Oberfläche als auch in kritischer Logik und Firebase Rules berücksichtigt.

## Zuletzt umgesetzt
- Umstellung der Mitarbeiter-Anmeldung auf Firebase Authentication.
- Migration bestehender Alt-Konten.
- Feste Account-IDs eingeführt.
- Login- und Rollenlogik abgesichert.
- Finalen Firebase-Regelsatz veröffentlicht.
- Passwort-Umstellungsstatus im Adminbereich ergänzt.
- Offene Passwortänderungen sind für den Master-Admin sichtbar.
- Erinnerungen für Mitarbeiter mit noch offener Passwortänderung können kopiert werden.
- Passwort-Reset durch Master-Admin führt bei entsprechenden Konten wieder zu einem persönlichen Passwortwechsel.
- Backup nach erfolgreicher Migration erstellt.
- Neuer System-Prompt für zukünftige Entwicklungs-Chats erstellt.

## Erfolgreich getestet
- Master-Admin-Anmeldung.
- Admin-Zentralverwaltung.
- Mitarbeiter-Kartei.
- Rollen- und Berechtigungs-Matrix.
- Backup & Wiederherstellung.
- System-Protokoll.
- Normaler Mitarbeiter-Login am Testkonto Max Mustermann.
- Erzwungener persönlicher Passwortwechsel am Testkonto.
- Anmeldung mit neuem Passwort nach Passwortwechsel.
- Passwort-Umstellungsstatus zeigt abgeschlossene und offene Konten korrekt an.
- Finale Firebase Security Rules funktionieren im getesteten Betrieb.

## Offene Tests
- Der exakte Übergangslogin eines noch unangetasteten Alt-Kontos mit dem ursprünglichen Alt-Passwort kann bei einem realen Mitarbeiter weiterhin natürlich beobachtet werden.
- Dieser offene Beobachtungstest blockiert den produktiven Betrieb nicht.

## Bekannte technische Grenzen / Hinweise
- Alte, nicht mehr zugeordnete technische Firebase-Auth-Konten können nach administrativen Resets oder Löschungen in Firebase Authentication sichtbar bleiben. Ohne gültigen `authIndex` besitzen sie keinen Zugriff auf die MD-Datenbank.
- Das Prüfungsmodul wertet korrekte Antworten weiterhin clientseitig aus. Vollständige Manipulationssicherheit würde eine serverseitige Auswertung erfordern.
- `database.rules.migration.json` ist nur historische Migrationsdatei und darf nicht als aktive Regel veröffentlicht werden.

## Offene Aufgaben / nächste Ideen
- Aktuell keine zwingenden technischen Folgearbeiten.
- Weitere Updates und Bugfixes werden in neuen Chats auf Basis dieses Projektstands geplant.
- Optionale spätere Verbesserungen können einzeln geplant und vor Umsetzung freigegeben werden.

## Backup-Stand
- Nach erfolgreicher Migration und den abschließenden Funktionstests wurde ein neues Realtime-Database-Backup erstellt.
- Das ältere Vor-Migrations-Backup soll zusätzlich aufbewahrt werden.

## Übergabehinweis für neuen Chat
Für einen neuen Entwicklungs-Chat möglichst bereitstellen:
1. `MD-Homepage-System-Prompt-v2.1.md`
2. diese `PROJECT_STATUS.md`
3. aktuelle `index.html`
4. aktuelle `app.js`
5. aktuelle `style.css`
6. bei Firebase-, Login-, Rollen- oder Berechtigungsthemen zusätzlich `database.rules.final.json`

Bereits bestätigte Bereiche – insbesondere Login, Topbar, Admin-Grundstruktur, Firebase-Authentifizierung und Rollen-/Berechtigungslogik – dürfen nicht ungefragt neu gestaltet oder refaktoriert werden.

Die tatsächlich aktuellen, vom Nutzer bestätigten Projektdateien haben immer Vorrang vor dieser Statusdatei.


## Update v6.4.0 – vorbereitet, noch nicht live bestätigt
- Registrierung und Freischaltung stabilisiert.
- Dienstnummer-Hover mit Fallback über die feste Account-ID ergänzt.
- Sichtbare Systemrolle Admin entfernt; alte Zuordnungen werden kontrolliert auf Chief-Ebene migriert.
- Statusanzeige für wartende, aktive und gesperrte Konten verbessert.
- Fehlerbehandlung bei Freischaltung, Sperrung und Prüfungsaktionen ergänzt.
- Bestehenden Changelog allgemeinverständlicher formuliert.
- `database.rules.final.json` bleibt gegenüber v6.3.0 unverändert.
- Dieser Stand darf erst nach erfolgreicher Veröffentlichung und Live-Test als bestätigt/live markiert werden.
