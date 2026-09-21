# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.6a  
**Aktueller Entwicklungsstand:** v6.8.7j  
**Status v6.8.7j:** 🟡 DN-SYNCHRONISIERUNG BESTÄTIGT / GESAMTER LIVE-GEGENCHECK NOCH AUSSTEHEND  
**Datum:** 21.09.2026

---

## 1. Verbindliche Basis

**v6.8.6a = bestätigte stabile Code-Rollback-Basis**

v6.8.7j baut auf v6.8.7i auf. Das Speichern im Bereich Rollen & Rechte wurde stabilisiert und die Laufbahn-Berechtigung in den ServerPermissions-Rules ausdrücklich ergänzt.

Firebase Auth, Passwörter, `authIndex`, `loginDirectory` und bestehende Account-IDs wurden nicht verändert. Die Rollenverwaltung erhielt ausschließlich die neue Berechtigung `canManageCareerPaths`; die Realtime-Database-Rules wurden nur für den neuen getrennten Pfad `data/employeeCareerPaths` ergänzt.

---

## 2. Offizielle DN-Liste 20.09.2026

Hinterlegte Zuordnung:
- DN 11 – Dr. Hiroto Takahashi
- DN 12 – Rene Stoned
- DN 13 – Mark Akuma
- DN 14 – Sam Franzika
- DN 15 – Rico Malz
- DN 27 – Ray Harper
- DN 30 – Maximilian Miami
- DN 40 – Fabio Leroux
- DN 41 – Conny Grey
- DN 42 – Domek Redfield
- DN 43 – Chiko Muerto
- DN 44 – Brian Akuma
- DN 45 – Alesya Leroux
- DN 46 – Luna Hunter
- DN 47 – John Fernandez Smith
- DN 48 – Nilo Leroux
- DN 49 – Neo Castilla
- DN 50 – Raven Marchetti
- DN 51 – Rico Reimer
- DN 52 – Andy Laken
- DN 53 – Lars Petersen

---

## 3. Synchronisierungslogik

Die Synchronisierung:
- läuft ausschließlich in einer angemeldeten Master-Admin-Sitzung,
- gleicht nur bereits vorhandene/registrierte Benutzerkonten anhand von Vor- und Nachname ab,
- ignoriert Namen aus der Liste, die noch kein Benutzerkonto besitzen,
- lässt bereits korrekte Dienstnummern unverändert,
- prüft vor dem Schreiben auf doppelte Ziel-Dienstnummern,
- bricht bei einer Doppelbelegung vollständig ab, bevor DNs geändert werden,
- schreibt ausschließlich das vorhandene Feld `data/users/{accountId}/dn`,
- migriert bei einer geänderten DN vorhandene alte News-Lesebestätigungen von der früheren DN auf die stabile Account-ID,
- protokolliert jede tatsächlich geänderte alte und neue DN im bestehenden Systemprotokoll.

Die Logik ist idempotent: Nach erfolgreicher Aktualisierung entstehen bei späteren Aufrufen keine weiteren DN-Änderungen.

---

## 4. Profilbild-Übersicht v6.8.7b

Geändert:
- Schriftgrößen und Abstände innerhalb der Profilbild-Übersicht wurden kompakter abgestimmt,
- die geöffnete Übersicht besitzt jetzt „Einklappen / Ausklappen“ im Kopf,
- der bestehende Button „Foto-Liste“ öffnet die Übersicht weiterhin wie bisher,
- Foto-Hinweise und Foto-Statuslogik wurden nicht verändert.

---

## 5. Schriftgrößen v6.8.7c

Die Schriftgrößen wurden auf der gesamten MMD Cloud in ein einheitliches System überführt:
- normale Texte: überwiegend 12–13 px,
- Buttons und Formulare: 12 px,
- Labels und Tabelleninhalte: 10–11 px,
- Überschriften: klar abgestuft,
- mobile Darstellung: leicht kompakter.

Dadurch sollen sehr kleine Einzeltexte und unnötig große Ausreißer reduziert werden. Funktionen und Inhalte wurden nicht verändert.

---

