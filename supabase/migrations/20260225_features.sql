-- ZeroQCM Feature Migration 2026-02-25
-- Tables: study_rooms, room_participants, module_certificates, flashcard_sessions

create table if not exists study_rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  module_id     int references modules(id) on delete cascade,
  host_id       uuid references auth.users(id) on delete cascade,
  status        text not null default 'waiting',
  current_q_idx int not null default 0,
  questions     jsonb not null default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table study_rooms enable row level security;
create policy "room_public_read"   on study_rooms for select using (true);
create policy "room_host_insert"   on study_rooms for insert with check (auth.uid() = host_id);
create policy "room_host_update"   on study_rooms for update using (auth.uid() = host_id);
create policy "room_host_delete"   on study_rooms for delete using (auth.uid() = host_id);

create table if not exists room_participants (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references study_rooms(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  display_name text not null,
  score      int not null default 0,
  answers    jsonb not null default '{}',
  joined_at  timestamptz default now(),
  unique (room_id, user_id)
);
alter table room_participants enable row level security;
create policy "participant_read"   on room_participants for select using (true);
create policy "participant_insert" on room_participants for insert with check (auth.uid() = user_id);
create policy "participant_update" on room_participants for update using (auth.uid() = user_id);
create policy "participant_delete" on room_participants for delete using (auth.uid() = user_id);

create table if not exists module_certificates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  module_id   int references modules(id) on delete cascade,
  module_name text not null,
  score_pct   int not null,
  total_answered int not null,
  earned_at   timestamptz default now(),
  unique (user_id, module_id)
);
alter table module_certificates enable row level security;
create policy "cert_owner_read"   on module_certificates for select using (auth.uid() = user_id);
create policy "cert_public_read"  on module_certificates for select using (true);
create policy "cert_insert"       on module_certificates for insert with check (auth.uid() = user_id);
create policy "cert_update"       on module_certificates for update using (auth.uid() = user_id);

create table if not exists flashcard_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  module_id    int references modules(id) on delete cascade,
  question_id  uuid references questions(id) on delete cascade,
  status       text not null default 'new',
  next_review  timestamptz default now(),
  interval_days int not null default 1,
  ease_factor  float not null default 2.5,
  reviews      int not null default 0,
  updated_at   timestamptz default now(),
  unique (user_id, question_id)
);
alter table flashcard_sessions enable row level security;
create policy "flash_owner" on flashcard_sessions for all using (auth.uid() = user_id);

create index if not exists idx_study_rooms_code       on study_rooms(code);
create index if not exists idx_study_rooms_host       on study_rooms(host_id);
create index if not exists idx_room_participants_room on room_participants(room_id);
create index if not exists idx_flashcard_user_module  on flashcard_sessions(user_id, module_id);
create index if not exists idx_flashcard_next_review  on flashcard_sessions(user_id, next_review);
create index if not exists idx_certificates_user      on module_certificates(user_id);

create or replace function update_study_room_timestamp()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists study_rooms_updated_at on study_rooms;
create trigger study_rooms_updated_at
  before update on study_rooms
  for each row execute function update_study_room_timestamp();

create or replace function get_due_flashcards(p_user_id uuid, p_module_id int)
returns table(
  question_id uuid, texte text, choices jsonb,
  status text, interval_days int, reviews int
) language sql security definer as $$
  select
    q.id,
    q.texte,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', c.id, 'contenu', c.contenu, 'est_correct', c.est_correct, 'explication', c.explication
        ) order by random())
       from choices c where c.question_id = q.id),
      '[]'::jsonb
    ) as choices,
    coalesce(fs.status, 'new')          as status,
    coalesce(fs.interval_days, 1)       as interval_days,
    coalesce(fs.reviews, 0)             as reviews
  from questions q
  left join flashcard_sessions fs
    on fs.question_id = q.id and fs.user_id = p_user_id
  where q.module_id = p_module_id
    and q.source_type not in ('open', 'no_answer')
    and (fs.next_review is null or fs.next_review <= now() or fs.status in ('new','learning'))
  order by
    case coalesce(fs.status,'new') when 'new' then 1 when 'learning' then 2 else 3 end,
    coalesce(fs.next_review, now())
  limit 50;
$$;

create or replace function get_module_stats_for_certificate(p_user_id uuid, p_module_id int)
returns table(total_q bigint, answered bigint, correct bigint, pct int) language sql security definer as $$
  select
    (select count(*) from questions where module_id = p_module_id
       and source_type not in ('open','no_answer')) as total_q,
    count(distinct ua.question_id)         as answered,
    count(distinct ua.question_id) filter (where ua.is_correct) as correct,
    case when count(distinct ua.question_id) = 0 then 0
         else round(100.0 * count(distinct ua.question_id) filter (where ua.is_correct) / count(distinct ua.question_id))::int
    end as pct
  from user_answers ua
  join questions q on q.id = ua.question_id
  where ua.user_id = p_user_id
    and q.module_id = p_module_id;
$$;