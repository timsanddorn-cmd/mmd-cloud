# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5j  
**Aktueller Entwicklungsstand:** v6.8.6a  
**Status v6.8.6a:** 🟡 KURZER LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 20.09.2026

---

## 1. Verbindliche Basis

**v6.8.5j = bestätigte stabile Live-Version und aktuelle Rollback-Basis**

Das Komfortpaket v6.8.6 wurde vom Nutzer anhand der vollständigen Testliste 1–14 geprüft. Anschließend wurde als kleine UX-Korrektur v6.8.6a erstellt.

Firebase Auth, Registrierung, Login, stabile Account-IDs, Rollenmodell, Berechtigungen, Datenpfade und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.6a – Status-Filter gezielt sichtbar

In der Mitarbeiterkartei gilt jetzt:
- **Status** ist nur für Personen mit der Berechtigung zur Mitarbeiterverwaltung oder für Master Admins sichtbar,
- **Profilbild** bleibt für alle freigeschalteten Mitarbeiter sichtbar,
- **Rolle** bleibt für alle freigeschalteten Mitarbeiter sichtbar,
- normale Mitarbeiter erhalten technisch immer den neutralen Statusfilter „Alle“, auch wenn im Browser zuvor ein anderer Wert gesetzt war.

Die bereits bestehende Datenfilterung bleibt unverändert: Mitarbeiter ohne Verwaltungsrecht sehen weiterhin ausschließlich die für sie vorgesehenen freigegebenen Mitarbeiter.

---

## 3. v6.8.6 – Komfortpaket 1–7

Der Nutzer hat die vollständige Testliste 1–14 geprüft. Enthalten sind:
- Admin-Kontrollzentrum,
- Schutz vor ungespeicherten Änderungen,
- Mitarbeiterfilter,
- nächste Termine,
- Benachrichtigungszähler,
- Backup-Vorschau,
- dezente MMD-Hinweise.

Der anschließend gewünschte Sichtbarkeits-Fix des Statusfilters ist Bestandteil von v6.8.6a.

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

## 5. Kurzer Live-Gegencheck v6.8.6a

Noch zu prüfen:
1. normaler Mitarbeiter sieht in der Mitarbeiterkartei nur **Profilbild**, **Rolle** und „Filter zurücksetzen“,
2. normaler Mitarbeiter sieht **keinen Statusfilter**,
3. Person mit „Mitarbeiter freigeben & Rollen verteilen“ sieht den Statusfilter,
4. Master Admin sieht den Statusfilter,
5. Profilbild- und Rollenfilter funktionieren weiterhin.

---

## 6. Rollback

**v6.8.5j = aktuelle bestätigte stabile Rollback-Basis**

Nach erfolgreichem Gegencheck von v6.8.6a kann dieser Stand als neue stabile Live- und Rollback-Basis bestätigt werden.

Die Firebase Rules müssen bei einem Rollback nicht verändert werden.
