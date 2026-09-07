// ============================================================
//  MMD CLOUD – Medical Center Web-App  |  app.js  v3.6-fixed
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
let cachedExamOrder   = [];
let allLinkCategories = ['Allgemein', 'EHK', 'CLS', 'Psychologie', 'MD Intern', 'Luftrettung', 'Ausbildung', 'Personalabteilung'];
let allCmdCategories  = ['Allgemein', 'Psychologie', 'T-Codes', 'Abkürzungen & Dokumente', 'Ausbildung', 'Ausbildungsabteilung', 'Personalabteilung'];
let activeExam        = null;
let activeExamTimerInterval = null;
let activeExamSecondsElapsed = 0;
let hasCorrectedExamsThisSession = false;

/* ── Default Roles ─────────────────────────────────────────── */
let defaultRoles = {
    masteradmin:       { id:'masteradmin',       name:'Master-Admin',        color:'#eab308', icon:'👑', isSystem:true, isAdmin:true,  isMasterAdmin:true,  canDelete:true,  isInstructor:true,  canManageInstructors:true,  canPostNews:true,  allowedLinkKats:{}, allowedCmdKats:{} },
    admin:             { id:'admin',             name:'Admin',               color:'#f59e0b', icon:'🛡️', isSystem:true, isAdmin:true,  isMasterAdmin:false, canDelete:true,  isInstructor:true,  canManageInstructors:true,  canPostNews:true,  allowedLinkKats:{}, allowedCmdKats:{} },
    ausbildungsleitung:{ id:'ausbildungsleitung',name:'Ausbildungsleitung',  color:'#c084fc', icon:'⚙️', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:true,  canManageInstructors:true,  canPostNews:true,  allowedLinkKats:{'Ausbildung':true,'Luftrettung':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'Ausbildung':true,'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    ausbilder:         { id:'ausbilder',         name:'Ausbilder',           color:'#8b5cf6', icon:'🎓', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:true,  canManageInstructors:false, canPostNews:false, allowedLinkKats:{'Ausbildung':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'Ausbildung':true,'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    ehk:               { id:'ehk',               name:'EHK-Ausbilder',       color:'#10b981', icon:'🩺', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:true,  canManageInstructors:false, canPostNews:false, allowedLinkKats:{'EHK':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'EHK':true,'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    cls:               { id:'cls',               name:'CLS-Ausbilder',       color:'#06b6d4', icon:'💉', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:true,  canManageInstructors:false, canPostNews:false, allowedLinkKats:{'CLS':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'CLS':true,'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    personal:          { id:'personal',          name:'Personalabteilung',   color:'#3b82f6', icon:'📋', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:false, canManageInstructors:false, canPostNews:false, allowedLinkKats:{'Personalabteilung':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'Personalabteilung':true,'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    psychologie:       { id:'psychologie',       name:'Psychologie',         color:'#ec4899', icon:'🧠', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:false, canManageInstructors:false, canPostNews:false, allowedLinkKats:{'Psychologie':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'Psychologie':true,'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    luftrettung:       { id:'luftrettung',       name:'Luftrettung',         color:'#0284c7', icon:'🚁', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:false, canManageInstructors:false, canPostNews:false, allowedLinkKats:{'Luftrettung':true,'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} },
    mitarbeiter:       { id:'mitarbeiter',       name:'Mitarbeiter',         color:'#64748b', icon:'👨‍⚕️', isSystem:true, isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:false, canManageInstructors:false, canPostNews:false, allowedLinkKats:{'MD Intern':true,'Allgemein':true}, allowedCmdKats:{'T-Codes':true,'Abkürzungen & Dokumente':true,'Allgemein':true} }
};
let cachedRoles = Object.assign({}, defaultRoles);

/* ── Guide Data Defaults ───────────────────────────────────── */
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
        { id:"kr_1", name:"Staatliche Fraktionen",          note:"(SAPD, USMS, DOJ & SAMD)",             desc:"Im Dienst wird keine Rechnung ausgestellt" },
        { id:"kr_2", name:"Mechaniker",                     note:"(Benny's, Redfield & Roxwood Tuning)",  desc:"Im Dienst wird keine Rechnung ausgestellt" },
        { id:"kr_3", name:"Security C77 / Bahamas / Casino",note:"",                                     desc:"Im Dienst wird keine Rechnung ausgestellt" }
    ]
};
let cachedGuideData = JSON.parse(JSON.stringify(defaultGuideData));

/* ── Material-Katalog ──────────────────────────────────────── */
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

let defaultNews = {
    news_welcome: {
        title: "📢 Willkommen im neuen MMD Cloud System v3.0",
        content: "Das zentrale Verwaltungssystem des San Andreas Medical Department wurde vollständig modernisiert und saniert.\n\nAlle Funktionen für Einsatzdokumentation, Funk- & Leitfaden, Dienst-Links, den gesamten Ausbildungsbereich sowie die Administration sind ab sofort live und einsatzbereit.",
        category: "Ankündigung",
        author: "Klinikleitung",
        ts: 1725500000000
    }
};

/* ── Standard-Prüfungskatalog (Vollständig & bereinigt) ──────── */
let defaultExams = {
    exam_ga1: {
        id: "exam_ga1",
        title: "Grundausbildung 1 (GA1)",
        kat: "Grundausbildung",
        timeLimitMinutes: 30,
        passPercentage: 60,
        passScore: 15,
        introHeader: "Grundausbildung 1",
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
        id: "exam_ga2",
        title: "Grundausbildung 2 (GA2)",
        kat: "Grundausbildung",
        timeLimitMinutes: 30,
        passPercentage: 60,
        passScore: 12,
        introHeader: "Grundausbildung 2",
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
        id: "exam_dv",
        title: "Dienstvorschriften (DV)",
        kat: "Dienstvorschriften",
        timeLimitMinutes: 30,
        passPercentage: 70,
        passScore: 14,
        introHeader: "Dienstvorschriften (DV)",
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
        id: "exam_para1",
        title: "Paramedic 1 (Praxis & Theorie)",
        kat: "Paramedic",
        timeLimitMinutes: 30,
        passPercentage: 75,
        passScore: 15,
        introHeader: "Paramedic Stufe 1",
        introText: "Erweiterte Notfallmedizin und Rettungsdienstpraxis.",
        questions: [
            { id: 1, text: "Was bedeutet Triage bei einem Massenanfall von Verletzten (MANV)?", options: ["Priorisierung der Patienten nach Schwere der Verletzung", "Wer zuerst kommt, wird zuerst behandelt", "Alle gleichzeitig"], correctAnswers: [0] },
            { id: 2, text: "Welche Maßnahme wird bei einem schweren Spannungspneumothorax eingeleitet?", options: ["Entlastungspunktion / Thoraxdrainage", "Nur Schmerzmittel", "Warten"], correctAnswers: [0] }
        ]
    },
    exam_para2: {
        id: "exam_para2",
        title: "Paramedic 2 (Erweiterte Notfallmedizin)",
        kat: "Paramedic",
        timeLimitMinutes: 30,
        passPercentage: 75,
        passScore: 15,
        introHeader: "Paramedic Stufe 2",
        introText: "ACLS-Leitlinien, erweiterte Notfallversorgung und schwierige Atemwegs-Sicherung.",
        questions: [
            { id: 1, text: "Welche Medikamente werden bei einer Reanimation nach ACLS-Standard verabreicht?", options: ["1mg Adrenalin alle 3-5 Minuten", "100mg Morphin sofort", "Nur Kochsalzlösung"], correctAnswers: [0] },
            { id: 2, text: "Was bedeutet das 'cABCDE'-Schema in der präklinischen Traumabehandlung?", options: ["critical bleeding, Airway, Breathing, Circulation, Disability, Exposure", "control, Ambulance, Blood, Care, Doctor, Emergency"], correctAnswers: [0] }
        ]
    },
    exam_para3: {
        id: "exam_para3",
        title: "Paramedic 3 Prüfung (Para 3)",
        kat: "Paramedic",
        timeLimitMinutes: 30,
        passPercentage: 75,
        passScore: 8,
        isPractical: true,
        introHeader: "Paramedic 3 Prüfung (Para 3)",
        introText: "Praktische Prüfung – wird vom Ausbilder für den Prüfling ausgefüllt.",
        questions: [
            { id: 1, type: "info_pruefer", text: "Dienstnummer des Prüfenden" },
            { id: 2, type: "info_dn", text: "Dienstnummer des Prüflings" },
            { id: 3, type: "info_name", text: "Name und Vorname des Prüflings" },
            { id: 4, type: "choice", text: "Zeit zur Anfahrt max. (3 Minuten)?", options: ["01:30-02:30 min", "02:30-03:00 min", "03:00-05:00 min"], correctAnswers: [1], points: [1] },
            { id: 5, type: "choice", text: "Vitalwerte geprüft?", options: ["Ja", "Nein", "Nicht Ordnungsgemäß"], correctAnswers: [0], points: [1] },
            { id: 6, type: "choice", text: "Blutung gestoppt?", options: ["Ja", "Nein", "Nicht Ordnungsgemäß"], correctAnswers: [0], points: [1] }
        ]
    },
    exam_arzt1: {
        id: "exam_arzt1",
        title: "Arzt 1 (Allgemeinmedizin & Notfallversorgung)",
        kat: "Doctor",
        timeLimitMinutes: 35,
        passPercentage: 80,
        passScore: 16,
        introHeader: "Fachprüfung Arzt 1",
        introText: "Klinisches Basiswissen, Differentialdiagnostik und Stationsorganisation.",
        questions: [
            { id: 1, text: "Welche Diagnostik ist bei Verdacht auf akutes Koronarsyndrom (STEMI) unverzüglich durchzuführen?", options: ["12-Kanal-EKG, Troponin-Labor und Vitalparameter-Monitoring", "Nur Blutdruck messen", "MRT des Schädels"], correctAnswers: [0] },
            { id: 2, text: "Welche Erstmaßnahme erfolgt bei einem anaphylaktischen Schock (Grad III/IV)?", options: ["Adrenalin i.m. (0,5 mg), Sauerstoff, Volumengabe, H1/H2-Blocker & Glukokortikoide", "Nur ein Glas Wasser", "Aspirin 1000mg"], correctAnswers: [0] }
        ]
    },
    exam_arzt2: {
        id: "exam_arzt2",
        title: "Arzt 2 (Notfallchirurgie & Chefarzt-Qualifikation)",
        kat: "Doctor",
        timeLimitMinutes: 40,
        passPercentage: 85,
        passScore: 18,
        introHeader: "Prüfung Arzt 2 (Chefarzt-Qualifikation)",
        introText: "Klinische Notfallchirurgie, Intensivmedizin und Führungskompetenz.",
        questions: [
            { id: 1, text: "Welche Indikation besteht für eine sofortige Notfall-Laparotomie im Schockraum?", options: ["Akutes Hämoperitoneum mit hämodynamischer Instabilität", "Leichte Bauchschmerzen", "Chronische Gastritis"], correctAnswers: [0] },
            { id: 2, text: "Was ist das Prinzip des 'Damage Control Surgery' beim Polytrauma?", options: ["Schnelle Blutungskontrolle und Dekontamination, Stabilisierung vor definitiver Rekonstruktion", "10-stündige Komplett-OP sofort", "Nur Verband anlegen"], correctAnswers: [0] }
        ]
    },
    exam_arzt3: {
        id: "exam_arzt3",
        title: "Arzt 3 Prüfung (Arzt 3)",
        kat: "Arzt",
        timeLimitMinutes: 30,
        passPercentage: 75,
        passScore: 8,
        isPractical: true,
        introHeader: "Arzt 3 Prüfung (Arzt 3)",
        introText: "Praktische Prüfung – wird vom Ausbilder für den Prüfling ausgefüllt.",
        questions: [
            { id: 1, type: "info_pruefer", text: "Dienstnummer des Prüfenden" },
            { id: 2, type: "info_dn", text: "Dienstnummer des Prüflings" },
            { id: 3, type: "info_name", text: "Name und Vorname des Prüflings" },
            { id: 4, type: "choice", text: "Anamnese durchgeführt?", options: ["Ja", "Nein", "Nicht ausreichend"], correctAnswers: [0], points: [1] },
            { id: 5, type: "choice", text: "Diagnose korrekt?", options: ["Ja", "Nein"], correctAnswers: [0], points: [1] },
            { id: 6, type: "choice", text: "Behandlung korrekt?", options: ["Ja", "Nein", "Teilweise"], correctAnswers: [0], points: [1] }
        ]
    }
};

