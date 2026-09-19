# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.5h  
**Aktueller Entwicklungsstand:** v6.8.5h  
**Status v6.8.5h:** 🟢 STABIL / LIVE BESTÄTIGT  
**Datum:** 19.09.2026

---

## 1. Verbindliche Basis

**v6.8.5h = bestätigte stabile Live-Version und aktuelle Rollback-Basis**

v6.8.5h wurde im Live-Betrieb bestätigt. Die Anwendung funktioniert nach der technischen Bereinigung stabil.

Firebase Auth, Registrierung, Login, Rollen, Berechtigungen, stabile Account-IDs, Benutzerstruktur und Realtime-Database-Rules wurden nicht verändert.

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

## 6. Live-Bestätigung v6.8.5h

Am 19.09.2026 wurde v6.8.5h im Live-Betrieb bestätigt.

Bestätigt:
1. aktuelle Mitarbeiter erscheinen zuverlässig unter **„Im Dienst“**,
2. alte Legacy-/Altdaten erscheinen nicht mehr als aktiver Dienst,
3. **„Dienst beenden“** funktioniert,
4. Presence-/Heartbeat-Verhalten funktioniert stabil,
5. es erscheint keine automatische Inaktivitätswarnung oder Inaktivitätsabmeldung mehr,
6. die Anwendung funktioniert nach der technischen Bereinigung ohne festgestellte Fehler.

---

## 7. Rollback

**v6.8.5h = aktuelle bestätigte stabile Rollback-Basis**

Für einen Rollback auf diesen Stand müssen die Firebase Rules nicht verändert werden.
