# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5c  
**Aktueller Entwicklungsstand:** v6.8.5h  
**Status v6.8.5h:** 🟡 LIVE-GEGENCHECK AUSSTEHEND  
**Datum:** 19.09.2026

---

## 1. Verbindliche Basis

**v6.8.5c = bestätigte stabile Live-Version und Rollback-Basis**

Der aktuelle Entwicklungsstand v6.8.5h baut direkt auf v6.8.5g auf. Die Bereinigung verändert keine produktive Funktion. Firebase Auth, Registrierung, Login, Rollen, Berechtigungen, stabile Account-IDs, Benutzerstruktur und Realtime-Database-Rules wurden nicht verändert.

---

## 2. v6.8.5h – Technische Bereinigung

Die Codebasis wurde vorsichtig aufgeräumt, ohne funktionierende Systeme umzubauen.

Entfernt bzw. bereinigt wurden:
- drei nachweislich nicht mehr aufgerufene Hilfsfunktionen,
- zwei alte doppelte Dateiüberschriften mit der Versionsangabe v6.8.1,
- veraltete technische Bezeichnungen zur bereits entfernten Inaktivitätsautomatik,
- eine alte Versionsbezeichnung im zugehörigen CSS-Abschnitt.

Unverändert bleiben:
- Firebase Auth und Registrierung,
- Login und Benutzerzuordnung,
- Rollen und Berechtigungen,
- Presence-/Heartbeat-System,
- Browser-Update-System,
- Mitarbeiterfotos und Mitarbeiterhinweise,
- Prüfungen und Navigation,
- Realtime-Database-Rules.

Für v6.8.5h ist keine Datenmigration erforderlich.

---

## 3. v6.8.5g – Inaktivitätsautomatik entfernt

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

## 4. v6.8.5g – „Im Dienst“-Anzeige bereinigt

Die Anzeige **„Im Dienst“** basiert ausschließlich auf aktuellen Presence-Einträgen mit regelmäßigem Heartbeat.

Technischer Stand:
- Heartbeat alle 30 Sekunden,
- ein Presence-Eintrag gilt nach 3 Minuten ohne neues Lebenszeichen als nicht mehr aktiv,
- aktuelle Einträge benötigen `lastSeen`, `clientVersion` und `authUid`,
- alte Legacy-/Altdaten ohne diese Felder werden nicht mehr als aktiver Dienst angezeigt,
- mehrere Browser desselben Mitarbeiters werden weiterhin nur einmal in der normalen „Im Dienst“-Anzeige dargestellt,
- `onDisconnect()` und **„Dienst beenden“** entfernen aktuelle Presence-Einträge weiterhin direkt.

Damit beeinflussen alte, stehengebliebene Presence-Daten die sichtbare Dienstanzeige nicht mehr.

---

## 5. Sicherheit / Firebase

Für v6.8.5h wurden **keine Firebase Rules geändert**.

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

## 6. Live-Gegencheck v6.8.5h

Da v6.8.5h keine funktionale Änderung gegenüber der Dienstlogik von v6.8.5g enthält, bleiben dieselben Live-Punkte zu beobachten:

1. aktuelle Mitarbeiter mit neuer Version erscheinen zuverlässig unter **„Im Dienst“**,
2. alte Legacy-/Altdaten erscheinen nicht mehr,
3. **„Dienst beenden“** entfernt den Mitarbeiter direkt,
4. Browser-/Verbindungsende entfernt bzw. verwirft den Presence-Status,
5. keine automatische Inaktivitätswarnung oder Inaktivitätsabmeldung erscheint mehr.

---

## 7. Rollback

**v6.8.5c = aktuelle bestätigte stabile Rollback-Basis**

Die Firebase Rules müssen bei einem Rollback nicht verändert werden.
