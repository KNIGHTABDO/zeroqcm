import fs from "fs";
import path from "path";
import readline from "readline";

const EXPORT_DIR = path.resolve("./export");
const DATASET_DIR = path.resolve("./dataset");
const MODULES_DIR = path.join(DATASET_DIR, "by_module");

if (!fs.existsSync(DATASET_DIR)) fs.mkdirSync(DATASET_DIR, { recursive: true });
if (!fs.existsSync(MODULES_DIR)) fs.mkdirSync(MODULES_DIR, { recursive: true });

function sanitizeText(str) {
  if (!str) return "";
  return str
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanModuleName(name) {
  if (!name) return "Autre";
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function stringHash(str) {
  let hash = 5381;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function run() {
  console.log("==========================================================");
  console.log("   ZEROQCM 100% DATASET PIPELINE & CHATML SYNTHESIS     ");
  console.log("==========================================================\n");

  const startPipelineTime = Date.now();

  // ── 1. Load Reference Metadata ──────────────────────────────────────
  console.log("1️⃣ Loading reference tables (semesters, modules, activities, ai_explanations)...");

  const semestersRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "semesters.json"), "utf8"));
  const modulesRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "modules.json"), "utf8"));
  const activitiesRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "activities.json"), "utf8"));
  
  let explanationsRaw = [];
  if (fs.existsSync(path.join(EXPORT_DIR, "ai_explanations.json"))) {
    explanationsRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "ai_explanations.json"), "utf8"));
  }

  const semestersMap = new Map();
  for (const s of semestersRaw) {
    semestersMap.set(s.semestre_id, {
      nom: s.nom || s.semestre_id,
      faculty: s.faculty || "Maroc",
    });
  }

  const modulesMap = new Map();
  for (const m of modulesRaw) {
    const sem = semestersMap.get(m.semester_id) || { nom: m.semester_id || "Général", faculty: "Maroc" };
    modulesMap.set(m.id, {
      id: m.id,
      module_id: m.module_id,
      nom: sanitizeText(m.nom) || `Module ${m.id}`,
      semester_id: m.semester_id,
      semester_nom: sem.nom,
      faculty: sem.faculty,
    });
  }

  const activitiesMap = new Map();
  for (const a of activitiesRaw) {
    const mod = modulesMap.get(a.module_id) || { nom: "Inconnu", semester_nom: "Inconnu", faculty: "Maroc" };
    activitiesMap.set(a.id, {
      id: a.id,
      nom: sanitizeText(a.nom) || `Activité ${a.id}`,
      chapitre: sanitizeText(a.chapitre) || null,
      type_activite: a.type_activite || "qcm",
      module_id: a.module_id,
      module_nom: mod.nom,
      semester_nom: mod.semester_nom,
      faculty: mod.faculty,
    });
  }

  const explanationsMap = new Map();
  for (const e of explanationsRaw) {
    if (e.question_id && e.explanation) {
      explanationsMap.set(String(e.question_id), sanitizeText(e.explanation));
    }
  }

  console.log(`  • Semesters:     ${semestersMap.size}`);
  console.log(`  • Modules:       ${modulesMap.size}`);
  console.log(`  • Activities:    ${activitiesMap.size}`);
  console.log(`  • Explanations:  ${explanationsMap.size}`);

  // ── 2. Index Choices Map ─────────────────────────────────────────────
  console.log("\n2️⃣ Indexing 758,462 choices into memory map...");
  const choicesMap = new Map();
  let totalChoicesRead = 0;

  const choicesRL = readline.createInterface({
    input: fs.createReadStream(path.join(EXPORT_DIR, "choices.jsonl"), { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of choicesRL) {
    if (!line.trim()) continue;
    totalChoicesRead++;
    const c = JSON.parse(line);
    const qId = String(c.question_id);
    
    let arr = choicesMap.get(qId);
    if (!arr) {
      arr = [];
      choicesMap.set(qId, arr);
    }

    const isCorrect = c.est_correct === true || c.est_correct === 1 || c.est_correct === "1" || c.est_correct === "true";
    arr.push({
      id: c.id,
      id_choix: c.id_choix,
      text: sanitizeText(c.contenu),
      correct: isCorrect,
      pct: typeof c.pourcentage === "number" ? c.pourcentage : (parseFloat(c.pourcentage) || null),
      explication: sanitizeText(c.explication) || null,
    });

    if (totalChoicesRead % 150000 === 0) {
      process.stdout.write(`\r  → ${totalChoicesRead.toLocaleString()} choices indexed...`);
    }
  }
  console.log(`\n  ✅ Total choices indexed: ${totalChoicesRead.toLocaleString()} across ${choicesMap.size.toLocaleString()} unique question keys.`);

  // ── 3. Process Questions & Generate Training Files ────────────────────
  console.log("\n3️⃣ Processing 226,191 questions into Unified Dataset & DeepSeek-R1 ChatML...");

  const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  // File streams
  const unifiedStream = fs.createWriteStream(path.join(DATASET_DIR, "all_questions_unified.jsonl"), { flags: "w", encoding: "utf8" });
  const trainStream = fs.createWriteStream(path.join(DATASET_DIR, "train.jsonl"), { flags: "w", encoding: "utf8" });
  const valStream = fs.createWriteStream(path.join(DATASET_DIR, "val.jsonl"), { flags: "w", encoding: "utf8" });
  const testStream = fs.createWriteStream(path.join(DATASET_DIR, "test_benchmark.jsonl"), { flags: "w", encoding: "utf8" });
  const flaggedStream = fs.createWriteStream(path.join(DATASET_DIR, "flagged_issues.jsonl"), { flags: "w", encoding: "utf8" });

  const moduleStreams = new Map();
  function getModuleStream(modName) {
    const clean = cleanModuleName(modName);
    let st = moduleStreams.get(clean);
    if (!st) {
      st = fs.createWriteStream(path.join(MODULES_DIR, `${clean}.jsonl`), { flags: "w", encoding: "utf8" });
      moduleStreams.set(clean, st);
    }
    return st;
  }

  let totalQuestionsRead = 0;
  let validQCMCount = 0;
  let validQROCCount = 0;
  let flaggedCount = 0;
  let trainCount = 0;
  let valCount = 0;
  let testCount = 0;

  const statsByFaculty = {};
  const statsBySemester = {};
  const statsByModule = {};

  const SYSTEM_PROMPT = "Tu es un médecin spécialiste et tuteur pédagogique d'élite pour les facultés de médecine du Maroc (FMPC, FMPR, FMPM, FMPT, FMPDF, UM6SS). Résous chaque QCM avec une rigueur clinique et méthodologique absolue. Analyse d'abord l'énoncé et chaque proposition dans les balises <think>...</think>, puis fournis les justifications détaillées et la liste exacte des bonnes réponses.";

  const questionsRL = readline.createInterface({
    input: fs.createReadStream(path.join(EXPORT_DIR, "questions.jsonl"), { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of questionsRL) {
    if (!line.trim()) continue;
    totalQuestionsRead++;

    const q = JSON.parse(line);
    const qIdStr = String(q.id);
    const activity = activitiesMap.get(q.activity_id) || {
      nom: "Session d'évaluation",
      chapitre: null,
      module_id: q.module_id,
      module_nom: "Module Médical",
      semester_nom: "Général",
      faculty: "Maroc",
    };

    const moduleInfo = modulesMap.get(q.module_id) || {
      nom: activity.module_nom || "Module Médical",
      semester_nom: activity.semester_nom || "Général",
      faculty: activity.faculty || "Maroc",
    };

    const faculty = moduleInfo.faculty || activity.faculty || "Maroc";
    const semester = moduleInfo.semester_nom || activity.semester_nom || "Général";
    const moduleName = moduleInfo.nom || activity.module_nom || "Général";

    // Track stats
    statsByFaculty[faculty] = (statsByFaculty[faculty] || 0) + 1;
    statsBySemester[semester] = (statsBySemester[semester] || 0) + 1;
    statsByModule[moduleName] = (statsByModule[moduleName] || 0) + 1;

    const questionText = sanitizeText(q.texte);
    const rawChoices = choicesMap.get(qIdStr) || [];
    
    // Sort choices deterministically by id
    rawChoices.sort((a, b) => a.id - b.id);

    const cachedExplanation = explanationsMap.get(qIdStr) || null;

    // Build unified JSON object
    const unifiedItem = {
      id: q.id,
      id_question: q.id_question,
      faculty,
      semester,
      module_id: q.module_id,
      module: moduleName,
      activity_id: q.activity_id,
      activity_name: activity.nom,
      chapitre: activity.chapitre,
      source_type: q.source_type,
      source_question: q.source_question,
      question: questionText,
      image_url: q.image_url || null,
      correction_raw: q.correction || null,
      explanation_cached: cachedExplanation,
      choices: rawChoices,
      choices_count: rawChoices.length,
      correct_choices_count: rawChoices.filter(c => c.correct).length,
    };

    unifiedStream.write(JSON.stringify(unifiedItem) + "\n");

    // ── Validation & ChatML Building ──
    const hasChoices = rawChoices.length >= 2;
    const hasText = questionText.length > 2;

    if (!hasText || (!hasChoices && !q.correction && !unifiedItem.source_question)) {
      // Flag incomplete/anomalous question
      flaggedCount++;
      flaggedStream.write(JSON.stringify({
        ...unifiedItem,
        flag_reason: !hasText ? "Texte de question vide" : "Aucun choix et aucune correction",
      }) + "\n");
      continue;
    }

    let chatMLMessage = null;

    if (hasChoices) {
      // Standard QCM
      validQCMCount++;

      // Build User Content
      const contextHeaders = [
        `Faculté: ${faculty}`,
        `Semestre: ${semester}`,
        `Module: ${moduleName}`,
      ];
      if (activity.chapitre) contextHeaders.push(`Chapitre: ${activity.chapitre}`);
      if (q.source_question) contextHeaders.push(`Session: ${q.source_question}`);

      let userPrompt = `[Contexte: ${contextHeaders.join(" | ")}]\n\n`;
      userPrompt += `Question: ${questionText}\n\n`;

      const labeledChoices = [];
      const correctLetters = [];
      const choiceExplanations = [];

      rawChoices.forEach((choice, idx) => {
        const letter = LETTERS[idx] || `Op${idx + 1}`;
        const cleanedChoiceText = choice.text.replace(/^[A-Ja-j1-9][\.\)\-\:\s]+/g, "").trim();
        labeledChoices.push(`${letter}. ${cleanedChoiceText}`);
        
        if (choice.correct) {
          correctLetters.push(letter);
        }

        const choiceStatus = choice.correct ? "VRAI" : "FAUX";
        let expl = choice.explication;
        if (!expl) {
          if (choice.correct) {
            expl = `Cette proposition est conforme aux recommandations et données médicales de référence du module ${moduleName}.`;
          } else {
            expl = `Cette proposition est inexacte ou constitue un piège classique dans ce contexte clinique.`;
          }
        }
        choiceExplanations.push(`- **${letter}. [${choiceStatus}]** : ${expl}`);
      });

      userPrompt += labeledChoices.join("\n");

      // Build Assistant Response with <think> tag
      const correctStr = correctLetters.length > 0 ? correctLetters.join(", ") : "Aucune proposition exacte";
      
      let thinkContent = `1. Domaine médical : ${moduleName} (${semester} - ${faculty}).\n`;
      thinkContent += `2. Énoncé clinique : "${questionText.slice(0, 120)}${questionText.length > 120 ? '...' : ''}".\n`;
      thinkContent += `3. Analyse proposition par proposition :\n`;
      rawChoices.forEach((c, idx) => {
        const letter = LETTERS[idx] || `Op${idx + 1}`;
        thinkContent += `   - Option ${letter} : ${c.correct ? 'Correcte' : 'Incorrecte'}${c.pct !== null ? ` (Répondue correctement par ${c.pct}% des étudiants)` : ''}.\n`;
      });
      thinkContent += `4. Synthèse finale des réponses validées : ${correctStr}.`;

      if (cachedExplanation) {
        thinkContent += `\n5. Justification clinique approfondie intégrée.`;
      }

      let assistantResponse = `<think>\n${thinkContent}\n</think>\n\n`;
      assistantResponse += `### Justification détaillée des propositions :\n`;
      assistantResponse += choiceExplanations.join("\n") + "\n\n";
      
      if (cachedExplanation) {
        assistantResponse += `### Explication clinique complémentaire :\n${cachedExplanation}\n\n`;
      }

      assistantResponse += `**Bonne(s) réponse(s) : ${correctStr}**`;

      chatMLMessage = {
        id: q.id,
        type: "qcm",
        module: moduleName,
        faculty,
        semester,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
          { role: "assistant", content: assistantResponse },
        ],
      };
    } else {
      // QROC (Open question with correction)
      validQROCCount++;
      const userPrompt = `[Contexte: Faculté: ${faculty} | Semestre: ${semester} | Module: ${moduleName}]\n\nQuestion (QROC): ${questionText}`;
      const corr = q.correction || q.source_question || "Réponse type attendue selon le cours officiel.";
      
      const assistantResponse = `<think>\nAnalyse de la question à réponse ouverte et courte (QROC) en ${moduleName}.\nSynthèse des points clés et critères d'évaluation.\n</think>\n\n### Éléments de réponse attendus :\n${corr}`;

      chatMLMessage = {
        id: q.id,
        type: "qroc",
        module: moduleName,
        faculty,
        semester,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
          { role: "assistant", content: assistantResponse },
        ],
      };
    }

    // Stratified split (90% Train, 5% Val, 5% Test)
    const hashVal = stringHash(qIdStr);
    const splitBucket = hashVal % 100;

    const chatMLStr = JSON.stringify(chatMLMessage) + "\n";

    if (splitBucket < 90) {
      trainCount++;
      trainStream.write(chatMLStr);
    } else if (splitBucket < 95) {
      valCount++;
      valStream.write(chatMLStr);
    } else {
      testCount++;
      testStream.write(chatMLStr);
    }

    // Also write to module partition
    const modStream = getModuleStream(moduleName);
    modStream.write(chatMLStr);

    if (totalQuestionsRead % 40000 === 0) {
      process.stdout.write(`\r  → ${totalQuestionsRead.toLocaleString()} / 226,191 questions processed...`);
    }
  }

  // Close all streams
  await new Promise(resolve => unifiedStream.end(resolve));
  await new Promise(resolve => trainStream.end(resolve));
  await new Promise(resolve => valStream.end(resolve));
  await new Promise(resolve => testStream.end(resolve));
  await new Promise(resolve => flaggedStream.end(resolve));

  for (const st of moduleStreams.values()) {
    await new Promise(resolve => st.end(resolve));
  }

  // ── 4. Save Stats Summary Report ─────────────────────────────────────
  const totalUsable = validQCMCount + validQROCCount;
  const statsReport = {
    generated_at: new Date().toISOString(),
    total_raw_questions_read: totalQuestionsRead,
    total_choices_indexed: totalChoicesRead,
    classification: {
      qcm_standard: validQCMCount,
      qroc_open: validQROCCount,
      flagged_anomalous: flaggedCount,
      total_usable_dataset: totalUsable,
    },
    splits: {
      train: trainCount,
      train_percentage: `${((trainCount / totalUsable) * 100).toFixed(2)}%`,
      val: valCount,
      val_percentage: `${((valCount / totalUsable) * 100).toFixed(2)}%`,
      test_benchmark: testCount,
      test_percentage: `${((testCount / totalUsable) * 100).toFixed(2)}%`,
    },
    distribution: {
      by_faculty: statsByFaculty,
      by_semester: statsBySemester,
      top_modules: Object.entries(statsByModule)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    },
  };

  fs.writeFileSync(path.join(DATASET_DIR, "stats_summary.json"), JSON.stringify(statsReport, null, 2), "utf8");

  const durationSec = ((Date.now() - startPipelineTime) / 1000).toFixed(1);
  console.log("\n\n==========================================================");
  console.log("            DATASET PROCESSING COMPLETE!                  ");
  console.log("==========================================================");
  console.log(`• Total Questions Processed: ${totalQuestionsRead.toLocaleString()}`);
  console.log(`• Total Choices Processed:   ${totalChoicesRead.toLocaleString()}`);
  console.log(`• Usable Training Items:     ${totalUsable.toLocaleString()}`);
  console.log(`  ├─ 🏋️ Training Split:       ${trainCount.toLocaleString()} (${statsReport.splits.train_percentage})`);
  console.log(`  ├─ 🧪 Validation Split:     ${valCount.toLocaleString()} (${statsReport.splits.val_percentage})`);
  console.log(`  └─ 🎯 Test Benchmark:       ${testCount.toLocaleString()} (${statsReport.splits.test_percentage})`);
  console.log(`• Flagged Anomalies:         ${flaggedCount.toLocaleString()} (saved to flagged_issues.jsonl)`);
  console.log(`• Distinct Module Files:     ${moduleStreams.size} files in dataset/by_module/`);
  console.log(`• Duration:                  ${durationSec}s`);
  console.log(`• Output directory:          ${DATASET_DIR}`);
}

run().catch(err => {
  console.error("Dataset pipeline error:", err);
  process.exit(1);
});
