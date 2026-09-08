// ============================================================
//  MMD CLOUD – Medical Center Web-App  |  app.js  v4.1
//  Firebase Realtime Database (Compat SDK v10)
// ============================================================

/* ── Firebase Init ─────────────────────────────────────────── */
const FIREBASE_DB_URL = "https://mmd-live-default-rtdb.europe-west1.firebasedatabase.app";
firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
const db = firebase.database();

/* ── Session-State ─────────────────────────────────────────── */
let sessionUser       = null;
let currentAuthTab    = 'login';
let aktuellerFallKosten = 0;
let anzahlVerletzungenFall = 1;
let fallMaterial      = {};
let daten             = { patienten: 0, verletzungen: 0, ausgaben: 0 };
let mySessionRef      = null;
let cachedUsers       = {};
let cachedExams       = {};
let cachedSubmissions = {};
let cachedNews        = {};
let cachedArchiv      = {};
let cachedAuditLogs   = {};
let activeExam        = null;
let activeExamTimerInterval = null;
let activeExamSecondsElapsed = 0;

/* ── Standard-Rollen & granulare Berechtigungen ───────────── */
let defaultRoles = {
    masteradmin: {
        id:'masteradmin', name:'Master-Admin', color:'#eab308', icon:'👑', isSystem:true,
        isAdmin:true, isMasterAdmin:true, canViewArchive:true,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:true, canEditGuide:true, canEditCommands:true, canEditLinks:true,
        delPatient:true, delArchiv:true, delGuide:true, delCommands:true, delLinks:true, delNews:true, delExams:true, delUsers:true
    },
    admin: {
        id:'admin', name:'Admin', color:'#f59e0b', icon:'🛡️', isSystem:true,
        isAdmin:true, isMasterAdmin:false, canViewArchive:true,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:true, canEditGuide:true, canEditCommands:true, canEditLinks:true,
        delPatient:true, delArchiv:true, delGuide:true, delCommands:true, delLinks:true, delNews:true, delExams:true, delUsers:false
    },
    ausbildungsleitung: {
        id:'ausbildungsleitung', name:'Ausbildungsleitung', color:'#c084fc', icon:'⚙️', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:false, canEditGuide:false, canEditCommands:true, canEditLinks:true,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:true, delUsers:false
    },
    ausbilder: {
        id:'ausbilder', name:'Ausbilder', color:'#8b5cf6', icon:'🎓', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:true, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false
    },
    cls: {
        id:'cls', name:'CLS-Ausbilder', color:'#06b6d4', icon:'💉', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:true, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false
    },
    ehk: {
        id:'ehk', name:'EHK-Ausbilder', color:'#10b981', icon:'🩺', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:true, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false
    },
    luftrettung: {
        id:'luftrettung', name:'Luftrettung', color:'#0284c7', icon:'🚁', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false
    },
    mitarbeiter: {
        id:'mitarbeiter', name:'Mitarbeiter', color:'#64748b', icon:'👨‍⚕️', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false
    }
};
let cachedRoles = Object.assign({}, defaultRoles);

/* ── Standard-Guide-Daten ───────────────────────────────────── */
let defaultGuideData = {
    tenCodes: [
        { id:"tc_1",  code:"10-1",  desc:"Auf Anfahrt",               color:"var(--warning)" },
        { id:"tc_2",  code:"10-2",  desc:"Am Einsatzort",              color:"var(--warning)" },
        { id:"tc_3",  code:"10-3",  desc:"Weg ins MD",                 color:"var(--warning)" },
        { id:"tc_4",  code:"10-4",  desc:"Verstanden, Ende",           color:"var(--success)" },
        { id:"tc_5",  code:"10-5",  desc:"Einsatz Beendet",            color:"var(--success)" },
        { id:"tc_6",  code:"10-6",  desc:"Auf Zuteilung",              color:"var(--primary)" },
        { id:"tc_7",  code:"10-7",  desc:"Auf Bereitschaft",           color:"var(--primary)" },
        { id:"tc_8",  code:"10-8",  desc:"Statusabfrage",              color:"var(--primary)" },
        { id:"tc_9",  code:"10-9",  desc:"Funkspruch wiederholen",     color:"var(--text-main)" },
        { id:"tc_10", code:"10-10", desc:"Weiterer RTW benötigt",      color:"var(--warning)" },
        { id:"tc_11", code:"10-11", desc:"Im Dienst",                  color:"var(--success)" },
        { id:"tc_12", code:"10-12", desc:"Dienstende",                 color:"var(--danger)" },
        { id:"tc_13", code:"10-20", desc:"Aktives Schussgefecht",      color:"var(--danger)" },
        { id:"tc_14", code:"10-19", desc:"Abholung benötigt",          color:"var(--warning)" },
        { id:"tc_15", code:"11-44", desc:"RTW von PD/USMS benötigt",   color:"var(--danger)" },
        { id:"tc_16", code:"11-99", desc:"Medic in Gefahr (Code Red)", color:"var(--danger)" }
    ],
    statusCodes: [
        { id:"sc_1", code:"1", desc:"Ausbildung", color:"var(--primary)" },
        { id:"sc_2", code:"2", desc:"verfügbar",  color:"var(--success)" },
        { id:"sc_3", code:"3", desc:"In Pause",   color:"var(--warning)" },
        { id:"sc_4", code:"4", desc:"Psychologie",color:"var(--primary)" },
        { id:"sc_5", code:"5", desc:"Besprechung",color:"var(--text-main)" }
    ],
    streifen: [
        { id:"st_1", code:"1", desc:"Streifen",      color:"var(--primary)" },
        { id:"st_2", code:"2", desc:"Luftrettung",   color:"var(--primary)" },
        { id:"st_3", code:"3", desc:"Sonderstreife", color:"var(--primary)" },
        { id:"st_4", code:"4", desc:"Bereitschaft",  color:"var(--primary)" }
    ],
    keineRechnung: [
        { id:"kr_1", name:"Staatliche Fraktionen",           note:"(SAPD, USMS, DOJ & SAMD)",            desc:"Im Dienst wird keine Rechnung ausgestellt" },
        { id:"kr_2", name:"Mechaniker",                      note:"(Benny's, Redfield & Roxwood Tuning)", desc:"Im Dienst wird keine Rechnung ausgestellt" },
        { id:"kr_3", name:"Security C77 / Bahamas / Casino", note:"",                                    desc:"Im Dienst wird keine Rechnung ausgestellt" }
    ]
};
let cachedGuideData = JSON.parse(JSON.stringify(defaultGuideData));

/* ── Material & Szenarien ──────────────────────────────────── */
let materialKatalog = {
    mat_05mg:        { name:"05mg Schmerzmittel", preis:200 },
    mat_10mg:        { name:"10mg Schmerzmittel", preis:400 },
    mat_15mg:        { name:"15mg Schmerzmittel", preis:600 },
    mat_20mg:        { name:"20mg Schmerzmittel", preis:800 },
    mat_schiene:     { name:"Schiene",            preis:600 },
    mat_naehset:     { name:"Nähset",             preis:350 },
    mat_wundreiniger:{ name:"Wundreiniger",        preis:150 },
    mat_ehk:         { name:"EHK",                preis:400 },
    mat_kuehlpack:   { name:"Kühlpack",           preis:200 },
    mat_verband:     { name:"Verband",            preis:200 },
    mat_wasser:      { name:"Wasser",             preis:200 }
};

let szenarioTemplates = {
    "Undefinierbar":  { mat_wundreiniger:1, mat_naehset:1, mat_verband:1, mat_10mg:1 },
    "Schnittwunde":   { mat_wundreiniger:1, mat_naehset:1, mat_verband:1, mat_15mg:1 },
    "Schusswunde":    { mat_wundreiniger:1, mat_naehset:1, mat_verband:1, mat_20mg:1 },
    "Stumpfe Gewalt": { mat_schiene:1, mat_naehset:1, mat_verband:1, mat_kuehlpack:1, mat_05mg:1 }
};

let medicDatenbank = {
    "Stumpfe Gewalt": ["Rechnung stellen","Vitalwerte prüfen","Schiene anlegen","Wunde nähen","Verband anlegen","Kühlpack verwenden","Schmerzmittel verabreichen (5 mg)"],
    "Schusswunde":    ["Rechnung stellen","Vitalwerte prüfen","Kugelzange benutzen","Wundreinigung durchführen","Wunde nähen","Verband anlegen","Schmerzmittel verabreichen (20 mg)"],
    "Schnittwunde":   ["Rechnung stellen","Vitalwerte prüfen","Wundreinigung durchführen","Wunde nähen","Verband anlegen","Schmerzmittel verabreichen (15 mg)"],
    "Undefinierbar":  ["Rechnung stellen","Vitalwerte prüfen","Wundreinigung durchführen","Wunde nähen","Verband anlegen","Schmerzmittel verabreichen (10 mg)"]
};

let defaultCommands = {
    cmd_1: { name:"!Psych",       desc:"Psych anforderungen",        kat:"Psychologie" },
    cmd_2: { name:"!waffenschein",desc:"Warten für die Überprüfung", kat:"Psychologie" },
    cmd_3: { name:"/editmdthud",  desc:"MD HUD ändern",              kat:"T-Codes" },
    cmd_4: { name:"PSGU Test",    desc:"Psychologisches Gutachten",   kat:"Abkürzungen & Dokumente" },
    cmd_5: { name:"CLS",          desc:"Combat Life Saver",           kat:"Abkürzungen & Dokumente" },
    cmd_6: { name:"EHK",          desc:"Erste Hilfe Kurs",            kat:"Abkürzungen & Dokumente" },
    cmd_7: { name:"!ausbildung",  desc:"Ausbildungsanfrage stellen",  kat:"Ausbildung" },
    cmd_8: { name:"!pruefung",    desc:"Prüfungsanmeldung",           kat:"Ausbildung" }
};

let defaultLinks = {
    link_1: { name:"Fraktions-Regelwerk SAMD",          url:"https://docs.google.com", desc:"Offizielles Regelwerk des SAMD", kat:"Allgemein" },
    link_2: { name:"Dienstblatt & Protokolle",           url:"https://docs.google.com", desc:"Zentrale Tabelle für Einsatzprotokolle", kat:"MD Intern" },
    link_3: { name:"Ausbildungs-Leitfaden & Richtlinien",url:"https://docs.google.com", desc:"Richtlinien für Lehrgänge & Prüfungen", kat:"Ausbildung" },
    link_4: { name:"Medikamenten-Leitfaden",            url:"https://docs.google.com", desc:"Dosierungen und Wirkstoffe", kat:"MD Intern" },
    link_5: { name:"Preisliste Behandlungen",           url:"https://docs.google.com", desc:"Aktuelle Abrechnungspreise", kat:"MD Intern" },
    link_6: { name:"Dienstplan / Schichtplan",          url:"https://docs.google.com", desc:"Aktuelle Dienstverteilung", kat:"MD Intern" },
    link_7: { name:"Urlaubsantrag",                     url:"https://docs.google.com", desc:"Formular zur Urlaubsbeantragung", kat:"Allgemein" }
};

/* ── Standard-Prüfungskatalog ─────────────────────────────── */
let defaultExams = {
    exam_ga1: {
        id: "exam_ga1", title: "Grundausbildung 1 (GA1)", kat: "Grundausbildung", timeLimitMinutes: 30, passPercentage: 60, passScore: 15,
        introText: "Willkommen bei der Grundausbildung 1. Mindestpunktzahl zum Bestehen: 15 Punkte (60%).",
        questions: [
            { id: 1, text: "Wie viel kostet ein MRT?", options: ["10.000 $", "7.500 $", "5.000 $", "2.500 $"], correctAnswers: [3] },
            { id: 2, text: "Wie viel kostet eine Reanimation? Im Zeitraum von 0 - 6Uhr!", options: ["2.500 $", "5.000 $", "7.500 $", "10.000 $"], correctAnswers: [3] },
            { id: 3, text: "Wie melde ich, dass mein Dispatch erledigt ist?", options: ["Einfach wegfahren", "SMS an Leitstelle", "Meldung im Funk: [Unit] 10-5", "Neuen Dispatch senden"], correctAnswers: [2] },
            { id: 4, text: "Was bedeutet der Funkcode 10-3?", options: ["Unterwegs", "Verstanden, Ende", "Weg ins MD", "Funkstille"], correctAnswers: [2] },
            { id: 5, text: "Was bedeutet der Funkcode 10-10?", options: ["Statusbericht", "Am Einsatzort", "Unterwegs", "Weiterer RTW benötigt"], correctAnswers: [3] },
            { id: 6, text: "Streife 2 trifft vor Ort ein und die Leitstelle fragt nach 10-8.", options: ["Einsatz abbrechen", "Warten auf Anweisung", "Ignorieren", "Streife 2 meldet ihren Status"], correctAnswers: [3] },
            { id: 7, text: "Wie meldest du dich im Funk an?", options: ["DN, meldet sich Status 10-4", "DN, meldet sich Status 10-5", "DN, meldet sich 10-11", "DN, meldet sich Code 10-2"], correctAnswers: [2] },
            { id: 8, text: "In welches GPS loggst du dich ein?", options: ["Kanal 1", "Kanal 4", "Kanal 2", "Kanal 3", "Kanal 5"], correctAnswers: [3] },
            { id: 9, text: "Wo stempelst du dich ein?", options: ["Hinter dem Tresen", "Gar nicht", "In der Mensa", "Hinter dem Gebäude"], correctAnswers: [0] },
            { id: 10, text: "Was ziehst du bei Dienstantritt an?", options: ["Außendienstkleidung", "Innendienstkleidung", "Leitstellen Outfit", "Zivilkleidung"], correctAnswers: [0] }
        ]
    },
    exam_ga2: {
        id: "exam_ga2", title: "Grundausbildung 2 (GA2)", kat: "Grundausbildung", timeLimitMinutes: 30, passPercentage: 60, passScore: 12,
        introText: "Vertiefung von Behandlungsabläufen, Materialkunde und Notfallversorgung.",
        questions: [
            { id: 1, text: "Welche Medikamentendosis wird bei einer Schusswunde standardmäßig verabreicht?", options: ["5mg Schmerzmittel", "10mg Schmerzmittel", "15mg Schmerzmittel", "20mg Schmerzmittel"], correctAnswers: [3] },
            { id: 2, text: "Welche Materialien werden für eine Schnittwunde benötigt?", options: ["Wundreiniger, Nähset, Verband, 15mg Schmerzmittel", "Schiene, Kühlpack, 5mg Schmerzmittel", "Kugelzange, 20mg Schmerzmittel"], correctAnswers: [0] },
            { id: 3, text: "Was ist der erste Schritt bei jeder Patientenbehandlung?", options: ["Vitalwerte prüfen / Anamnese durchführen", "Sofort operieren", "Medikamente spritzen"], correctAnswers: [0] },
            { id: 4, text: "Welche Materialien werden zur Behandlung einer Fraktur benötigt?", options: ["Schiene, Kühlpack, Verband, 10mg Schmerzmittel", "Kugelzange und Nähset", "Nur Verband"], correctAnswers: [0] },
            { id: 5, text: "Welche Materialien werden zur Behandlung einer Schusswunde benötigt?", options: ["Wundreiniger, Kugelzange, Nähset, Verband, 20mg Schmerzmittel", "Nur Verband", "Kühlpack und Schiene"], correctAnswers: [0] }
        ]
    },
    exam_dv: {
        id: "exam_dv", title: "Dienstvorschriften (DV)", kat: "Dienstvorschriften", timeLimitMinutes: 30, passPercentage: 70, passScore: 14,
        introText: "Überprüfung der Dienstvorschriften, Verhaltensrichtlinien und Funkordnung des SAMD.",
        questions: [
            { id: 1, text: "Wer ist weisungsberechtigt gegenüber den Mitarbeitern im Dienst?", options: ["Die anwesende Schichtleitung & Führungsebene (High & Mid Command)", "Jeder Bürger", "Nur der Chief"], correctAnswers: [0] },
            { id: 2, text: "Wann darf das Sondersignal (Blaulicht & Sirene, Code 3) eingesetzt werden?", options: ["Ausschließlich bei dringenden Notfalleinsätzen oder autorisierten Einsatzfahrten", "Immer", "Zum Spaß"], correctAnswers: [0] },
            { id: 3, text: "Wie ist die ärztliche Schweigepflicht gegenüber Dritten geregelt?", options: ["Patientendaten und Diagnosen sind streng vertraulich", "Darf gepostet werden", "Gibt keine"], correctAnswers: [0] },
            { id: 4, text: "Welche Pflicht besteht bezüglich der Dokumentation?", options: ["Jede Behandlung und jeder Verbrauch muss zeitnah live protokolliert werden", "Keine Pflicht", "Nur bei Todesfällen"], correctAnswers: [0] },
            { id: 5, text: "§13.1 & §13.2: Wann dürfen Medics Personen an einem Schusswechsel wiederbeleben?", options: ["Erst wenn kein Schusswechsel mehr stattfindet und die Situation gesichert ist", "Mitten im Gefecht", "Sofort"], correctAnswers: [0] }
        ]
    },
    exam_para1: {
        id: "exam_para1", title: "Paramedic 1 (Para 1)", kat: "Paramedic", timeLimitMinutes: 30, passPercentage: 75, passScore: 15,
        introText: "Erweiterte Notfallmedizin und Rettungsdienstpraxis.",
        questions: [
            { id: 1, text: "Was bedeutet Triage bei einem Massenanfall von Verletzten (MANV)?", options: ["Priorisierung der Patienten nach Schwere der Verletzung", "Wer zuerst kommt, wird zuerst behandelt", "Alle gleichzeitig"], correctAnswers: [0] },
            { id: 2, text: "Welche Maßnahme wird bei einem schweren Spannungspneumothorax eingeleitet?", options: ["Entlastungspunktion / Thoraxdrainage", "Nur Schmerzmittel", "Warten"], correctAnswers: [0] }
        ]
    },
    exam_para2: {
        id: "exam_para2", title: "Paramedic 2 (Para 2)", kat: "Paramedic", timeLimitMinutes: 30, passPercentage: 75, passScore: 15,
        introText: "ACLS-Leitlinien, erweiterte Notfallversorgung und schwierige Atemwegs-Sicherung.",
        questions: [
            { id: 1, text: "Welche Medikamente werden bei einer Reanimation nach ACLS-Standard verabreicht?", options: ["1mg Adrenalin alle 3-5 Minuten", "100mg Morphin sofort", "Nur Kochsalzlösung"], correctAnswers: [0] },
            { id: 2, text: "Was bedeutet das 'cABCDE'-Schema in der präklinischen Traumabehandlung?", options: ["critical bleeding, Airway, Breathing, Circulation, Disability, Exposure", "control, Ambulance, Blood, Care, Doctor, Emergency"], correctAnswers: [0] }
        ]
    },
    exam_arzt1: {
        id: "exam_arzt1", title: "Arzt 1", kat: "Doctor", timeLimitMinutes: 35, passPercentage: 80, passScore: 16,
        introText: "Klinisches Basiswissen, Differentialdiagnostik und Stationsorganisation.",
        questions: [
            { id: 1, text: "Welche Diagnostik ist bei Verdacht auf akutes Koronarsyndrom (STEMI) unverzüglich durchzuführen?", options: ["12-Kanal-EKG, Troponin-Labor und Vitalparameter-Monitoring", "Nur Blutdruck messen", "MRT des Schädels"], correctAnswers: [0] },
            { id: 2, text: "Welche Erstmaßnahme erfolgt bei einem anaphylaktischen Schock (Grad III/IV)?", options: ["Adrenalin i.m. (0,5 mg), Sauerstoff, Volumengabe, H1/H2-Blocker & Glukokortikoide", "Nur ein Glas Wasser", "Aspirin 1000mg"], correctAnswers: [0] }
        ]
    },
    exam_arzt2: {
        id: "exam_arzt2", title: "Arzt 2", kat: "Doctor", timeLimitMinutes: 40, passPercentage: 85, passScore: 18,
        introText: "Klinische Notfallchirurgie, Intensivmedizin und Führungskompetenz.",
        questions: [
            { id: 1, text: "Welche Indikation besteht für eine sofortige Notfall-Laparotomie im Schockraum?", options: ["Akutes Hämoperitoneum mit hämodynamischer Instabilität", "Leichte Bauchschmerzen", "Chronische Gastritis"], correctAnswers: [0] },
            { id: 2, text: "Was ist das Prinzip des 'Damage Control Surgery' beim Polytrauma?", options: ["Schnelle Blutungskontrolle und Dekontamination, Stabilisierung vor definitiver Rekonstruktion", "10-stündige Komplett-OP sofort", "Nur Verband anlegen"], correctAnswers: [0] }
        ]
    }
};

