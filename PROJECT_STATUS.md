# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5h  
**Aktueller Entwicklungsstand:** v6.8.5j  
**Status v6.8.5j:** 🟡 LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 19.09.2026

---

## 1. Verbindliche Basis

**v6.8.5h = bestätigte stabile Live-Version und Rollback-Basis**

v6.8.5j baut auf v6.8.5i auf und korrigiert ausschließlich einen Darstellungsfehler in der Profilbild-Übersicht.

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

## 5. Live-Gegencheck v6.8.5j

Noch zu prüfen:
1. Foto-Hinweis ragt bei keinem Mitarbeiter mehr aus der Karte,
2. benachbarte Mitarbeiterkarten werden nicht überdeckt,
3. Vor- und Nachname sowie Dienstnummer sind weiterhin sichtbar,
4. Foto-Hinweis lässt sich weiterhin normal versenden,
5. Admin-Bereich und Browser-Aktualisierung aus v6.8.5i funktionieren weiterhin.

---

## 6. Rollback

**v6.8.5h = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback nicht verändert werden.
