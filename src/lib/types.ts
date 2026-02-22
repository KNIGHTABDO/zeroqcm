export interface Module {
  id: number; nom: string; total_questions: number; total_activities: number; semester_id: string;
}
export interface Activity {
  id: number; nom: string; type_activite: "exam" | "exercise"; module_id: number; total_questions: number; chapitre?: string;
}
export interface Choice {
  id: string; id_choix: number; contenu: string; est_correct: boolean; pourcentage: number; explication: string | null;
}
export interface Question {
  id: string; id_question: number; texte: string; image_url: string | null; correction: string | null;
  source_question: string | null; source_type: string; position: number; activity_id: number; module_id: number;
  choices: Choice[];
}
