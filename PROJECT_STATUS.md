# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.6a  
**Aktueller Entwicklungsstand:** v6.8.7  
**Status v6.8.7:** 🟡 LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 20.09.2026

---

## 1. Verbindliche Basis

**v6.8.6a = bestätigte stabile Live-Version und aktuelle Rollback-Basis**

v6.8.7 baut direkt auf dem bestätigten Stand v6.8.6a auf. Ziel ist ausschließlich mehr Übersicht, schnellere Navigation und einheitlichere Bedienung.

Firebase Auth, Registrierung, Login, stabile Account-IDs, Rollenmodell, Berechtigungslogik und Realtime-Database-Rules wurden nicht verändert.

Es wurden keine neuen Top-Level-Datenpfade eingeführt. Für „Zuletzt geändert“ werden bei zukünftigen Bearbeitungen lediglich optionale Zeit-/Bearbeiterfelder in bereits bestehenden Inhaltsdatensätzen gespeichert. Eine Datenmigration ist nicht erforderlich.

---

## 2. v6.8.7 – Komfortpaket

### Heute im Dienst
Direkt unter der Kopfleiste befindet sich eine kompakte persönliche Übersicht:
- nächster sichtbarer Termin,
- Anzahl persönlicher offener Dinge,
- aktive Mitarbeiter im Dienst,
- ungelesene News.

### Kalender – Monat und Liste
Der vorhandene Monatskalender bleibt bestehen. Zusätzlich gibt es eine Listenansicht für die nächsten 30 Tage. Beide Ansichten verwenden dieselbe bestehende Sichtbarkeits- und Einladungslogik.

### Sanktionskatalog
Die vorhandene Suche wurde klarer als Sofortsuche gekennzeichnet. Sie durchsucht weiterhin:
- Paragraph,
- Verstoß,
- 1. Sanktion,
- 2. Sanktion,
- 3. Sanktion.

### Mitarbeiter-Detailansicht
Ein Klick auf eine Mitarbeiterkarte öffnet eine kompakte Detailansicht mit:
- Profilbild,
- Dienstnummer,
- Name,
- Rollen,
- Diensttagen,
- Profilbildstatus.

Der Mitarbeiterstatus wird nur Personen mit Mitarbeiterverwaltung beziehungsweise Master Admins angezeigt. Verwaltungsaktionen erscheinen nur mit den bereits bestehenden Berechtigungen.

### Admin – nur offene Dinge
Unter dem bestehenden Admin-Kontrollzentrum erscheint eine zusätzliche Aufgabenliste. Sie zeigt ausschließlich aktuell offene Punkte, z. B. Registrierungen, fehlende Profilbilder, Passwortumstellungen, aktive Wartung oder eine noch nicht verteilte Browser-Version.

Ist nichts offen, wird „Aktuell nichts zu erledigen“ angezeigt.

### Einheitlichere Bearbeitungsfenster
Bestehende Bearbeitungsfenster wurden optisch vereinheitlicht. Die zugrunde liegenden Speicher-, Lösch- und Rechtefunktionen wurden nicht neu strukturiert.

### Zuletzt geändert
Zentrale Inhalte zeigen soweit verfügbar einen kleinen Aktualitätshinweis:
- medizinische Abläufe,
- Funk & Codes,
- Hierarchie,
- Gehaltstabelle,
- Commands,
- Links & Dokumente,
- Sanktionskatalog.

Für bestehende Inhalte ohne historischen Zeitstempel wird neutral „Aktueller Cloud-Stand“ angezeigt. Es wird kein erfundenes Änderungsdatum dargestellt.

### Mobile Feinarbeit
Navigation, Kopfleiste, Heute-Bereich, Kalenderliste, Mitarbeiterdetail, Bearbeitungsfenster und Tabellen wurden für kleinere Displays gezielt nachgeschärft.

### Globale Schnellsuche
Die MMD Cloud besitzt eine Schnellsuche über die Kopfleiste und per **Strg + K**.

Die Suche kann zu sichtbaren Bereichen springen und passende Inhalte aus bereits zulässigen Daten anzeigen, insbesondere:
- Mitarbeiter,
- Kalendertermine,
- Sanktionskatalog,
- Hauptbereiche der Cloud.

Die Suche erzeugt keine zusätzlichen Rechte und verwendet die bereits bestehende Sichtbarkeit der Inhalte.

### Meine offenen Dinge
Ungelesene News, persönliche Mitarbeiterhinweise und offene Kalendereinladungen werden zusätzlich in einer gemeinsamen persönlichen Übersicht gebündelt.

---

## 3. Bewusst nicht umgesetzt

Auf Wunsch nicht Bestandteil von v6.8.7:
- **Punkt 5:** zusätzliche Filter im Systemprotokoll,
- **Punkt 7:** persönliche Favoriten.

Die bestehenden Funktionen in diesen Bereichen bleiben unverändert.

---

## 4. Sicherheit / Firebase

Für v6.8.7 wurden **keine Firebase Rules geändert**.

Unverändert bleiben insbesondere:
- Firebase Auth,
- Registrierung und Login,
- `authIndex`,
- `loginDirectory`,
- stabile Account-IDs,
- Benutzer- und Rollenstruktur,
- bestehende Rechteprüfungen,
- bestehende Haupt-Datenpfade,
- Presence und Sitzungssteuerung.

Eine Datenmigration ist nicht erforderlich.

---

## 5. Live-Gegencheck v6.8.7

Noch zu prüfen:
1. Heute-Bereich erscheint kompakt und zeigt plausible Werte,
2. „Meine offenen Dinge“ bündelt News, Hinweise und Kalendereinladungen korrekt,
3. Kalender kann zwischen Monat und Liste wechseln,
4. Listenansicht zeigt nur sichtbare Termine der nächsten 30 Tage,
5. Kalendereinträge lassen sich aus der Liste normal öffnen,
6. Sanktionssuche findet Paragraph, Verstoß und Sanktionstexte,
7. Klick auf Mitarbeiterkarte öffnet die Detailansicht,
8. normaler Mitarbeiter sieht dort keinen internen Mitarbeiterstatus,
9. Verwaltungsberechtigte sehen Status und ihre zulässigen Aktionen,
10. Foto-/Freischalt-/Logo-Aktionen auf Mitarbeiterkarten öffnen nicht versehentlich die Detailkarte,
11. Admin-Kontrollzentrum zeigt die Liste „Nur offene Dinge“ korrekt,
12. Strg + K beziehungsweise „Suchen“ öffnet die Schnellsuche,
13. Schnellsuche findet Bereiche, Mitarbeiter, Termine und Sanktionen ohne Berechtigungen zu umgehen,
14. Aktualitätshinweise zeigen entweder echte Metadaten oder neutral „Aktueller Cloud-Stand“,
15. Bearbeitungsfenster funktionieren weiterhin wie zuvor,
16. Desktop- und mobile Darstellung bleiben ohne überlappende Bedienelemente,
17. bestehende News-, Foto-, Kalender-, Rollen-, Prüfungs- und Browser-Update-Funktionen arbeiten weiterhin.

---

## 6. Rollback

**v6.8.6a = aktuelle bestätigte stabile Rollback-Basis**

Bis zum erfolgreichen Live-Gegencheck von v6.8.7 bleibt v6.8.6a die verbindliche Rückfallversion.

Die Firebase Rules müssen bei einem Rollback nicht verändert werden.
