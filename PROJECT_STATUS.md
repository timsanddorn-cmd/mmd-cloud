# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.7j  
**Aktueller Entwicklungsstand:** v6.9.2  
**Status v6.9.2:** 🟡 CHANGELOG-HISTORIE KOMPAKT ZUSAMMENGEFASST / LIVE-TEST AUSSTEHEND  
**Datum:** 22.09.2026

---

## 1. Verbindliche Basis

**v6.8.7j = bestätigte stabile Code-Rollback-Basis**

v6.8.8 baut auf der bestätigten stabilen Basis v6.8.7j auf. Bis zum vollständigen Live-Test bleibt v6.8.7j die sichere Rollback-Basis.

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

Der aktuelle Stand v6.8.7j wurde am 21.09.2026 inklusive aktualisierter Firebase Rules live getestet und vom Nutzer als funktionierend bestätigt.

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

**v6.8.7j ist die bestätigte stabile Code-Rollback-Basis.**

Ein reiner Code-Rollback setzt bereits synchronisierte Dienstnummern nicht automatisch zurück.

Darum wird bei der Synchronisierung im Systemprotokoll für jede Änderung festgehalten:
`Name: alte DN → neue DN`.

Damit stehen die bisherigen Werte für eine gezielte Rücksetzung weiterhin zur Verfügung.

Firebase Rules müssen weder für die Synchronisierung noch für einen Code-Rollback verändert werden.

---

## 12. Live-Gegencheck abgeschlossen

Am 21.09.2026 wurde der aktuelle Stand **v6.8.7j** inklusive der aktualisierten Firebase Rules vom Nutzer live getestet.

Bestätigt:
- Rollen & Rechte funktionieren,
- Checkboxen werden vollständig angezeigt,
- Rollen lassen sich speichern,
- Personalabteilungs-Bereich und Laufbahnverwaltung funktionieren,
- die aktualisierten Firebase Rules sind veröffentlicht,
- der getestete aktuelle Stand funktioniert im Live-System.

Damit ist **v6.8.7j die bestätigte stabile Live- und Code-Rollback-Version**.


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
- Die aktualisierte `database.rules.final.json` wurde am 21.09.2026 in Firebase veröffentlicht und anschließend erfolgreich live getestet.
- Login, Passwörter, Account-IDs, Rollen-IDs und Auth-Zuordnungen wurden nicht verändert.


---

## 17. Personalabteilung v6.8.8

Neu:
- übersichtliche Personal-Arbeitsseite mit vier Bereichen: Übersicht, Personalakten, Mitarbeiterkalender und Neuer Mitarbeiter,
- Personalakten mit Laufbahn, aktuellen Rängen, Rankup-Historie mit Grund, Sanktionen mit Bericht und allgemeinen Notizen,
- verbindliche Rangstruktur:
  - Trainee → Solo → EMT → A-EMT,
  - Doctor: Resident Physician → Physician → Attending,
  - Paramedic: Paramedic → Senior Paramedic → Medical Supervisor,
  - gemeinsam: Lieutenant → Chief Physician → F.o.D → D.o.M.O → Deputy Chief → Ass. Chief → Chief,
- Doctor- und Paramedic-Laufbahn können gleichzeitig geführt werden; beide laufbahnspezifischen Ränge können parallel sichtbar sein,
- Mitarbeiterkalender für Urlaub und entschuldigte Abwesenheit mit Filter nach Mitarbeiter und Rang,
- die Mitarbeiterkartei zeigt bei Abwesenheit ausschließlich „Urlaub“ oder „Entschuldigt abwesend“, keine internen Zeiträume,
- nach Ablauf einer Abwesenheit erscheint im Personalbereich eine rote Rückkehrprüfung; der öffentliche Status bleibt bestehen, bis die Personalabteilung die Rückkehr bestätigt,
- neue Mitarbeiter können über den Personalbereich mit einem vorläufigen Passwort über den bestehenden sicheren Registrierungsweg angelegt werden,
- Rang, Laufbahn und öffentlicher Abwesenheitsstatus erscheinen in Mehrfach- und Einzelansicht der Mitarbeiterkartei.

Neue Rollenrechte:
- `canViewPersonnelRecords`,
- `canManagePersonnelRecords`,
- `canManagePersonnelAbsences`,
- `canManagePersonnelRanks`,
- `canCreateEmployees`.

