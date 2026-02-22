export interface Semester {
  id: string;
  semestre_id: string;
  nom: string;
  faculty: string;
  total_modules: number;
  total_questions: number;
  total_activities: number;
}

export interface Module {
  id: number;
  module_id: string;
  nom: string;
  description: string | null;
  semester_id: string;
  total_questions: number;
  total_activities: number;
}

export interface Activity {
  id: number;
  activite_id: string;
  nom: string;
  type_activite: "exam" | "exercise";
  module_id: number;
  total_questions: number;
  chapitre?: string;
}

export interface Choice {
  id: string;
  id_choix: number;
  contenu: string;
  est_correct: boolean;
  pourcentage: number;
  explication: string | null;
}

export interface Question {
  id: string;
  id_question: number;
  texte: string;
  image_url: string | null;
  correction: string | null;
  source_question: string | null;
  source_type: "qcm" | "open";
  position: number;
  activity_id: number;
  module_id: number;
  choices: Choice[];
}

export interface QuizSession {
  activityId: number;
  activityName: string;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string[]>;
  revealed: Record<string, boolean>;
  startedAt: number;
}