let _examBuilderQuestions = [];

let hierarchieDaten = {
    chief_01:"Aktuell nicht belegt", chief_02:"Aktuell nicht belegt", chief_03:"Aktuell nicht belegt",
    domo_04:"Nick Garcia",   domo_04_sub:"",
    fod_05:"Mike Gonzalo",   fod_05_sub:"",
    chiefphys_06:"Katarina Harper", chiefphys_07:"Tim Sanddorn",
    lt_08:"Aktuell nicht belegt", lt_09:"Aktuell nicht belegt",
    dept_psych_l:"Aktuell nicht belegt",  dept_psych_sl:"Aktuell nicht belegt",
    dept_perso_l:"Aktuell nicht belegt",  dept_perso_sl:"Aktuell nicht belegt",
    dept_ausb_l:"Aktuell nicht belegt",   dept_ausb_sl:"Aktuell nicht belegt",
    dept_luft_l:"Gleich die Ausbildungsleitung", dept_luft_sl:"Aktuell nicht belegt",
    a_emt_count:"2", emt_count:"0"
};

/* ── Audit Logger ──────────────────────────────────────────── */
function logAdminAudit(action, details) {
    if (!sessionUser) return;
    db.ref('data/auditLogs').push({
        action: action,
        details: details,
        admin: sessionUser.vorname + ' ' + sessionUser.nachname,
        ts: Date.now()
    });
}

/* ── Rollen & Effektive Berechtigungen ─────────────────────── */
function getUserRolesList(user) {
    if (!user) return [];
    let list = [];
    if (user.roles) {
        if (Array.isArray(user.roles)) list = [...user.roles];
        else if (typeof user.roles === 'object') list = Object.keys(user.roles).filter(k => user.roles[k] === true);
    }
    const v = (user.vorname||'').trim().toLowerCase(), n = (user.nachname||'').trim().toLowerCase();
    if (v === 'tim' && n === 'sanddorn' && !list.includes('masteradmin')) list.unshift('masteradmin');
    if (user.isMasterAdmin && !list.includes('masteradmin')) list.unshift('masteradmin');
    else if (user.isAdmin && !list.includes('admin') && !list.includes('masteradmin')) list.push('admin');
    if (user.canManageInstructors && !list.includes('ausbildungsleitung')) list.push('ausbildungsleitung');
    else if (user.isInstructor && !list.includes('ausbilder') && !list.includes('ausbildungsleitung')) list.push('ausbilder');
    return [...new Set(list)];
}

function getUserEffectivePermissions(user) {
    const eff = {
        isAdmin:false, isMasterAdmin:false, canViewArchive:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false,
        allowedCmdKats: [],
        allowedLinkKats: []
    };
    if (!user) return eff;

    const roleIds = getUserRolesList(user);
    roleIds.forEach(rId => {
        const role = cachedRoles[rId] || defaultRoles[rId];
        if (!role) return;
        Object.keys(eff).forEach(prop => {
            if (prop === 'allowedCmdKats' || prop === 'allowedLinkKats') {
                if (role[prop] && Array.isArray(role[prop])) {
                    eff[prop] = [...new Set([...eff[prop], ...role[prop]])];
                }
            } else if (role[prop]) {
                eff[prop] = true;
            }
        });
    });

    Object.keys(eff).forEach(k => {
        if (k !== 'allowedCmdKats' && k !== 'allowedLinkKats' && user[k]) eff[k] = true;
    });

    const v = (user.vorname||'').trim().toLowerCase(), n = (user.nachname||'').trim().toLowerCase();
    if (v === 'tim' && n === 'sanddorn') {
        Object.keys(eff).forEach(k => {
            if (k !== 'allowedCmdKats' && k !== 'allowedLinkKats') eff[k] = true;
        });
    }
    return eff;
}

function isUserInstructor() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return eff.isInstructor || eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin;
}

function renderUserRoleBadges(user, isTopBar = false) {
    if (!user) return '';
    const roleIds = getUserRolesList(user);
    if (!roleIds.length) return '<span class="user-role-badge" style="background:#64748b22;color:#94a3b8;border:1px solid #64748b44;font-size:11px;padding:2px 8px;border-radius:6px;">Mitarbeiter</span>';
    
    if (isTopBar && roleIds.length > 2) {
        const topRoles = roleIds.slice(0, 2);
        const remaining = roleIds.length - 2;
        const allNames = roleIds.map(rId => (cachedRoles[rId] || defaultRoles[rId])?.name || rId).join(', ');
        const badgesHtml = topRoles.map(rId => {
            const r = cachedRoles[rId] || defaultRoles[rId];
            if (!r) return '';
            const c = r.color || '#38bdf8';
            return `<span class="user-role-badge" style="background:${c}22;color:${c};border:1px solid ${c}44;font-size:11px;padding:2px 8px;border-radius:6px;white-space:nowrap;">${r.icon ? r.icon + ' ' : ''}${r.name}</span>`;
        }).join('');
        return badgesHtml + `<span class="user-role-badge" title="${allNames}" style="background:rgba(255,255,255,0.1);color:var(--text-muted);border:1px solid var(--border);font-size:10px;padding:2px 6px;border-radius:6px;cursor:pointer;white-space:nowrap;">+${remaining} weitere</span>`;
    }

    return roleIds.map(rId => {
        const r = cachedRoles[rId] || defaultRoles[rId];
        if (!r) return '';
        const c = r.color || '#38bdf8';
        return `<span class="user-role-badge" style="background:${c}22;color:${c};border:1px solid ${c}44;font-size:11px;padding:2px 8px;border-radius:6px;white-space:nowrap;display:inline-block;margin:2px;">${r.icon ? r.icon + ' ' : ''}${r.name}</span>`;
    }).join('');
}

/* ── Authentifizierung ─────────────────────────────────────── */
function toggleAuthTab(tab) {
    currentAuthTab = tab;
    document.getElementById('tabLoginBtn').classList.toggle('active', tab==='login');
    document.getElementById('tabRegisterBtn').classList.toggle('active', tab==='register');
    document.getElementById('mainAuthActionBtn').textContent = tab==='login' ? 'Dienst antreten' : 'Account beantragen';
    document.getElementById('authPassword').placeholder = tab==='login' ? 'Passwort' : 'Passwort ausdenken';
    const dnC = document.getElementById('authDNContainer');
    if (dnC) dnC.style.display = tab==='login' ? 'none' : 'block';
}

function handleAuthAction() {
    const v = (document.getElementById('authVorname')?.value||'').trim();
    const n = (document.getElementById('authNachname')?.value||'').trim();
    const p = (document.getElementById('authPassword')?.value||'').trim();
    if (!v || !n || !p) { alert('Bitte alle Felder ausfüllen!'); return; }
    const uId = (v+'_'+n).toLowerCase().replace(/[^a-z0-9_]/g,'');

    if (v.toLowerCase()==='tim' && n.toLowerCase()==='sanddorn' && p==='0815') {
        const admin = {
            vorname:'Tim', nachname:'Sanddorn', pass:'0815', status:'approved',
            isAdmin:true, isMasterAdmin:true, roles:{masteradmin:true}, date:'20.07.2026'
        };
        db.ref('data/users/tim_sanddorn').update(admin);
        initDienstEintritt(admin);
        return;
    }

    if (currentAuthTab === 'register') {
        const dn = (document.getElementById('authDN')?.value||'').trim();
        if (!dn) { alert('Bitte Dienstnummer eingeben!'); return; }
        db.ref('data/users/'+uId).once('value', snap => {
            if (snap.val()) { alert('Dieser Name ist bereits registriert!'); return; }
            const newUser = {
                vorname: v, nachname: n, pass: p, dn: dn, status: 'pending',
                date: new Date().toLocaleDateString('de-DE'), roles: { mitarbeiter: true }
            };
            db.ref('data/users/'+uId).set(newUser).then(() => {
                alert('Registrierung erfolgreich! Bitte warten Sie auf die Freischaltung durch die Leitung.');
                location.reload();
            });
        });
    } else {
        db.ref('data/users/'+uId).once('value', snap => {
            const user = snap.val();
            if (!user || user.pass !== p) { alert('Falscher Name oder falsches Passwort!'); return; }
            if (user.status !== 'approved' && !user.isAdmin && !user.isMasterAdmin) {
                alert('Dein Account wurde noch nicht freigeschaltet oder ist gesperrt!');
                return;
            }
            initDienstEintritt(user);
        });
    }
}

/* ── Dienst-Start & App Init ───────────────────────────────── */
function applyUserPermissions(user) {
    if (!user) return;
    const eff = getUserEffectivePermissions(user);
    
    const akBtn = document.getElementById('adminKeyBtn');
    if (akBtn) akBtn.style.display = (eff.isAdmin || eff.isMasterAdmin) ? 'inline-block' : 'none';

    const pEdit = document.getElementById('btnEditPricesInline');
    if (pEdit) pEdit.style.display = eff.canEditPrices ? 'inline-block' : 'none';

    const gEdit = document.getElementById('btnEditGuideInline');
    if (gEdit) gEdit.style.display = eff.canEditGuide ? 'inline-block' : 'none';

    const cEdit = document.getElementById('btnEditCommandsInline');
    if (cEdit) cEdit.style.display = eff.canEditCommands ? 'inline-block' : 'none';

    const lEdit = document.getElementById('btnEditLinksInline');
    if (lEdit) lEdit.style.display = eff.canEditLinks ? 'inline-block' : 'none';

    const hEdit = document.getElementById('btnEditHierarchieInline');
    if (hEdit) hEdit.style.display = (eff.isAdmin || eff.isMasterAdmin) ? 'inline-block' : 'none';

    const aBtn = document.getElementById('btnOpenWeeklyArchive');
    if (aBtn) aBtn.style.display = (eff.canViewArchive || eff.isAdmin) ? 'inline-block' : 'none';

    const npBtn = document.getElementById('btnOpenPostNews');
    if (npBtn) npBtn.style.display = eff.canPostNews ? 'inline-block' : 'none';

    const instrView = document.getElementById('examInstructorView');
    if (instrView) instrView.style.display = isUserInstructor() ? 'block' : 'none';

    const allowedExamsBtn = document.getElementById('instrAllowedExamsTabBtn');
    if (allowedExamsBtn) allowedExamsBtn.style.display = (eff.canManageInstructors || eff.isAdmin) ? '' : 'none';

    const instrManageBtn = document.getElementById('instrTabManageBtn');
    if (instrManageBtn) instrManageBtn.style.display = (eff.canManageExams || eff.isAdmin) ? '' : 'none';

    document.querySelectorAll('.admin-action-th').forEach(el => {
        el.style.display = eff.delArchiv ? 'table-cell' : 'none';
    });

    const manualArchBtn = document.getElementById('btnManualArchive');
    if (manualArchBtn) manualArchBtn.style.display = (eff.isAdmin || eff.isMasterAdmin) ? 'inline-block' : 'none';

    const manualProtArchBtn = document.getElementById('btnManualProtArchive');
    if (manualProtArchBtn) manualProtArchBtn.style.display = (eff.isAdmin || eff.isMasterAdmin) ? 'inline-block' : 'none';
}

function initDienstEintritt(user) {
    sessionUser = user;
    sessionStorage.setItem('mmd_session_active', 'true');
    sessionStorage.setItem('mmd_session_user', JSON.stringify(user));
    localStorage.setItem('mmd_session_active', 'true');
    localStorage.setItem('mmd_session_user', JSON.stringify(user));

    document.getElementById('authView').style.display = 'none';
    document.getElementById('mainAppView').style.display = 'block';
    document.getElementById('topBarMedicName').innerHTML = '<b>' + user.vorname + ' ' + user.nachname + '</b> ' + renderUserRoleBadges(user, true);
    
    const dEl = document.getElementById('daysMedicName');
    if (dEl) dEl.textContent = user.vorname + ' ' + user.nachname;

    applyUserPermissions(user);
    startPresenceWatcher();
    updateOnlineStatus();
    updateLiveDate();
    baueMaterialUIAuf();
    startFirebaseListeners();
    setupMidnightScheduler();

    const gDatum = localStorage.getItem('mmd_einstellungsdatum_' + user.vorname + '_' + user.nachname);
    const eDatumEl = document.getElementById('einstellungsDatum');
    if (gDatum && eDatumEl) { eDatumEl.value = gDatum; berechneDienstTage(); }
}

