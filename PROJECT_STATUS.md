# MMD CLOUD – PROJECT STATUS

## Aktueller Stand
- **Version:** v6.5.0
- **Status:** Bereit zur Veröffentlichung – noch nicht live bestätigt
- **Datum des letzten bestätigten Updates:** 15.09.2026 (v6.4.2 bleibt letzter bestätigter Live-Stand bis zum v6.5.0-Test)

## Aktive Projektdateien
- `index.html`
- `app.js`
- `style.css`
- `database.rules.final.json`

## Firebase
- Firebase Authentication mit E-Mail/Passwort ist aktiv.
- Die sichtbare Mitarbeiter-Anmeldung erfolgt weiterhin über Vorname + Nachname + Passwort.
- Technische Firebase-E-Mail-Adressen bleiben für Mitarbeiter unsichtbar.
- Der für v6.4.2 angepasste rollenbasierte Realtime-Database-Regelsatz ist veröffentlicht und im Live-Betrieb bestätigt.
- Feste Account-IDs sowie `authIndex` und `loginDirectory` bilden die Benutzerzuordnung.
- Passwörter werden im regulären Betrieb nicht im Klartext in der Realtime Database gespeichert.
- Temporäre Migrationsregeln sind nicht mehr aktiv und dürfen nicht wieder versehentlich veröffentlicht werden.

## Rollen & Berechtigungen
- Master-Admin besitzt die höchsten administrativen Rechte.
- Chief-Ebene übernimmt die vorgesehenen Admin-Funktionen.
- Dauerhaftes Löschen von Mitarbeiterkonten und privilegierte Rollenzuweisungen bleiben Master-Admin vorbehalten.
- Berechtigungen werden sowohl in der Oberfläche als auch in kritischer Logik und Firebase Rules berücksichtigt.

## Zuletzt umgesetzt
- v6.4.2 erfolgreich veröffentlicht und live getestet.
- Ausstehende Registrierungen sind für berechtigte Rollen sichtbar und direkt freischaltbar.
- Die Mitarbeiter-/Adminansicht lädt neue Registrierungen zuverlässig aus Firebase.
- Gelöschte Mitarbeiter können sich erneut mit demselben Namen registrieren; die technische Auth-Version wird dabei automatisch erhöht.
- Alte Firebase-Auth-Konten erhalten ohne gültigen `authIndex` keinen Datenbankzugriff.
- Dienstnummern werden im Bereich „Im Dienst“ beim Hover wieder zuverlässig angezeigt, soweit eine DN vorhanden ist.
- Die sichtbare Systemrolle „Admin“ wurde entfernt; die Chief-Ebene übernimmt deren vorgesehenen Funktionsumfang.
- Statusanzeigen für wartende, aktive und gesperrte Konten wurden verständlicher gestaltet.
- Fehlerbehandlung bei Freischaltung, Sperrung und Prüfungsaktionen wurde verbessert.
- Der bestehende Changelog wurde allgemeinverständlicher formuliert.
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
- v6.4.2 Veröffentlichung und Live-Betrieb.
- Neuregistrierung eines Mitarbeiters.
- Anzeige eines neuen Kontos als „Wartet auf Freischaltung“.
- Freischaltung eines neuen Mitarbeiters durch berechtigte Rolle.
- Anmeldung nach erfolgter Freischaltung.
- Sperren und erneute Freischaltung.
- Löschen eines Mitarbeiters und anschließende erneute Registrierung mit demselben Namen.
- Automatische Erhöhung der technischen Auth-Version bei Wiederregistrierung.
- Mitarbeiter-Kartei und Adminverwaltung zeigen neue Registrierungen zuverlässig an.
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
- Der Stand v6.4.2 gilt als produktiv bestätigt und ist die neue Ausgangsbasis für weitere Änderungen.
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


## Update v6.4.0 – in v6.4.2 aufgegangen
- Registrierung und Freischaltung stabilisiert.
- Dienstnummer-Hover mit Fallback über die feste Account-ID ergänzt.
- Sichtbare Systemrolle Admin entfernt; alte Zuordnungen werden kontrolliert auf Chief-Ebene migriert.
- Statusanzeige für wartende, aktive und gesperrte Konten verbessert.
- Fehlerbehandlung bei Freischaltung, Sperrung und Prüfungsaktionen ergänzt.
- Bestehenden Changelog allgemeinverständlicher formuliert.
- `database.rules.final.json` bleibt gegenüber v6.3.0 unverändert.
- Dieser Zwischenstand ist vollständig in v6.4.2 aufgegangen.