let _examBuilderQuestions = [];
let _guideItemEditSection = '';
let _guideItemEditId = '';

let hierarchieDaten = {
    chief_01:"Aktuell nicht belegt", chief_02:"Aktuell nicht belegt", chief_03:"Aktuell nicht belegt",
    domo_04:"Nick Garcia",   domo_04_sub:"",
    fod_05:"Mike Gonzalo",   fod_05_sub:"",
    chiefphys_06:"Katarina Harper", chiefphys_07:"Tim Sanddorn",
    lt_08:"Aktuell nicht belegt", lt_09:"Aktuell nicht belegt",
    dept_psych_l:"Aktuell nicht belegt",  dept_psych_sl:"Aktuell nicht belegt",
    dept_perso_l:"Aktuell nicht belegt",  dept_perso_sl:"Aktuell nicht belegt",
    dept_ausb_l:"Aktuell nicht belegt",   dept_ausb_sl:"Aktuell nicht belegt",
    dept_luft_l:"Gleich die Ausbildungsleitung", dept_luft_sl:"Aktuell nicht belegt"
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

/* ── Rollen & Berechtigungen ───────────────────────────────── */
function getUserRolesList(user) {
    if (!user) return [];
    let list = [];
    if (user.roles) {
        if (Array.isArray(user.roles)) list = [...user.roles];
        else if (typeof user.roles === 'object') list = Object.keys(user.roles).filter(k => user.roles[k] === true);
    }
    if (list.includes('superadmin')) { list = list.filter(r => r !== 'superadmin'); if (!list.includes('masteradmin')) list.unshift('masteradmin'); }
    const v = (user.vorname||'').trim().toLowerCase(), n = (user.nachname||'').trim().toLowerCase();
    if (v === 'tim' && n === 'sanddorn' && !list.includes('masteradmin')) list.unshift('masteradmin');
    if (user.isMasterAdmin && !list.includes('masteradmin')) list.unshift('masteradmin');
    else if (user.isAdmin && !list.includes('admin') && !list.includes('masteradmin')) list.push('admin');
    if (user.canManageInstructors && !list.includes('ausbildungsleitung')) list.push('ausbildungsleitung');
    else if (user.isInstructor && !list.includes('ausbilder') && !list.includes('ausbildungsleitung')) list.push('ausbilder');
    return list;
}

function getUserEffectivePermissions(user) {
    if (!user) return { isAdmin:false, isMasterAdmin:false, canDelete:false, isInstructor:false, canManageInstructors:false, canPostNews:false, canSeeLinks:true, canSeeCommands:true };
    const roleIds = getUserRolesList(user);
    let isAdmin=!!user.isAdmin, isMasterAdmin=!!user.isMasterAdmin, canDelete=!!user.canDelete;
    let isInstructor=!!user.isInstructor, canManageInstructors=!!user.canManageInstructors;
    let canPostNews=!!user.canPostNews, canSeeLinks=user.canSeeLinks!==false, canSeeCommands=user.canSeeCommands!==false;
    roleIds.forEach(rId => {
        const role = cachedRoles[rId] || (rId==='superadmin'?cachedRoles['masteradmin']:null);
        if (!role) return;
        if (role.isAdmin)              isAdmin=true;
        if (role.isMasterAdmin)        isMasterAdmin=true;
        if (role.canDelete)            canDelete=true;
        if (role.isInstructor)         isInstructor=true;
        if (role.canManageInstructors) canManageInstructors=true;
        if (role.canPostNews)          canPostNews=true;
    });
    const v=(user.vorname||'').trim().toLowerCase(), n=(user.nachname||'').trim().toLowerCase();
    if (v==='tim'&&n==='sanddorn') { isAdmin=true;isMasterAdmin=true;canDelete=true;isInstructor=true;canManageInstructors=true;canPostNews=true;canSeeLinks=true;canSeeCommands=true; }
    return { isAdmin,isMasterAdmin,canDelete,isInstructor,canManageInstructors,canPostNews,canSeeLinks,canSeeCommands };
}

function isUserInstructor() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return eff.isInstructor || eff.isAdmin || eff.isMasterAdmin;
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

function getUserAllowedLinkCategories(user, allCats) {
    if (!user || !allCats) return allCats || [];
    const eff = getUserEffectivePermissions(user);
    if (eff.isAdmin || eff.isMasterAdmin) return allCats;
    return allCats.filter(kat => !(user.allowedLinkKats && user.allowedLinkKats[kat] === false));
}

function getUserAllowedCmdCategories(user, allCats) {
    if (!user || !allCats) return allCats || [];
    const eff = getUserEffectivePermissions(user);
    if (eff.isAdmin || eff.isMasterAdmin) return allCats;
    return allCats.filter(kat => !(user.allowedCmdKats && user.allowedCmdKats[kat] === false));
}

/* ── Authentifizierung ─────────────────────────────────────── */
function toggleAuthTab(tab) {
    currentAuthTab=tab;
    document.getElementById('tabLoginBtn').classList.toggle('active',tab==='login');
    document.getElementById('tabRegisterBtn').classList.toggle('active',tab==='register');
    document.getElementById('mainAuthActionBtn').textContent=tab==='login'?'Dienst antreten':'Account beantragen';
    document.getElementById('authPassword').placeholder=tab==='login'?'Passwort':'Passwort ausdenken';
    const dnC=document.getElementById('authDNContainer');
    if (dnC) dnC.style.display=tab==='login'?'none':'block';
}

function handleAuthAction() {
    const v=(document.getElementById('authVorname')?.value||'').trim();
    const n=(document.getElementById('authNachname')?.value||'').trim();
    const p=(document.getElementById('authPassword')?.value||'').trim();
    if (!v||!n||!p) { alert('Bitte alle Felder ausfüllen!'); return; }
    const uId=(v+'_'+n).toLowerCase().replace(/[^a-z0-9_]/g,'');

    if (v.toLowerCase()==='tim'&&n.toLowerCase()==='sanddorn'&&p==='0815') {
        const admin={vorname:'Tim',nachname:'Sanddorn',pass:'0815',status:'approved',isAdmin:true,isMasterAdmin:true,canDelete:true,isInstructor:true,canManageInstructors:true,canSeeLinks:true,canSeeCommands:true,canPostNews:true,roles:{masteradmin:true},date:'20.07.2026'};
        db.ref('data/users/tim_sanddorn').set(admin);
        initDienstEintritt(admin);
        return;
    }
    if (currentAuthTab==='register') {
        const dn=(document.getElementById('authDN')?.value||'').trim();
        if (!dn) { alert('Bitte Dienstnummer eingeben!'); return; }
        db.ref('data/users/'+uId).once('value',snap=>{
            if (snap.val()) { alert('Dieser Name ist bereits registriert!'); return; }
            db.ref('data/users/'+uId).set({vorname:v,nachname:n,pass:p,dn,status:'pending',date:new Date().toLocaleDateString('de-DE'),isAdmin:false,roles:{},canSeeLinks:true,canSeeCommands:true,canDelete:false,canPostNews:false}).then(()=>{
                alert('Bitte warten Sie auf die Verifizierung durch die Leitung.');
                location.reload();
            });
        });
    } else {
        db.ref('data/users/'+uId).once('value',snap=>{
            const user=snap.val();
            if (!user||user.pass!==p) { alert('Falscher Name oder falsches Passwort!'); return; }
            if (user.status!=='approved'&&!user.isAdmin&&!user.isMasterAdmin) { alert('Dein Account wurde noch nicht freigeschaltet!'); return; }
            initDienstEintritt(user);
        });
    }
}

/* ── Dienst-Start & App Init ───────────────────────────────── */
function applyUserPermissions(user) {
    if (!user) return;
    const eff=getUserEffectivePermissions(user);
    const lBtn=document.getElementById('linksTabBtn'); if(lBtn) lBtn.style.display=eff.canSeeLinks?'':'none';
    const cBtn=document.querySelector('.tab-nav button[onclick*="commandTab"]'); if(cBtn) cBtn.style.display=eff.canSeeCommands?'':'none';
    const newsPostBtn=document.getElementById('btnOpenPostNews'); if(newsPostBtn) newsPostBtn.style.display=eff.canPostNews?'':'none';
    const instrView=document.getElementById('examInstructorView'); if(instrView) instrView.style.display=(eff.isInstructor||eff.isAdmin)?'block':'none';
    const allowedExamsBtn=document.getElementById('instrAllowedExamsTabBtn'); if(allowedExamsBtn) allowedExamsBtn.style.display=(eff.canManageInstructors||eff.isAdmin)?'':'none';
}

function initDienstEintritt(user) {
    sessionUser=user;
    sessionStorage.setItem('mmd_session_active','true');
    sessionStorage.setItem('mmd_session_user',JSON.stringify(user));
    localStorage.setItem('mmd_session_active','true');
    localStorage.setItem('mmd_session_user',JSON.stringify(user));
    const eff=getUserEffectivePermissions(user);
    document.getElementById('authView').style.display='none';
    document.getElementById('mainAppView').style.display='block';
    document.getElementById('topBarMedicName').innerHTML='<b>'+user.vorname+' '+user.nachname+'</b> '+renderUserRoleBadges(user, true);
    const dEl=document.getElementById('daysMedicName'); if(dEl) dEl.textContent=user.vorname+' '+user.nachname;
    const akBtn=document.getElementById('adminKeyBtn'); if(akBtn) akBtn.style.display=(eff.isAdmin||eff.isMasterAdmin)?'inline-block':'none';
    document.querySelectorAll('.admin-action-th').forEach(el=>el.style.display=eff.canDelete?'table-cell':'none');
    applyUserPermissions(user);
    startPresenceWatcher();
    updateOnlineStatus();
    updateLiveDate();
    baueMaterialUIAuf();
    startFirebaseListeners();
    renderGuideTab();
    renderNewsFeed();
    const gDatum=localStorage.getItem('mmd_einstellungsdatum_'+user.vorname+'_'+user.nachname);
    const eDatumEl=document.getElementById('einstellungsDatum');
    if (gDatum&&eDatumEl) { eDatumEl.value=gDatum; berechneDienstTage(); }
}

function updateLiveDate() {
    const el=document.getElementById('liveDateDisplay');
    if (el) el.textContent=new Date().toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
}

/* ── Firebase Listeners ────────────────────────────────────── */
function startFirebaseListeners() {
    db.ref('data/protokoll').on('value',s=>renderProtokoll(s.val()||{}));
    db.ref('data/archiv').on('value',s=>renderArchiv(s.val()||{}));
    db.ref('data/hierarchie').on('value',s=>{ if(s.val()) renderHierarchieBoard(s.val()); else renderHierarchieBoard(hierarchieDaten); });
    db.ref('data/guide').on('value',s=>{
        cachedGuideData=s.val()?Object.assign(JSON.parse(JSON.stringify(defaultGuideData)),s.val()):JSON.parse(JSON.stringify(defaultGuideData));
        renderGuideTab();
    });
    db.ref('data/materialPreise').on('value',s=>{
        if (!s.val()) return;
        Object.keys(s.val()).forEach(k=>{ if(materialKatalog[k]) materialKatalog[k].preis=s.val()[k]; });
        baueMaterialUIAuf();
    });
    db.ref('data/szenarioTemplates').on('value',s=>{ if(s.val()) szenarioTemplates=Object.assign({},szenarioTemplates,s.val()); });
    db.ref('data/dienstLinks').on('value',s=>renderLinksTab(s.val()||{}));
    db.ref('data/dienstCommands').on('value',s=>renderCommandsTab(s.val()||{}));
    db.ref('data/roles').on('value',s=>{ cachedRoles=s.val()?Object.assign({},defaultRoles,s.val()):Object.assign({},defaultRoles); });
    
    // Prüfungen laden (Dauerhaftes Löschen respektieren!)
    db.ref('data/exams').on('value',s=>{
        const raw=s.val()||{};
        cachedExams={};
        Object.keys(defaultExams).forEach(k=>{
            if(!raw[k] || !raw[k].deleted) cachedExams[k]=defaultExams[k];
        });
        Object.keys(raw).forEach(k=>{
            if(raw[k] && !raw[k].deleted) cachedExams[k]=raw[k];
            else if(raw[k] && raw[k].deleted) delete cachedExams[k];
        });
        Object.keys(cachedExams).forEach(id=>{ cachedExams[id]=ensureExamHasDefaultHeaderFields(cachedExams[id]); });
        db.ref('data/users').once('value',us=>{
            cachedUsers=us.val()||{};
            db.ref('data/examSubmissions').once('value',ss=>{ cachedSubmissions=ss.val()||{}; renderExamTab(); });
        });
    });

    db.ref('data/examOrder').on('value',s=>{ if(s.val()&&Array.isArray(s.val())) cachedExamOrder=s.val(); });
    db.ref('data/news').on('value',s=>renderNewsFeedData(s.val()||{}));
    db.ref('data/auditLogs').on('value',s=>renderAdminAuditLogsData(s.val()||{}));
    db.ref('data/examSubmissions').on('value',s=>{ cachedSubmissions=s.val()||{}; renderInstructorSubmissions(cachedSubmissions); });
}

/* ── Presence Watcher ──────────────────────────────────────── */
function updateOnlineStatus() {
    if (!sessionUser) return;
    if (!mySessionRef) { mySessionRef=db.ref('data/presence').push(); mySessionRef.onDisconnect().remove(); }
    mySessionRef.set(sessionUser.vorname+' '+sessionUser.nachname);
}

function startPresenceWatcher() {
    db.ref('data/presence').off();
    db.ref('data/presence').on('value',snap=>{
        const list=snap.val();
        const d=document.getElementById('onlineMedicsList'), ad=document.getElementById('adminOnlineMedicsList');
        if (!list) { if(d) d.textContent='Keiner im Dienst'; if(ad) ad.textContent='Keine Medics im Dienst'; return; }
        const names=[...new Set(Object.values(list))].join(', ');
        if(d) d.textContent=names; if(ad) ad.textContent=names;
    });
}

/* ── Patient & Einsatz ─────────────────────────────────────── */
function stepVerletzungenAnzahl(d) {
    anzahlVerletzungenFall=Math.max(1,anzahlVerletzungenFall+d);
    const el=document.getElementById('val_pVerletzungenAnzahl'); if(el) el.textContent=anzahlVerletzungenFall;
}
function stepKosten(d) {
    aktuellerFallKosten=Math.max(0,aktuellerFallKosten+d);
    const el=document.getElementById('val_pKosten'); if(el) el.textContent='$'+aktuellerFallKosten;
}
function stepMat(key,d) {
    fallMaterial[key]=Math.max(0,(fallMaterial[key]||0)+d);
    const el=document.getElementById('val_'+key); if(el) el.textContent=fallMaterial[key];
    let total=0; Object.keys(fallMaterial).forEach(k=>{ if(materialKatalog[k]) total+=fallMaterial[k]*materialKatalog[k].preis; });
    aktuellerFallKosten=total;
    const ke=document.getElementById('val_pKosten'); if(ke) ke.textContent='$'+total;
}
function ladeCheckliste() {
    const sel=document.getElementById('verletzungSelect'), cont=document.getElementById('checklisteContainer');
    if (!sel||!cont) return;
    const sz=sel.value;
    if (!sz) { cont.innerHTML='<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>'; return; }
    const schritte=medicDatenbank[sz]||[];
    cont.innerHTML=schritte.map((s,i)=>`<div class="todo-item" id="todo_${i}" onclick="toggleTodo(${i})"><input type="checkbox" id="check_${i}" onclick="event.stopPropagation();toggleTodo(${i})"><span>${s}</span></div>`).join('');
    const tpl=szenarioTemplates[sz]||{};
    Object.keys(materialKatalog).forEach(k=>{ fallMaterial[k]=tpl[k]||0; const e=document.getElementById('val_'+k); if(e) e.textContent=fallMaterial[k]; });
    fallMaterial['mat_wasser']=anzahlVerletzungenFall;
    const we=document.getElementById('val_mat_wasser'); if(we) we.textContent=anzahlVerletzungenFall;
    let total=0; Object.keys(fallMaterial).forEach(k=>{ if(materialKatalog[k]) total+=fallMaterial[k]*materialKatalog[k].preis; });
    aktuellerFallKosten=total;
    const ke=document.getElementById('val_pKosten'); if(ke) ke.textContent='$'+total;
}
function toggleTodo(idx) {
    const item=document.getElementById('todo_'+idx), chk=document.getElementById('check_'+idx);
    if(!item) return; item.classList.toggle('completed'); if(chk) chk.checked=item.classList.contains('completed');
}

function resetMedicalWorkflow() {
    const nF=document.getElementById('pName'), sS=document.getElementById('verletzungSelect');
    if(nF) nF.value=''; if(sS) sS.value='';
    anzahlVerletzungenFall=1; aktuellerFallKosten=0; fallMaterial={};
    const vE=document.getElementById('val_pVerletzungenAnzahl'), kE=document.getElementById('val_pKosten');
    if(vE) vE.textContent='1'; if(kE) kE.textContent='$0';
    const cc=document.getElementById('checklisteContainer');
    if(cc) cc.innerHTML='<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>';
    if (typeof baueMaterialUIAuf === 'function') baueMaterialUIAuf();
}

function patientHinzufuegen() {
    if (!sessionUser) { alert('Nicht eingeloggt!'); return; }
    const nF=document.getElementById('pName'), sS=document.getElementById('verletzungSelect');
    const patName=(nF?.value||'').trim()||'Patient '+((daten.patienten||0)+1);
    const sz=sS?.value||'Undefinierbar';
    const mat=Object.assign({},fallMaterial); mat['mat_wasser']=anzahlVerletzungenFall;
    db.ref('data/protokoll').push({name:patName,szenario:sz,verletzungen:anzahlVerletzungenFall,kosten:aktuellerFallKosten,material:mat,medic:sessionUser.vorname+' '+sessionUser.nachname,ts:Date.now()}).then(()=>{
        if(nF) nF.value=''; if(sS) sS.value='';
        anzahlVerletzungenFall=1; aktuellerFallKosten=0; fallMaterial={};
        const vE=document.getElementById('val_pVerletzungenAnzahl'),kE=document.getElementById('val_pKosten');
        if(vE) vE.textContent='1'; if(kE) kE.textContent='$0';
        const cc=document.getElementById('checklisteContainer');
        if(cc) cc.innerHTML='<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>';
        baueMaterialUIAuf();
    });
}

/* ── Protokoll & Archiv ────────────────────────────────────── */
function renderProtokoll(obj) {
    const tbody=document.getElementById('logTableBody'); if(!tbody) return;
    const eff=sessionUser?getUserEffectivePermissions(sessionUser):{};
    const entries=Object.entries(obj).sort((a,b)=>(b[1].ts||0)-(a[1].ts||0));
    tbody.innerHTML=entries.length===0
        ?'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">📋 Noch keine Patienten für die laufende Schicht dokumentiert.</td></tr>'
        :entries.map(([k,v])=>`<tr><td>${v.name||'-'}</td><td>${v.szenario||'-'}</td><td>${v.verletzungen||0}</td><td style="color:var(--success);font-weight:800;">$${v.kosten||0}</td><td>${v.medic||'-'}</td><td><button class="btn-edit-row" onclick="openEditModal('${k}')">✏️</button>${eff.canDelete?`<button class="btn-delete-row" onclick="deletePatient('${k}')">🗑️</button>`:''}</td></tr>`).join('');
    let tP=0,tV=0,tA=0;
    entries.forEach(([,v])=>{ tP++; tV+=v.verletzungen||0; tA+=v.kosten||0; });
    daten={patienten:tP,verletzungen:tV,ausgaben:tA};
    const sp=document.getElementById('statPatienten'),sv=document.getElementById('statVerletzungen'),sa=document.getElementById('statAusgaben');
    if(sp) sp.textContent=tP; if(sv) sv.textContent=tV; if(sa) sa.textContent='$'+tA;
    renderTagesVerbrauch(entries.map(([,v])=>v));
}

function renderTagesVerbrauch(entries) {
    const tbody=document.getElementById('tagesVerbrauchTableBody'); if(!tbody) return;
    const totals={};
    entries.forEach(e=>{ const m=e.material||{}; Object.keys(m).forEach(k=>{ totals[k]=(totals[k]||0)+(m[k]||0); }); });
    tbody.innerHTML=Object.keys(totals).length===0
        ?'<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">📦 Noch kein Materialverbrauch erfasst.</td></tr>'
        :Object.entries(totals).filter(([,v])=>v>0).map(([k,v])=>`<tr><td>${materialKatalog[k]?materialKatalog[k].name:k}</td><td><b>${v}x</b></td></tr>`).join('');
}

function renderArchiv(obj) {
    const tbody = document.getElementById('archivTableBody');
    const tfoot = document.getElementById('archivTableFoot');
    if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const sA = eff.canDelete || (sessionUser && sessionUser.isAdmin);
    
    if (!obj || !Object.keys(obj).length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">📥 Noch keine archivierten Schichten vorhanden.</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    let totalP = 0, totalV = 0, totalCash = 0, totalMatObj = {};
    const entries = Object.entries(obj).reverse();

    tbody.innerHTML = entries.map(([k, i]) => {
        const p = Number(i.p !== undefined ? i.p : (i.patienten !== undefined ? i.patienten : 0)) || 0;
        const v = Number(i.v !== undefined ? i.v : (i.verletzungen !== undefined ? i.verletzungen : 0)) || 0;
        const cash = Number(i.cash !== undefined ? i.cash : (i.ausgaben !== undefined ? i.ausgaben : (i.kosten !== undefined ? i.kosten : 0))) || 0;
        const tagLabel = i.tag ? ('Schicht ' + i.tag) : (i.datum || i.date || 'Schicht');

        totalP += p; totalV += v; totalCash += cash;

        let mHtml = '<ul class="archiv-details-list" style="margin:0;padding-left:14px;color:var(--text-muted);font-size:11px;list-style-type:square;">';
        const matObj = i.matDetailsObj || i.material || i.matDetails;
        if (matObj && typeof matObj === 'object' && Object.keys(matObj).length > 0) {
            Object.keys(matObj).forEach(m => {
                let qty = Number(matObj[m]) || 0;
                if (qty > 0) {
                    const dispName = (typeof materialKatalog !== 'undefined' && materialKatalog[m]) ? materialKatalog[m].name : m;
                    mHtml += `<li>${dispName}: <b>${qty}</b></li>`;
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
            <td>${v}</td>
            <td style="color:var(--success);font-weight:800;font-family:monospace;font-size:13px;">$${cash.toLocaleString('de-DE')}</td>
            <td>${mHtml}</td>
            <td style="text-align:right;">${sA ? `<button class="btn-delete-row" onclick="deleteArchivSchicht('${k}')" title="Schicht löschen">🗑️</button>` : '--'}</td>
        </tr>`;
    }).join('');

    if (tfoot) {
        let totalMatHtml = '<ul class="archiv-details-list" style="margin:0;padding-left:14px;color:var(--text-muted);font-size:11px;list-style-type:square;">';
        Object.keys(totalMatObj).sort().forEach(m => {
            totalMatHtml += `<li>${m}: <b style="color:var(--primary);">${totalMatObj[m]}</b></li>`;
        });
        totalMatHtml += '</ul>';

        tfoot.innerHTML = `<tr style="background:rgba(56,189,248,0.1);font-weight:800;border-top:2px solid var(--primary);color:var(--text-main);">
            <td><b style="color:var(--primary);">Gesamtsumme (Historie)</b></td>
            <td style="font-size:13px;color:var(--primary);">${totalP.toLocaleString('de-DE')}</td>
            <td style="font-size:13px;color:var(--warning);">${totalV.toLocaleString('de-DE')}</td>
            <td style="font-size:13px;color:var(--success);font-family:monospace;">$${totalCash.toLocaleString('de-DE')}</td>
            <td>${totalMatHtml}</td>
            <td style="text-align:right;">--</td>
        </tr>`;
    }
}

function openEditModal(key) {
    db.ref('data/protokoll/'+key).once('value',s=>{
        const v=s.val(); if(!v) return;
        document.getElementById('editKey').value=key;
        document.getElementById('editName').value=v.name||'';
        document.getElementById('editSzenario').value=v.szenario||'';
        document.getElementById('editCount').value=v.verletzungen||1;
        document.getElementById('editCash').value=v.kosten||0;
        document.getElementById('editModal').style.display='flex';
    });
}
function closeEditModal() { document.getElementById('editModal').style.display='none'; }
function speicherePatientEdit() {
    const key=document.getElementById('editKey').value; if(!key) return;
    db.ref('data/protokoll/'+key).update({name:document.getElementById('editName').value.trim(),szenario:document.getElementById('editSzenario').value.trim(),verletzungen:parseInt(document.getElementById('editCount').value)||1,kosten:parseInt(document.getElementById('editCash').value)||0}).then(()=>closeEditModal());
}

/* ── Funk, Codes, Links & News ─────────────────────────────── */
function renderGuideTab() {
    _renderGuideSection('guideTenCodesBody',    cachedGuideData.tenCodes);
    _renderGuideSection('guideStatusCodesBody', cachedGuideData.statusCodes);
    _renderGuideSection('guideStreifenBody',     cachedGuideData.streifen);
    _renderGuideKeineRechnung();
}
function _renderGuideSection(id,data) {
    const t=document.getElementById(id) || document.getElementById(id.replace('Body', 'TableBody')); if(!t) return;
    t.innerHTML=!data||!data.length?'<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">-</td></tr>'
        :data.map(i=>`<tr><td class="text-center" style="color:${i.color||'var(--text-main)'};font-weight:800;">${i.code||''}</td><td>${i.desc||''}</td></tr>`).join('');
}
function _renderGuideKeineRechnung() {
    const t=document.getElementById('guideKeineRechnungBody'); if(!t) return;
    const data=cachedGuideData.keineRechnung||[];
    t.innerHTML=!data||!data.length?'<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">Keine Einträge</td></tr>'
        :data.map(i=>`<tr><td colspan="2"><b>${i.name||''}</b>${i.note?` <span style="color:var(--text-muted);font-size:11px;">${i.note}</span>`:''}<br><span style="color:var(--text-muted);font-size:12px;">${i.desc||''}</span></td></tr>`).join('');
}

function renderLinksTab(obj) {
    const cont = document.getElementById('linksAccordionContainer'); if (!cont) return;
    const allLinks = Object.assign({}, defaultLinks, obj || {});
    const kats = [...new Set(Object.values(allLinks).map(l => l.kat || l.thema || 'Allgemein'))].sort();
    allLinkCategories = kats;
    const ak = sessionUser ? getUserAllowedLinkCategories(sessionUser, kats) : kats;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!ak.length) { cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Keine Links freigegeben.</p>'; return; }
    cont.innerHTML = ak.map(kat => {
        const lnks = Object.entries(allLinks).filter(([, l]) => (l.kat || l.thema || 'Allgemein') === kat);
        const rows = lnks.map(([k, l]) => `<tr>
            <td style="width:35%;padding:10px 14px;word-break:break-word;"><a class="link-btn-clickable" href="${l.url||'#'}" target="_blank" rel="noopener">🔗 ${l.name||l.url}</a></td>
            <td style="width:55%;padding:10px 14px;color:var(--text-main);font-size:13px;line-height:1.5;">${l.desc||l.description||'Keine Beschreibung'}</td>
            <td style="width:10%;padding:10px 14px;text-align:right;">${eff.canDelete?`<button class="btn-delete-row" onclick="deleteDienstLink('${k}')">🗑️</button>`:''}</td>
        </tr>`).join('');
        const gId = 'lnk_' + kat.replace(/\W/g, '_');
        return `<div class="theme-accordion-group" id="${gId}" style="margin-bottom:12px;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <div class="theme-accordion-header" onclick="toggleGroupCollapse('${gId}')"><span>📁 ${kat}</span><span style="background:rgba(56,189,248,0.12);padding:2px 10px;border-radius:12px;font-size:11px;">${lnks.length} Links</span></div>
            <div class="theme-accordion-content"><table style="width:100%;"><tbody>${rows||'<tr><td colspan="3">Keine Links</td></tr>'}</tbody></table></div>
        </div>`;
    }).join('');
}

function linkHinzufuegen() {
    if (!sessionUser||!getUserEffectivePermissions(sessionUser).isAdmin) { alert("❌ Nur Admins!"); return; }
    const name=(document.getElementById('linkName')?.value||'').trim(), url=(document.getElementById('linkUrl')?.value||'').trim(), thema=(document.getElementById('linkThema')?.value||'').trim()||"Allgemein";
    if (!name||!url) { alert("Bitte ausfüllen!"); return; }
    db.ref("data/dienstLinks").push({ name, url, kat:thema, thema }).then(()=>{
        document.getElementById('linkName').value=""; document.getElementById('linkUrl').value="";
        alert("✅ Link gespeichert!"); renderAdminGuideContent();
    });
}

function renderCommandsTab(obj) {
    const cont=document.getElementById('commandsAccordionContainer'); if(!cont) return;
    const all=Object.assign({},defaultCommands,obj||{});
    const kats=[...new Set(Object.values(all).map(c=>c.kat||'Allgemein'))].sort();
    allCmdCategories=kats;
    const ak=sessionUser?getUserAllowedCmdCategories(sessionUser,kats):kats;
    const eff=sessionUser?getUserEffectivePermissions(sessionUser):{};
    if(!ak.length){ cont.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:24px;">Keine Commands verfügbar.</p>'; return; }
    cont.innerHTML=ak.map(kat=>{
        const cmds=Object.entries(all).filter(([,c])=>(c.kat||'Allgemein')===kat);
        const rows=cmds.map(([k,c])=>`<tr>
            <td style="width:35%;padding:10px 14px;font-weight:800;color:var(--primary);font-family:monospace;">${c.name||''}</td>
            <td style="width:55%;padding:10px 14px;color:var(--text-main);font-size:13px;">${c.desc||c.description||''}</td>
            <td style="width:10%;padding:10px 14px;text-align:right;">${eff.canDelete?`<button class="btn-delete-row" onclick="deleteDienstCommand('${k}')">🗑️</button>`:''}</td>
        </tr>`).join('');
        const gId='cmd_'+kat.replace(/\W/g,'_');
        return `<div class="theme-accordion-group" id="${gId}" style="margin-bottom:12px;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <div class="theme-accordion-header" onclick="toggleGroupCollapse('${gId}')"><span>⚡ ${kat}</span><span style="background:rgba(56,189,248,0.12);padding:2px 10px;border-radius:12px;font-size:11px;">${cmds.length} Commands</span></div>
            <div class="theme-accordion-content"><table style="width:100%;"><tbody>${rows||'<tr><td colspan="3">Keine Commands</td></tr>'}</tbody></table></div>
        </div>`;
    }).join('');
}

function commandHinzufuegen() {
    if (!sessionUser||!getUserEffectivePermissions(sessionUser).isAdmin) { alert("❌ Nur Admins!"); return; }
    const name=(document.getElementById('cmdName')?.value||'').trim(), desc=(document.getElementById('cmdDesc')?.value||'').trim(), kat=(document.getElementById('cmdKat')?.value||'').trim()||"Allgemein";
    if (!name||!desc) { alert("Bitte ausfüllen!"); return; }
    db.ref("data/dienstCommands").push({ name, desc, kat }).then(()=>{
        document.getElementById('cmdName').value=""; document.getElementById('cmdDesc').value="";
        alert("✅ Command gespeichert!"); renderAdminGuideContent();
    });
}

function bulkCommandsImportieren() {
    if (!sessionUser||!getUserEffectivePermissions(sessionUser).isAdmin) return;
    const raw=document.getElementById('bulkCmdTextarea')?.value||'', fb=document.getElementById('bulkCmdCategoryFallback')?.value||'Allgemein';
    const lines=raw.split('\n'); let p=[];
    lines.forEach(l=>{ const parts=l.split('|').map(s=>s.trim()); if(parts[0]) p.push(db.ref("data/dienstCommands").push({name:parts[0],desc:parts[1]||'',kat:parts[2]||fb})); });
    Promise.all(p).then(()=>{ document.getElementById('bulkCmdTextarea').value=""; alert(`✅ ${p.length} Commands importiert!`); renderAdminGuideContent(); });
}

function renderNewsFeed() {
    const c=document.getElementById('newsFeedList'); if(!c) return;
    if (!c.children.length) c.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:24px;">Lade Schwarzes Brett...</div>';
}
function renderNewsFeedData(obj) {
    const c = document.getElementById('newsFeedList'); if (!c) return;
    const rawNews = Object.assign({}, defaultNews, obj || {});
    const entries = Object.entries(rawNews).filter(([, n]) => !n.deleted && n.title && n.content).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!entries.length) { c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">📭 Keine aktuellen Mitteilungen.</div>'; return; }
    const myKey = sessionUser ? (sessionUser.dn ? ('dn_' + sessionUser.dn) : (sessionUser.vorname + '_' + sessionUser.nachname).replace(/\W/g, '_')) : '';

    c.innerHTML = entries.map(([k, n]) => {
        const readByObj = n.readBy || {};
        const hasRead = myKey && readByObj[myKey];
        return `<div style="background:rgba(15,23,42,0.7);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px;">
            <div style="padding:16px 20px;background:rgba(30,41,59,0.6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div><span style="font-weight:800;font-size:16px;color:var(--primary);">${n.title}</span><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">👤 <b>${n.author||'Klinikleitung'}</b> • 🏷️ ${n.category||'Allgemein'}</div></div>
                <div style="display:flex;gap:8px;align-items:center;">
                    ${hasRead ? '<span style="color:var(--success);font-weight:800;font-size:11px;">✅ Gelesen</span>' : `<button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:11px;" onclick="markNewsAsRead('${k}')">👁️ Als gelesen markieren</button>`}
                    ${eff.canDelete ? `<button class="btn-delete-row" onclick="deleteNews('${k}')">🗑️</button>` : ''}
                </div>
            </div>
            <div style="padding:20px;white-space:pre-wrap;font-size:13px;line-height:1.6;">${n.content}</div>
        </div>`;
    }).join('');
}

function markNewsAsRead(newsId) {
    if (!sessionUser) return;
    const myKey = sessionUser.dn ? ('dn_' + sessionUser.dn) : (sessionUser.vorname + '_' + sessionUser.nachname).replace(/\W/g, '_');
    db.ref('data/news/' + newsId + '/readBy/' + myKey).set({ name: sessionUser.vorname + ' ' + sessionUser.nachname, ts: Date.now() });
}
function togglePostNewsForm() { const e=document.getElementById('postNewsContainer'); if(e) e.style.display=e.style.display==='none'?'block':'none'; }
function speichereNeueNews() {
    if (!sessionUser||!getUserEffectivePermissions(sessionUser).canPostNews) return;
    const t=document.getElementById('newNewsTitle')?.value.trim(), c=document.getElementById('newNewsContent')?.value.trim(), cat=document.getElementById('newNewsCategory')?.value||'Allgemein';
    if (!t||!c) { alert('Bitte Titel und Inhalt eingeben!'); return; }
    db.ref('data/news').push({title:t,content:c,category:cat,author:sessionUser.vorname+' '+sessionUser.nachname,ts:Date.now()}).then(()=>{
        document.getElementById('newNewsTitle').value=''; document.getElementById('newNewsContent').value=''; togglePostNewsForm();
    });
}
function deleteNews(k) { if(sessionUser&&getUserEffectivePermissions(sessionUser).canDelete&&confirm('Löschen?')) db.ref('data/news/'+k).remove(); }

/* ── Material & Preise UI ──────────────────────────────────── */
function baueMaterialUIAuf() {
    const grid=document.getElementById('dynamischerMaterialVerbrauchGrid'); if(!grid) return;
    grid.innerHTML='';
    let hL='<div>',hR='<div>',cnt=0;
    const keys=Object.keys(materialKatalog).filter(k=>k!=='mat_wasser'), half=Math.ceil(keys.length/2);
    keys.forEach(k=>{
        const q=fallMaterial[k]||0;
        const h=`<label style="margin-top:4px;">${materialKatalog[k].name} ($${materialKatalog[k].preis})</label><div class="counter-group"><button class="counter-btn" onclick="stepMat('${k}',-1)">-</button><span class="counter-value" id="val_${k}">${q}</span><button class="counter-btn plus-main" onclick="stepMat('${k}',1)">+</button></div>`;
        if(cnt<half) hL+=h; else hR+=h; cnt++;
    });
    grid.innerHTML=hL+'</div>'+hR+'</div>';
    const wP=document.getElementById('wasserPreisLabel'); if(wP) wP.textContent='$'+materialKatalog.mat_wasser.preis;
}

function bauePreiseEinstellungenUI() {
    const c = document.getElementById('preiseEinstellungsContainer'); if (!c) return;
    c.innerHTML = Object.keys(materialKatalog).map(k => `
        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
            <div style="font-weight:700;">📦 ${materialKatalog[k].name}:</div>
            <div style="display:flex;align-items:center;gap:6px;"><input type="number" style="width:90px;padding:6px;" id="setPrice_${k}" value="${materialKatalog[k].preis}"><b style="color:var(--success);">$</b></div>
        </div>
    `).join('');
}
function speicherePreise() {
    if (!sessionUser||!getUserEffectivePermissions(sessionUser).isAdmin) return;
    const p={};
    Object.keys(materialKatalog).forEach(k=>{ const e=document.getElementById('setPrice_'+k); if(e){p[k]=parseInt(e.value)||materialKatalog[k].preis; materialKatalog[k].preis=p[k];} });
    db.ref('data/materialPreise').set(p).then(()=>{ baueMaterialUIAuf(); alert('Preise gespeichert!'); });
}
function ladeSzenarioTemplateInSettings() {
    const s=document.getElementById('templateSzenarioSelect'),c=document.getElementById('templateMaterialsContainer'); if(!s||!c) return;
    const tpl=szenarioTemplates[s.value]||{}; c.innerHTML='';
    Object.keys(materialKatalog).filter(k=>k!=='mat_wasser').forEach(k=>{ c.innerHTML+=`<div class="setting-row"><span>${materialKatalog[k].name}:</span><input type="number" style="width:70px;" id="setTpl_${k}" value="${tpl[k]||0}" min="0"></div>`; });
}
function speichereSzenarioTemplate() {
    const s=document.getElementById('templateSzenarioSelect'); if(!s||!s.value) return;
    if(!szenarioTemplates[s.value]) szenarioTemplates[s.value]={};
    Object.keys(materialKatalog).filter(k=>k!=='mat_wasser').forEach(k=>{ const e=document.getElementById('setTpl_'+k), v=e?parseInt(e.value)||0:0; if(v>0) szenarioTemplates[s.value][k]=v; else delete szenarioTemplates[s.value][k]; });
    db.ref('data/szenarioTemplates').set(szenarioTemplates).then(()=>alert('Voreinstellungen gespeichert!'));
}

/* ── Hierarchie Board ──────────────────────────────────────── */
function renderHierarchieBoard(hData) {
    if(!hData) return;
    hierarchieDaten=Object.assign({},hierarchieDaten,hData);
    Object.keys(hierarchieDaten).forEach(key=>{
        let val=hierarchieDaten[key];
        const d=document.getElementById('disp_h_'+key);
        if(d) {
            if(key.endsWith('_sub')){ d.textContent=(val&&val!=='--')?val:''; d.style.display=(val&&val!=='--')?'inline-block':'none'; }
            else { d.textContent=(val&&val!=='#REF!')?val:'Aktuell nicht belegt'; }
        }
        const i=document.getElementById('inp_h_'+key);
        if(i&&document.activeElement!==i) i.value=(val!=='Aktuell nicht belegt'&&val!=='#REF!')?val:'';
    });
}
function speichereHierarchieDaten() {
    if(!sessionUser||!getUserEffectivePermissions(sessionUser).isAdmin) return;
    Object.keys(hierarchieDaten).forEach(k=>{ const e=document.getElementById('inp_h_'+k); if(e) hierarchieDaten[k]=e.value.trim()||'Aktuell nicht belegt'; });
    db.ref('data/hierarchie').set(hierarchieDaten).then(()=>alert('Hierarchie gespeichert!'));
}

/* ── Admin Management Modal ────────────────────────────────── */
function openAdminKeyModal() {
    const eff=sessionUser?getUserEffectivePermissions(sessionUser):{};
    if(!eff.isAdmin&&!eff.isMasterAdmin) return;
    const pi=document.getElementById('adminAuthPassInput'); if(pi) pi.value='';
    const m=document.getElementById('adminAuthModal'); if(m){m.style.display='flex'; renderAdminAuditLogs(); renderAdminRolesList(); bauePreiseEinstellungenUI(); if(pi) pi.focus();}
}
function closeAdminAuthModal() { const m=document.getElementById('adminAuthModal'); if(m) m.style.display='none'; }
function verifyAdminKeyPassword() {
    const p=(document.getElementById('adminAuthPassInput')?.value||'').trim();
    if (p===sessionUser.pass || (sessionUser.vorname==='Tim'&&sessionUser.nachname==='Sanddorn'&&p==='0815')) {
        closeAdminAuthModal();
        const m=document.getElementById('adminManagementModal'); if(m) m.style.display='flex';
        updateAdminModalTabVisibility(getUserEffectivePermissions(sessionUser));
        bauePreiseEinstellungenUI(); ladeSzenarioTemplateInSettings();
        db.ref('data/users').once('value',s=>{ if(s.val()) renderAdminUserTable(s.val()); });
        renderAdminRolesList(); renderAdminGuideContent();
    } else alert('Falsches Passwort!');
}
function closeAdminManagementModal() { const m=document.getElementById('adminManagementModal'); if(m) m.style.display='none'; }
function updateAdminModalTabVisibility(eff) {
    const ids=['btnAdminSubUsers','btnAdminSubRoles','btnAdminSubContent','btnAdminSubHierarchy','btnAdminSubPrices','btnAdminSubSystem','btnAdminSubAudit'];
    ids.forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display=(eff.isMasterAdmin || id!=='btnAdminSubRoles')?'':'none'; });
}

function renderAdminUserTable(obj) {
    const tbody = document.getElementById('adminUserTableBody'); if (!tbody) return;
    cachedUsers = obj || {};
    tbody.innerHTML = Object.entries(cachedUsers).sort((a, b) => (a[1].nachname || '').localeCompare(b[1].nachname || '')).map(([uId, u]) => `
        <tr>
            <td colspan="4" style="padding:10px;border-bottom:1px solid var(--border);">
                <div style="background:rgba(15,23,42,0.6);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div><b>${u.vorname||''} ${u.nachname||''}</b> <span style="color:var(--primary);font-size:11px;">(${u.dn||'Keine DN'})</span> - <span style="color:${u.status==='approved'?'var(--success)':'var(--danger)'};font-weight:700;">${u.status==='approved'?'✅ Aktiv':'⛔ Gesperrt'}</span></div>
                    <div style="display:flex;gap:6px;">
                        ${u.status !== 'approved' ? `<button class="btn" style="width:auto;padding:5px 12px;font-size:11px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveUser('${uId}')">✅ Freischalten</button>` : `<button class="btn" style="width:auto;padding:5px 12px;font-size:11px;background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);" onclick="revokeUser('${uId}')">⛔ Sperren</button>`}
                        <button class="btn" style="width:auto;padding:5px 12px;font-size:11px;" onclick="openAssignRolesModal('${uId}','${u.vorname} ${u.nachname}')">🎭 Rollen</button>
                        <button class="btn" style="width:auto;padding:5px 12px;font-size:11px;background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid #a855f7;" onclick="openUserPermissionsModal('${uId}')">🔑 Rechte</button>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
}

function approveUser(uId) {
    db.ref('data/users/'+uId+'/status').set('approved').then(()=>{
        if (cachedUsers[uId]) cachedUsers[uId].status = 'approved';
        aktualisiereAdminVerwaltung();
        renderInstructorAllowedExams(cachedUsers, cachedExams);
        alert('✅ Mitarbeiter freigeschaltet!');
    });
}
function revokeUser(uId) {
    if(confirm('Mitarbeiter wirklich sperren?')) {
        db.ref('data/users/'+uId+'/status').set('revoked').then(()=>{
            if (cachedUsers[uId]) cachedUsers[uId].status = 'revoked';
            aktualisiereAdminVerwaltung();
            renderInstructorAllowedExams(cachedUsers, cachedExams);
            alert('⛔ Mitarbeiter gesperrt!');
        });
    }
}
function aktualisiereAdminVerwaltung() { db.ref('data/users').once('value',s=>{ if(s.val()) renderAdminUserTable(s.val()); }); }

/* ── Rollen Manager ────────────────────────────────────────── */
function renderAdminRolesList() {
    const sb=document.getElementById('adminRolesSidebarList'); if(!sb) return;
    sb.innerHTML=Object.values(cachedRoles).map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1px solid ${r.color||'#38bdf8'}33;background:${r.color||'#38bdf8'}0d;cursor:pointer;" onclick="selectRole('${r.id}')"><span>${r.icon||''}</span><b style="color:${r.color||'#38bdf8'};">${r.name}</b></div>`).join('');
}
function selectRole(roleId) {
    const r=cachedRoles[roleId]; if(!r) return;
    document.getElementById('editingRoleId').value=roleId;
    document.getElementById('roleEditName').value=r.name||'';
    document.getElementById('roleEditColor').value=r.color||'#38bdf8';
    document.getElementById('roleEditIcon').value=r.icon||'';
    ['roleFlagAdmin','roleFlagDelete','roleFlagInstructor','roleFlagManageInstructors','roleFlagMasterAdmin','roleFlagPostNews'].forEach(id=>{ const prop=id.replace('roleFlag',''); const p=prop.charAt(0).toLowerCase()+prop.slice(1); document.getElementById(id).checked=!!r[p]||!!r['is'+prop]||!!r['can'+prop]; });
    updateRoleBadgePreview();
}
function updateRoleBadgePreview() {
    const n=document.getElementById('roleEditName')?.value||'Rolle', c=document.getElementById('roleEditColor')?.value||'#38bdf8', i=document.getElementById('roleEditIcon')?.value||'';
    const p=document.getElementById('editingRoleBadgePreview'); if(!p) return;
    p.textContent=`${i} ${n}`.trim(); p.style.color=c; p.style.background=c+'22'; p.style.border=`1px solid ${c}44`;
}
function neueRolleErstellen() { document.getElementById('editingRoleId').value='role_'+Date.now(); document.getElementById('roleEditName').value=''; updateRoleBadgePreview(); }
function speichereRolle() {
    const id=document.getElementById('editingRoleId')?.value; if(!id) return;
    const r={id,name:document.getElementById('roleEditName')?.value.trim()||id,color:document.getElementById('roleEditColor')?.value||'#38bdf8',icon:document.getElementById('roleEditIcon')?.value.trim()||'',isAdmin:!!document.getElementById('roleFlagAdmin')?.checked,canDelete:!!document.getElementById('roleFlagDelete')?.checked,isInstructor:!!document.getElementById('roleFlagInstructor')?.checked,canManageInstructors:!!document.getElementById('roleFlagManageInstructors')?.checked,isMasterAdmin:!!document.getElementById('roleFlagMasterAdmin')?.checked,canPostNews:!!document.getElementById('roleFlagPostNews')?.checked};
    db.ref('data/roles/'+id).set(r).then(()=>{ cachedRoles[id]=r; renderAdminRolesList(); alert('Rolle gespeichert!'); });
}
function loescheRolle() {
    const id=document.getElementById('editingRoleId')?.value;
    if(id&&confirm('Löschen?')) db.ref('data/roles/'+id).remove().then(()=>{ delete cachedRoles[id]; renderAdminRolesList(); });
}
function openAssignRolesModal(uId,name) {
    const m=document.getElementById('assignRolesModal'); if(!m) return;
    document.getElementById('assignRoleUserId').value=uId; document.getElementById('assignRoleUserName').textContent=name;
    const u=cachedUsers[uId]||{}, rids=getUserRolesList(u);
    document.getElementById('assignRolesContainer').innerHTML=Object.values(cachedRoles).map(r=>`<label style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;"><input type="checkbox" ${rids.includes(r.id)?'checked':''} id="assignRole_${r.id}"><b style="color:${r.color||'#38bdf8'};">${r.icon||''} ${r.name}</b></label>`).join('');
    m.style.display='flex';
}
function closeAssignRolesModal() { const m=document.getElementById('assignRolesModal'); if(m) m.style.display='none'; }
function saveAssignedRoles() {
    const uId=document.getElementById('assignRoleUserId')?.value; if(!uId) return;
    const nr={}; Object.keys(cachedRoles).forEach(rId=>{ const e=document.getElementById('assignRole_'+rId); if(e&&e.checked) nr[rId]=true; });
    db.ref('data/users/'+uId+'/roles').set(nr).then(()=>{ closeAssignRolesModal(); aktualisiereAdminVerwaltung(); alert('Rollen gespeichert!'); });
}

function openUserPermissionsModal(uId) {
    const m=document.getElementById('userPermissionsModal'); if(!m) return;
    const u=cachedUsers[uId]||{};
    (document.getElementById('permUserId')||document.getElementById('permModalUserId')).value=uId;
    document.getElementById('permVorname').value=u.vorname||'';
    document.getElementById('permNachname').value=u.nachname||'';
    document.getElementById('permDN').value=u.dn||'';
    document.getElementById('permStatus').value=u.status||'approved';
    document.getElementById('permPassword').value=u.pass||'';
    m.style.display='flex';
}
function closeUserPermissionsModal() { const m=document.getElementById('userPermissionsModal'); if(m) m.style.display='none'; }
function saveUserPermissions() {
    const uId=(document.getElementById('permUserId')||document.getElementById('permModalUserId'))?.value; if(!uId) return;
    const upd={
        vorname:document.getElementById('permVorname').value.trim(),
        nachname:document.getElementById('permNachname').value.trim(),
        dn:document.getElementById('permDN').value.trim(),
        status:document.getElementById('permStatus').value,
        pass:document.getElementById('permPassword').value.trim()
    };
    db.ref('data/users/'+uId).update(upd).then(()=>{ closeUserPermissionsModal(); aktualisiereAdminVerwaltung(); alert('Gespeichert!'); });
}

/* ── Guide CMS & Admin Subtabs ─────────────────────────────── */
function renderAdminGuideContent() {
    _renderAdminGuideSection('adminTenCodesTableBody', cachedGuideData.tenCodes, 'tenCodes');
    _renderAdminGuideSection('adminStatusCodesTableBody', cachedGuideData.statusCodes, 'statusCodes');
    _renderAdminGuideSection('adminStreifenTableBody', cachedGuideData.streifen, 'streifen');
    _renderAdminGuideSection('adminKeineRechnungBody', cachedGuideData.keineRechnung, 'keineRechnung');
}
function _renderAdminGuideSection(id,data,sec) {
    const t=document.getElementById(id)||document.getElementById(id.replace('Body','TableBody')); if(!t) return;
    t.innerHTML=!data||!data.length?'<tr><td colspan="4">Keine Einträge</td></tr>'
        :data.map(i=>`<tr><td><b>${i.code||i.name||''}</b></td><td>${i.desc||''}</td><td>${i.color||i.note||''}</td><td style="text-align:right;"><button class="btn-delete-row" onclick="deleteGuideItem('${sec}','${i.id}')">🗑️</button></td></tr>`).join('');
}
function deleteGuideItem(sec,iid) {
    if(confirm('Löschen?')&&cachedGuideData[sec]) {
        cachedGuideData[sec]=cachedGuideData[sec].filter(i=>i.id!==iid);
        db.ref('data/guide/'+sec).set(cachedGuideData[sec]).then(()=>{ renderGuideTab(); renderAdminGuideContent(); });
    }
}

/* ── Schicht & Backup ──────────────────────────────────────── */
function schichtAbschliessen() {
    if(!sessionUser||!getUserEffectivePermissions(sessionUser).isAdmin) return;
    if(!confirm('Schicht abschließen?')) return;
    db.ref('data/protokoll').once('value',s=>{
        const p=s.val()||{}, e=Object.values(p); if(!e.length){ alert('Keine Einsätze.'); return; }
        let tP=e.length, tV=0, tA=0, tm={};
        e.forEach(x=>{ tV+=x.verletzungen||0; tA+=x.kosten||0; Object.keys(x.material||{}).forEach(k=>{ tm[k]=(tm[k]||0)+(x.material[k]||0); }); });
        db.ref('data/archiv').push({datum:new Date().toLocaleDateString('de-DE'),patienten:tP,verletzungen:tV,ausgaben:tA,material:tm,ts:Date.now()}).then(()=>{
            db.ref('data/protokoll').remove().then(()=>alert('✅ Schicht archiviert!'));
        });
    });
}
function vollstaendigerReset() {
    if(sessionUser&&getUserEffectivePermissions(sessionUser).isMasterAdmin&&confirm('ACHTUNG: Alles löschen?')&&confirm('Wirklich alles löschen?')) {
        db.ref('data').remove().then(()=>location.reload());
    }
}
function exportArchivCSV() {
    db.ref('data/archiv').once('value',s=>{
        const a=s.val()||{}, e=Object.entries(a); if(!e.length) return;
        let csv='Datum,Patienten,Verletzungen,Ausgaben\n';
        e.forEach(([,v])=>{ csv+=`"${v.datum||''}","${v.patienten||0}","${v.verletzungen||0}","$${v.ausgaben||0}"\n`; });
        const b=new Blob([csv],{type:'text/csv;charset=utf-8;'}), u=URL.createObjectURL(b), el=document.createElement('a');
        el.href=u; el.download='Archiv.csv'; el.click();
    });
}
function downloadSystemBackup() {
    db.ref('data').once('value', s => {
        const json = JSON.stringify(s.val() || {}, null, 2);
        const b = new Blob([json], { type: 'application/json' }), el = document.createElement('a');
        el.href = URL.createObjectURL(b); el.download = 'MMD_Backup.json'; el.click();
    });
}
function restoreSystemBackupFromFile(event) {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            db.ref('data').update(data.data ? data.data : data).then(() => { alert('✅ Backup eingespielt!'); location.reload(); });
        } catch(err) { alert('Fehler: ' + err.message); }
    };
    reader.readAsText(file);
}

function renderAdminAuditLogs() {
    db.ref('data/auditLogs').once('value', s => renderAdminAuditLogsData(s.val()||{}));
}
function renderAdminAuditLogsData(logsObj) {
    const tbody = document.getElementById('adminAuditLogTableBody'); if (!tbody) return;
    const entries = Object.entries(logsObj).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));
    tbody.innerHTML = !entries.length ? '<tr><td colspan="4" style="text-align:center;">Keine Protokolle.</td></tr>'
        : entries.map(([, l]) => `<tr><td style="font-size:11px;">📅 ${l.ts ? new Date(l.ts).toLocaleString('de-DE') : '-'}</td><td><b>${l.admin||'System'}</b></td><td><span style="color:var(--primary);">${l.action||'-'}</span></td><td>${l.details||'-'}</td></tr>`).join('');
}

/* ══════════════════════════════════════════════════════════════
   AUSBILDUNGS- & PRÜFUNGSBEREICH (SORTIERUNG & LIVE-UPDATE)
══════════════════════════════════════════════════════════════ */

// Strikte Sortierreihenfolge laut Vorgabe:
// GA1 -> GA2 -> DV -> Para 1 -> Para 2 -> Para 3 -> Arzt 1 -> Arzt 2 -> Arzt 3
function sortExamIds(ids, map) {
    const priority = ['exam_ga1', 'exam_ga2', 'exam_dv', 'exam_para1', 'exam_para2', 'exam_para3', 'exam_arzt1', 'exam_arzt2', 'exam_arzt3'];
    return ids.sort((a, b) => {
        let ia = priority.indexOf(a);
        let ib = priority.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        if (ia !== ib) return ia - ib;
        return ((map[a]?.title || '').toLowerCase()).localeCompare((map[b]?.title || '').toLowerCase());
    });
}

function ensureExamHasDefaultHeaderFields(exam) {
    if(!exam||!exam.questions) return exam;
    if(!Array.isArray(exam.questions)){ try{ exam.questions=Object.values(exam.questions); }catch(e){} }
    if(!Array.isArray(exam.questions)) return exam;
    let hasDN=exam.questions.some(q=>q.type==='info_dn');
    let haPr=exam.questions.some(q=>q.type==='info_pruefer');
    let haN=exam.questions.some(q=>q.type==='info_name');
    let nq=[];
    if(!hasDN) nq.push({type:'info_dn',text:'Dienstnummer des Mitarbeiters',options:[]});
    if(!haPr)  nq.push({type:'info_pruefer',text:'Dienstnummer des Prüfers',options:[]});
    if(!haN)   nq.push({type:'info_name',text:'Vor- und Nachname des Mitarbeiters',options:[]});
    if(nq.length) exam.questions=[...nq,...exam.questions];
    exam.questions.forEach((q,i)=>{ q.id=i+1; if(!q.type) q.type='choice'; if(q.type==='choice'&&(!q.correctAnswers||!q.correctAnswers.length)) q.correctAnswers=[0]; });
    return exam;
}

function renderExamTab() {
    Object.keys(cachedExams).forEach(id=>{ cachedExams[id]=ensureExamHasDefaultHeaderFields(cachedExams[id]); });
    const iv=document.getElementById('examInstructorView');
    if(iv) {
        if(isUserInstructor()) {
            iv.style.display='block';
            renderInstructorUnlocks(cachedUsers, cachedExams);
            renderInstructorSubmissions(cachedSubmissions);
            renderInstructorExistingExams(cachedExams);
            renderInstructorAllowedExams(cachedUsers, cachedExams);
        } else iv.style.display='none';
    }
    renderStudentUnlockedExams();
}

function renderStudentUnlockedExams(uId, pObj, uObj) {
    const c = document.getElementById('studentUnlockedExamsContainer') || document.getElementById('studentUnlockedExamsList');
    if (!c) return;
    const exams = cachedExams || {};
    const validIds = Object.keys(exams).filter(k => exams[k] && !exams[k].deleted);
    if (!validIds.length) { c.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">Keine Prüfungen hinterlegt.</div>'; return; }

    const user = (uId && cachedUsers[uId]) || sessionUser || {};
    pObj = pObj || user.passedExams || {};
    uObj = uObj || user.unlockedExams || {};
    const subHistory = user.examSubmissions || {};

    const sortedIds = sortExamIds(validIds, exams);
    c.innerHTML = sortedIds.map(eid => {
        const ex = exams[eid];
        const isPassed = !!pObj[eid], isU = !!uObj[eid];
        const mySubs = Object.values(subHistory).filter(s => s.examId === eid);
        const best = mySubs.length ? mySubs.reduce((prev, curr) => (prev.percentage > curr.percentage) ? prev : curr) : null;

        let sb = '', ab = '', completedDetailsHtml = '';
        if (isPassed) {
            sb = `<span style="background:rgba(16,185,129,0.15);color:var(--success);border:1px solid var(--success);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;">✅ Bestanden${best ? ` (${best.percentage}%)` : ''}</span>`;
            completedDetailsHtml = `<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:10px 14px;margin-top:12px;font-size:12px;">Ergebnis: <b style="color:var(--success);">${best ? best.percentage : 100}%</b></div>`;
        } else if (isU) {
            sb = '<span style="background:rgba(56,189,248,0.15);color:var(--primary);border:1px solid var(--primary);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;">⚡ Bereit zur Prüfung</span>';
            ab = `<button class="btn" style="background:var(--primary);color:#080c14;font-weight:800;margin-top:14px;" onclick="startExam('${eid}')">📝 Prüfung starten</button>`;
        } else {
            sb = '<span style="background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;">🔒 Gesperrt</span>';
            ab = '<div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.25);padding:10px 14px;border-radius:8px;text-align:center;font-size:12px;color:var(--danger);font-weight:700;margin-top:14px;">⛔ Bitte an Ausbildungsleitung wenden.</div>';
        }

        return `<div class="exam-card ${isPassed?'completed':(isU?'unlocked':'locked')}" style="padding:16px;border-radius:14px;background:rgba(15,23,42,0.7);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:11px;color:var(--primary);font-weight:800;text-transform:uppercase;">${ex.kat||'Allgemein'}</span>
                ${sb}
            </div>
            <h4 style="margin:4px 0 8px 0;font-size:15px;color:var(--text-main);">${ex.title}</h4>
            <div style="font-size:12px;color:var(--text-muted);">⏱️ ${ex.timeLimitMinutes||30} Min • ❓ ${ex.questions?ex.questions.length:0} Fragen • 🎯 Mindestquote: ${ex.passPercentage||60}%</div>
            ${completedDetailsHtml}
            ${ab}
        </div>`;
    }).join('');
}

// Aktualisierungsbutton-Funktion für den Reiter "Prüfungen freischalten"
function aktualisierePruefungsFreischaltungen() {
    db.ref('data/users').once('value', us => {
        cachedUsers = us.val() || {};
        renderInstructorUnlocks(cachedUsers, cachedExams);
        alert('✅ Mitarbeiter-Freischaltungen aktualisiert!');
    });
}

function renderInstructorUnlocks(users, exams) {
    const tbody = document.getElementById('instructorUserUnlocksTableBody'); if (!tbody || !users) return;
    tbody.innerHTML = '';
    const sortedExamIds = sortExamIds(Object.keys(exams).filter(k => exams[k] && !exams[k].deleted), exams);

    Object.entries(users).sort((a, b) => (a[1].nachname || '').localeCompare(b[1].nachname || '')).forEach(([uId, u]) => {
        const unlocked = u.unlockedExams || {}, passedMap = u.passedExams || {};
        const checkboxes = sortedExamIds.map(eId => {
            const ex = exams[eId]; if (!ex) return '';
            return `<div style="display:flex;flex-direction:column;gap:3px;padding:6px 10px;background:rgba(30,41,59,0.6);border:1px solid ${unlocked[eId]?'rgba(56,189,248,0.4)':'var(--border)'};border-radius:8px;min-width:170px;">
                <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ex.title}</div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:10px;color:var(--primary);cursor:pointer;"><input type="checkbox" ${unlocked[eId]?'checked':''} onchange="toggleExamUnlockForUser('${uId}','${eId}',this.checked)"> Freigabe</label>
                    <label style="font-size:10px;color:var(--success);cursor:pointer;"><input type="checkbox" ${passedMap[eId]?'checked':''} onchange="toggleExamPassedForUser('${uId}','${eId}',this.checked)"> Bestanden</label>
                </div>
            </div>`;
        }).join('');

        tbody.innerHTML += `<tr>
            <td style="width:220px;vertical-align:top;padding:10px;"><b>${u.vorname||''} ${u.nachname||''}</b><br><span style="color:var(--primary);font-size:11px;">DN: ${u.dn||'--'}</span></td>
            <td style="width:100px;vertical-align:top;padding:10px;color:var(--text-muted);">${u.date||'--'}</td>
            <td style="vertical-align:top;padding:10px;"><div style="display:flex;flex-wrap:wrap;gap:6px;">${checkboxes||'Keine'}</div></td>
        </tr>`;
    });
}

function toggleExamUnlockForUser(uId, examId, isUnlocked) {
    db.ref(`data/users/${uId}/unlockedExams/${examId}`).set(isUnlocked);
}
function toggleExamPassedForUser(uId, examId, isPassed) {
    db.ref(`data/users/${uId}/passedExams/${examId}`).set(isPassed);
}

// Kompakteres Kacheldesign für Prüfungskatalog & dauerhaftes Löschen
function renderInstructorExistingExams(exams) {
    const c = document.getElementById('instructorExistingExamsList') || document.getElementById('instructorExamsList');
    if (!c) return;
    const validIds = Object.keys(exams).filter(k => exams[k] && !exams[k].deleted);
    if (!validIds.length) { c.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">Keine Prüfungen vorhanden.</div>'; return; }

    const sortedIds = sortExamIds(validIds, exams);
    c.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;margin-top:10px;">` +
        sortedIds.map(k => {
            const e = exams[k];
            return `<div style="background:rgba(15,23,42,0.8);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                <div>
                    <div style="font-size:10px;color:var(--primary);font-weight:800;text-transform:uppercase;">${e.kat||'Allgemein'}</div>
                    <h5 style="margin:4px 0 6px 0;font-size:14px;color:var(--text-main);">${e.title||'Ohne Titel'}</h5>
                    <div style="font-size:11px;color:var(--text-muted);">⏱️ ${e.timeLimitMinutes||30} Min • ❓ ${e.questions?e.questions.length:0} Fragen • 🎯 ${e.passPercentage||60}%</div>
                </div>
                <div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">
                    <button class="btn" style="width:auto;margin:0;padding:5px 10px;font-size:11px;" onclick="editExam('${k}')">✏️ Bearbeiten</button>
                    <button class="btn-delete-row" style="margin:0;padding:5px 8px;font-size:13px;" onclick="deleteExam('${k}')" title="Prüfung dauerhaft löschen">🗑️</button>
                </div>
            </div>`;
        }).join('') + `</div>`;
}

// Dauerhaftes Löschen von Prüfungen (wird in Firebase als gelöscht markiert und respawnt nie wieder)
function deleteExam(eid) {
    if (!confirm('Soll diese Prüfung wirklich unwiderruflich aus dem System gelöscht werden?')) return;
    db.ref('data/exams/' + eid).set({ deleted: true }).then(() => {
        delete cachedExams[eid];
        renderInstructorExistingExams(cachedExams);
        renderStudentUnlockedExams();
        logAdminAudit('Prüfung gelöscht', `ID: ${eid} von ${sessionUser.vorname} ${sessionUser.nachname}`);
        alert('✅ Prüfung dauerhaft gelöscht.');
    });
}

// Ausbildungsleitung Bereich mit Freischalten & Sperren Buttons
function renderInstructorAllowedExams(users, exams) {
    const mt = document.getElementById('instructorMembersApprovalTableBody');
    if (mt && users) {
        mt.innerHTML = Object.entries(users).sort((a, b) => (a[1].nachname || '').localeCompare(b[1].nachname || '')).map(([uId, u]) => `
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
                        <button class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:11px;" onclick="openAssignRolesModal('${uId}','${u.vorname} ${u.nachname}')">🎭 Rollen</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function renderInstructorSubmissions(subs) {
    const t = document.getElementById('instructorSubmissionsTableBody'); if (!t) return;
    const ee = Object.entries(subs||{}).sort((a,b)=>(b[1].ts||0)-(a[1].ts||0));
    t.innerHTML = !ee.length ? '<tr><td colspan="8" style="text-align:center;padding:24px;">Keine Prüfungsergebnisse.</td></tr>'
        : ee.map(([subId, sub]) => `<tr>
            <td style="font-size:11px;color:var(--text-muted);">${sub.datum||'--'}</td>
            <td><b>${sub.userName||'--'}</b> <span style="color:var(--primary);font-size:11px;">(${sub.userDN||'--'})</span></td>
            <td><span style="color:var(--warning);font-size:11px;">${sub.prueferDN||'--'}</span></td>
            <td style="font-weight:700;color:var(--primary);">${sub.examTitle||'--'}</td>
            <td style="font-family:monospace;color:var(--warning);">${sub.durationFormatted||'--'}</td>
            <td><b>${sub.percentage||0}%</b></td>
            <td><span style="color:${sub.passed?'var(--success)':'var(--danger)'};font-weight:800;">${sub.passed?'✅ Bestanden':'⛔ Nicht bestanden'}</span></td>
            <td><button class="btn-delete-row" onclick="deleteExamSubmission('${subId}')">🗑️</button></td>
        </tr>`).join('');
}

function deleteExamSubmission(k) {
    if(confirm('Ergebnis löschen?')) db.ref('data/examSubmissions/'+k).remove();
}

function startExam(eid) {
    const ex=cachedExams[eid]; if(!ex||!ex.questions) return;
    activeExam={id:eid,exam:ex}; activeExamSecondsElapsed=0;
    clearInterval(activeExamTimerInterval);
    activeExamTimerInterval=setInterval(()=>{
        activeExamSecondsElapsed++;
        const m=Math.floor(activeExamSecondsElapsed/60).toString().padStart(2,'0'), s=(activeExamSecondsElapsed%60).toString().padStart(2,'0');
        const tEl=document.getElementById('activeExamTimerDisplay'); if(tEl) tEl.textContent=`${m}:${s}`;
    },1000);
    document.getElementById('activeExamTitle').textContent=ex.title||'Prüfung';
    renderActiveExamQuestions(ex);
    document.getElementById('activeExamContainer').style.display='block';
    document.getElementById('studentUnlockedExamsContainer').style.display='none';
    window.scrollTo({top:0,behavior:'smooth'});
}

function renderActiveExamQuestions(ex) {
    const c=document.getElementById('activeExamQuestionsContainer'); if(!c) return;
    c.innerHTML=ex.questions.map((q,idx)=>{
        if(['info_dn','info_pruefer','info_name'].includes(q.type)) {
            return `<div class="exam-q-box"><p style="font-weight:800;margin:0 0 8px 0;">ℹ️ ${q.text}</p><input type="text" id="q_${idx}" placeholder="${q.text}"></div>`;
        }
        return `<div class="exam-q-box"><p style="font-weight:800;margin:0 0 8px 0;">❓ Frage ${idx+1}: ${q.text}</p>${(q.options||[]).map((o,oIdx)=>`<label class="exam-opt-label"><input type="radio" name="q_${idx}" id="q_${idx}_${oIdx}" value="${oIdx}">${o}</label>`).join('')}</div>`;
    }).join('');
}

function cancelActiveExam() {
    clearInterval(activeExamTimerInterval); activeExam=null;
    document.getElementById('activeExamContainer').style.display='none';
    document.getElementById('studentUnlockedExamsContainer').style.display='block';
}

function submitActiveExam() {
    if(!activeExam) return;
    clearInterval(activeExamTimerInterval);
    const ex=activeExam.exam, eid=activeExam.id;
    let tp=0, ep=0;
    ex.questions.forEach((q,idx)=>{
        if(['info_dn','info_pruefer','info_name'].includes(q.type)) return;
        tp++;
        const ca=q.correctAnswers||[0];
        (q.options||[]).forEach((_,oIdx)=>{
            const el=document.getElementById(`q_${idx}_${oIdx}`);
            if(el&&el.checked&&ca.includes(oIdx)) ep++;
        });
    });
    const pct=tp>0?Math.round((ep/tp)*100):0, passed=pct>=(ex.passPercentage||60);
    const myId=(sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'');
    const m=Math.floor(activeExamSecondsElapsed/60).toString().padStart(2,'0'), s=(activeExamSecondsElapsed%60).toString().padStart(2,'0');

    db.ref('data/examSubmissions').push({
        examId: eid, examTitle: ex.title, userId: myId, userName: sessionUser.vorname+' '+sessionUser.nachname,
        userDN: sessionUser.dn||'Keine DN', percentage: pct, passed: passed, durationFormatted: `${m}:${s} Min`, datum: new Date().toLocaleDateString('de-DE'), ts: Date.now()
    }).then(()=>{
        if(passed) db.ref(`data/users/${myId}/passedExams/${eid}`).set(true);
        alert(passed ? `🎉 Bestanden mit ${pct}%!` : `❌ Leider nicht bestanden (${pct}%).`);
        cancelActiveExam();
    });
}

function resetExamBuilderForm() {
    _examBuilderQuestions=[];
    ['newExamTitle','newExamKat','newExamIntroText','editingExamId'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    refreshExamQuestionsDisplay();
}
function addExamQuestionRow(qData) {
    _examBuilderQuestions.push(qData||{type:'choice',text:'',options:['','',''],correctAnswers:[0]});
    refreshExamQuestionsDisplay();
}
function refreshExamQuestionsDisplay() {
    const c=document.getElementById('examQuestionsListBuilder'); if(!c) return;
    c.innerHTML=_examBuilderQuestions.map((q,idx)=>`
        <div style="background:rgba(15,23,42,0.6);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><b>Frage ${idx+1}</b><button class="btn-delete-row" onclick="_examBuilderQuestions.splice(${idx},1);refreshExamQuestionsDisplay();">🗑️</button></div>
            <input type="text" value="${q.text||''}" onchange="_examBuilderQuestions[${idx}].text=this.value" placeholder="Fragetext...">
        </div>
    `).join('');
}
function neuePruefungSpeichern() {
    const t=document.getElementById('newExamTitle')?.value.trim(); if(!t){ alert('Titel fehlt!'); return; }
    const sid=document.getElementById('editingExamId')?.value||('exam_'+Date.now());
    const exData={title:t,kat:document.getElementById('newExamKat')?.value.trim()||'Allgemein',timeLimitMinutes:parseInt(document.getElementById('newExamTime')?.value)||30,passPercentage:parseInt(document.getElementById('newExamPassRate')?.value)||60,questions:[..._examBuilderQuestions],createdAt:Date.now()};
    db.ref('data/exams/'+sid).set(exData).then(()=>{ alert('✅ Gespeichert!'); resetExamBuilderForm(); });
}
function editExam(eid) {
    const ex=cachedExams[eid]; if(!ex) return;
    document.getElementById('editingExamId').value=eid;
    document.getElementById('newExamTitle').value=ex.title||'';
    document.getElementById('newExamKat').value=ex.kat||'';
    _examBuilderQuestions=ex.questions?JSON.parse(JSON.stringify(ex.questions)):[];
    refreshExamQuestionsDisplay();
    switchInstructorTab('instrTabManage',document.querySelector('[onclick*="instrTabManage"]'));
}

/* ── Tab Switcher & Navigation ─────────────────────────────── */
function switchTab(tabId,btn) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
    const t=document.getElementById(tabId); if(t) t.classList.add('active');
    if(btn) btn.classList.add('active');
    if(tabId==='newsTab') renderNewsFeed();
    if(tabId==='guideTab') renderGuideTab();
    if(tabId==='linksTab') renderLinksTab(defaultLinks);
    if(tabId==='commandTab') renderCommandsTab(defaultCommands);
    if(tabId==='hierarchieTab') renderHierarchieBoard(hierarchieDaten);
    if(tabId==='examTab') renderExamTab();
}
function settingsTabClick() { switchTab('settingsTab',document.getElementById('adminMainTabHeader')); }
function switchAdminTab(tabId,btnEl) {
    document.querySelectorAll('#adminManagementModal .admin-subtab-content').forEach(e=>e.classList.remove('active'));
    document.querySelectorAll('#adminManagementModal .admin-tab-btn').forEach(e=>e.classList.remove('active'));
    const t=document.getElementById(tabId); if(t) t.classList.add('active');
    if(btnEl) btnEl.classList.add('active');
    if(tabId==='adminSubTabAudit') renderAdminAuditLogs();
}
function switchInstructorTab(tabId,btnEl) {
    document.querySelectorAll('#examInstructorView .admin-subtab-content').forEach(e=>e.classList.remove('active'));
    document.querySelectorAll('#examInstructorView .admin-tab-btn').forEach(e=>e.classList.remove('active'));
    const t=document.getElementById(tabId); if(t) t.classList.add('active');
    if(btnEl) btnEl.classList.add('active');
}
function toggleGroupCollapse(gId) { const g=document.getElementById(gId); if(g) g.classList.toggle('collapsed'); }

/* ── CRUD Helpers & Settings ───────────────────────────────── */
function deletePatient(k) { if(confirm('Löschen?')) db.ref('data/protokoll/'+k).remove(); }
function deleteArchivSchicht(k) { if(confirm('Löschen?')) db.ref('data/archiv/'+k).remove(); }
function deleteDienstLink(k) { if(confirm('Löschen?')) db.ref('data/dienstLinks/'+k).remove(); }
function deleteDienstCommand(k) { if(confirm('Löschen?')) db.ref('data/dienstCommands/'+k).remove(); }

function passwortAendern() {
    if(!sessionUser) return;
    const np=document.getElementById('newPasswordInput')?.value.trim(); if(!np) return;
    const uId=(sessionUser.vorname+'_'+sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g,'');
    db.ref('data/users/'+uId+'/pass').set(np).then(()=>{ sessionUser.pass=np; alert('Passwort geändert!'); });
}
function handleDienstEndeLogout() {
    if(mySessionRef) mySessionRef.remove();
    sessionStorage.clear(); localStorage.clear(); location.reload();
}
function berechneDienstTage() {
    if(!sessionUser) return;
    const f=document.getElementById('einstellungsDatum'); if(!f||!f.value) return;
    const ed=new Date(f.value); ed.setHours(0,0,0,0);
    const h=new Date(); h.setHours(0,0,0,0);
    const t=Math.max(0,Math.floor((h-ed)/(1000*60*60*24))+1);
    const e=document.getElementById('val_dienstTage'); if(e) e.textContent=t;
}

/* ── DOM Ready & Window Exports ────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
    updateLiveDate(); setInterval(updateLiveDate,60000);
    renderGuideTab(); renderHierarchieBoard(hierarchieDaten); baueMaterialUIAuf();
    const su=sessionStorage.getItem('mmd_session_user')||localStorage.getItem('mmd_session_user');
    if(su) { try { initDienstEintritt(JSON.parse(su)); } catch(e){} }
});

const _w=window;
_w.switchTab=switchTab; _w.settingsTabClick=settingsTabClick; _w.switchAdminTab=switchAdminTab; _w.switchInstructorTab=switchInstructorTab;
_w.handleAuthAction=handleAuthAction; _w.toggleAuthTab=toggleAuthTab;
_w.openAdminKeyModal=openAdminKeyModal; _w.closeAdminAuthModal=closeAdminAuthModal; _w.verifyAdminKeyPassword=verifyAdminKeyPassword; _w.closeAdminManagementModal=closeAdminManagementModal;
_w.handleDienstEndeLogout=handleDienstEndeLogout; _w.berechneDienstTage=berechneDienstTage; _w.passwortAendern=passwortAendern;
_w.toggleGroupCollapse=toggleGroupCollapse; _w.stepVerletzungenAnzahl=stepVerletzungenAnzahl; _w.stepKosten=stepKosten; _w.stepMat=stepMat; _w.ladeCheckliste=ladeCheckliste; _w.patientHinzufuegen=patientHinzufuegen; _w.toggleTodo=toggleTodo;
_w.resetMedicalWorkflow=resetMedicalWorkflow; _w.openEditModal=openEditModal; _w.closeEditModal=closeEditModal; _w.speicherePatientEdit=speicherePatientEdit;
_w.deletePatient=deletePatient; _w.deleteArchivSchicht=deleteArchivSchicht; _w.deleteDienstLink=deleteDienstLink; _w.deleteDienstCommand=deleteDienstCommand; _w.exportArchivCSV=exportArchivCSV;
_w.renderNewsFeed=renderNewsFeed; _w.togglePostNewsForm=togglePostNewsForm; _w.speichereNeueNews=speichereNeueNews; _w.deleteNews=deleteNews;
_w.startExam=startExam; _w.cancelActiveExam=cancelActiveExam; _w.submitActiveExam=submitActiveExam;
_w.addExamQuestionRow=addExamQuestionRow; _w.resetExamBuilderForm=resetExamBuilderForm; _w.neuePruefungSpeichern=neuePruefungSpeichern; _w.editExam=editExam; _w.deleteExam=deleteExam; _w.deleteExamSubmission=deleteExamSubmission;
_w.aktualisierePruefungsFreischaltungen=aktualisierePruefungsFreischaltungen;
_w.linkHinzufuegen=linkHinzufuegen; _w.commandHinzufuegen=commandHinzufuegen; _w.bulkCommandsImportieren=bulkCommandsImportieren;
_w.downloadSystemBackup=downloadSystemBackup; _w.markNewsAsRead=markNewsAsRead; _w.toggleExamUnlockForUser=toggleExamUnlockForUser; _w.toggleExamPassedForUser=toggleExamPassedForUser; _w.restoreSystemBackupFromFile=restoreSystemBackupFromFile;
_w.speichereHierarchieDaten=speichereHierarchieDaten; _w.bauePreiseEinstellungenUI=bauePreiseEinstellungenUI; _w.speicherePreise=speicherePreise; _w.ladeSzenarioTemplateInSettings=ladeSzenarioTemplateInSettings; _w.speichereSzenarioTemplate=speichereSzenarioTemplate;
_w.aktualisiereAdminVerwaltung=aktualisiereAdminVerwaltung; _w.approveUser=approveUser; _w.revokeUser=revokeUser;
_w.openAssignRolesModal=openAssignRolesModal; _w.closeAssignRolesModal=closeAssignRolesModal; _w.saveAssignedRoles=saveAssignedRoles;
_w.openUserPermissionsModal=openUserPermissionsModal; _w.closeUserPermissionsModal=closeUserPermissionsModal; _w.saveUserPermissions=saveUserPermissions;
_w.neueRolleErstellen=neueRolleErstellen; _w.selectRole=selectRole; _w.updateRoleBadgePreview=updateRoleBadgePreview; _w.speichereRolle=speichereRolle; _w.loescheRolle=loescheRolle;
_w.schichtAbschliessen=schichtAbschliessen; _w.vollstaendigerReset=vollstaendigerReset; _w.renderAdminAuditLogs=renderAdminAuditLogs;
_w.filterDivs = function(id, q) {
    const c=document.getElementById(id); if(!c) return;
    Array.from(c.children).forEach(el=>{ el.style.display=el.innerText.toLowerCase().includes(q.toLowerCase())?'':'none'; });
};