Sicherheit / Daten:
- bestehende Benutzerkonten werden nicht migriert,
- Login, Passwörter bestehender Konten, Account-IDs, `authIndex` und `loginDirectory` werden nicht umgebaut,
- interne Personalakten und Abwesenheitszeiträume sind durch Firebase Rules auf Personalberechtigungen beschränkt,
- für alle freigeschalteten Mitarbeiter lesbar sind nur Laufbahn, Rang und aktueller Abwesenheitsstatus,
- die neuen Daten liegen getrennt unter `employeeRanks`, `employeeAbsenceStatus`, `personnelRecords` und `personnelAbsences`,
- v6.8.7j bleibt bis zum bestätigten Live-Test die stabile Rollback-Basis.

Firebase:
- vor dem vollständigen Live-Test muss die zu v6.8.8 gehörende `database.rules.final.json` veröffentlicht werden.


---

## 18. Personalverwaltung v6.8.9 – Masterlisten-Erweiterung

Aus der bereitgestellten SAMD-Masterliste wurden ausschließlich sinnvolle Personalverwaltungs-Funktionen als Vorlage übernommen. Es erfolgt **kein automatischer Import** der Tabellenzeilen.

Neu:
- zusätzliche interne Personalstammdaten:
  - Telefonnummer,
  - Zweitjob,
  - interne Funktionen / Zusatzaufgaben,
  - eingewiesen durch,
  - eingestellt durch,
  - Vereidigung,
  - Erste-Hilfe-Kurs,
  - Behandlungseinweisung,
- interne Personalstatus:
  - Perso-Ticket offen,
  - Inaktivität prüfen,
  - Kündigung prüfen,
- offene Personalstatus werden in der Personalübersicht gezählt und als direkte Arbeitsliste angezeigt,
- eigener Bereich **Kündigungsarchiv**,
- Kündigungen/Austritte speichern:
  - Kündigungsdatum,
  - letzter Rang,
  - Laufbahn,
  - Kündigungsgrund,
  - Bearbeiter,
  - Diensttage,
- der Mitarbeiteraccount wird bei einer Kündigung nicht gelöscht, sondern gesperrt,
- Wiedereinstellungen reaktivieren denselben stabilen Account,
- bestehende Personalakte, Ranghistorie, Notizen und Sanktionen bleiben bei einer Wiedereinstellung erhalten,
- Personalereignisse wie Einstellung, Rangänderung, Abwesenheit, Rückkehr, Kündigung und Wiedereinstellung werden chronologisch in der Personalhistorie ergänzt,
- neues Rollenrecht `canManagePersonnelDepartures` für Kündigungen und Wiedereinstellungen.

Nicht übernommen / nicht gespeichert:
- E-Mail-Adressen,
- Discord-IDs,
- Foto-Verweise aus der Excel-Tabelle.

Sicherheit:
- `loginDirectory`, `authIndex`, bestehende Account-IDs und bestehende Passwörter werden nicht umgebaut,
- Kündigungen verwenden den vorhandenen Account-Status `revoked`; Wiedereinstellungen setzen denselben Account wieder auf `approved`,
- interne Stammdaten liegen getrennt unter `personnelProfiles`,
- Kündigungsdaten liegen getrennt unter `personnelDepartures`,
- v6.8.7j bleibt bis zum bestätigten Live-Test die stabile Rollback-Basis.

Firebase:
- vor dem Live-Test von v6.8.9 muss die aktuelle `database.rules.final.json` veröffentlicht werden.


---

## 19. Personalverwaltung v6.8.10 – Masterlisten-Abgleich & UI-Finish

Quelle:
- `Kopie von Storytime _ SAMD MASTERLISTE 3.0.xlsx`
- Zuordnung bestehender Mitarbeiter ausschließlich über die Dienstnummer (DN).

Übernommen / ergänzt:
- Telefonnummer,
- Zweitjob,
- interne Funktionen / Zusatzaufgaben,
- eingewiesen durch,
- eingestellt durch,
- Vereidigung,
- Erste-Hilfe-Kurs,
- Behandlungseinweisung,
- Laufbahn,
- aktueller Rang,
- Einstellungsdatum, sofern berechtigt und bisher nicht hinterlegt,
- Diensttage-Korrektur aus der Masterliste.

Nicht übernommen:
- E-Mail-Adressen,
- Discord-IDs,
- Foto-Verweise.

Verhalten:
- vorhandene manuell gepflegte Werte werden nicht überschrieben,
- der Abgleich ergänzt nur fehlende Werte,
- Mitarbeiter werden über DN statt über Account-ID oder Namen zugeordnet,
- bestehende Auth-/Login-Struktur bleibt unverändert,
- Diensttage berücksichtigen die Masterlisten-Korrektur,
- spezialisierte Doctor-/Paramedic-Ränge bleiben sichtbar, auch wenn die Laufbahn in der Masterliste noch nicht gesetzt war.