function updateLiveDate() {
    const el = document.getElementById('liveDateDisplay');
    if (el) el.textContent = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

/* ── Automatische Mitternachts-Archivierung (00:00 Uhr) ────── */
function setupMidnightScheduler() {
    checkMidnightAutoArchive();
    setInterval(checkMidnightAutoArchive, 15000);
}

function checkMidnightAutoArchive() {
    const now = new Date();
    const todayFormatted = now.toLocaleDateString('de-DE');
    
    db.ref('data/systemStatus/lastArchiveDate').once('value', snap => {
        const lastArchived = snap.val();
        if (!lastArchived) {
            db.ref('data/systemStatus/lastArchiveDate').set(todayFormatted);
            return;
        }

        if (lastArchived !== todayFormatted) {
            db.ref('data/systemStatus/lastArchiveDate').set(todayFormatted).then(() => {
                executeMidnightArchive(lastArchived);
            });
        }
    });
}

function executeMidnightArchive(archivedDateLabel) {
    const archiveTimestamp = Date.now();

    db.ref('data/protokoll').once('value', s => {
        const p = s.val() || {};
        const entries = Object.values(p);
        if (entries.length > 0) {
            let tP = entries.length;
            let tV = 0;
            let tA = 0;
            let tm = {};

            entries.forEach(x => {
                tV += Number(x.verletzungen) || 0;
                tA += Number(x.kosten) || 0;
                const mObj = x.material || {};
                Object.keys(mObj).forEach(k => {
                    tm[k] = (tm[k] || 0) + (Number(mObj[k]) || 0);
                });
            });

            db.ref('data/archiv').push({
                datum: archivedDateLabel,
                patienten: tP,
                verletzungen: tV,
                ausgaben: tA,
                material: tm,
                ts: archiveTimestamp,
                isAutoArchived: true
            }).then(() => {
                db.ref('data/protokoll').remove();
            });
        }
    });

    db.ref('data/auditLogs').once('value', s => {
        const logs = s.val() || {};
        if (Object.keys(logs).length > 0) {
            const dateKeySafe = archivedDateLabel.replace(/\./g, '-');
            db.ref('data/auditLogsArchiv/' + dateKeySafe).set(logs).then(() => {
                db.ref('data/auditLogs').remove();
            });
        }
    });
}

/* ── Firebase Listeners ────────────────────────────────────── */
function startFirebaseListeners() {
    db.ref('data/protokoll').on('value', s => renderProtokoll(s.val() || {}));
    db.ref('data/archiv').on('value', s => { cachedArchiv = s.val() || {}; renderArchiv(cachedArchiv); });
    db.ref('data/hierarchie').on('value', s => renderHierarchieBoard(s.val() || hierarchieDaten));
    db.ref('data/guide').on('value', s => {
        cachedGuideData = s.val() ? Object.assign(JSON.parse(JSON.stringify(defaultGuideData)), s.val()) : JSON.parse(JSON.stringify(defaultGuideData));
        renderGuideTab();
    });
    db.ref('data/materialPreise').on('value', s => {
        if (!s.val()) return;
        Object.keys(s.val()).forEach(k => { if (materialKatalog[k]) materialKatalog[k].preis = s.val()[k]; });
        baueMaterialUIAuf();
    });
    db.ref('data/szenarioTemplates').on('value', s => { if (s.val()) szenarioTemplates = Object.assign({}, szenarioTemplates, s.val()); });
    db.ref('data/dienstLinks').on('value', s => renderLinksTab(s.val() || {}));
    db.ref('data/dienstCommands').on('value', s => renderCommandsTab(s.val() || {}));
    db.ref('data/roles').on('value', s => {
        cachedRoles = s.val() ? Object.assign({}, defaultRoles, s.val()) : Object.assign({}, defaultRoles);
        if (sessionUser) applyUserPermissions(sessionUser);
    });
    db.ref('data/users').on('value', s => {
        cachedUsers = s.val() || {};
        if (sessionUser) {
            const uId = (sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'');
            if (cachedUsers[uId]) {
                sessionUser = cachedUsers[uId];
                applyUserPermissions(sessionUser);
            }
        }
        renderExamTab();
        renderAdminUserTable(cachedUsers);
    });
    db.ref('data/exams').on('value', s => {
        const raw = s.val() || {};
        cachedExams = {};
        Object.keys(defaultExams).forEach(k => {
            if (!raw[k] || !raw[k].deleted) cachedExams[k] = defaultExams[k];
        });
        Object.keys(raw).forEach(k => {
            if (raw[k] && !raw[k].deleted) cachedExams[k] = raw[k];
        });
        renderExamTab();
    });
    db.ref('data/examSubmissions').on('value', s => {
        cachedSubmissions = s.val() || {};
        renderInstructorSubmissions(cachedSubmissions);
        renderStudentUnlockedExams();
    });
    db.ref('data/news').on('value', s => {
        cachedNews = s.val() || {};
        renderNewsFeedData(cachedNews);
    });
    db.ref('data/auditLogs').on('value', s => {
        cachedAuditLogs = s.val() || {};
        renderAdminAuditLogsData(cachedAuditLogs);
    });
}

/* ── Presence Watcher ──────────────────────────────────────── */
function updateOnlineStatus() {
    if (!sessionUser) return;
    if (!mySessionRef) { mySessionRef = db.ref('data/presence').push(); mySessionRef.onDisconnect().remove(); }
    mySessionRef.set(sessionUser.vorname + ' ' + sessionUser.nachname);
}

function startPresenceWatcher() {
    db.ref('data/presence').off();
    db.ref('data/presence').on('value', snap => {
        const list = snap.val();
        const d = document.getElementById('onlineMedicsList');
        if (!list) { if (d) d.textContent = 'Keiner im Dienst'; return; }
        const names = [...new Set(Object.values(list))].join(', ');
        if (d) d.textContent = names;
    });
}

/* ── REITER 1: DOKUMENTATION & EINSATZ ─────────────────────── */
function stepVerletzungenAnzahl(d) {
    anzahlVerletzungenFall = Math.max(1, anzahlVerletzungenFall + d);
    const el = document.getElementById('val_pVerletzungenAnzahl'); 
    if (el) el.textContent = anzahlVerletzungenFall;

    const sz = document.getElementById('verletzungSelect')?.value;
    if (sz && szenarioTemplates[sz]) {
        const tpl = szenarioTemplates[sz];
        Object.keys(materialKatalog).forEach(k => {
            if (k === 'mat_wasser') return;
            const baseQty = tpl[k] || 0;
            fallMaterial[k] = baseQty * anzahlVerletzungenFall;
            const e = document.getElementById('val_' + k);
            if (e) e.textContent = fallMaterial[k];
        });
    }

    fallMaterial['mat_wasser'] = anzahlVerletzungenFall;
    const we = document.getElementById('val_mat_wasser');
    if (we) we.textContent = anzahlVerletzungenFall;

    let total = 0;
    Object.keys(fallMaterial).forEach(k => {
        if (materialKatalog[k]) total += fallMaterial[k] * materialKatalog[k].preis;
    });
    aktuellerFallKosten = total;
    const ke = document.getElementById('val_pKosten');
    if (ke) ke.textContent = '$' + total;
}

function stepKosten(d) {
    aktuellerFallKosten = Math.max(0, aktuellerFallKosten + d);
    const el = document.getElementById('val_pKosten'); if (el) el.textContent = '$' + aktuellerFallKosten;
}

function stepMat(key, d) {
    fallMaterial[key] = Math.max(0, (fallMaterial[key]||0) + d);
    const el = document.getElementById('val_' + key); if (el) el.textContent = fallMaterial[key];
    let total = 0; Object.keys(fallMaterial).forEach(k => { if (materialKatalog[k]) total += fallMaterial[k] * materialKatalog[k].preis; });
    aktuellerFallKosten = total;
    const ke = document.getElementById('val_pKosten'); if (ke) ke.textContent = '$' + total;
}

function ladeCheckliste() {
    const sel = document.getElementById('verletzungSelect'), cont = document.getElementById('checklisteContainer');
    if (!sel || !cont) return;
    const sz = sel.value;
    if (!sz) { 
        cont.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>'; 
        return; 
    }
    const schritte = medicDatenbank[sz] || [];
    cont.innerHTML = schritte.map((s, i) => `<div class="todo-item" id="todo_${i}" onclick="toggleTodo(${i})"><input type="checkbox" id="check_${i}" onclick="event.stopPropagation();toggleTodo(${i})"><span>${s}</span></div>`).join('');
    
    const tpl = szenarioTemplates[sz] || {};
    Object.keys(materialKatalog).forEach(k => {
        if (k === 'mat_wasser') return;
        const baseQty = tpl[k] || 0;
        fallMaterial[k] = baseQty * anzahlVerletzungenFall;
        const e = document.getElementById('val_' + k); 
        if (e) e.textContent = fallMaterial[k];
    });
    fallMaterial['mat_wasser'] = anzahlVerletzungenFall;
    const we = document.getElementById('val_mat_wasser'); 
    if (we) we.textContent = anzahlVerletzungenFall;
    
    let total = 0; 
    Object.keys(fallMaterial).forEach(k => { 
        if (materialKatalog[k]) total += fallMaterial[k] * materialKatalog[k].preis; 
    });
    aktuellerFallKosten = total;
    const ke = document.getElementById('val_pKosten'); 
    if (ke) ke.textContent = '$' + total;
}

function toggleTodo(idx) {
    const item = document.getElementById('todo_' + idx), chk = document.getElementById('check_' + idx);
    if (!item) return;
    item.classList.toggle('completed');
    if (chk) chk.checked = item.classList.contains('completed');
}

function resetMedicalWorkflow() {
    const cont = document.getElementById('checklisteContainer');
    if (!cont) return;
    const items = cont.querySelectorAll('.todo-item');
    items.forEach(it => {
        it.classList.remove('completed');
        const chk = it.querySelector('input[type="checkbox"]');
        if (chk) chk.checked = false;
    });
}

function patientHinzufuegen() {
    if (!sessionUser) { alert('Nicht eingeloggt!'); return; }
    const nF = document.getElementById('pName'), sS = document.getElementById('verletzungSelect');
    const patName = (nF?.value||'').trim() || 'Patient ' + ((daten.patienten||0)+1);
    const sz = sS?.value || 'Undefinierbar';
    const mat = Object.assign({}, fallMaterial); mat['mat_wasser'] = anzahlVerletzungenFall;
    
    db.ref('data/protokoll').push({
        name: patName, szenario: sz, verletzungen: anzahlVerletzungenFall, kosten: aktuellerFallKosten,
        material: mat, medic: sessionUser.vorname + ' ' + sessionUser.nachname, ts: Date.now()
    }).then(() => {
        if (nF) nF.value = '';
        if (sS) sS.value = '';
        anzahlVerletzungenFall = 1;
        aktuellerFallKosten = 0;
        fallMaterial = {};
        const vE = document.getElementById('val_pVerletzungenAnzahl'), kE = document.getElementById('val_pKosten');
        if (vE) vE.textContent = '1';
        if (kE) kE.textContent = '$0';
        const cc = document.getElementById('checklisteContainer');
        if (cc) cc.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>';
        baueMaterialUIAuf();
    });
}

function baueMaterialUIAuf() {
    const grid = document.getElementById('dynamischerMaterialVerbrauchGrid'); if (!grid) return;
    grid.innerHTML = '';
    let hL = '<div>', hR = '<div>', cnt = 0;
    const keys = Object.keys(materialKatalog).filter(k => k !== 'mat_wasser'), half = Math.ceil(keys.length/2);
    keys.forEach(k => {
        const q = fallMaterial[k] || 0;
        const h = `<div id="lbl_mat_${k}" class="material-label-title" style="margin-top:4px; font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">${materialKatalog[k].name} ($${materialKatalog[k].preis})</div><div class="counter-group" aria-labelledby="lbl_mat_${k}"><button type="button" class="counter-btn" onclick="stepMat('${k}',-1)" aria-label="Weniger">-</button><span class="counter-value" id="val_${k}">${q}</span><button type="button" class="counter-btn plus-main" onclick="stepMat('${k}',1)" aria-label="Mehr">+</button></div>`;
        if (cnt < half) hL += h; else hR += h; cnt++;
    });
    grid.innerHTML = hL + '</div>' + hR + '</div>';
    const wP = document.getElementById('wasserPreisLabel'); if (wP) wP.textContent = '$' + materialKatalog.mat_wasser.preis;
}

/* ── PREISE & SZENARIEN VOR ORT ANPASSEN (INLINE) ─────────── */
function openPricesInlineModal() {
    const cont = document.getElementById('pricesInlineContainer');
    if (!cont) return;
    cont.innerHTML = Object.keys(materialKatalog).map(k => `
        <div style="background:rgba(30,41,59,0.5);border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center;">
            <label for="inlinePrice_${k}" style="font-weight:700;margin:0;cursor:pointer;">📦 ${materialKatalog[k].name}</label>
            <div style="display:flex;align-items:center;gap:4px;">
                <input type="number" id="inlinePrice_${k}" value="${materialKatalog[k].preis}" style="width:90px;padding:6px;">
                <b style="color:var(--success);">$</b>
            </div>
        </div>
    `).join('');
    document.getElementById('pricesInlineModal').style.display = 'flex';
}
function closePricesInlineModal() { document.getElementById('pricesInlineModal').style.display = 'none'; }

function speicherePreiseInline() {
    const upd = {};
    Object.keys(materialKatalog).forEach(k => {
        const inp = document.getElementById('inlinePrice_' + k);
        if (inp) {
            const v = parseInt(inp.value) || materialKatalog[k].preis;
            upd[k] = v;
            materialKatalog[k].preis = v;
        }
    });
    db.ref('data/materialPreise').set(upd).then(() => {
        baueMaterialUIAuf();
        closePricesInlineModal();
        logAdminAudit('Materialpreise angepasst', `${sessionUser.vorname} ${sessionUser.nachname} hat die Preise vor Ort aktualisiert.`);
        alert('✅ Materialpreise gespeichert!');
    });
}

/* ── REITER 2: STATISTIK & ARCHIV ─────────────────────────── */
function renderProtokoll(obj) {
    const tbody = document.getElementById('logTableBody'); if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const entries = Object.entries(obj).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));
    
    tbody.innerHTML = entries.length === 0
        ? '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">📋 Noch keine Patienten für die laufende Schicht dokumentiert.</td></tr>'
        : entries.map(([k,v]) => {
            const dateStr = v.ts ? new Date(v.ts).toLocaleDateString('de-DE') : '-';
            return `<tr>
                <td>${v.name||'-'}</td>
                <td>${v.szenario||'-'}</td>
                <td>${v.verletzungen||0}</td>
                <td style="color:var(--success);font-weight:800;">$${v.kosten||0}</td>
                <td>${v.medic||'-'}</td>
                <td style="font-size:12px;color:var(--text-muted);">${dateStr}</td>
                <td>
                    <button class="btn-edit-row" onclick="openEditModal('${k}')">✏️</button>
                    ${eff.delPatient ? `<button class="btn-delete-row" onclick="deletePatient('${k}')">🗑️</button>` : ''}
                </td>
              </tr>`;
          }).join('');

    let tP = 0, tV = 0, tA = 0;
    entries.forEach(([,v]) => { tP++; tV += v.verletzungen||0; tA += v.kosten||0; });
    daten = { patienten: tP, verletzungen: tV, ausgaben: tA };
    
    const sp = document.getElementById('statPatienten'), sv = document.getElementById('statVerletzungen'), sa = document.getElementById('statAusgaben');
    if (sp) sp.textContent = tP; if (sv) sv.textContent = tV; if (sa) sa.textContent = '$' + tA;
    renderTagesVerbrauch(entries.map(([,v]) => v));
}

function renderTagesVerbrauch(entries) {
    const tbody = document.getElementById('tagesVerbrauchTableBody'); if (!tbody) return;
    const totals = {};
    entries.forEach(e => { const m = e.material||{}; Object.keys(m).forEach(k => { totals[k] = (totals[k]||0) + (m[k]||0); }); });
    tbody.innerHTML = Object.keys(totals).length === 0
        ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">📦 Noch kein Materialverbrauch erfasst.</td></tr>'
        : Object.entries(totals).filter(([,v]) => v > 0).map(([k,v]) => `<tr><td>${materialKatalog[k]?materialKatalog[k].name:k}</td><td><b>${v}x</b></td></tr>`).join('');
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return [d.getUTCFullYear(), weekNo];
}

