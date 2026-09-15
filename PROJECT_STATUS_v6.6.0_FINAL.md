# PROJECT_STATUS – MMD Cloud

## Aktueller Stand
- **Version:** v6.6.0
- **Status:** Live und bestätigt
- **Basis:** bestätigter Live-Stand v6.5.0
- **Live bestätigt am:** 15.09.2026

- Rollen-/Berechtigungsfix: Chief-Materialrechte werden jetzt in den wirksamen Benutzerrechten berücksichtigt und vorhandene serverseitige Berechtigungen bei berechtigtem Login still im Hintergrund abgeglichen. Mitarbeiter müssen nichts neu einstellen.
## Enthaltene Änderungen v6.6.0
- Sichtbarer Name „Chief Ebene“ ohne Bindestrich.
- „Bestands Historie“ ohne Bindestrich.
- Maximalbestände kompakter dargestellt.
- 17 historische Bestandsaufnahmen aus der bereitgestellten Materialliste werden einmalig und nachvollziehbar übernommen.
- Einzelne Bestandsaufnahmen können mit passender Berechtigung über den Mülleimer gelöscht werden.
- Auto-Logout zum Tageswechsel mit zusätzlicher Prüfung bei Fokus, Sichtbarkeit und Seitenwiederaufnahme stabilisiert.
- Neuer Admin-Reiter „Wartungsarbeiten“.
- Wartungsmodus kann nur von Chief Ebene und Master Admin verwaltet werden.
- Während Wartungsarbeiten bleibt „Dokumentation & Einsatz“ für alle freigeschalteten Mitarbeiter verfügbar; andere Bereiche sind für normale Mitarbeiter gesperrt.
- Neue Registrierungen werden während Wartungsarbeiten blockiert.
- Sichtbarer Changelog vollständig vereinfacht; alte Einträge wurden ebenfalls allgemein formuliert.
- Sichtbare Fehler- und Hinweismeldungen wurden von technischen Plattformbegriffen bereinigt. Technische Details bleiben nur in der Konsole für die Fehlersuche.
- Anzeige „Im Dienst“ für längere Mitarbeiternamen verbessert; Namensfelder umbrechen sauber und überlappen nicht.
- Master-Admin-Passwortverwaltung verständlicher gestaltet: bestehende Passwörter werden nicht angezeigt; ein neues vorläufiges Passwort kann separat zurückgesetzt werden und muss beim nächsten Login geändert werden.
- Cache-Version auf v6.6.0 erhöht.

## Sicherheits-/Veröffentlichungsstand
- `database.rules.final.json` wurde für den Wartungsmodus angepasst und veröffentlicht.
- `index.html`, `app.js` und `style.css` wurden veröffentlicht.
- v6.6.0 ist nach erfolgreichem Live-Test als „Live und bestätigt“ freigegeben.

## Live-Tests / bestätigte Punkte
- Normalbetrieb mit Login, Registrierung, Dokumentation & Einsatz und Chief Materialverwaltung geprüft.
- Wartungsmodus als Chief Ebene und Master Admin geprüft.
- Normale Mitarbeiter behalten während Wartung Zugriff auf Dokumentation & Einsatz; übrige Bereiche sind eingeschränkt.
- Chief Ebene und Master Admin behalten während Wartung vollständigen Zugriff.
- Registrierung wird während Wartung gesperrt und ist danach wieder möglich.
- Bereits eingeloggte normale Mitarbeiter werden beim Aktivieren des Wartungsmodus eingeschränkt.
- Auto-Logout/Tageswechsel wurde überarbeitet und ist Teil des bestätigten v6.6.0-Stands.
- 17 Altbestände wurden in die Bestands Historie übernommen.
- Historieneinträge können mit passender Berechtigung einzeln über den Mülleimer gelöscht werden.
- Sichtbare Fehler- und Hinweismeldungen sind allgemein formuliert und enthalten keine unnötigen Plattformnamen.
- Master-Admin-Passwortverwaltung ist verständlich getrennt und kann ein neues vorläufiges Passwort setzen.

## Zusätzlich live bestätigt
- Der Hauptreiter **„Chief Ebene“** wird bei Mitarbeitern mit der Rolle Chief Ebene korrekt angezeigt.
- Die Chief-Materialrechte werden in den wirksamen Benutzerrechten korrekt berücksichtigt.
- Bestehende Rollen mussten dafür nicht neu vergeben werden; die Korrektur greift im Hintergrund.

## Bestätigter Rollback-Stand
- **v6.5.0** bleibt als bestätigter Rollback-Stand erhalten.


### Rollenanzeige (v6.6.0)
- Standardrollen werden in der festgelegten Reihenfolge angezeigt: Master Admin, Chief Ebene, Ausbildungsleitung, Ausbilder, Personalabteilung, Psychologie, CLS Ausbilder, EHK Ausbilder, Luftrettung, Mitarbeiter.
- Sichtbare Namen wurden vereinheitlicht; interne Rollen-IDs und bestehende Berechtigungszuordnungen bleiben unverändert.

## Nachtrag v6.6.0
- Berechtigungsfehler bei Chief-Materialrechten behoben: Rollenrechte werden jetzt korrekt in die wirksamen Benutzerrechte übernommen.
- Passwortformular um ein verborgenes Benutzername-Feld für Browser-Kompatibilität ergänzt.

## Aktuelle Ausgangsbasis
- **v6.6.0 ist der neue produktive und bestätigte Ausgangsstand für weitere Änderungen.**
- Weitere Änderungen sollen auf diesem Stand aufbauen.
