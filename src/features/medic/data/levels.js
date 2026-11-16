// The four US EMS certification levels, lowest to highest. Each level
// includes everything below it, so the knowledge base and skill stations
// tag their material with the lowest level that needs it.
//
// Written for study. Scope of practice is set by each state and your
// medical director, and exam details change: check NREMT.org and your
// state EMS office for the current rules.

export const LEVELS = [
  {
    id: "emr",
    short: "EMR",
    name: "Emergency Medical Responder",
    tagline: "First on scene: keep them alive until the ambulance gets there.",
    hours: "About 50 to 60 hours of training",
    role: "Firefighters, police, lifeguards, industrial and campus responders. EMRs reach the patient first and handle the immediate life threats with very little equipment.",
    scope: [
      "Scene safety, triage and calling for more help",
      "Manual airway opening, OPA and NPA, suction",
      "Bag-valve-mask ventilation and supplemental oxygen",
      "CPR and AED",
      "Bleeding control, tourniquets and wound packing",
      "Manual stabilization of the spine and of injured limbs",
      "Emergency childbirth (assisting a normal delivery)",
      "Naloxone and epinephrine auto-injectors where the state allows",
    ],
    exam: [
      "Cognitive exam: computer adaptive, so it ends when the computer is sure whether you pass. Plan on about two hours.",
      "Practical: the patient assessment, BVM, CPR/AED and bleeding control stations, run by your course or state.",
    ],
  },
  {
    id: "emt",
    short: "EMT",
    name: "Emergency Medical Technician (EMT-B)",
    tagline: "The backbone of the ambulance: assess, treat with basic tools, transport.",
    hours: "About 150 to 190 hours, including clinical and ride time",
    role: "Staff most ambulances in the US. EMTs do full patient assessments, give a short list of medications and make the transport decision.",
    scope: [
      "Everything an EMR does",
      "Full trauma and medical assessments, vital signs, pulse oximetry",
      "CPAP and suctioning, oxygen by every basic device",
      "Aspirin for chest pain, oral glucose, epinephrine auto-injector",
      "Helping patients take their own nitroglycerin and inhalers",
      "Naloxone (nasal or auto-injector)",
      "Splinting, traction splints and spinal motion restriction",
      "Glucose checks and 12-lead acquisition where the state allows",
    ],
    exam: [
      "Cognitive exam: computer adaptive, roughly 70 to 120 questions in about two hours.",
      "Newer NREMT exams also mix in multiple-select, drag-and-drop and short case items.",
      "Practical: skill competency is verified by your program or state, usually with the classic skill sheets this app follows.",
    ],
  },
  {
    id: "aemt",
    short: "AEMT",
    name: "Advanced EMT",
    tagline: "Basic life support plus IVs, IOs, advanced airways and a few key drugs.",
    hours: "About 150 to 250 hours beyond the EMT",
    role: "Common in rural and volunteer services. AEMTs start IVs and IOs, place supraglottic airways and give a handful of drugs that fix the things that kill fast.",
    scope: [
      "Everything an EMT does",
      "Peripheral IV and intraosseous access, IV fluids",
      "Supraglottic airways (i-gel, King) and waveform capnography",
      "Dextrose IV and glucagon for low blood sugar",
      "Naloxone IV/IO/IM, epinephrine IM for anaphylaxis",
      "Nebulized albuterol, nitroglycerin, nitrous oxide where allowed",
    ],
    exam: [
      "Cognitive exam: a fixed-length exam of about 135 questions in a little over two hours.",
      "Practical: patient assessment, IV and IV bolus medication, pediatric IO, supraglottic airway and BLS stations.",
    ],
  },
  {
    id: "paramedic",
    short: "Paramedic",
    name: "Paramedic (NRP)",
    tagline: "Advanced life support: cardiology, pharmacology and critical decisions.",
    hours: "About 1,200 to 1,800 hours, often an associate degree",
    role: "Run the advanced calls. Paramedics read ECGs, manage cardiac arrests with drugs and electricity, intubate and make independent treatment decisions under protocol.",
    scope: [
      "Everything an AEMT does",
      "ECG and 12-lead interpretation, defibrillation, cardioversion and pacing",
      "Endotracheal intubation, surgical airway, needle decompression",
      "A large drug formulary: ACLS drugs, pain control, sedation, antiarrhythmics",
      "Advanced assessment and independent clinical decisions within protocol",
    ],
    exam: [
      "Cognitive exam: computer adaptive and the longest of the four. Expect cardiology, pharmacology and case questions throughout.",
      "Practical: your program verifies a portfolio of skills, and the national psychomotor exam tests scenario stations such as dynamic cardiology and an integrated patient call.",
    ],
  },
];

export const LEVEL_IDS = LEVELS.map(l => l.id);
export const levelById = new Map(LEVELS.map(l => [l.id, l]));

/** 0 for EMR up to 3 for Paramedic; unknown ids count as EMR. */
export const rank = id => Math.max(0, LEVEL_IDS.indexOf(id));

/** True when material for `min` is part of what `level` studies. */
export const covers = (level, min = "emr") => rank(level) >= rank(min);

/** The five areas every NREMT cognitive exam draws from. */
export const EXAM_AREAS = [
  { id: "airway", name: "Airway, respiration and ventilation" },
  { id: "cardio", name: "Cardiology and resuscitation" },
  { id: "trauma", name: "Trauma" },
  { id: "medical", name: "Medical, obstetrics and gynecology" },
  { id: "ops", name: "EMS operations" },
];
