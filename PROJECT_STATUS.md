# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.6a  
**Aktueller Entwicklungsstand:** v6.8.7b  
**Status v6.8.7b:** 🟡 DN-SYNCHRONISIERUNG BESTÄTIGT / GESAMTER LIVE-GEGENCHECK NOCH AUSSTEHEND  
**Datum:** 20.09.2026

---

## 1. Verbindliche Basis

**v6.8.6a = bestätigte stabile Code-Rollback-Basis**

v6.8.7b baut auf v6.8.7a auf. Zusätzlich wurde die Profilbild-Übersicht kompakter gestaltet und innerhalb des geöffneten Bereichs einklappbar gemacht.

Firebase Auth, Passwörter, Rollen, Berechtigungen, `authIndex`, `loginDirectory` und Realtime-Database-Rules wurden nicht verändert.

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

## 5. Bestätigung der DN-Synchronisierung

Am 20.09.2026 wurde die DN-Aktualisierung im Live-System vom Nutzer bestätigt.

Bestätigt:
- die Dienstnummern wurden aktualisiert,
- die Änderungen sind in der Mitarbeiterkartei sichtbar,
- es war keine manuelle Bearbeitung einzelner Mitarbeiter nötig.

Damit gilt die **DN-Synchronisierung als erfolgreich abgeschlossen**.

Der vollständige Live-Gegencheck der zusätzlichen Funktionen aus v6.8.7 steht weiterhin aus.

---

## 6. Auswirkungen auf Login und Konten

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

## 7. Rollback / Nachvollziehbarkeit

**v6.8.6a bleibt vorerst die bestätigte stabile Code-Rollback-Basis.**

Ein reiner Code-Rollback setzt bereits synchronisierte Dienstnummern nicht automatisch zurück.

Darum wird bei der Synchronisierung im Systemprotokoll für jede Änderung festgehalten:
`Name: alte DN → neue DN`.

Damit stehen die bisherigen Werte für eine gezielte Rücksetzung weiterhin zur Verfügung.

Firebase Rules müssen weder für die Synchronisierung noch für einen Code-Rollback verändert werden.

---

## 8. Noch offener Live-Gegencheck

Für v6.8.7/v6.8.7b müssen bei Gelegenheit noch die Komfortfunktionen geprüft werden, insbesondere:
- Heute-Bereich,
- „Meine offenen Dinge“,
- Kalender Monat/Liste,
- Mitarbeiter-Detailansicht,
- Admin-Aufgabenliste,
- globale Schnellsuche,
- Aktualitätshinweise,
- mobile Darstellung,
- bestehende Kernfunktionen.

Nach erfolgreichem Gesamtcheck kann v6.8.7b als neue stabile Live- und Rollback-Version bestätigt werden.
