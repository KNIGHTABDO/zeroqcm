-- FMPC QCM Platform — Supabase Schema
-- Run in Supabase SQL Editor

-- Semesters
create table if not exists semesters (
  id          uuid primary key default gen_random_uuid(),
  semestre_id text unique not null,  -- 's1', 's1_fmpr', etc.
  nom         text not null,
  faculty     text not null,         -- 'FMPC', 'FMPR', 'FMPM', 'UM6SS', 'FMPDF'
  total_modules     int default 0,
  total_questions   int default 0,
  total_activities  int default 0,
  created_at  timestamptz default now()
);

-- Modules
create table if not exists modules (
  id          int primary key,       -- DariQCM id_module
  module_id   text,
  nom         text not null,
  description text,
  semester_id text references semesters(semestre_id),
  total_questions   int default 0,
  total_activities  int default 0,
  created_at  timestamptz default now()
);

-- Activities (exam sessions & exercises)
create table if not exists activities (
  id            int primary key,     -- DariQCM id_activite
  activite_id   text,
  nom           text not null,
  type_activite text not null,       -- 'exam' | 'exercise'
  module_id     int references modules(id),
  total_questions int default 0,
  chapitre      text,
  created_at    timestamptz default now()
);

-- Questions
create table if not exists questions (
  id              uuid primary key default gen_random_uuid(),
  id_question     int unique not null,
  question_id     text,
  texte           text not null,
  image_url       text,
  correction      text,
  source_question text,
  source_type     text default 'qcm',
  position        int default 0,
  activity_id     int references activities(id),
  module_id       int references modules(id),
  created_at      timestamptz default now()
);

-- Choices (answer options)
create table if not exists choices (
  id           uuid primary key default gen_random_uuid(),
  id_choix     int unique not null,
  choix_id     text,
  question_id  uuid references questions(id) on delete cascade,
  contenu      text not null,
  est_correct  boolean not null default false,
  pourcentage  decimal(5,2) default 0,
  explication  text,
  created_at   timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_questions_activity_id on questions(activity_id);
create index if not exists idx_questions_module_id on questions(module_id);
create index if not exists idx_choices_question_id on choices(question_id);
create index if not exists idx_modules_semester_id on modules(semester_id);
create index if not exists idx_activities_module_id on activities(module_id);
