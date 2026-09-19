# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.6a  
**Aktueller Entwicklungsstand:** v6.8.6a  
**Status v6.8.6a:** 🟢 STABIL / LIVE BESTÄTIGT  
**Datum:** 20.09.2026

---

## 1. Verbindliche Basis

**v6.8.6a = bestätigte stabile Live-Version und aktuelle Rollback-Basis**

Das Komfortpaket v6.8.6 wurde anhand der vollständigen Testliste 1–14 geprüft. Anschließend wurde in v6.8.6a der Mitarbeiter-Statusfilter gezielt auf Personen mit Mitarbeiterverwaltung beziehungsweise Master Admins beschränkt.

Der anschließende Live-Gegencheck wurde erfolgreich bestätigt.

Firebase Auth, Registrierung, Login, stabile Account-IDs, Rollenmodell, Berechtigungen, Datenpfade und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.6a – Status-Filter gezielt sichtbar

In der Mitarbeiterkartei gilt:
- **Status** ist nur für Personen mit der Berechtigung zur Mitarbeiterverwaltung oder für Master Admins sichtbar,
- **Profilbild** bleibt für alle freigeschalteten Mitarbeiter sichtbar,
- **Rolle** bleibt für alle freigeschalteten Mitarbeiter sichtbar,
- normale Mitarbeiter erhalten technisch immer den neutralen Statusfilter „Alle“.

Bestätigt wurde:
- normale Mitarbeiter sehen keinen Statusfilter,
- Verwaltungsberechtigte und Master Admins sehen den Statusfilter,
- Profilbild- und Rollenfilter funktionieren weiterhin.

---

## 3. v6.8.6 – Komfortpaket 1–7

Bestätigt funktionsfähig:
- Admin-Kontrollzentrum,
- Schutz vor ungespeicherten Änderungen,
- Mitarbeiterfilter,
- nächste Termine,
- Benachrichtigungszähler,
- Backup-Vorschau,
- dezente MMD-Hinweise.

---

## 4. Sicherheit / Firebase

Für v6.8.6a wurden **keine Firebase Rules geändert** und es ist **keine Datenmigration** erforderlich.

Unverändert bleiben insbesondere:
- Firebase Auth,
- Registrierung und Login,
- `authIndex`,
- `loginDirectory`,
- stabile Account-IDs,
- Benutzer- und Rollenstruktur,
- bestehende Rechteprüfung,
- bestehende Datenpfade.

---

## 5. Live-Bestätigung v6.8.6a

Am 20.09.2026 wurde v6.8.6a im Live-Betrieb bestätigt.

Der Stand gilt damit als stabil.

---

## 6. Rollback

**v6.8.6a = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback auf diesen Stand nicht verändert werden.
