# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5h  
**Aktueller Entwicklungsstand:** v6.8.5i  
**Status v6.8.5i:** 🟡 LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 19.09.2026

---

## 1. Verbindliche Basis

**v6.8.5h = bestätigte stabile Live-Version und Rollback-Basis**

v6.8.5i baut direkt auf dem bestätigten stabilen Stand v6.8.5h auf. Die Änderung betrifft die Bedienoberfläche des Admin-Bereichs, die bestehende Browser-Update-Bedienung und die Darstellung der Profilbild-Übersicht.

Firebase Auth, Registrierung, Login, Rollen, Berechtigungen, stabile Account-IDs, Benutzerstruktur und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.5i – Admin-Bereich übersichtlicher

Der Admin-Bereich wurde vereinfacht, ohne die dahinterliegenden Verwaltungsfunktionen neu zu strukturieren.

Geändert:
- Admin-Navigation ist sichtbar in **Verwaltung**, **System** und **Sicherheit** gruppiert,
- Kopfbereich und Navigation bleiben beim Scrollen sichtbar,
- auf kleineren Bildschirmen ist die Admin-Navigation kompakt horizontal erreichbar,
- **„Sitzungen & Updates“** wurde verständlicher als **„Sitzungen & Browser“** bezeichnet,
- die Browser-Aktualisierung benötigt keine manuelle Eingabe der Versionsnummer mehr,
- die aktuelle `APP_VERSION` wird automatisch verwendet,
- der optionale Hinweistext ist unter erweiterten Optionen eingeklappt,
- der Status zeigt klar, ob die aktuelle Version bereits an geöffnete Browser verteilt wurde,
- der bewusste Master-Admin-Klick zum Verteilen einer Version bleibt als Sicherheitsstufe erhalten.

---

## 3. Profilbild-Übersicht verbessert

In **Mitarbeiter → Mitarbeiterkartei → Foto-Liste** werden Dienstnummer sowie Vor- und Nachname jetzt als gemeinsamer Mitarbeiterblock dargestellt.

Dadurch bleibt der Mitarbeitername auch bei kleineren Fenstern und bei Mitarbeitern ohne eigenes Profilbild sichtbar.

Der bestehende Foto-Hinweis, Foto-Workflow und die Ableitung des Fotostatus aus `photoUrl` wurden nicht verändert.

---

## 4. Sicherheit / Firebase

Für v6.8.5i wurden **keine Firebase Rules geändert**.

Unverändert bleiben insbesondere:
- Firebase Auth
- Registrierung und Login
- `authIndex`
- `loginDirectory`
- stabile Account-IDs
- Rollen und Berechtigungen
- Benutzerverwaltung
- Mitarbeiterfoto-Datenmodell
- bestehende Realtime-Database-Rules

Eine Datenmigration ist nicht erforderlich.

---

## 5. Live-Gegencheck v6.8.5i

Noch zu prüfen:
1. Admin-Bereich öffnet und schließt wie bisher,
2. Mitarbeiter, Rollen & Rechte, Systemprotokoll, Wartung und Backup/Gefahrenzone bleiben erreichbar,
3. Kopfbereich und Admin-Navigation bleiben bei langen Seiten sichtbar,
4. Browser-Update zeigt automatisch v6.8.5i und benötigt keine manuelle Versionseingabe,
5. **„Update an geöffnete Browser senden“** verteilt die aktuelle Version weiterhin zuverlässig,
6. andere geöffnete ältere Browser erhalten weiterhin den 10-Sekunden-Hinweis und laden neu,
7. Foto-Liste zeigt bei Mitarbeitern ohne eigenes Foto Dienstnummer sowie Vor- und Nachname,
8. Darstellung bleibt auf kleineren Bildschirmen bedienbar.

---

## 6. Rollback

**v6.8.5h = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback nicht verändert werden.