function renderArchiv(obj) {
    const tbody = document.getElementById('archivTableBody');
    const tfoot = document.getElementById('archivTableFoot');
    if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    if (!obj || !Object.keys(obj).length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">📥 Noch keine archivierten Schichten vorhanden.</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    const currentWeekInfo = getWeekNumber(new Date());
    const currentWeekKey = `${currentWeekInfo[0]}-KW${currentWeekInfo[1].toString().padStart(2, '0')}`;

    let totalP = 0, totalV = 0, totalCash = 0, totalMatObj = {};
    const allEntries = Object.entries(obj).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));

    const cleanEntries = allEntries.filter(([, item]) => {
        const p = Number(item.patienten ?? item.p ?? 0);
        const cash = Number(item.ausgaben ?? item.cash ?? item.kosten ?? 0);
        if (p === 0 && cash === 0) return false;
        return true;
    });

    const weekEntries = cleanEntries.filter(([, item]) => {
        let d;
        if (item.ts) {
            d = new Date(item.ts);
        } else if (item.datum && item.datum.includes('.')) {
            const parts = item.datum.split('.');
            d = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            d = new Date();
        }
        const wInfo = getWeekNumber(d);
        const wKey = `${wInfo[0]}-KW${wInfo[1].toString().padStart(2, '0')}`;
        return wKey === currentWeekKey;
    });

    if (!weekEntries.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">📥 In der aktuellen Woche (${currentWeekKey}) liegen noch keine gültigen archivierten Schichten vor.</td></tr>`;
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    tbody.innerHTML = weekEntries.map(([k, i]) => {
        const p = Number(i.patienten ?? i.p ?? 0);
        const v = Number(i.verletzungen ?? i.v ?? 0);
        const cash = Number(i.ausgaben ?? i.cash ?? i.kosten ?? 0);
        const tagLabel = i.datum || (i.ts ? new Date(i.ts).toLocaleDateString('de-DE') : 'Schicht');

        totalP += p; 
        totalV += v; 
        totalCash += cash;

        let mHtml = '<ul class="archiv-details-list" style="margin:0;padding-left:14px;color:var(--text-muted);font-size:11px;list-style-type:square;">';
        const matObj = i.material || i.matDetailsObj || {};
        const matKeys = Object.keys(matObj);
        
        if (matKeys.length > 0) {
            matKeys.forEach(m => {
                const qty = Number(matObj[m]) || 0;
                if (qty > 0) {
                    const dispName = materialKatalog[m] ? materialKatalog[m].name : m;
                    mHtml += `<li>${dispName}: <b>${qty}x</b></li>`;
                    totalMatObj[dispName] = (totalMatObj[dispName] || 0) + qty;
                }
            });
        } else {
            mHtml += '<li>Kein Verbrauch</li>';
        }
        mHtml += '</ul>';

        return `<tr>
            <td style="font-weight:700;color:var(--text-main);">${tagLabel}</td>
            <td style="font-weight:700;">${p}</td>
            <td style="color:var(--warning);font-weight:700;">${v}</td>
            <td style="color:var(--success);font-weight:800;font-family:monospace;font-size:13px;">$${cash.toLocaleString('de-DE')}</td>
            <td>${mHtml}</td>
            <td style="text-align:right;">${eff.delArchiv ? `<button class="btn-delete-row" onclick="deleteArchivSchicht('${k}')" title="Schicht löschen">🗑️</button>` : '--'}</td>
        </tr>`;
    }).join('');

    if (tfoot) {
        let totalMatHtml = '<ul class="archiv-details-list" style="margin:0;padding-left:14px;color:var(--text-muted);font-size:11px;list-style-type:square;">';
        const totalKeys = Object.keys(totalMatObj);
        if (totalKeys.length > 0) {
            totalKeys.sort().forEach(m => {
                totalMatHtml += `<li>${m}: <b style="color:var(--primary);">${totalMatObj[m]}x</b></li>`;
            });
        } else {
            totalMatHtml += '<li>Kein Verbrauch</li>';
        }
        totalMatHtml += '</ul>';

        tfoot.innerHTML = `<tr style="background:rgba(56,189,248,0.08);font-weight:800;border-top:2px solid var(--primary);">
            <td><b style="color:var(--primary);">Summe (${currentWeekKey})</b></td>
            <td style="color:var(--primary);">${totalP.toLocaleString('de-DE')}</td>
            <td style="color:var(--warning);">${totalV.toLocaleString('de-DE')}</td>
            <td style="color:var(--success);font-family:monospace;">$${totalCash.toLocaleString('de-DE')}</td>
            <td>${totalMatHtml}</td>
            <td>--</td>
        </tr>`;
    }
}

function manualTriggerArchive() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung für diese Aktion!');
        return;
    }
    if (!confirm('Möchtest du das aktuelle Tagesprotokoll als Schicht in die aktuelle Kalenderwoche übernehmen und das Tagesprotokoll zurücksetzen?')) return;

    db.ref('data/protokoll').once('value', s => {
        const p = s.val() || {};
        const entries = Object.values(p);
        
        if (entries.length === 0) {
            alert('⚠️ Das Tagesprotokoll ist bereits leer.');
            return;
        }

        const todayFormatted = new Date().toLocaleDateString('de-DE');
        const archiveTimestamp = Date.now();

        let tP = entries.length;
        let tV = 0;
        let tA = 0;
        let tm = {};

        entries.forEach(x => {
            tV += Number(x.verletzungen) || 0;
            tA += Number(x.kosten) || 0;
            const mObj = x.material || {};
            Object.keys(mObj).forEach(k => {
                tm[k] = (tm[k] || 0) + (Number(mObj[k]) || 0);
            });
        });

        db.ref('data/archiv').push({
            datum: todayFormatted,
            patienten: tP,
            verletzungen: tV,
            ausgaben: tA,
            material: tm,
            ts: archiveTimestamp,
            isManualProtArchived: true
        }).then(() => {
            db.ref('data/protokoll').remove().then(() => {
                logAdminAudit('Tagesprotokoll als Schicht übernommen', `${sessionUser.vorname} ${sessionUser.nachname} hat das Tagesprotokoll in die aktuelle Woche übernommen.`);
                alert('✅ Tagesprotokoll wurde als Schicht in die aktuelle Kalenderwoche übernommen und zurückgesetzt!');
            });
        });
    });
}

function deleteArchivSchicht(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delArchiv) {
        alert('Keine Berechtigung zum Löschen von Archiven!');
        return;
    }
    if (confirm('Soll dieser archivierte Schichteintrag wirklich gelöscht werden?')) {
        db.ref('data/archiv/' + k).remove().then(() => {
            alert('✅ Schichteintrag erfolgreich gelöscht!');
        }).catch(err => {
            alert('Fehler beim Löschen: ' + err.message);
        });
    }
}

function openEditModal(key) {
    db.ref('data/protokoll/'+key).once('value', s => {
        const v = s.val(); if (!v) return;
        document.getElementById('editKey').value = key;
        document.getElementById('editName').value = v.name || '';
        document.getElementById('editSzenario').value = v.szenario || '';
        document.getElementById('editCount').value = v.verletzungen || 1;
        document.getElementById('editCash').value = v.kosten || 0;
        document.getElementById('editModal').style.display = 'flex';
    });
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function speicherePatientEdit() {
    const key = document.getElementById('editKey').value; if (!key) return;
    db.ref('data/protokoll/'+key).update({
        name: document.getElementById('editName').value.trim(),
        szenario: document.getElementById('editSzenario').value.trim(),
        verletzungen: parseInt(document.getElementById('editCount').value) || 1,
        kosten: parseInt(document.getElementById('editCash').value) || 0
    }).then(() => closeEditModal());
}
function deletePatient(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delPatient) return;
    if (confirm('Patienteneintrag wirklich löschen?')) db.ref('data/protokoll/' + k).remove();
}

function exportArchivCSV() {
    db.ref('data/archiv').once('value', s => {
        const a = s.val() || {}, e = Object.entries(a); if (!e.length) return;
        let csv = 'Datum,Patienten,Verletzungen,Ausgaben\n';
        e.forEach(([,v]) => { csv += `"${v.datum||''}","${v.patienten||0}","${v.verletzungen||0}","$${v.ausgaben||0}"\n`; });
        const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), u = URL.createObjectURL(b), el = document.createElement('a');
        el.href = u; el.download = 'MMD_Archiv.csv'; el.click();
    });
}

/* ── REITER: HIERARCHIE BOARD ──────────────────────────────── */
function renderHierarchieBoard(hData) {
    if (!hData) return;
    hierarchieDaten = Object.assign({}, hierarchieDaten, hData);
    Object.keys(hierarchieDaten).forEach(key => {
        let val = hierarchieDaten[key];
        const d = document.getElementById('disp_h_' + key);
        if (d) {
            if (key.endsWith('_sub')) {
                d.textContent = (val && val !== '--') ? val : '';
                d.style.display = (val && val !== '--') ? 'inline-block' : 'none';
            } else {
                d.textContent = (val && val !== '#REF!') ? val : 'Aktuell nicht belegt';
            }
        }
        const i = document.getElementById('inp_h_' + key);
        if (i && document.activeElement !== i) i.value = (val !== 'Aktuell nicht belegt' && val !== '#REF!') ? val : '';
    });
}