UI:
- Stammdatenkarte mit Stift-Symbol und eigenem Bearbeiten-Modus,
- Eingabe-, Auswahl- und Textfelder im Personalbereich an das dunkle MMD-Cloud-Design angepasst.

Sicherheit:
- keine Änderung an Firebase Auth, `authIndex`, `loginDirectory`, Account-IDs oder Passwörtern,
- keine neue User-Migration,
- v6.8.7j bleibt bis zum bestätigten Live-Test stabile Rollback-Basis.

Firebase:
- `database.rules.final.json` wurde in v6.8.10 nicht verändert,
- vor dem Live-Test muss weiterhin die bereits aktuelle Rules-Datei aus dem Repository veröffentlicht sein.


---

## 20. Personalverwaltung v6.8.11 – Dropdowns & Rangdarstellung

Behoben:
- Vereidigung, Erste-Hilfe-Kurs, Behandlungseinweisung und interner Personalstatus sind für berechtigte Personalmitarbeiter direkt bedienbar.
- Stammdaten können weiterhin über das Stift-Symbol hervorgehoben/bearbeitet werden, die Auswahlfelder sind aber nicht mehr unnötig gesperrt.
- Laufbahn und Rangverwaltung sind visuell getrennt und zeigen den aktuellen Stand oben kompakt an.
- Doctor- und Paramedic-Ränge bleiben parallel möglich.

Masterlisten-Abgleich:
- die aktuellen Ränge aus der SAMD-Masterliste werden für die bekannten DNs einmalig verbindlich übernommen,
- bestehende alte Rangwerte ohne Herkunftsmarker werden dabei auf den Masterlisten-Stand korrigiert,
- spätere manuelle Änderungen erhalten den Marker `manual` und werden nicht erneut überschrieben,
- Laufbahnen aus der Masterliste werden entsprechend übernommen,
- falls der Datenbankabgleich noch nicht gelaufen ist, zeigt die Oberfläche Rang/Laufbahn bereits aus der Masterliste als Fallback.

Sicherheit:
- keine Änderung an Firebase Auth,
- keine Änderung an `authIndex`,
- keine Änderung an `loginDirectory`,
- keine Änderung an Account-IDs oder Passwörtern,
- `database.rules.final.json` bleibt unverändert,
- stabile Rollback-Basis bleibt v6.8.7j.


---

## 21. Personalverwaltung v6.8.12 – Sanktionen bearbeiten & löschen

Personalakten:
- ausgestellte Sanktionen zeigen für berechtigte Personalmitarbeiter die Aktionen `Bearbeiten` und `Löschen`,
- Bearbeiten erfolgt direkt innerhalb der Personalhistorie,
- Titel und Bericht können geändert werden,
- Löschen erfordert eine Sicherheitsabfrage,
- beide Aktionen werden im Admin-Audit protokolliert.

Berechtigung:
- Bearbeiten und Löschen verwenden weiterhin ausschließlich `canManagePersonnelRecords` bzw. Masteradmin,
- reine Lese-Berechtigungen erhalten keine Aktionsbuttons.

Firebase:
- keine Änderung an `database.rules.final.json` nötig; die bestehenden Regeln erlauben Update und Delete bereits,
- keine Änderung an Firebase Auth, `authIndex`, `loginDirectory`, Account-IDs oder Passwörtern.


---

## 22. Personalverwaltung v6.8.13 – Zeilenumbruch in der Personalhistorie

Behoben:
- sehr lange Texte ohne Leerzeichen bleiben innerhalb der Historienkarte,
- lange Links und andere untrennbare Zeichenfolgen werden umgebrochen,
- die Karte kann dadurch nicht mehr horizontal aus dem Layout herauswachsen.

Es handelt sich ausschließlich um eine Darstellungs-/CSS-Korrektur.
Keine Änderung an Firebase Auth, `authIndex`, `loginDirectory`, Account-IDs, Passwörtern oder `database.rules.final.json`.


---

## 23. Personalverwaltung v6.8.14 – Workflow vervollständigt

