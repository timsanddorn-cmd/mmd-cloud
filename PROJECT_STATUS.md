# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5c  
**Aktueller Entwicklungsstand:** v6.8.5g  
**Status v6.8.5g:** 🟡 LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 19.09.2026

---

## 1. Verbindliche Basis

**v6.8.5c = bestätigte stabile Live-Version und Rollback-Basis**

Der aktuelle Entwicklungsstand v6.8.5g baut auf dem bestehenden stabilen Stand auf. Firebase Auth, Registrierung, Login, Rollen, Berechtigungen, stabile Account-IDs, Benutzerstruktur und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.5g – Inaktivitätsautomatik entfernt

Die bisherige automatische Inaktivitätsabmeldung wurde vollständig aus der Anwendung entfernt.

Entfernt wurden:
- Inaktivitäts-Timer,
- Aktivitätsüberwachung über Maus, Tastatur, Scrollen und Fensterfokus,
- Warnfenster „Bist du noch im Dienst?“,
- Bestätigungs-Countdown,
- automatische Abmeldung wegen Inaktivität.

Unverändert bleiben:
- der normale Button **„Dienst beenden“**,
- der tägliche erzwungene Dienstwechsel,
- die Master-Admin-Funktion **„Aus Dienst entfernen“**,
- Firebase Auth und alle bestehenden Sicherheitsregeln.

---

## 3. v6.8.5g – „Im Dienst“-Anzeige bereinigt

Die Anzeige **„Im Dienst“** basiert jetzt ausschließlich auf aktuellen Presence-Einträgen mit regelmäßigem Heartbeat.

Technischer Stand:
- Heartbeat alle 30 Sekunden,
- ein Presence-Eintrag gilt nach 3 Minuten ohne neues Lebenszeichen als nicht mehr aktiv,
- aktuelle Einträge benötigen `lastSeen`, `clientVersion` und `authUid`,
- alte Legacy-/Altdaten ohne diese Felder werden nicht mehr als aktiver Dienst angezeigt,
- mehrere Browser desselben Mitarbeiters werden weiterhin nur einmal in der normalen „Im Dienst“-Anzeige dargestellt,
- `onDisconnect()` und **„Dienst beenden“** entfernen aktuelle Presence-Einträge weiterhin direkt.

Damit beeinflussen alte, stehengebliebene Presence-Daten die sichtbare Dienstanzeige nicht mehr.

---

## 4. Sicherheit / Firebase

Für v6.8.5g wurden **keine Firebase Rules geändert**.

Unverändert bleiben insbesondere:
- Firebase Auth
- Registrierung und Login
- `authIndex`
- `loginDirectory`
- stabile Account-IDs
- Rollen und Berechtigungen
- Benutzerverwaltung
- bestehende Realtime-Database-Rules

---

## 5. Live-Gegencheck v6.8.5g

Noch zu prüfen:
1. aktuelle Mitarbeiter mit neuer Version erscheinen zuverlässig unter **„Im Dienst“**,
2. alte Legacy-/Altdaten erscheinen nicht mehr,
3. **„Dienst beenden“** entfernt den Mitarbeiter direkt,
4. Browser-/Verbindungsende entfernt bzw. verwirft den Presence-Status,
5. keine automatische Inaktivitätswarnung oder Inaktivitätsabmeldung erscheint mehr.

---

## 6. Rollback

**v6.8.5c = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback nicht verändert werden.