function openHierarchieInlineModal() {
    const cont = document.getElementById('hierarchieInlineEditorContainer');
    if (!cont) return;

    const fields = [
        { grp: "⭐ Chiefebene", items: [
            { k: "chief_01", label: "01 Chief of SAMD" },
            { k: "chief_02", label: "02 Ass. Chief of SAMD" },
            { k: "chief_03", label: "03 Deputy Chief of SAMD" }
        ]},
        { grp: "🏢 Abteilungsleitungen", items: [
            { k: "dept_psych_l", label: "Psychologie (Leitung)" },
            { k: "dept_psych_sl", label: "Psychologie (Stellv. Leitung)" },
            { k: "dept_perso_l", label: "Personal (Leitung)" },
            { k: "dept_perso_sl", label: "Personal (Stellv. Leitung)" },
            { k: "dept_ausb_l", label: "Ausbildung (Leitung)" },
            { k: "dept_ausb_sl", label: "Ausbildung (Stellv. Leitung)" },
            { k: "dept_luft_l", label: "Luftrettung (Leitung)" },
            { k: "dept_luft_sl", label: "Luftrettung (Stellv. Leitung)" }
        ]},
        { grp: "🎖️ High Command", items: [
            { k: "domo_04", label: "04 D.o.M.O" },
            { k: "domo_04_sub", label: "04 Zusatzinfo / Stellv." },
            { k: "fod_05", label: "05 F.o.D" },
            { k: "fod_05_sub", label: "05 Zusatzinfo / Stellv." },
            { k: "chiefphys_06", label: "06 Chief Physician" },
            { k: "chiefphys_07", label: "07 Chief Physician" },
            { k: "lt_08", label: "08 Lieutenant" },
            { k: "lt_09", label: "09 Lieutenant" }
        ]},
        { grp: "🩺 Low Command (Belegungszahlen)", items: [
            { k: "a_emt_count", label: "A-EMT (Anzahl Belegung)" },
            { k: "emt_count", label: "EMT (Anzahl Belegung)" }
        ]}
    ];

    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
            ${fields.map(g => `
                <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--primary);font-size:14px;">${g.grp}</h4>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:10px;">
                        ${g.items.map(item => `
                            <div>
                                <label for="inline_h_${item.k}" style="font-size:11px;margin-bottom:4px;">${item.label}</label>
                                <input type="text" id="inline_h_${item.k}" value="${hierarchieDaten[item.k] !== 'Aktuell nicht belegt' ? (hierarchieDaten[item.k] || '') : ''}" placeholder="Aktuell nicht belegt">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
                <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeHierarchieInlineModal()">Abbrechen</button>
                <button type="button" class="btn" style="width:auto;background:var(--success);color:#080c14;font-weight:800;" onclick="saveHierarchieInline()">💾 Hierarchie speichern</button>
            </div>
        </div>
    `;

    document.getElementById('hierarchieInlineModal').style.display = 'flex';
}

function closeHierarchieInlineModal() {
    document.getElementById('hierarchieInlineModal').style.display = 'none';
}

function saveHierarchieInline() {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).isAdmin) return;

    const allInputs = document.querySelectorAll('#hierarchieInlineEditorContainer input');
    allInputs.forEach(inp => {
        const key = inp.id.replace('inline_h_', '');
        hierarchieDaten[key] = inp.value.trim() || 'Aktuell nicht belegt';
    });

    db.ref('data/hierarchie').set(hierarchieDaten).then(() => {
        logAdminAudit('Hierarchie vor Ort aktualisiert', `${sessionUser.vorname} ${sessionUser.nachname} hat das Hierarchie-Board gespeichert.`);
        closeHierarchieInlineModal();
        alert('✅ Hierarchie erfolgreich aktualisiert!');
    });
}

/* ── REITER 3: FUNK & CODES (INLINE EDIT) ───────────────────── */
function renderGuideTab() {
    _renderGuideSection('guideTenCodesBody',    cachedGuideData.tenCodes);
    _renderGuideSection('guideStatusCodesBody', cachedGuideData.statusCodes);
    _renderGuideSection('guideStreifenBody',     cachedGuideData.streifen);
    _renderGuideKeineRechnung();
}
function _renderGuideSection(id, data) {
    const t = document.getElementById(id); if (!t) return;
    t.innerHTML = !data || !data.length ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">-</td></tr>'
        : data.map(i => `<tr><td class="text-center" style="color:${i.color||'var(--text-main)'};font-weight:800;">${i.code||''}</td><td>${i.desc||''}</td></tr>`).join('');
}
function _renderGuideKeineRechnung() {
    const t = document.getElementById('guideKeineRechnungBody'); if (!t) return;
    const data = cachedGuideData.keineRechnung || [];
    t.innerHTML = !data || !data.length ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">Keine Einträge</td></tr>'
        : data.map(i => `<tr><td colspan="2"><b>${i.name||''}</b>${i.note?` <span style="color:var(--text-muted);font-size:11px;">${i.note}</span>`:''}<br><span style="color:var(--text-muted);font-size:12px;">${i.desc||''}</span></td></tr>`).join('');
}

function openGuideInlineModal() {
    const cont = document.getElementById('guideInlineEditorContainer');
    if (!cont) return;
    
    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px;">
            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--primary);">📻 Ten Codes</h4>
                    <button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('tenCodes')">➕ Zeile hinzufügen</button>
                </div>
                <div id="inlineGuide_tenCodes"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--warning);">📟 Status Codes</h4>
                    <button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('statusCodes')">➕ Zeile hinzufügen</button>
                </div>
                <div id="inlineGuide_statusCodes"></div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">
                <button class="btn" style="width:auto;background:var(--text-muted);" onclick="closeGuideInlineModal()">Schließen</button>
                <button class="btn" style="width:auto;background:var(--success);color:#080c14;font-weight:800;" onclick="saveGuideInline()">💾 Speichern</button>
            </div>
        </div>
    `;
    renderGuideInlineRows('tenCodes');
    renderGuideInlineRows('statusCodes');
    document.getElementById('guideInlineModal').style.display = 'flex';
}
function closeGuideInlineModal() { document.getElementById('guideInlineModal').style.display = 'none'; }

function renderGuideInlineRows(section) {
    const c = document.getElementById('inlineGuide_' + section); if (!c) return;
    const list = cachedGuideData[section] || [];
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    c.innerHTML = list.map((item, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="text" id="${section}_code_${idx}" value="${item.code||''}" style="width:110px;" placeholder="Code">
            <input type="text" id="${section}_desc_${idx}" value="${item.desc||''}" style="flex:1;" placeholder="Beschreibung">
            ${eff.delGuide ? `<button class="btn-delete-row" onclick="removeGuideRow('${section}', ${idx})">🗑️</button>` : ''}
        </div>
    `).join('');
}
function addGuideRow(section) {
    if (!cachedGuideData[section]) cachedGuideData[section] = [];
    cachedGuideData[section].push({ id: 'g_' + Date.now(), code: '', desc: '', color: 'var(--text-main)' });
    renderGuideInlineRows(section);
}
function removeGuideRow(section, idx) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delGuide) return;
    cachedGuideData[section].splice(idx, 1);
    renderGuideInlineRows(section);
}
function saveGuideInline() {
    ['tenCodes', 'statusCodes'].forEach(sec => {
        (cachedGuideData[sec] || []).forEach((item, idx) => {
            const cInp = document.getElementById(`${sec}_code_${idx}`);
            const dInp = document.getElementById(`${sec}_desc_${idx}`);
            if (cInp) item.code = cInp.value.trim();
            if (dInp) item.desc = dInp.value.trim();
        });
    });
    db.ref('data/guide').set(cachedGuideData).then(() => {
        renderGuideTab();
        closeGuideInlineModal();
        logAdminAudit('Funk & Codes aktualisiert', `${sessionUser.vorname} ${sessionUser.nachname} hat Codes vor Ort geändert.`);
        alert('✅ Funk & Codes gespeichert!');
    });
}

/* ── REITER: COMMANDS (INLINE EDIT & KEINE ZÄHLER) ────────── */
function renderCommandsTab(obj) {
    const cont = document.getElementById('commandsAccordionContainer'); if (!cont) return;
    const all = Object.assign({}, defaultCommands, obj || {});
    let kats = [...new Set(Object.values(all).map(c => c.kat || 'Allgemein'))].sort();
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    if (!eff.isMasterAdmin && eff.allowedCmdKats && eff.allowedCmdKats.length > 0) {
        kats = kats.filter(k => eff.allowedCmdKats.includes(k));
    }

    if (!kats.length) { cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Keine Commands für deinen Dienstgrad freigegeben.</p>'; return; }

    cont.innerHTML = kats.map(kat => {
        const cmds = Object.entries(all).filter(([,c]) => (c.kat || 'Allgemein') === kat);
        const rows = cmds.map(([k,c]) => `<tr>
            <td style="width:30%;padding:10px 14px;"><span class="cmd-badge">${c.name||''}</span></td>
            <td style="width:60%;padding:10px 14px;color:var(--text-main);font-size:13px;">${c.desc||c.description||''}</td>
            <td style="width:10%;padding:10px 14px;text-align:right;">${eff.delCommands ? `<button class="btn-delete-row" onclick="deleteDienstCommand('${k}')">🗑️</button>` : ''}</td>
        </tr>`).join('');
        const gId = 'cmd_' + kat.replace(/\W/g, '_');
        return `<div class="theme-accordion-group" id="${gId}" style="margin-bottom:12px;">
            <div class="theme-accordion-header" onclick="toggleGroupCollapse('${gId}')">
                <span>⚡ ${kat}</span>
            </div>
            <div class="theme-accordion-content"><table style="width:100%;"><tbody>${rows||'<tr><td colspan="3">Keine Commands</td></tr>'}</tbody></table></div>
        </div>`;
    }).join('');
}

function openCommandsInlineModal() {
    const cont = document.getElementById('commandsInlineEditorContainer');
    if (!cont) return;

    db.ref('data/dienstCommands').once('value', snap => {
        const cloudData = snap.val() || {};
        const allCmds = Object.assign({}, defaultCommands, cloudData);
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

        let existingRowsHtml = Object.entries(allCmds).map(([k, c]) => `
            <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;padding:10px;display:grid;grid-template-columns:1.5fr 2.5fr 1.5fr auto;gap:8px;align-items:center;margin-bottom:8px;">
                <input type="text" id="cmd_name_${k}" value="${c.name || ''}" placeholder="Name">
                <input type="text" id="cmd_desc_${k}" value="${c.desc || c.description || ''}" placeholder="Beschreibung">
                <input type="text" id="cmd_kat_${k}" value="${c.kat || 'Allgemein'}" placeholder="Kategorie">
                <div style="display:flex;gap:6px;">
                    <button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="editCommandInline('${k}')">💾</button>
                    ${eff.delCommands ? `<button type="button" class="btn-delete-row" onclick="deleteDienstCommand('${k}')">🗑️</button>` : ''}
                </div>
            </div>
        `).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
                <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--success);">➕ Neuen Command anlegen</h4>
                    <div style="display:grid;grid-template-columns:1.5fr 2.5fr 1.5fr auto;gap:8px;">
                        <input type="text" id="inlineNewCmdName" placeholder="Name (z.B. !funk)">
                        <input type="text" id="inlineNewCmdDesc" placeholder="Beschreibung">
                        <input type="text" id="inlineNewCmdKat" placeholder="Kategorie">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:8px 16px;" onclick="addCommandInline()">Hinzufügen</button>
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">📋 Bestehende Commands bearbeiten</h4>
                    <div style="max-height:55vh;overflow-y:auto;padding-right:4px;">
                        ${existingRowsHtml || '<p style="color:var(--text-muted);">Keine Einträge vorhanden.</p>'}
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeCommandsInlineModal()">Schließen</button>
                </div>
            </div>
        `;
        document.getElementById('commandsInlineModal').style.display = 'flex';
    });
}
function closeCommandsInlineModal() { document.getElementById('commandsInlineModal').style.display = 'none'; }

function addCommandInline() {
    const name = document.getElementById('inlineNewCmdName')?.value.trim();
    const desc = document.getElementById('inlineNewCmdDesc')?.value.trim();
    const kat = document.getElementById('inlineNewCmdKat')?.value.trim() || 'Allgemein';
    if (!name || !desc) { alert('Bitte Name und Beschreibung angeben!'); return; }
    db.ref('data/dienstCommands').push({ name, desc, kat }).then(() => {
        alert('✅ Command angelegt!');
        closeCommandsInlineModal();
        refreshOpenRoleCategoryCheckboxes();
    });
}

function editCommandInline(k) {
    const name = document.getElementById('cmd_name_' + k)?.value.trim();
    const desc = document.getElementById('cmd_desc_' + k)?.value.trim();
    const kat = document.getElementById('cmd_kat_' + k)?.value.trim() || 'Allgemein';

    if (!name || !desc) { alert('Name und Beschreibung dürfen nicht leer sein!'); return; }

    db.ref('data/dienstCommands/' + k).set({ name, desc, kat }).then(() => {
        logAdminAudit('Command bearbeitet', `${sessionUser.vorname} ${sessionUser.nachname} hat Command "${name}" geändert.`);
        alert('✅ Command erfolgreich gespeichert!');
    });
}

function deleteDienstCommand(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delCommands) return;
    if (confirm('Command löschen?')) db.ref('data/dienstCommands/' + k).remove();
}

/* ── REITER 4: LINKS & DOKUMENTE (INLINE EDIT & KEINE ZÄHLER) */
function renderLinksTab(obj) {
    const cont = document.getElementById('linksAccordionContainer'); if (!cont) return;
    const allLinks = Object.assign({}, defaultLinks, obj || {});
    let kats = [...new Set(Object.values(allLinks).map(l => l.kat || l.thema || 'Allgemein'))].sort();
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    if (!eff.isMasterAdmin && eff.allowedLinkKats && eff.allowedLinkKats.length > 0) {
        kats = kats.filter(k => eff.allowedLinkKats.includes(k));
    }

    if (!kats.length) { cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Keine Links für deinen Dienstgrad freigegeben.</p>'; return; }

    cont.innerHTML = kats.map(kat => {
        const lnks = Object.entries(allLinks).filter(([, l]) => (l.kat || l.thema || 'Allgemein') === kat);
        const rows = lnks.map(([k, l]) => `<tr>
            <td style="width:35%;padding:10px 14px;word-break:break-word;"><a class="link-btn-clickable" href="${l.url||'#'}" target="_blank" rel="noopener">🔗 ${l.name||l.url}</a></td>
            <td style="width:55%;padding:10px 14px;color:var(--text-main);font-size:13px;line-height:1.5;">${l.desc||l.description||'Keine Beschreibung'}</td>
            <td style="width:10%;padding:10px 14px;text-align:right;">${eff.delLinks ? `<button class="btn-delete-row" onclick="deleteDienstLink('${k}')">🗑️</button>` : ''}</td>
        </tr>`).join('');
        const gId = 'lnk_' + kat.replace(/\W/g, '_');
        return `<div class="theme-accordion-group" id="${gId}" style="margin-bottom:12px;">
            <div class="theme-accordion-header" onclick="toggleGroupCollapse('${gId}')">
                <span>📁 ${kat}</span>
            </div>
            <div class="theme-accordion-content"><table style="width:100%;"><tbody>${rows||'<tr><td colspan="3">Keine Links</td></tr>'}</tbody></table></div>
        </div>`;
    }).join('');
}

function openLinksInlineModal() {
    const cont = document.getElementById('linksInlineEditorContainer');
    if (!cont) return;

    db.ref('data/dienstLinks').once('value', snap => {
        const cloudData = snap.val() || {};
        const allLinks = Object.assign({}, defaultLinks, cloudData);
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

        let existingRowsHtml = Object.entries(allLinks).map(([k, l]) => `
            <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <input type="text" id="link_name_${k}" value="${l.name || ''}" placeholder="Titel">
                    <input type="text" id="link_url_${k}" value="${l.url || ''}" placeholder="https://...">
                </div>
                <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;align-items:center;">
                    <input type="text" id="link_desc_${k}" value="${l.desc || l.description || ''}" placeholder="Beschreibung">
                    <input type="text" id="link_kat_${k}" value="${l.kat || l.thema || 'Allgemein'}" placeholder="Kategorie">
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="editLinkInline('${k}')">💾</button>
                        ${eff.delLinks ? `<button type="button" class="btn-delete-row" onclick="deleteDienstLink('${k}')">🗑️</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
                <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">➕ Neuen Dokumenten-Link anlegen</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                        <input type="text" id="inlineNewLinkName" placeholder="Titel des Links">
                        <input type="text" id="inlineNewLinkUrl" placeholder="https://docs.google.com/...">
                    </div>
                    <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;">
                        <input type="text" id="inlineNewLinkDesc" placeholder="Beschreibung">
                        <input type="text" id="inlineNewLinkKat" placeholder="Kategorie (z.B. MD Intern)">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:8px 16px;" onclick="addLinkInline()">Hinzufügen</button>
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">📁 Bestehende Links bearbeiten</h4>
                    <div style="max-height:55vh;overflow-y:auto;padding-right:4px;">
                        ${existingRowsHtml || '<p style="color:var(--text-muted);">Keine Links vorhanden.</p>'}
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeLinksInlineModal()">Schließen</button>
                </div>
            </div>
        `;
        document.getElementById('linksInlineModal').style.display = 'flex';
    });
}
function closeLinksInlineModal() { document.getElementById('linksInlineModal').style.display = 'none'; }

function addLinkInline() {
    const name = document.getElementById('inlineNewLinkName')?.value.trim();
    const url = document.getElementById('inlineNewLinkUrl')?.value.trim();
    const desc = document.getElementById('inlineNewLinkDesc')?.value.trim();
    const kat = document.getElementById('inlineNewLinkKat')?.value.trim() || 'Allgemein';
    if (!name || !url) { alert('Bitte Name und URL angeben!'); return; }
    db.ref('data/dienstLinks').push({ name, url, desc, kat }).then(() => {
        alert('✅ Link gespeichert!');
        closeLinksInlineModal();
        refreshOpenRoleCategoryCheckboxes();
    });
}

function editLinkInline(k) {
    const name = document.getElementById('link_name_' + k)?.value.trim();
    const url = document.getElementById('link_url_' + k)?.value.trim();
    const desc = document.getElementById('link_desc_' + k)?.value.trim();
    const kat = document.getElementById('link_kat_' + k)?.value.trim() || 'Allgemein';

    if (!name || !url) { alert('Name und URL dürfen nicht leer sein!'); return; }

    db.ref('data/dienstLinks/' + k).set({ name, url, desc, kat }).then(() => {
        logAdminAudit('Link bearbeitet', `${sessionUser.vorname} ${sessionUser.nachname} hat Link "${name}" geändert.`);
        alert('✅ Link erfolgreich gespeichert!');
    });
}

function deleteDienstLink(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delLinks) return;
    if (confirm('Link löschen?')) db.ref('data/dienstLinks/' + k).remove();
}

/* ── REITER: NEWS / SCHWARZES BRETT ────────────────────────── */
function renderNewsFeedData(obj) {
    const c = document.getElementById('newsFeedList'); if (!c) return;
    const pendingCont = document.getElementById('pendingNewsApprovalContainer');
    const unreadBadge = document.getElementById('newsUnreadBadge');

    const allNews = Object.entries(obj || {}).filter(([, n]) => !n.deleted);
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myKey = sessionUser ? (sessionUser.dn ? ('dn_' + sessionUser.dn) : (sessionUser.vorname + '_' + sessionUser.nachname).replace(/\W/g, '_')) : '';

    const approvedNews = allNews.filter(([, n]) => n.status !== 'pending_approval');
    let unreadCount = 0;
    approvedNews.forEach(([, n]) => {
        const readBy = n.readBy || {};
        if (!readBy[myKey]) unreadCount++;
    });

    if (unreadBadge) {
        if (unreadCount > 0) {
            unreadBadge.textContent = unreadCount;
            unreadBadge.style.display = 'inline-flex';
        } else {
            unreadBadge.style.display = 'none';
        }
    }

    if (pendingCont) {
        if (eff.canApproveNews) {
            const pendingList = allNews.filter(([, n]) => n.status === 'pending_approval');
            if (pendingList.length > 0) {
                pendingCont.style.display = 'block';
                pendingCont.innerHTML = `
                    <div style="background:rgba(245,158,11,0.08);border:1px solid var(--warning);border-radius:14px;padding:16px;">
                        <h4 style="margin:0 0 10px 0;color:var(--warning);">⏳ Ausstehende News-Vorschläge von Mitarbeitern (${pendingList.length})</h4>
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${pendingList.map(([k, n]) => `
                                <div style="background:rgba(15,23,42,0.8);padding:12px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                                    <div>
                                        <b>${n.title}</b> <span style="font-size:11px;color:var(--text-muted);">von ${n.author}</span>
                                        <p style="margin:4px 0 0 0;font-size:12px;color:var(--text-main);">${n.content}</p>
                                    </div>
                                    <div style="display:flex;gap:6px;">
                                        <button class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:11px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveNewsProposal('${k}')">✅ Freigeben</button>
                                        <button class="btn-delete-row" onclick="deleteNews('${k}')">🗑️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                pendingCont.style.display = 'none';
            }
        } else {
            pendingCont.style.display = 'none';
        }
    }

    const published = approvedNews.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    if (!published.length) {
        c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">📭 Keine aktuellen Mitteilungen.</div>';
        return;
    }

    c.innerHTML = published.map(([k, n]) => {
        const readBy = n.readBy || {};
        const hasRead = myKey && readBy[myKey];
        const readCount = Object.keys(readBy).length;

        return `
            <div style="background:rgba(15,23,42,0.7);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px;">
                <div style="padding:16px 20px;background:rgba(30,41,59,0.6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div>
                        <span style="font-weight:800;font-size:16px;color:var(--primary);">${n.title}</span>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">👤 <b>${n.author||'Klinikleitung'}</b> • 🏷️ ${n.category||'Allgemein'}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        ${hasRead ? '<span style="color:var(--success);font-weight:800;font-size:11px;">✅ Gelesen</span>' : `<button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:11px;" onclick="markNewsAsRead('${k}')">👁️ Als gelesen markieren</button>`}
                        ${eff.canViewNewsRead ? `<button class="btn" style="width:auto;margin:0;padding:5px 10px;font-size:11px;background:rgba(56,189,248,0.15);color:var(--primary);border:1px solid var(--primary);" onclick="openNewsReadersModal('${k}')">👥 Gelesen (${readCount})</button>` : ''}
                        ${eff.delNews ? `<button class="btn-delete-row" onclick="deleteNews('${k}')">🗑️</button>` : ''}
                    </div>
                </div>
                <div style="padding:20px;white-space:pre-wrap;font-size:13px;line-height:1.6;">${n.content}</div>
            </div>
        `;
    }).join('');
}

function markNewsAsRead(newsId) {
    if (!sessionUser) return;
    const myKey = sessionUser.dn ? ('dn_' + sessionUser.dn) : (sessionUser.vorname + '_' + sessionUser.nachname).replace(/\W/g, '_');
    db.ref('data/news/' + newsId + '/readBy/' + myKey).set({
        name: sessionUser.vorname + ' ' + sessionUser.nachname,
        dn: sessionUser.dn || '--',
        ts: Date.now()
    });
}

function openNewsReadersModal(newsId) {
    const n = cachedNews[newsId]; if (!n) return;
    const cont = document.getElementById('newsReadersListContainer');
    const modal = document.getElementById('newsReadersModal');
    if (!cont || !modal) return;
    const list = Object.values(n.readBy || {});
    cont.innerHTML = !list.length ? '<p style="color:var(--text-muted);text-align:center;">Noch von niemandem gelesen.</p>'
        : `<ul style="list-style:none;padding:0;margin:0;">` +
          list.map(r => `<li style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;"><b>${r.name}</b> <span style="color:var(--primary);">${r.dn}</span></li>`).join('') +
          `</ul>`;
    modal.style.display = 'flex';
}
function closeNewsReadersModal() { document.getElementById('newsReadersModal').style.display = 'none'; }

function togglePostNewsForm() {
    const e = document.getElementById('postNewsContainer');
    if (e) e.style.display = e.style.display === 'none' ? 'block' : 'none';
}
function toggleProposeNewsForm() {
    const e = document.getElementById('proposeNewsContainer');
    if (e) e.style.display = e.style.display === 'none' ? 'block' : 'none';
}

function speichereNeueNews() {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).canPostNews) return;
    const t = document.getElementById('newNewsTitle')?.value.trim();
    const c = document.getElementById('newNewsContent')?.value.trim();
    const cat = document.getElementById('newNewsCategory')?.value || 'Allgemein';
    if (!t || !c) { alert('Bitte Titel und Inhalt eingeben!'); return; }
    db.ref('data/news').push({
        title: t, content: c, category: cat, status: 'published',
        author: sessionUser.vorname + ' ' + sessionUser.nachname, ts: Date.now()
    }).then(() => {
        document.getElementById('newNewsTitle').value = '';
        document.getElementById('newNewsContent').value = '';
        togglePostNewsForm();
        logAdminAudit('News veröffentlicht', `${sessionUser.vorname} ${sessionUser.nachname}: ${t}`);
    });
}

function submitNewsProposal() {
    if (!sessionUser) return;
    const t = document.getElementById('propNewsTitle')?.value.trim();
    const c = document.getElementById('propNewsContent')?.value.trim();
    if (!t || !c) { alert('Bitte Titel und Inhalt angeben!'); return; }
    db.ref('data/news').push({
        title: t, content: c, category: 'Vorschlag', status: 'pending_approval',
        author: sessionUser.vorname + ' ' + sessionUser.nachname, ts: Date.now()
    }).then(() => {
        document.getElementById('propNewsTitle').value = '';
        document.getElementById('propNewsContent').value = '';
        toggleProposeNewsForm();
        alert('✅ Dein Vorschlag wurde eingereicht und wird von der Leitung geprüft!');
    });
}

function approveNewsProposal(newsId) {
    db.ref('data/news/' + newsId).update({ status: 'published', ts: Date.now() }).then(() => {
        logAdminAudit('News-Vorschlag genehmigt', `ID ${newsId} freigegeben von ${sessionUser.vorname} ${sessionUser.nachname}`);
    });
}

function deleteNews(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delNews) return;
    if (confirm('Möchtest du diesen News-Beitrag wirklich löschen?')) {
        db.ref('data/news/' + k).remove().then(() => {
            logAdminAudit('News gelöscht', `ID ${k} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

/* ── REITER 5: EINSTELLUNGEN / DIENSTTAGE ───────────────────── */
function passwortAendern() {
    if (!sessionUser) return;
    const np = document.getElementById('newPasswordInput')?.value.trim(); if (!np) return;
    const uId = (sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'');
    db.ref('data/users/'+uId+'/pass').set(np).then(() => {
        sessionUser.pass = np;
        alert('✅ Passwort erfolgreich geändert!');
    });
}

function berechneDienstTage() {
    if (!sessionUser) return;
    const f = document.getElementById('einstellungsDatum'); if (!f || !f.value) return;
    localStorage.setItem('mmd_einstellungsdatum_' + sessionUser.vorname + '_' + sessionUser.nachname, f.value);
    const ed = new Date(f.value); ed.setHours(0,0,0,0);
    const h = new Date(); h.setHours(0,0,0,0);
    const t = Math.max(0, Math.floor((h - ed)/(1000*60*60*24)) + 1);
    const e = document.getElementById('val_dienstTage'); if (e) e.textContent = t;
}

function handleDienstEndeLogout() {
    if (mySessionRef) mySessionRef.remove();
    sessionStorage.clear(); localStorage.clear(); location.reload();
}

/* ══════════════════════════════════════════════════════════════
   AUSBILDUNGS- & PRÜFUNGSBEREICH (HERZSTÜCK)
══════════════════════════════════════════════════════════════ */
const STRICT_EXAM_ORDER = ['exam_ga1', 'exam_ga2', 'exam_dv', 'exam_para1', 'exam_para2', 'exam_arzt1', 'exam_arzt2'];

function sortExamIds(ids) {
    return ids.sort((a, b) => {
        let ia = STRICT_EXAM_ORDER.indexOf(a);
        let ib = STRICT_EXAM_ORDER.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });
}

function renderExamTab() {
    const iv = document.getElementById('examInstructorView');
    if (iv) {
        if (isUserInstructor()) {
            iv.style.display = 'block';
            renderInstructorUnlocks();
            renderInstructorSubmissions(cachedSubmissions);
            renderInstructorExistingExams();
            renderInstructorAllowedExams();
        } else {
            iv.style.display = 'none';
        }
    }
    renderStudentUnlockedExams();
}

function renderStudentUnlockedExams() {
    const c = document.getElementById('studentUnlockedExamsContainer'); if (!c) return;
    const validIds = sortExamIds(Object.keys(cachedExams));
    if (!validIds.length) {
        c.innerHTML = '<div style="color:var(--text-muted);padding:14px;text-align:center;">Keine Prüfungen vorhanden.</div>';
        return;
    }

    const uId = sessionUser ? (sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'') : '';
    const user = cachedUsers[uId] || sessionUser || {};
    const unlocked = user.unlockedExams || {};
    const passed = user.passedExams || {};

    c.innerHTML = validIds.map(eid => {
        const ex = cachedExams[eid]; if (!ex) return '';
        const isPassed = !!passed[eid];
        const isU = !!unlocked[eid];

        let badge = '', btnHtml = '';
        if (isPassed) {
            badge = '<span style="color:var(--success);font-weight:800;font-size:11px;">✅ Bestanden</span>';
            btnHtml = '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Erfolgreich abgeschlossen.</div>';
        } else if (isU) {
            badge = '<span style="color:var(--primary);font-weight:800;font-size:11px;">⚡ Freigeschaltet</span>';
            btnHtml = `<button class="btn" style="margin-top:8px;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="startExam('${eid}')">📝 Prüfung starten</button>`;
        } else {
            badge = '<span style="color:var(--danger);font-weight:800;font-size:11px;">🔒 Gesperrt</span>';
            btnHtml = '<div style="font-size:11px;color:var(--danger);margin-top:6px;">Nicht freigeschaltet oder durchgefallen.</div>';
        }

        return `
            <div class="exam-card-compact ${isPassed ? 'completed' : (isU ? 'unlocked' : 'locked')}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:10px;color:var(--primary);text-transform:uppercase;font-weight:800;">${ex.kat||'Allgemein'}</span>
                    ${badge}
                </div>
                <h4 style="margin:4px 0;font-size:13px;color:var(--text-main);">${ex.title}</h4>
                <div style="font-size:11px;color:var(--text-muted);">⏱️ ${ex.timeLimitMinutes||30} Min • ❓ ${ex.questions?ex.questions.length:0} Fragen</div>
                ${btnHtml}
            </div>
        `;
    }).join('');
}

function renderInstructorUnlocks() {
    const tbody = document.getElementById('instructorUserUnlocksTableBody'); if (!tbody) return;
    tbody.innerHTML = '';
    const sortedExamIds = sortExamIds(Object.keys(cachedExams));

    const myId = sessionUser ? (sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'') : '';
    const myPassed = (cachedUsers[myId]?.passedExams) || {};
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const isLeitung = eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin;

    const userList = Object.entries(cachedUsers).sort((a, b) => (a[1].nachname || '').localeCompare(b[1].nachname || ''));

    userList.forEach(([uId, u]) => {
        const unlocked = u.unlockedExams || {};
        const passedMap = u.passedExams || {};

        const examGridHtml = `
            <div class="exam-unlock-grid">
                ${sortedExamIds.map(eId => {
                    const ex = cachedExams[eId]; if (!ex) return '';
                    const canUnlockThis = isLeitung || !!myPassed[eId];
                    const disabledAttr = canUnlockThis ? '' : 'disabled title="Nur freischaltbar, wenn selbst bestanden!"';

                    return `
                        <div class="exam-unlock-box ${unlocked[eId] ? 'active' : ''}">
                            <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ex.title}</div>
                            <div style="display:flex;gap:8px;align-items:center;margin-top:2px;">
                                <label style="font-size:10px;color:var(--primary);cursor:pointer;">
                                    <input type="checkbox" ${unlocked[eId]?'checked':''} ${disabledAttr} onchange="toggleExamUnlockForUser('${uId}','${eId}',this.checked)"> Freigabe
                                </label>
                                <label style="font-size:10px;color:var(--success);cursor:pointer;">
                                    <input type="checkbox" ${passedMap[eId]?'checked':''} ${disabledAttr} onchange="toggleExamPassedForUser('${uId}','${eId}',this.checked)"> Bestanden
                                </label>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        tbody.innerHTML += `
            <tr class="user-unlock-row" data-name="${(u.vorname+' '+u.nachname+' '+u.dn).toLowerCase()}">
                <td style="width:200px;vertical-align:top;padding:10px;">
                    <b>${u.vorname||''} ${u.nachname||''}</b><br>
                    <span style="color:var(--primary);font-size:11px;">DN: ${u.dn||'--'}</span>
                </td>
                <td style="width:90px;vertical-align:top;padding:10px;color:var(--text-muted);font-size:11px;">${u.date||'--'}</td>
                <td style="vertical-align:top;padding:10px;">${examGridHtml}</td>
            </tr>
        `;
    });
}

function filterUnlocksTable() {
    const q = (document.getElementById('searchUnlocksUser')?.value||'').toLowerCase();
    document.querySelectorAll('.user-unlock-row').forEach(row => {
        row.style.display = row.getAttribute('data-name').includes(q) ? '' : 'none';
    });
}

function toggleExamUnlockForUser(uId, examId, isUnlocked) {
    db.ref(`data/users/${uId}/unlockedExams/${examId}`).set(isUnlocked);
}
function toggleExamPassedForUser(uId, examId, isPassed) {
    db.ref(`data/users/${uId}/passedExams/${examId}`).set(isPassed);
}

function renderInstructorSubmissions(subs) {
    const t = document.getElementById('instructorSubmissionsTableBody'); if (!t) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myId = sessionUser ? (sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'') : '';

    let ee = Object.entries(subs || {}).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));

    if (!isUserInstructor()) {
        ee = ee.filter(([, sub]) => sub.userId === myId);
    }

    t.innerHTML = !ee.length ? '<tr><td colspan="8" style="text-align:center;padding:24px;">Keine Prüfungsergebnisse vorhanden.</td></tr>'
        : ee.map(([subId, sub]) => `
            <tr>
                <td style="font-size:11px;color:var(--text-muted);">${sub.datum||'--'}</td>
                <td><b>${sub.userName||'--'}</b> <span style="color:var(--primary);font-size:11px;">(${sub.userDN||'--'})</span></td>
                <td style="font-weight:700;color:var(--primary);">${sub.examTitle||'--'}</td>
                <td style="font-family:monospace;color:var(--warning);">${sub.durationFormatted||'--'}</td>
                <td><b>${sub.percentage||0}%</b></td>
                <td><span style="color:${sub.passed?'var(--success)':'var(--danger)'};font-weight:800;">${sub.passed?'✅ Bestanden':'⛔ Nicht bestanden'}</span></td>
                <td>
                    ${isUserInstructor() ? `<button class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:11px;" onclick="openExamSubmissionDetailsModal('${subId}')">👁️ Details</button>` : '--'}
                </td>
                <td>${eff.delExams ? `<button class="btn-delete-row" onclick="deleteExamSubmission('${subId}')">🗑️</button>` : '--'}</td>
            </tr>
        `).join('');
}

function openExamSubmissionDetailsModal(subId) {
    const sub = cachedSubmissions[subId]; 
    if (!sub) return;
    
    const cont = document.getElementById('examSubDetailsContent');
    const modal = document.getElementById('examSubmissionDetailsModal');
    if (!cont || !modal) return;

    let answersList = [];
    if (Array.isArray(sub.answers)) {
        answersList = sub.answers;
    } else if (sub.answers && typeof sub.answers === 'object') {
        answersList = Object.values(sub.answers);
    }

    let answersHtml = '';
    if (answersList.length === 0) {
        answersHtml = `
            <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:8px;color:var(--text-muted);text-align:center;">
                ℹ️ Für diesen älteren Eintrag wurden noch keine detaillierten Frage-Antwort-Protokolle gespeichert.
            </div>
        `;
    } else {
        answersHtml = answersList.map((ans, idx) => {
            const isCorrect = !!ans.isCorrect;
            const qText = ans.questionText || `Frage ${idx + 1}`;
            const chosen = ans.chosenAnswerText || 'Keine Antwort ausgewählt';
            
            return `
                <div style="background:rgba(15,23,42,0.7);padding:12px;border-radius:8px;border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
                    <div style="font-weight:700;font-size:13px;color:var(--text-main);">Frage ${idx + 1}: ${qText}</div>
                    <div style="font-size:12px;margin-top:4px;color:${isCorrect ? 'var(--success)' : 'var(--danger)'};font-weight:700;">
                        Ausgewählt: <span style="color:var(--text-main);font-weight:normal;">${chosen}</span> ${isCorrect ? '✅ (Richtig)' : '❌ (Falsch)'}
                    </div>
                </div>
            `;
        }).join('');
    }

    cont.innerHTML = `
        <div style="background:rgba(30,41,59,0.5);padding:14px;border-radius:10px;margin-bottom:14px;border:1px solid var(--border);">
            <p style="margin:0;"><b>Prüfling:</b> ${sub.userName || '--'} <span style="color:var(--primary);font-weight:700;">(DN: ${sub.userDN || '--'})</span></p>
            <p style="margin:6px 0 0 0;">
                <b>Prüfung:</b> ${sub.examTitle || '--'} • 
                <b>Ergebnis:</b> <b style="color:${sub.passed ? 'var(--success)' : 'var(--danger)'};">${sub.percentage || 0}%</b> 
                (${sub.passed ? '✅ Bestanden' : '⛔ Nicht bestanden'}) • 
                <b>Dauer:</b> ${sub.durationFormatted || '--'}
            </p>
        </div>
        <h4 style="margin:0 0 10px 0;color:var(--primary);">Antwort-Korrekturbogen:</h4>
        <div style="display:flex;flex-direction:column;gap:8px;">
            ${answersHtml}
        </div>
    `;

    modal.style.display = 'flex';
}
function closeExamSubmissionDetailsModal() { document.getElementById('examSubmissionDetailsModal').style.display = 'none'; }

function deleteExamSubmission(subId) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delExams) return;
    if (confirm('Ergebnis löschen?')) db.ref('data/examSubmissions/' + subId).remove();
}

function renderInstructorExistingExams() {
    const c = document.getElementById('instructorExistingExamsList'); if (!c) return;
    const validIds = sortExamIds(Object.keys(cachedExams));
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    c.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;">
            ${validIds.map(k => {
                const e = cachedExams[k]; if (!e) return '';
                return `
                    <div style="background:rgba(15,23,42,0.8);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                        <div>
                            <span style="font-size:10px;color:var(--primary);font-weight:800;text-transform:uppercase;">${e.kat||'Allgemein'}</span>
                            <h5 style="margin:4px 0 6px 0;font-size:14px;color:var(--text-main);">${e.title}</h5>
                            <div style="font-size:11px;color:var(--text-muted);">⏱️ ${e.timeLimitMinutes||30} Min • ❓ ${e.questions?e.questions.length:0} Fragen • 🎯 ${e.passPercentage||60}%</div>
                        </div>
                        <div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">
                            ${eff.canManageExams ? `<button class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:11px;" onclick="editExam('${k}')">✏️ Bearbeiten</button>` : ''}
                            ${eff.delExams ? `<button class="btn-delete-row" onclick="deleteExam('${k}')" title="Prüfung löschen">🗑️</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function openExamBuilderModal() {
    resetExamBuilderForm();
    document.getElementById('examBuilderModalHeading').textContent = '📝 Neue Prüfung erstellen';
    document.getElementById('examBuilderModal').style.display = 'flex';
}
function closeExamBuilderModal() { document.getElementById('examBuilderModal').style.display = 'none'; }

function resetExamBuilderForm() {
    _examBuilderQuestions = [];
    document.getElementById('editingExamId').value = '';
    document.getElementById('newExamTitle').value = '';
    document.getElementById('newExamKat').value = '';
    document.getElementById('newExamIntroText').value = '';
    document.getElementById('newExamTime').value = '30';
    document.getElementById('newExamPassRate').value = '60';
    refreshExamQuestionsDisplay();
}

function addExamQuestionRow() {
    _examBuilderQuestions.push({
        id: _examBuilderQuestions.length + 1,
        text: '',
        options: ['', '', '', ''],
        correctAnswers: [0]
    });
    refreshExamQuestionsDisplay();
}

function refreshExamQuestionsDisplay() {
    const c = document.getElementById('examQuestionsListBuilder'); if (!c) return;
    document.getElementById('examQuestionsCountDisplay').textContent = _examBuilderQuestions.length;

    c.innerHTML = _examBuilderQuestions.map((q, idx) => `
        <div style="background:rgba(15,23,42,0.6);border:1px solid var(--border);border-radius:10px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <b>Frage ${idx+1}</b>
                <button class="btn-delete-row" onclick="_examBuilderQuestions.splice(${idx},1);refreshExamQuestionsDisplay();">🗑️</button>
            </div>
            <input type="text" value="${q.text||''}" oninput="_examBuilderQuestions[${idx}].text=this.value" placeholder="Fragetext..." style="margin-bottom:8px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                ${(q.options||[]).map((opt, oIdx) => `
                    <div style="display:flex;align-items:center;gap:6px;">
                        <input type="radio" name="correct_${idx}" ${q.correctAnswers?.includes(oIdx)?'checked':''} onchange="_examBuilderQuestions[${idx}].correctAnswers=[${oIdx}]">
                        <input type="text" value="${opt||''}" oninput="_examBuilderQuestions[${idx}].options[${oIdx}]=this.value" placeholder="Antwort ${oIdx+1}">
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function neuePruefungSpeichern() {
    const title = document.getElementById('newExamTitle')?.value.trim();
    if (!title) { alert('Bitte Titel angeben!'); return; }
    const kat = document.getElementById('newExamKat')?.value.trim() || 'Allgemein';
    const timeLimit = parseInt(document.getElementById('newExamTime')?.value) || 30;
    const passRate = parseInt(document.getElementById('newExamPassRate')?.value) || 60;
    const intro = document.getElementById('newExamIntroText')?.value.trim() || '';
    const examId = document.getElementById('editingExamId')?.value || ('exam_' + Date.now());

    const data = {
        id: examId, title, kat, timeLimitMinutes: timeLimit, passPercentage: passRate,
        introText: intro, questions: _examBuilderQuestions, ts: Date.now()
    };

    db.ref('data/exams/' + examId).set(data).then(() => {
        closeExamBuilderModal();
        alert('✅ Prüfung in Cloud gespeichert!');
    });
}

function editExam(eid) {
    const ex = cachedExams[eid]; if (!ex) return;
    document.getElementById('editingExamId').value = eid;
    document.getElementById('newExamTitle').value = ex.title || '';
    document.getElementById('newExamKat').value = ex.kat || '';
    document.getElementById('newExamTime').value = ex.timeLimitMinutes || 30;
    document.getElementById('newExamPassRate').value = ex.passPercentage || 60;
    document.getElementById('newExamIntroText').value = ex.introText || '';
    _examBuilderQuestions = JSON.parse(JSON.stringify(ex.questions || []));
    refreshExamQuestionsDisplay();
    document.getElementById('examBuilderModalHeading').textContent = '✏️ Prüfung bearbeiten';
    document.getElementById('examBuilderModal').style.display = 'flex';
}

function deleteExam(eid) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delExams) return;
    if (confirm('Soll diese Prüfung wirklich dauerhaft gelöscht werden?')) {
        db.ref('data/exams/' + eid).set({ deleted: true }).then(() => {
            delete cachedExams[eid];
            renderInstructorExistingExams();
            renderStudentUnlockedExams();
            logAdminAudit('Prüfung gelöscht', `ID ${eid} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

function renderInstructorAllowedExams() {
    const mt = document.getElementById('instructorMembersApprovalTableBody'); if (!mt) return;
    const userList = Object.entries(cachedUsers).sort((a, b) => (a[1].nachname || '').localeCompare(b[1].nachname || ''));

    mt.innerHTML = userList.map(([uId, u]) => `
        <tr>
            <td style="padding:10px;"><b>${u.vorname||''} ${u.nachname||''}</b></td>
            <td style="padding:10px;color:var(--primary);font-weight:700;">DN: ${u.dn||'--'}</td>
            <td style="padding:10px;">${renderUserRoleBadges(u)}</td>
            <td style="padding:10px;"><span style="color:${u.status==='approved'?'var(--success)':'var(--danger)'};font-weight:700;">${u.status==='approved'?'✅ Aktiv':'⛔ Gesperrt'}</span></td>
            <td style="text-align:right;padding:10px;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    ${u.status !== 'approved'
                        ? `<button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:11px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveUser('${uId}')">✅ Freischalten</button>`
                        : `<button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:11px;background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);" onclick="revokeUser('${uId}')">⛔ Sperren</button>`
                    }
                    <button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:11px;" onclick="openAssignRolesModal('${uId}','${u.vorname} ${u.nachname}', true)">🎭 Rollen</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function startExam(eid) {
    const ex = cachedExams[eid]; if (!ex || !ex.questions) return;
    activeExam = { id: eid, exam: ex }; activeExamSecondsElapsed = 0;
    clearInterval(activeExamTimerInterval);
    activeExamTimerInterval = setInterval(() => {
        activeExamSecondsElapsed++;
        const m = Math.floor(activeExamSecondsElapsed/60).toString().padStart(2, '0');
        const s = (activeExamSecondsElapsed%60).toString().padStart(2, '0');
        const tEl = document.getElementById('activeExamTimerDisplay'); if (tEl) tEl.textContent = `${m}:${s}`;
    }, 1000);

    document.getElementById('activeExamTitle').textContent = ex.title;
    const c = document.getElementById('activeExamQuestionsContainer');
    if (c) {
        c.innerHTML = ex.questions.map((q, idx) => `
            <div class="exam-q-box">
                <p style="font-weight:800;margin:0 0 8px 0;">❓ Frage ${idx+1}: ${q.text}</p>
                ${(q.options || []).map((opt, oIdx) => `
                    <label class="exam-opt-label">
                        <input type="radio" name="q_${idx}" value="${oIdx}">
                        <span>${opt}</span>
                    </label>
                `).join('')}
            </div>
        `).join('');
    }

    document.getElementById('activeExamContainer').style.display = 'block';
    document.getElementById('examStudentView').querySelector('.exam-grid-compact').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelActiveExam() {
    clearInterval(activeExamTimerInterval); activeExam = null;
    document.getElementById('activeExamContainer').style.display = 'none';
    document.getElementById('examStudentView').querySelector('.exam-grid-compact').style.display = 'grid';
}

function submitActiveExam() {
    if (!activeExam) return;
    clearInterval(activeExamTimerInterval);
    const ex = activeExam.exam, eid = activeExam.id;
    let totalQ = ex.questions.length, correctQ = 0;
    const recordedAnswers = [];

    ex.questions.forEach((q, idx) => {
        const radios = document.getElementsByName('q_' + idx);
        let chosen = -1;
        for (let r of radios) { if (r.checked) { chosen = parseInt(r.value); break; } }
        const isRight = (q.correctAnswers || [0]).includes(chosen);
        if (isRight) correctQ++;
        recordedAnswers.push({
            questionText: q.text,
            chosenAnswerText: chosen >= 0 ? (q.options[chosen] || 'Keine') : 'Keine Antwort',
            isCorrect: isRight
        });
    });

    const pct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
    const passed = pct >= (ex.passPercentage || 60);
    const myId = (sessionUser.vorname + '_' + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const m = Math.floor(activeExamSecondsElapsed / 60).toString().padStart(2, '0');
    const s = (activeExamSecondsElapsed % 60).toString().padStart(2, '0');

    db.ref('data/examSubmissions').push({
        examId: eid, examTitle: ex.title, userId: myId, userName: sessionUser.vorname + ' ' + sessionUser.nachname,
        userDN: sessionUser.dn || 'Keine DN', percentage: pct, passed: passed,
        durationFormatted: `${m}:${s} Min`, datum: new Date().toLocaleDateString('de-DE'), ts: Date.now(),
        answers: recordedAnswers
    }).then(() => {
        if (passed) {
            db.ref(`data/users/${myId}/passedExams/${eid}`).set(true);
            alert(`🎉 Herzlichen Glückwunsch! Du hast die Prüfung bestanden mit ${pct}%!`);
        } else {
            db.ref(`data/users/${myId}/unlockedExams/${eid}`).set(false);
            alert(`❌ Leider nicht bestanden (${pct}%). Die Prüfung wurde gesperrt und muss von der Ausbildungsleitung neu freigeschaltet werden.`);
        }
        cancelActiveExam();
    });
}

/* ══════════════════════════════════════════════════════════════
   ADMIN-BEREICH: MITARBEITER, ROLLEN & BACKUP
══════════════════════════════════════════════════════════════ */
function openAdminKeyModal() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isAdmin && !eff.isMasterAdmin) return;
    const pi = document.getElementById('adminAuthPassInput'); if (pi) pi.value = '';
    const m = document.getElementById('adminAuthModal');
    if (m) { m.style.display = 'flex'; if (pi) pi.focus(); }
}
function closeAdminAuthModal() { document.getElementById('adminAuthModal').style.display = 'none'; }

function verifyAdminKeyPassword() {
    const p = (document.getElementById('adminAuthPassInput')?.value||'').trim();
    if (p === sessionUser.pass || (sessionUser.vorname==='Tim' && sessionUser.nachname==='Sanddorn' && p==='0815')) {
        closeAdminAuthModal();
        document.getElementById('adminManagementModal').style.display = 'flex';
        renderAdminUserTable(cachedUsers);
        renderAdminRolesList();
    } else {
        alert('Falsches Admin-Passwort!');
    }
}
function closeAdminManagementModal() { document.getElementById('adminManagementModal').style.display = 'none'; }

function switchAdminTab(tabId, btnEl) {
    document.querySelectorAll('#adminManagementModal .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#adminManagementModal .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}

function renderAdminUserTable(obj) {
    const tbody = document.getElementById('adminUserTableBody'); if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const userList = Object.entries(obj || {}).sort((a, b) => (a[1].nachname || '').localeCompare(b[1].nachname || ''));

    tbody.innerHTML = userList.map(([uId, u]) => `
        <tr class="admin-user-row" data-name="${(u.vorname+' '+u.nachname+' '+u.dn).toLowerCase()}">
            <td>
                <b>${u.vorname||''} ${u.nachname||''}</b>
            </td>
            <td>
                <span style="color:var(--primary);font-weight:700;">DN: ${u.dn||'--'}</span> | 
                <span style="font-family:monospace;color:var(--warning);">PW: ${u.pass||'--'}</span>
            </td>
            <td>
                ${renderUserRoleBadges(u)}<br>
                <span style="color:${u.status==='approved'?'var(--success)':'var(--danger)'};font-weight:700;font-size:11px;">${u.status==='approved'?'✅ Aktiv':'⛔ Gesperrt'}</span>
            </td>
            <td style="color:var(--text-muted);font-size:11px;">${u.date||'--'}</td>
            <td style="text-align:right;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    ${u.status !== 'approved'
                        ? `<button class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:11px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveUser('${uId}')">✅ Freischalten</button>`
                        : `<button class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:11px;background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);" onclick="revokeUser('${uId}')">⛔ Sperren</button>`
                    }
                    <button class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:11px;" onclick="openAssignRolesModal('${uId}','${u.vorname} ${u.nachname}', false)">🎭 Rollen</button>
                    <button class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:11px;background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid #a855f7;" onclick="openUserPermissionsModal('${uId}')">✏️ Edit</button>
                    ${eff.delUsers ? `<button class="btn-delete-row" onclick="deleteUserAccount('${uId}')" title="Mitarbeiter löschen">🗑️</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function filterAdminUserTable() {
    const q = (document.getElementById('searchAdminUsers')?.value||'').toLowerCase();
    document.querySelectorAll('.admin-user-row').forEach(r => {
        r.style.display = r.getAttribute('data-name').includes(q) ? '' : 'none';
    });
}

function approveUser(uId) {
    db.ref('data/users/'+uId+'/status').set('approved').then(() => {
        logAdminAudit('Mitarbeiter freigeschaltet', `Account ${uId} aktiviert von ${sessionUser.vorname} ${sessionUser.nachname}`);
    });
}
function revokeUser(uId) {
    if (confirm('Mitarbeiter wirklich sperren? Der Account bleibt bestehen, kann sich aber nicht mehr einloggen.')) {
        db.ref('data/users/'+uId+'/status').set('revoked').then(() => {
            logAdminAudit('Mitarbeiter gesperrt', `Account ${uId} gesperrt von ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}
function deleteUserAccount(uId) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delUsers) return;
    if (confirm('ACHTUNG: Mitarbeiter endgültig aus der Datenbank löschen?')) {
        db.ref('data/users/' + uId).remove().then(() => {
            logAdminAudit('Mitarbeiter gelöscht', `Account ${uId} unwiderruflich gelöscht von ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

function openUserPermissionsModal(uId) {
    const u = cachedUsers[uId]; if (!u) return;
    document.getElementById('permUserId').value = uId;
    document.getElementById('permVorname').value = u.vorname || '';
    document.getElementById('permNachname').value = u.nachname || '';
    document.getElementById('permDN').value = u.dn || '';
    document.getElementById('permPassword').value = u.pass || '';
    document.getElementById('permStatus').value = u.status || 'approved';
    document.getElementById('userPermissionsModal').style.display = 'flex';
}
function closeUserPermissionsModal() { document.getElementById('userPermissionsModal').style.display = 'none'; }

function saveUserPermissions() {
    const uId = document.getElementById('permUserId')?.value; if (!uId) return;
    const upd = {
        vorname: document.getElementById('permVorname').value.trim(),
        nachname: document.getElementById('permNachname').value.trim(),
        dn: document.getElementById('permDN').value.trim(),
        pass: document.getElementById('permPassword').value.trim(),
        status: document.getElementById('permStatus').value
    };
    db.ref('data/users/' + uId).update(upd).then(() => {
        closeUserPermissionsModal();
        logAdminAudit('Mitarbeiterdaten bearbeitet', `Account ${uId} angepasst von ${sessionUser.vorname} ${sessionUser.nachname}`);
    });
}

function openAssignRolesModal(uId, name, isRestrictedByLeitung = false) {
    const m = document.getElementById('assignRolesModal'); if (!m) return;
    document.getElementById('assignRoleUserId').value = uId;
    document.getElementById('assignRoleUserName').textContent = name;
    const u = cachedUsers[uId] || {}, rids = getUserRolesList(u);

    const allowedForLeitung = ['mitarbeiter', 'luftrettung', 'cls', 'ehk', 'ausbilder'];

    const rolesToShow = Object.values(cachedRoles).filter(r => {
        if (isRestrictedByLeitung) return allowedForLeitung.includes(r.id);
        return true;
    });

    document.getElementById('assignRolesContainer').innerHTML = rolesToShow.map(r => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;background:rgba(30,41,59,0.3);border-radius:8px;">
            <input type="checkbox" ${rids.includes(r.id)?'checked':''} id="assignRole_${r.id}">
            <b style="color:${r.color||'#38bdf8'};">${r.icon||''} ${r.name}</b>
        </label>
    `).join('');

    m.style.display = 'flex';
}
function closeAssignRolesModal() { document.getElementById('assignRolesModal').style.display = 'none'; }

function saveAssignedRoles() {
    const uId = document.getElementById('assignRoleUserId')?.value; if (!uId) return;
    const nr = {};
    Object.keys(cachedRoles).forEach(rId => {
        const e = document.getElementById('assignRole_' + rId);
        if (e && e.checked) nr[rId] = true;
    });
    db.ref('data/users/' + uId + '/roles').set(nr).then(() => {
        closeAssignRolesModal();
        logAdminAudit('Rollen zugewiesen', `Für ${uId} von ${sessionUser.vorname} ${sessionUser.nachname}`);
    });
}

function renderAdminRolesList() {
    const sb = document.getElementById('adminRolesSidebarList'); if (!sb) return;
    sb.innerHTML = Object.values(cachedRoles).map(r => `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid ${r.color||'#38bdf8'}33;background:${r.color||'#38bdf8'}0d;cursor:pointer;" onclick="selectRole('${r.id}')">
            <span>${r.icon||'🎭'}</span>
            <b style="color:${r.color||'#38bdf8'};font-size:13px;">${r.name}</b>
        </div>
    `).join('');
}

function renderRoleCategoryCheckboxes(containerId, allItems, selectedList = []) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const kats = [...new Set(Object.values(allItems).map(i => i.kat || i.thema || 'Allgemein'))].sort();
    if (!kats.length) {
        cont.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Keine Kategorien vorhanden.</span>';
        return;
    }
    cont.innerHTML = kats.map(k => `
        <label style="display:inline-flex;align-items:center;gap:6px;background:rgba(30,41,59,0.5);padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" class="cat-checkbox-item ${containerId}_check" value="${k}" ${selectedList.includes(k) ? 'checked' : ''}>
            <span>${k}</span>
        </label>
    `).join('');
}

function refreshOpenRoleCategoryCheckboxes() {
    const curRoleId = document.getElementById('editingRoleId')?.value;
    if (!curRoleId) return;
    const r = cachedRoles[curRoleId] || {};

    db.ref('data/dienstCommands').once('value', sCmd => {
        const allCmds = Object.assign({}, defaultCommands, sCmd.val() || {});
        renderRoleCategoryCheckboxes('roleCommandsCategoriesContainer', allCmds, r.allowedCmdKats || []);
    });

    db.ref('data/dienstLinks').once('value', sLnk => {
        const allLnks = Object.assign({}, defaultLinks, sLnk.val() || {});
        renderRoleCategoryCheckboxes('roleLinksCategoriesContainer', allLnks, r.allowedLinkKats || []);
    });
}

function selectRole(roleId) {
    const r = cachedRoles[roleId] || defaultRoles[roleId]; if (!r) return;
    document.getElementById('editingRoleId').value = roleId;
    document.getElementById('roleEditName').value = r.name || '';
    document.getElementById('roleEditColor').value = r.color || '#38bdf8';
    document.getElementById('roleEditIcon').value = r.icon || '';

    const isMaster = (roleId === 'masteradmin');

    const fields = [
        'roleFlagAdmin','roleFlagMasterAdmin','roleFlagArchive',
        'roleFlagInstructor','roleFlagManageInstructors','roleFlagManageExams',
        'roleFlagPostNews','roleFlagApproveNews','roleFlagViewNewsRead',
        'roleFlagEditPrices','roleFlagEditGuide','roleFlagEditCommands','roleFlagEditLinks',
        'delFlagPatient','delFlagArchiv','delFlagGuide','delFlagCommands','delFlagLinks','delFlagNews','delFlagExams','delFlagUsers'
    ];
    fields.forEach(fId => {
        const prop = fId.replace('roleFlag', '').replace('delFlag', 'del');
        const key = prop.charAt(0).toLowerCase() + prop.slice(1);
        const chk = document.getElementById(fId);
        if (chk) {
            if (isMaster) {
                chk.checked = true;
            } else {
                chk.checked = !!r[key];
            }
        }
    });

    const btnDel = document.getElementById('btnDeleteRole');
    const protectedRoles = ['masteradmin', 'admin', 'mitarbeiter', 'ausbilder', 'ausbildungsleitung'];
    if (btnDel) {
        if (protectedRoles.includes(roleId) || r.isSystem) {
            btnDel.style.display = 'none';
        } else {
            btnDel.style.display = 'inline-block';
        }
    }

    db.ref('data/dienstCommands').once('value', sCmd => {
        const allCmds = Object.assign({}, defaultCommands, sCmd.val() || {});
        const allCmdKats = isMaster ? Object.values(allCmds).map(c => c.kat || 'Allgemein') : (r.allowedCmdKats || []);
        renderRoleCategoryCheckboxes('roleCommandsCategoriesContainer', allCmds, allCmdKats);
    });

    db.ref('data/dienstLinks').once('value', sLnk => {
        const allLnks = Object.assign({}, defaultLinks, sLnk.val() || {});
        const allLinkKats = isMaster ? Object.values(allLnks).map(l => l.kat || l.thema || 'Allgemein') : (r.allowedLinkKats || []);
        renderRoleCategoryCheckboxes('roleLinksCategoriesContainer', allLnks, allLinkKats);
    });

    updateRoleBadgePreview();
    attachAutoSaveListeners();
}

function updateRoleBadgePreview() {
    const n = document.getElementById('roleEditName')?.value || 'Rolle';
    const c = document.getElementById('roleEditColor')?.value || '#38bdf8';
    const i = document.getElementById('roleEditIcon')?.value || '🎭';
    const p = document.getElementById('editingRoleBadgePreview'); if (!p) return;
    p.textContent = `${i} ${n}`.trim();
    p.style.color = c; p.style.background = c + '22'; p.style.border = `1px solid ${c}44`;
}

function neueRolleErstellen() {
    const newId = 'role_' + Date.now();
    document.getElementById('editingRoleId').value = newId;
    document.getElementById('roleEditName').value = '';
    document.getElementById('roleEditColor').value = '#38bdf8';
    document.getElementById('roleEditIcon').value = '🎭';
    
    const btnDel = document.getElementById('btnDeleteRole');
    if (btnDel) btnDel.style.display = 'none';
    
    document.querySelectorAll('#adminRoleEditorCard input[type="checkbox"]').forEach(c => c.checked = false);

    db.ref('data/dienstCommands').once('value', sCmd => {
        const allCmds = Object.assign({}, defaultCommands, sCmd.val() || {});
        renderRoleCategoryCheckboxes('roleCommandsCategoriesContainer', allCmds, []);
    });

    db.ref('data/dienstLinks').once('value', sLnk => {
        const allLnks = Object.assign({}, defaultLinks, sLnk.val() || {});
        renderRoleCategoryCheckboxes('roleLinksCategoriesContainer', allLnks, []);
    });

    updateRoleBadgePreview();
    attachAutoSaveListeners();
}

function speichereRolle() {
    const id = document.getElementById('editingRoleId')?.value; if (!id) return;

    const isMaster = (id === 'masteradmin');

    const allowedCmds = [];
    document.querySelectorAll('.roleCommandsCategoriesContainer_check:checked').forEach(c => allowedCmds.push(c.value));

    const allowedLnks = [];
    document.querySelectorAll('.roleLinksCategoriesContainer_check:checked').forEach(c => allowedLnks.push(c.value));

    const r = {
        id,
        name: document.getElementById('roleEditName')?.value.trim() || id,
        color: document.getElementById('roleEditColor')?.value || '#38bdf8',
        icon: document.getElementById('roleEditIcon')?.value.trim() || '🎭',
        isAdmin: isMaster ? true : !!document.getElementById('roleFlagAdmin')?.checked,
        isMasterAdmin: isMaster ? true : !!document.getElementById('roleFlagMasterAdmin')?.checked,
        canViewArchive: isMaster ? true : !!document.getElementById('roleFlagArchive')?.checked,
        isInstructor: isMaster ? true : !!document.getElementById('roleFlagInstructor')?.checked,
        canManageInstructors: isMaster ? true : !!document.getElementById('roleFlagManageInstructors')?.checked,
        canManageExams: isMaster ? true : !!document.getElementById('roleFlagManageExams')?.checked,
        canPostNews: isMaster ? true : !!document.getElementById('roleFlagPostNews')?.checked,
        canApproveNews: isMaster ? true : !!document.getElementById('roleFlagApproveNews')?.checked,
        canViewNewsRead: isMaster ? true : !!document.getElementById('roleFlagViewNewsRead')?.checked,
        canEditPrices: isMaster ? true : !!document.getElementById('roleFlagEditPrices')?.checked,
        canEditGuide: isMaster ? true : !!document.getElementById('roleFlagEditGuide')?.checked,
        canEditCommands: isMaster ? true : !!document.getElementById('roleFlagEditCommands')?.checked,
        canEditLinks: isMaster ? true : !!document.getElementById('roleFlagEditLinks')?.checked,
        delPatient: isMaster ? true : !!document.getElementById('delFlagPatient')?.checked,
        delArchiv: isMaster ? true : !!document.getElementById('delFlagArchiv')?.checked,
        delGuide: isMaster ? true : !!document.getElementById('delFlagGuide')?.checked,
        delCommands: isMaster ? true : !!document.getElementById('delFlagCommands')?.checked,
        delLinks: isMaster ? true : !!document.getElementById('delFlagLinks')?.checked,
        delNews: isMaster ? true : !!document.getElementById('delFlagNews')?.checked,
        delExams: isMaster ? true : !!document.getElementById('delFlagExams')?.checked,
        delUsers: isMaster ? true : !!document.getElementById('delFlagUsers')?.checked,
        allowedCmdKats: allowedCmds,
        allowedLinkKats: allowedLnks
    };

    db.ref('data/roles/' + id).set(r).then(() => {
        cachedRoles[id] = r;
        renderAdminRolesList();
    });
}

function attachAutoSaveListeners() {
    const editorCard = document.getElementById('adminRoleEditorCard');
    if (!editorCard || editorCard.dataset.autoSaveAttached === 'true') return;
    editorCard.dataset.autoSaveAttached = 'true';

    editorCard.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            speichereRolle();
        }
    });

    let typingTimer;
    editorCard.addEventListener('input', (e) => {
        if (e.target.type === 'text' || e.target.type === 'color') {
            updateRoleBadgePreview();
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                speichereRolle();
            }, 600);
        }
    });
}

function loescheRolle() {
    const id = document.getElementById('editingRoleId')?.value;
    if (!id) { alert('Keine Rolle ausgewählt!'); return; }

    const role = cachedRoles[id] || defaultRoles[id];
    const protectedSystemRoles = ['masteradmin', 'admin', 'mitarbeiter', 'ausbilder', 'ausbildungsleitung'];
    if (protectedSystemRoles.includes(id) || role?.isSystem) {
        alert(`⛔ Die Standard-Systemrolle "${role?.name || id}" kann nicht gelöscht werden!`);
        return;
    }

    if (confirm(`Möchtest du die Rolle "${role?.name || id}" wirklich dauerhaft löschen?\n\nHinweis: Sie wird auch automatisch bei allen Mitarbeitern entfernt.`)) {
        db.ref('data/roles/' + id).remove().then(() => {
            delete cachedRoles[id];

            db.ref('data/users').once('value', snap => {
                const users = snap.val() || {};
                Object.keys(users).forEach(uId => {
                    if (users[uId]?.roles && users[uId].roles[id]) {
                        db.ref(`data/users/${uId}/roles/${id}`).remove();
                    }
                });
            });

            renderAdminRolesList();
            neueRolleErstellen();
            logAdminAudit('Rolle gelöscht', `${sessionUser.vorname} ${sessionUser.nachname} hat die Rolle "${role?.name || id}" gelöscht.`);
            alert('✅ Rolle erfolgreich gelöscht!');
        });
    }
}

function downloadSystemBackup() {
    db.ref('data').once('value', s => {
        const json = JSON.stringify(s.val() || {}, null, 2);
        const b = new Blob([json], { type: 'application/json' }), el = document.createElement('a');
        el.href = URL.createObjectURL(b); el.download = 'MMD_Backup_' + new Date().toISOString().split('T')[0] + '.json'; el.click();
    });
}

function restoreSystemBackupFromFile(event) {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            db.ref('data').update(data.data ? data.data : data).then(() => {
                alert('✅ Backup erfolgreich eingespielt!');
                location.reload();
            });
        } catch(err) { alert('Fehler: ' + err.message); }
    };
    reader.readAsText(file);
}