## Hotfix v6.4.2 – live und bestätigt
- Enthält vollständig die vorgesehenen Verbesserungen aus v6.4.1; v6.4.1 musste nicht separat veröffentlicht werden.
- Gelöschte Mitarbeiter können sich erneut mit demselben Namen registrieren; die technische Auth-Version wird automatisch erhöht.
- Alte Firebase-Auth-Konten erhalten keinen neuen Datenbankzugriff, weil nur die neue UID in `authIndex` eingetragen wird.
- `database.rules.final.json` wurde gezielt für sichere Wiederregistrierung und Registrierungs-Rollbacks erweitert.
- Veröffentlichung erfolgte erfolgreich mit kontrollierter Rules- und Datei-Reihenfolge.

## In v6.4.2 enthaltene Freischaltungsverbesserungen
- Ausstehende Registrierungen werden für berechtigte Rollen zusätzlich in der Mitarbeiter-Kartei angezeigt.
- Freischaltung ist dort direkt möglich.
- Adminverwaltung lädt Benutzer beim Öffnen nochmals frisch aus Firebase.
- Live-Test erfolgreich abgeschlossen; dieser Stand ist bestätigt.


## Geplantes Update v6.5.0 – noch nicht live bestätigt
- Neuer Hauptreiter `⭐ Chief-Ebene` mit zentraler Materialverwaltung.
- Grundlage ist die bereitgestellte XLSX-Materialliste: Wundreiniger, Nahtset, Verband, Schiene, Kühlpack, MediKit sowie Schmerzmittel 5/10/15/20 mg.
- Automatische Verbrauchsberechnung und Farbstufen: Überschuss, 0–199, 200–399, 400–599, ab 600 verbraucht.
- Standard-Maximalbestände: 2500; MediKit 3000; Schmerzmittel 10 mg 3500. Diese Werte können berechtigt geändert werden.
- Zentrale Firebase-Historie mit Stichtag, Auffüllstatus und erfassendem Mitarbeiter.
- Neue Rollenrechte `canViewChiefMaterials` und `canEditChiefMaterials`; Chief-Ebene und Master-Admin erhalten standardmäßig Zugriff.
- Firebase Rules um den geschützten Pfad `data/chiefMaterials` und die beiden Berechtigungsfelder erweitert.
- Chief-Materialdaten bleiben beim Fachdaten-Reset erhalten.
- Browser-DOM-Warnungen der Passwortfelder `newPasswordInput` und `permPassword` durch saubere Formular-Struktur beseitigt.
- DN-Hover erweitert: Falls ein Presence-Eintrag keine verwertbare Account-ID/DN besitzt, wird zusätzlich über Vor- und Nachname in der Mitarbeiterkartei nach der Dienstnummer gesucht (u. a. für Alt-/Sonderfälle wie Neo Castilla).
- Chief-Materialrechte werden in UI und Firebase Rules konsequent über `canViewChiefMaterials` / `canEditChiefMaterials` gesteuert; ein bewusst deaktiviertes Rollenrecht wird respektiert.
- Cache-Busting auf v6.5.0 angehoben.

### Offene Live-Tests für v6.5.0
- Chief-Ebene sichtbar für Chief/Master-Admin und unsichtbar ohne Berechtigung.
- Rollenrechte zum Anzeigen/Bearbeiten testen.
- Bestandsaufnahme speichern und in einem zweiten berechtigten Konto sichtbar prüfen.
- Verbrauchsberechnung und alle fünf Farbstufen prüfen.
- Maximalbestände ändern und neue Berechnung prüfen.
- Auffüllstatus und Auffülldatum prüfen.
- Historieneintrag löschen (nur mit Bearbeitungsrecht).
- Firebase `permission_denied` für unberechtigte direkte Zugriffe prüfen.
- Browser-Konsole auf die beiden bisherigen Passwort-DOM-Warnungen prüfen.

**Wichtig:** v6.5.0 darf erst nach Veröffentlichung und erfolgreichen Live-Tests als „Live und bestätigt“ markiert werden. Bis dahin bleibt v6.4.2 der bestätigte Rollback-Stand.