## 6. Schriftgrößen v6.8.7d

Auf Wunsch wurde die gesamte Schriftstaffel noch einmal deutlich angehoben:
- kleine Hinweise: überwiegend 12 px,
- Labels und Tabelleninhalte: etwa 13 px,
- Buttons und Formulare: etwa 14 px,
- normale Grundschrift: etwa 15 px,
- Überschriften entsprechend jeweils ca. 2 px größer als in v6.8.7c.

Auch die mobile Staffel wurde um etwa 2 px angehoben.

---

## 7. Modalfenster v6.8.7e

Behoben:
- alle vorhandenen `.modal-overlay`-Fenster werden beim Laden direkt an den Dokument-Body verschoben,
- dadurch bezieht sich die feste Positionierung wieder auf den sichtbaren Browserbereich,
- auch nach langem Scrollen sollen Fenster direkt sichtbar öffnen,
- die bestehende interne Scrollfunktion langer Dialoge bleibt erhalten,
- „Foto-Liste“ wurde im aktuellen UI in „Foto liste“ geändert.

---

## 8. Bestands Historie v6.8.7f

Geändert:
- der horizontale Scrollbalken steht jetzt oberhalb der Historientabelle direkt unter der Beschreibung,
- die obere Scrollleiste steuert die Tabelle synchron,
- der bisherige untere horizontale Scrollbalken wird ausgeblendet,
- Tabelleninhalt, Löschfunktion und Berechtigungen wurden nicht verändert.

---

## 9. Bestätigung der DN-Synchronisierung

Am 20.09.2026 wurde die DN-Aktualisierung im Live-System vom Nutzer bestätigt.

Bestätigt:
- die Dienstnummern wurden aktualisiert,
- die Änderungen sind in der Mitarbeiterkartei sichtbar,
- es war keine manuelle Bearbeitung einzelner Mitarbeiter nötig.

Damit gilt die **DN-Synchronisierung als erfolgreich abgeschlossen**.

Der vollständige Live-Gegencheck der zusätzlichen Funktionen aus v6.8.7 steht weiterhin aus.

---

## 10. Auswirkungen auf Login und Konten

Die DN ist **nicht** Bestandteil der technischen Login-Zuordnung.

Unverändert bleiben:
- Vor- und Nachname,
- feste Account-ID,
- Firebase Auth UID,
- Passwort,
- Login-Key,
- `authIndex`,
- `loginDirectory`,
- Rollen und Rechte,
- Kontostatus.

Daher ist durch die reine DN-Aktualisierung kein Login-Wechsel vorgesehen.

Historische Datensätze wie frühere Prüfungsabgaben oder alte Protokolle behalten ihre damals gespeicherte DN als Historie.

---

## 11. Rollback / Nachvollziehbarkeit

**v6.8.6a bleibt vorerst die bestätigte stabile Code-Rollback-Basis.**

Ein reiner Code-Rollback setzt bereits synchronisierte Dienstnummern nicht automatisch zurück.

Darum wird bei der Synchronisierung im Systemprotokoll für jede Änderung festgehalten:
`Name: alte DN → neue DN`.

Damit stehen die bisherigen Werte für eine gezielte Rücksetzung weiterhin zur Verfügung.

Firebase Rules müssen weder für die Synchronisierung noch für einen Code-Rollback verändert werden.

---

## 12. Noch offener Live-Gegencheck

Für v6.8.7/v6.8.7f müssen bei Gelegenheit noch die Komfortfunktionen geprüft werden, insbesondere:
- Heute-Bereich,
- „Meine offenen Dinge“,
- Kalender Monat/Liste,
- Mitarbeiter-Detailansicht,
- Admin-Aufgabenliste,
- globale Schnellsuche,
- Aktualitätshinweise,
- mobile Darstellung,
- bestehende Kernfunktionen.

Nach erfolgreichem Gesamtcheck kann v6.8.7f als neue stabile Live- und Rollback-Version bestätigt werden.


---

## 13. Mitarbeiterlaufbahnen v6.8.7g