Stammdaten & neuer Mitarbeiter:
- `Eingewiesen durch` und `Eingestellt durch` sind Dropdowns.
- Als neue Auswahl erscheinen freigeschaltete Mitarbeiter mit Rolle `ausbilder` oder `personalabteilung`.
- Historische Bestandswerte bleiben auswählbar, auch wenn die Person heute keine dieser Rollen mehr besitzt.
- Vereidigung, Erste-Hilfe-Kurs und Behandlungseinweisung verwenden nur noch `Ja` / `Nein`.
- Standardwert ist `Nein`; `Nicht festgelegt` wurde aus der Oberfläche entfernt.

Laufbahn & Ränge:
- gemeinsame Einstiegsränge bis einschließlich A-EMT können parallel zu Doctor- und Paramedic-Rängen geführt werden,
- Beispiel: `A-EMT · Physician · Senior Paramedic`,
- gemeinsame Führungsränge bleiben weiterhin übergeordnet/exklusiv in der Anzeige.

Personalhistorie:
- Bearbeitete Sanktionen schließen nach erfolgreichem Speichern zuverlässig den Bearbeitungsmodus.
- Zeilenumbrüche in Sanktionen und Notizen bleiben in der Anzeige erhalten.
- Allgemeine Notizen können bearbeitet und gelöscht werden.
- Bearbeiten/Löschen wird weiterhin über `canManagePersonnelRecords` geschützt und im Audit protokolliert.

Mitarbeiterkalender:
- aktive Abwesenheiten können bearbeitet werden (Art, Von, Bis, interne Notiz),
- aktive Abwesenheiten können vor dem geplanten Enddatum frühzeitig beendet werden,
- Rückkehrstatus und öffentlicher Abwesenheitsstatus werden dabei konsistent aktualisiert,
- Änderungen werden in Personalhistorie und Audit protokolliert.

Rollenvergabe Personalabteilung:
- Personalabteilung darf zusätzlich `CLS`, `EHK` und `Luftrettung` vergeben,
- Ausbildungsleitung und andere Rollen mit `canManageMemberAccess` behalten ihren bisherigen eingeschränkten Rollenbereich,
- Rollen-IDs, Auth-Struktur, `authIndex`, `loginDirectory`, Account-IDs und Passwörter bleiben unverändert.

Firebase:
- `database.rules.final.json` wurde ausschließlich für die drei zusätzlichen Rollenvergaben durch `personalabteilung` erweitert.
- Diese Rules müssen vor dem Live-Test der neuen Rollenvergabe in Firebase veröffentlicht werden.
- Keine Datenmigration erforderlich.
- Code-Rollback: v6.8.13; stabile Live-Rollback-Basis bleibt v6.8.7j.


---

## 24. v6.9.0 – Modern Workspace & Audit

Ziel:
- Personalabteilung nach den vielen Funktionsänderungen vollständig gegenprüfen,
- sichtbare Überladung reduzieren,
- gesamte MMD Cloud einschließlich Adminbereich visuell vereinheitlichen,
- bekannte Logik- und Rule-Inkonsistenzen korrigieren, ohne Auth-/Login-Strukturen umzubauen.

Personalabteilung:
- Übersicht von sieben gleichwertigen Einzelkarten auf vier logisch gruppierte Statuskarten reduziert:
  - aktives Team,
  - Abwesenheiten,
  - offene Personalthemen,
  - Fälle mit Aufmerksamkeit.
- Offene Personalthemen und Rückkehrprüfungen stehen nebeneinander und werden mobil gestapelt.
- Mitarbeiterliste kompakter und klarer beschriftet.
- Personalakte bleibt zweigeteilt in Stammdaten und Laufbahn/Ränge.
- Sanktion, allgemeine Notiz und Kündigung/Austritt werden als kompakte einklappbare Aktionskarten dargestellt.
- Personalhistorie bleibt dauerhaft sichtbar.
- Beim Wechsel des Personalbereichs werden offene Bearbeitungszustände sauber zurückgesetzt.
- Nach dem Speichern von Stammdaten wird die Ansicht unmittelbar neu aufgebaut.
- Neue Sanktionen/Notizen leeren ihre Eingabefelder nach erfolgreichem Speichern.

Gefundener Laufbahn-Bug:
- bei Masterlisten-Mitarbeitern konnte `Noch nicht festgelegt` bisher nicht dauerhaft gesetzt werden,
- Ursache: das Löschen des Career-Pfads aktivierte sofort wieder den Masterlisten-Fallback,
- v6.9.0 speichert deshalb `path: "none"` ausdrücklich als manuellen Wert,
- `database.rules.final.json` erlaubt dafür zusätzlich ausschließlich den bestehenden Wert `none` neben `doctor`, `paramedic` und `both`.

