# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.6a  
**Aktueller Entwicklungsstand:** v6.8.7a  
**Status v6.8.7a:** 🟡 LIVE-GEGENCHECK / DN-SYNCHRONISIERUNG AUSSTEHEND  
**Datum:** 20.09.2026

---

## 1. Verbindliche Basis

**v6.8.6a = bestätigte stabile Code-Rollback-Basis**

v6.8.7a baut auf v6.8.7 auf und ergänzt die vom Nutzer gelieferte offizielle Dienstnummernliste.

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

## 4. Auswirkungen auf Login und Konten

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

## 5. Rollback / Nachvollziehbarkeit

**v6.8.6a bleibt bis zur Bestätigung die stabile Code-Rollback-Basis.**

Wichtig: Ein reiner Code-Rollback setzt bereits synchronisierte Dienstnummern nicht automatisch zurück.

Darum wird bei der Synchronisierung im Systemprotokoll für jede Änderung festgehalten:
`Name: alte DN → neue DN`.

Damit stehen die bisherigen Werte für eine gezielte Rücksetzung weiterhin zur Verfügung.

Firebase Rules müssen weder für die Synchronisierung noch für einen Code-Rollback verändert werden.

---

## 6. Live-Gegencheck

Nach Laden von v6.8.7a mit einem Master-Admin-Konto prüfen:
1. Erfolgs-Hinweis nennt Anzahl geänderter und gefundener registrierter Personen,
2. Mitarbeiterkartei zeigt bei den registrierten Personen die neue DN,
3. nicht registrierte Namen wurden nicht als neue Benutzer angelegt,
4. Login der bestehenden Mitarbeiter funktioniert unverändert,
5. bei einer Doppelbelegung erscheint stattdessen eine Warnung und es werden keine DNs geändert,
6. die Funktionen aus v6.8.7 bleiben weiterhin intakt.
