# MMD Cloud – PROJECT STATUS

**Aktuell bestätigte stabile Live-Version:** v6.8.1  
**Vorbereitete nächste Version:** v6.8.2  
**Status v6.8.2:** 🟡 VORBEREITET / LIVE-TEST AUSSTEHEND  
**Datum:** 18.09.2026

---

## 1. Verbindliche Basis

Die aktuell bestätigte stabile Live-Version ist:

**v6.8.1**

Der vorherige Stand **v6.8.0e** bleibt zusätzlich als ältere Rückfallbasis dokumentiert.

v6.8.1 wurde live erfolgreich geprüft. Bestätigt wurden unter anderem:

- Login und normaler Dienstbetrieb,
- Presence / „Im Dienst“,
- Sitzungen & Updates,
- manueller Master-Admin-Rauswurf,
- normales „Dienst beenden“,
- Portrait-Darstellung,
- zentrale Live-Version,
- Inaktivitätswarnung und automatische Abmeldung nach Ablauf der Warnfrist.

---

## 2. Änderungen in v6.8.2

### Prüfungen

- Fragen mit genau **einer** richtigen Antwort verwenden beim Prüfling echte Einzelauswahl (Radio-Buttons).
- Fragen mit **mehreren** richtigen Antworten verwenden weiterhin Checkboxen.
- Der Hinweis „Mehrfachauswahl möglich“ erscheint nur noch bei echten Mehrfachfragen.
- Die Punkteberechnung und historische Prüfungsergebnisse bleiben unverändert.
- Prüfungen werden ausschließlich in Firebase verwaltet.
- Die einmalige fest eingebaute Flugausbildungsprüfung wurde aus `app.js` entfernt, nachdem sie in Firebase angelegt wurde.
- Wird eine Prüfung künftig bewusst gelöscht, wird sie nicht mehr automatisch aus dem Programmcode neu erstellt.

### Inaktivität

- Die Inaktivitätsgrenze wurde von 20 auf **30 Minuten** erhöht.
- Danach erscheint weiterhin die bekannte **30-Sekunden-Rückfrage**.
- Erfolgt keine Bestätigung, wird die Sitzung vollständig beendet.

### Versionierung

Die Datei- und Cache-Stände wurden wieder vereinheitlicht:

- `APP_VERSION = v6.8.2`
- `app.js?v=6.8.2`
- `style.css?v=6.8.2`

Damit entfallen interne Zwischenstände wie `exam2` oder `portrait4` aus der sichtbaren Cache-Versionierung. Die darin enthaltenen funktionierenden Änderungen bleiben erhalten.

---

## 3. Firebase / Sicherheit

Für v6.8.2 sind **keine neuen Firebase Rules erforderlich**.

Unverändert bleiben insbesondere:

- Firebase Auth,
- Registrierung und Login,
- `authIndex`,
- `loginDirectory`,
- Benutzerkonten,
- Rollen und Berechtigungen,
- Passwörter,
- bestehende Prüfungsabgaben,
- bestehende Firebase-Daten.

Es ist **keine Datenmigration** erforderlich.

---

## 4. Google-Dokument-Links

Die in der MMD Cloud hinterlegten Links zu EHK, CLS, Psychologie, Dienstvorschriften und Sanktionskatalog bleiben unverändert.

Der Programmcode kann prüfen, ob die Links formal vorhanden sind. Die tatsächlichen Google-Freigaberechte müssen jedoch direkt in Google Drive geprüft werden, da diese Berechtigungen außerhalb der MMD Cloud verwaltet werden.

Empfohlener Test: jeden Link einmal in einem privaten / Inkognito-Browser ohne angemeldetes Google-Konto öffnen. So lässt sich schnell erkennen, ob die gewünschte Freigabe tatsächlich funktioniert.

---

## 5. Veröffentlichung v6.8.2

Zu veröffentlichen:

- `app.js`
- `index.html`
- `style.css`
- `PROJECT_STATUS.md`

Unverändert:

- `database.rules.final.json`
- `mdlogo.png`
- `wuensche_und_bugs.md`

Keine Rules-Änderung und keine Migration.

---

## 6. Live-Test v6.8.2

Nach Veröffentlichung mindestens prüfen:

- Login und Dienstantritt,
- normale Single-Choice-Prüfung: nur eine Antwort gleichzeitig auswählbar,
- Mehrfachfrage: mehrere Antworten auswählbar,
- vorhandene Flugausbildungsprüfung weiterhin sichtbar,
- Prüfung bearbeiten / freigeben / abgeben,
- bestehende Punkteberechnung,
- „Dienst beenden“,
- Presence / „Im Dienst“,
- Inaktivitätswarnung nach 30 Minuten,
- automatische Abmeldung nach weiteren 30 Sekunden,
- Master-Admin-Sitzungsverwaltung.

---

## 7. Rollback

Bis v6.8.2 erfolgreich live getestet wurde, bleibt:

**v6.8.1 = verbindliche Rollback-Basis**

Bei einem Problem werden die v6.8.1-Webdateien wiederhergestellt. Die Firebase Rules müssen für diese Änderung nicht zurückgesetzt werden, da sie in v6.8.2 unverändert bleiben.

---

## 8. Stabil-Markierung

Nach erfolgreicher Veröffentlichung und Live-Prüfung kann der Status geändert werden auf:

**v6.8.2 – ✅ LIVE / STABIL BESTÄTIGT**