function vollstaendigerReset() {
    if (sessionUser && getUserEffectivePermissions(sessionUser).isMasterAdmin && confirm('ACHTUNG: Wirklich das KOMPLETTE System leeren?') && confirm('ALLE Einsätze, Nutzer und Prüfungen werden gelöscht! Fortfahren?')) {
        db.ref('data').remove().then(() => location.reload());
    }
}

function renderAdminAuditLogs() {
    db.ref('data/auditLogs').once('value', s => renderAdminAuditLogsData(s.val() || {}));
}

function renderAdminAuditLogsData(logsObj) {
    const tbody = document.getElementById('adminAuditLogTableBody'); if (!tbody) return;
    const entries = Object.entries(logsObj).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));
    tbody.innerHTML = !entries.length ? '<tr><td colspan="4" style="text-align:center;">Keine Protokolle für den heutigen Tag.</td></tr>'
        : entries.map(([, l]) => `<tr>
            <td style="font-size:11px;">⏰ ${l.ts ? new Date(l.ts).toLocaleTimeString('de-DE') : '-'}</td>
            <td><b>${l.admin||'System'}</b></td>
            <td><span style="color:var(--primary);font-weight:700;">${l.action||'-'}</span></td>
            <td>${l.details||'-'}</td>
          </tr>`).join('');
}