Adminbereich:
- Berechtigungsgruppen in der Rollenmatrix werden einklappbar.
- Eine Rechtesuche filtert die Berechtigungskarten live.
- Gruppen werden beim Suchen automatisch geöffnet.
- Adminnavigation, Übersichtsflächen und Rollenbereich wurden optisch entschlackt.
- Hinweistext zur Rollenvergabe wurde an v6.8.14 angepasst: Personalabteilung darf zusätzlich CLS, EHK und Luftrettung vergeben.
- Beschreibungen der Personalakten- und Abwesenheitsrechte wurden an die tatsächlich vorhandenen Bearbeiten-/Löschen-/Frühzeitig-Beenden-Funktionen angepasst.

Rule-Audit:
- Rollen-Editor: 43 wirksame `SERVER_PERMISSION_KEYS`.
- Vor v6.9.0 fehlten bei drei bereits verwendeten Feldern eigene serverseitige Validierungen:
  - `canSendEmployeeNotices`,
  - `canViewEmployeeNoticeRead`,
  - `delEmployeeNotices`.
- v6.9.0 ergänzt diese drei Boolean-Validierungen nach dem bestehenden Berechtigungsmuster.
- Dadurch werden keine neuen Rechte vergeben; die Rules werden nur vollständiger und typstrenger.

Globales UI:
- ruhigere Oberflächenhierarchie und einheitliche Abstände,
- Topbar in Informationszeile + kompakte Werkzeugleiste aufgeteilt,
- Hauptnavigation optisch vereinheitlicht,
- Seitenköpfe, Formulare, Tabellen, Karten und Modale auf ein gemeinsames Surface-System gebracht,
- responsive Darstellung für Personalbereich, Adminbereich und allgemeine Navigation erweitert,
- bestehende Funktionen und Datenpfade bleiben erhalten.

Sicherheit / Migration:
- keine Änderung an Firebase Auth,
- keine Änderung an `authIndex`,
- keine Änderung an `loginDirectory`,
- keine Änderung an Account-IDs, Passwörtern oder Rollen-IDs,
- keine Datenmigration notwendig.
- `database.rules.final.json` wurde in zwei eng begrenzten Punkten geändert:
  1. `employeeCareerPaths.path` darf zusätzlich `none` enthalten,
  2. die drei bestehenden Mitarbeiterhinweis-Rechte erhalten eigene Boolean-Validierungen.
- Die neue Rule-Datei muss nach dem Merge vor dem Live-Test von v6.9.0 in Firebase veröffentlicht werden.
- bestätigte stabile Rollback-Basis bleibt v6.8.7j.


---

## 25. v6.9.1 – Changelog Archiv

Geändert:
- Beim Öffnen des Changelogs wird standardmäßig nur noch der neueste Eintrag angezeigt.
- Der aktuellste Eintrag ist zusätzlich mit `AKTUELL` gekennzeichnet.
- Alle älteren System- und benutzerdefinierten Changelog-Einträge bleiben vollständig erhalten.
- Ältere Einträge liegen in einem standardmäßig geschlossenen Bereich `📦 Archiv`.
- Das Archiv zeigt direkt die Anzahl der älteren Versionen und kann bei Bedarf aufgeklappt werden.
- Die Changelog-Datenstruktur und der Master-Admin-Writer wurden nicht verändert.

Sicherheit:
- keine Änderung an Firebase Rules,
- keine Änderung an Firebase Auth, `authIndex`, `loginDirectory`, Account-IDs, Passwörtern oder Rollen,
- keine Migration erforderlich.


---

## 26. v6.9.2 – Changelog-Historie kompakt

Geändert:
- Die aktuelle Version bleibt einzeln und vollständig sichtbar.
- Die bisher einzeln dargestellten älteren Changelog-Versionen werden im Archiv nach Versionsfamilien gebündelt.
- Jede Gruppe zeigt maximal sechs zentrale Änderungstitel.
- Weitere kleinere Änderungen werden nur noch als Anzahl zusammengefasst.
- Das Archiv zeigt Anzahl der älteren Versionen und Anzahl der daraus gebildeten Gruppen.
- Die zugrunde liegenden System- und Custom-Changelog-Daten werden nicht gelöscht oder umgebaut.

Sicherheit:
- keine Änderung an Firebase Rules,
- keine Änderung an Firebase Auth, `authIndex`, `loginDirectory`, Account-IDs, Passwörtern oder Rollen,
- keine Migration erforderlich.