Neu:
- Laufbahn je Mitarbeiter: „Noch nicht festgelegt“, „Arzt“, „Paramedic“ oder „Arzt & Paramedic“,
- standardmäßige Anzeige in der Mitarbeiter-Mehrfachansicht und in der Einzelansicht,
- eigener Personalabteilungs-Bereich innerhalb der Mitarbeiterkartei zur Vergabe,
- neue Rollenberechtigung „Mitarbeiterlaufbahn verwalten“ (`canManageCareerPaths`),
- Personalabteilung besitzt dieses Recht standardmäßig; Master Admin durch Vollzugriff ebenfalls,
- Laufbahndaten werden getrennt von Account-/Login-Daten unter `data/employeeCareerPaths/{accountId}` gespeichert,
- bestehende Mitarbeiter ohne Eintrag erscheinen automatisch als „Noch nicht festgelegt“,
- Mitarbeiter-Einzelansicht wurde auf Desktop deutlich vergrößert und bleibt mobil responsiv.

Sicherheit:
- kein Eingriff in Firebase Auth, Passwörter, `authIndex`, `loginDirectory` oder stabile Account-IDs,
- bestehende Benutzerobjekte werden für Laufbahnen nicht erweitert,
- Lesen der Laufbahn ist für freigeschaltete Mitarbeiter erlaubt,
- Schreiben ist ausschließlich mit `canManageCareerPaths` oder als Master Admin erlaubt.


---

## 14. Eigener Personalabteilungs-Bereich v6.8.7h

Geändert:
- neuer direkter Hauptreiter „Personalabteilung“,
- Laufbahnverwaltung aus der Mitarbeiterkartei in den neuen Personalbereich verschoben,
- Zugriff auf den Personalbereich nur mit `canManageCareerPaths` oder als Master Admin,
- direkter Aufruf des Bereichs wird zusätzlich in der Navigation geprüft,
- Laufbahnanzeige in der Mehrfachansicht und Einzelansicht der Mitarbeiterkartei bleibt für alle berechtigten Cloud-Nutzer sichtbar,
- der neue Personalbereich ist bewusst als Grundlage für spätere Personal-Funktionen angelegt.

Nicht verändert:
- Laufbahndaten und deren Firebase Rules,
- Login, Registrierung, Passwörter, Account-IDs, `authIndex`, `loginDirectory`,
- Mitarbeiterfoto-Workflow,
- bestehende Rollen-IDs.


---

## 15. Rollen & Rechte – Checkboxen v6.8.7i

Geprüft:
- alle 37 vergebbaren Berechtigungen sind weiterhin vollständig mit der Rollenlogik verbunden,
- jede vergebbare Rechte-Karte besitzt eine Checkbox,
- das feste Kalender-Grundrecht besitzt jetzt ebenfalls ein sichtbares, angehaktes und gesperrtes Kästchen,
- deaktivierte Systemrechte bleiben sichtbar und werden nicht ausgeblendet,
- Checkboxen besitzen eine feste Größe und native Browser-Darstellung.

Nicht verändert:
- Berechtigungswerte und Rollenlogik,
- Firebase Rules,
- Benutzerkonten, Login, Passwörter und Rollen-IDs.


---

## 16. Rollenspeichern v6.8.7j

Behoben:
- „Rolle speichern“ besitzt einen eigenen stabilen Button-Zustand,
- während des Speicherns wird „Speichert …“ angezeigt,
- der eigentliche Rollenschreibvorgang und die anschließende Synchronisierung der Benutzerrechte werden getrennt behandelt,
- ein Fehler bei der nachgelagerten Synchronisierung macht einen bereits erfolgreichen Rollenspeichervorgang nicht mehr rückwirkend zu einem Fehler,
- `canManageCareerPaths` ist als eigene boolesche Server-Berechtigung in den Firebase Rules definiert.

Wichtig:
- Wegen der ergänzten ServerPermissions-Regel muss die aktuelle `database.rules.final.json` in Firebase veröffentlicht werden, falls diese Rules noch nicht live sind.
- Login, Passwörter, Account-IDs, Rollen-IDs und Auth-Zuordnungen wurden nicht verändert.