function openAuditLogArchiveModal() {
    const modal = document.getElementById('auditArchiveModal');
    const cont = document.getElementById('auditArchiveContent');
    if (!modal || !cont) return;

    db.ref('data/auditLogsArchiv').once('value', s => {
        const raw = s.val() || {};
        const keys = Object.keys(raw);
        if (!keys.length) {
            cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Noch keine archivierten Tage vorhanden.</p>';
        } else {
            cont.innerHTML = keys.sort().reverse().map(dateKey => {
                const logs = Object.values(raw[dateKey] || {});
                const displayDate = dateKey.replace(/-/g, '.');
                return `
                    <div class="theme-accordion-group" id="audit_${dateKey}" style="margin-bottom:10px;">
                        <div class="theme-accordion-header" onclick="toggleGroupCollapse('audit_${dateKey}')">
                            <span>📅 Tag: ${displayDate}</span>
                            <span>${logs.length} Einträge</span>
                        </div>
                        <div class="theme-accordion-content">
                            <div class="table-responsive" style="margin:0;border:none;">
                                <table>
                                    <thead><tr><th>Uhrzeit</th><th>Admin</th><th>Aktion</th><th>Details</th></tr></thead>
                                    <tbody>
                                        ${logs.map(l => `<tr><td>${l.ts ? new Date(l.ts).toLocaleTimeString('de-DE') : '--:--'}</td><td><b>${l.admin || 'System'}</b></td><td>${l.action || '--'}</td><td>${l.details || '--'}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        modal.style.display = 'flex';
    });
}
function closeAuditArchiveModal() { document.getElementById('auditArchiveModal').style.display = 'none'; }

/* ── Navigation & Global Helpers ───────────────────────────── */
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btn) btn.classList.add('active');
}
function settingsTabClick() { switchTab('settingsTab', document.getElementById('adminMainTabHeader')); }
function switchInstructorTab(tabId, btnEl) {
    document.querySelectorAll('#examInstructorView .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#examInstructorView .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}
function toggleGroupCollapse(gId) { const g = document.getElementById(gId); if (g) g.classList.toggle('collapsed'); }

/* ── DOM Ready & Exports ────────────────────────────────     */
document.addEventListener('DOMContentLoaded', () => {
    updateLiveDate(); setInterval(updateLiveDate, 60000);
    renderGuideTab(); renderHierarchieBoard(hierarchieDaten); baueMaterialUIAuf();
    const su = sessionStorage.getItem('mmd_session_user') || localStorage.getItem('mmd_session_user');
    if (su) { try { initDienstEintritt(JSON.parse(su)); } catch(e){} }
});

const _w = window;
_w.switchTab = switchTab; _w.settingsTabClick = settingsTabClick; _w.switchAdminTab = switchAdminTab; _w.switchInstructorTab = switchInstructorTab;
_w.handleAuthAction = handleAuthAction; _w.toggleAuthTab = toggleAuthTab;
_w.openAdminKeyModal = openAdminKeyModal; _w.closeAdminAuthModal = closeAdminAuthModal; _w.verifyAdminKeyPassword = verifyAdminKeyPassword; _w.closeAdminManagementModal = closeAdminManagementModal;
_w.handleDienstEndeLogout = handleDienstEndeLogout; _w.berechneDienstTage = berechneDienstTage; _w.passwortAendern = passwortAendern;
_w.toggleGroupCollapse = toggleGroupCollapse; _w.stepVerletzungenAnzahl = stepVerletzungenAnzahl; _w.stepKosten = stepKosten; _w.stepMat = stepMat; _w.ladeCheckliste = ladeCheckliste; _w.patientHinzufuegen = patientHinzufuegen; _w.toggleTodo = toggleTodo;
_w.resetMedicalWorkflow = resetMedicalWorkflow; _w.openEditModal = openEditModal; _w.closeEditModal = closeEditModal; _w.speicherePatientEdit = speicherePatientEdit;
_w.deletePatient = deletePatient; _w.deleteArchivSchicht = deleteArchivSchicht; _w.deleteDienstLink = deleteDienstLink; _w.deleteDienstCommand = deleteDienstCommand; _w.exportArchivCSV = exportArchivCSV;
_w.openPricesInlineModal = openPricesInlineModal; _w.closePricesInlineModal = closePricesInlineModal; _w.speicherePreiseInline = speicherePreiseInline;
_w.openGuideInlineModal = openGuideInlineModal; _w.closeGuideInlineModal = closeGuideInlineModal; _w.addGuideRow = addGuideRow; _w.removeGuideRow = removeGuideRow; _w.saveGuideInline = saveGuideInline;
_w.openCommandsInlineModal = openCommandsInlineModal; _w.closeCommandsInlineModal = closeCommandsInlineModal; _w.addCommandInline = addCommandInline;
_w.openLinksInlineModal = openLinksInlineModal; _w.closeLinksInlineModal = closeLinksInlineModal; _w.addLinkInline = addLinkInline;
_w.renderNewsFeed = () => renderNewsFeedData(cachedNews); _w.togglePostNewsForm = togglePostNewsForm; _w.speichereNeueNews = speichereNeueNews; _w.deleteNews = deleteNews;
_w.toggleProposeNewsForm = toggleProposeNewsForm; _w.submitNewsProposal = submitNewsProposal; _w.approveNewsProposal = approveNewsProposal;
_w.markNewsAsRead = markNewsAsRead; _w.openNewsReadersModal = openNewsReadersModal; _w.closeNewsReadersModal = closeNewsReadersModal;
_w.startExam = startExam; _w.cancelActiveExam = cancelActiveExam; _w.submitActiveExam = submitActiveExam;
_w.addExamQuestionRow = addExamQuestionRow; _w.resetExamBuilderForm = resetExamBuilderForm; _w.neuePruefungSpeichern = neuePruefungSpeichern; _w.editExam = editExam; _w.deleteExam = deleteExam; _w.deleteExamSubmission = deleteExamSubmission;
_w.openExamBuilderModal = openExamBuilderModal; _w.closeExamBuilderModal = closeExamBuilderModal;
_w.openExamSubmissionDetailsModal = openExamSubmissionDetailsModal; _w.closeExamSubmissionDetailsModal = closeExamSubmissionDetailsModal;
_w.filterUnlocksTable = filterUnlocksTable; _w.toggleExamUnlockForUser = toggleExamUnlockForUser; _w.toggleExamPassedForUser = toggleExamPassedForUser;
_w.downloadSystemBackup = downloadSystemBackup; _w.restoreSystemBackupFromFile = restoreSystemBackupFromFile;
_w.speichereHierarchieDaten = saveHierarchieInline;
_w.approveUser = approveUser; _w.revokeUser = revokeUser; _w.deleteUserAccount = deleteUserAccount; _w.filterAdminUserTable = filterAdminUserTable;
_w.openAssignRolesModal = openAssignRolesModal; _w.closeAssignRolesModal = closeAssignRolesModal; _w.saveAssignedRoles = saveAssignedRoles;
_w.openUserPermissionsModal = openUserPermissionsModal; _w.closeUserPermissionsModal = closeUserPermissionsModal; _w.saveUserPermissions = saveUserPermissions;
_w.neueRolleErstellen = neueRolleErstellen; _w.selectRole = selectRole; _w.updateRoleBadgePreview = updateRoleBadgePreview; _w.speichereRolle = speichereRolle; _w.loescheRolle = loescheRolle;
_w.vollstaendigerReset = vollstaendigerReset; _w.renderAdminAuditLogs = renderAdminAuditLogs;
_w.openAuditLogArchiveModal = openAuditLogArchiveModal; _w.closeAuditArchiveModal = closeAuditArchiveModal;
_w.editCommandInline = editCommandInline;
_w.editLinkInline = editLinkInline;
_w.openHierarchieInlineModal = openHierarchieInlineModal;
_w.closeHierarchieInlineModal = closeHierarchieInlineModal;
_w.saveHierarchieInline = saveHierarchieInline;
_w.deleteArchivSchicht = deleteArchivSchicht;