# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5j  
**Aktueller Entwicklungsstand:** v6.8.5j  
**Status v6.8.5j:** 🟢 STABIL / LIVE BESTÄTIGT  
**Datum:** 19.09.2026

---

## 1. Verbindliche Basis

**v6.8.5j = bestätigte stabile Live-Version und aktuelle Rollback-Basis**

v6.8.5j wurde im Live-Betrieb bestätigt. Die Admin-Überarbeitung aus v6.8.5i und die anschließende Korrektur der Profilbild-Übersicht funktionieren stabil.

Firebase Auth, Registrierung, Login, Rollen, Berechtigungen, Benutzerstruktur, Foto-Datenmodell und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.5j – Foto-Liste Layout korrigiert

Beim Live-Gegencheck von v6.8.5i wurde festgestellt, dass der Button **„Foto-Hinweis“** bei Mitarbeitern ohne Profilbild aus der jeweiligen Karte herausragen und benachbarte Karten überdecken konnte.

Korrigiert:
- jede Mitarbeiterkarte behält ihren Foto-Hinweis vollständig innerhalb der eigenen Begrenzung,
- Profilbildstatus und Foto-Hinweis stehen kompakt auf der rechten Seite,
- Vor- und Nachname sowie Dienstnummer bleiben sichtbar,
- auf kleineren Bildschirmen werden Status und Foto-Hinweis sauber unter dem Mitarbeiterblock angeordnet.

Der Foto-Hinweis selbst, seine Empfängerlogik und der bestehende Mitarbeiterhinweis-Workflow wurden nicht verändert.

---

## 3. v6.8.5i – Admin-Bereich

Die mit v6.8.5i eingeführte übersichtlichere Admin-Navigation und die vereinfachte Browser-Aktualisierung bleiben unverändert bestehen.

---

## 4. Sicherheit / Firebase

Für v6.8.5j wurden **keine Firebase Rules geändert** und es ist keine Datenmigration erforderlich.

---

## 5. Live-Bestätigung v6.8.5j

Am 19.09.2026 wurde v6.8.5j im Live-Betrieb bestätigt.

Bestätigt:
1. Foto-Hinweise bleiben vollständig innerhalb der jeweiligen Mitarbeiterkarte,
2. benachbarte Mitarbeiterkarten werden nicht mehr überdeckt,
3. Vor- und Nachname sowie Dienstnummer sind sichtbar,
4. der Foto-Hinweis funktioniert weiterhin,
5. der überarbeitete Admin-Bereich funktioniert,
6. die vereinfachte Browser-Aktualisierung funktioniert,
7. im Live-Betrieb wurden keine weiteren Fehler festgestellt.

---

## 6. Rollback

**v6.8.5j = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback auf diesen Stand nicht verändert werden.
