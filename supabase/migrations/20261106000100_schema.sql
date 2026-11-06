-- =====================================================================
-- Мини-CRM «Объекты и задачи» — схема данных
-- =====================================================================

-- Роли пользователей и статусы задач
create type public.user_role as enum ('manager', 'executor');           -- постановщик / исполнитель
create type public.task_status as enum (
  'new',          -- Новая
  'in_progress',  -- В работе
  'on_review',    -- На проверке
  'accepted',     -- Принята
  'rework'        -- На доработке
);

-- Служебная схема: не публикуется через API (PostgREST видит только public),
-- здесь лежат вспомогательные функции и триггеры.
create schema if not exists private;

-- ---------------------------------------------------------------------
-- Профили пользователей (1:1 с auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Объекты (стройки)
-- ---------------------------------------------------------------------
create table public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 200),
  address    text not null default '' check (length(address) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Задачи
-- ---------------------------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  -- Объект нельзя удалить, пока в нём есть задачи
  object_id   uuid not null references public.objects (id) on delete restrict,
  title       text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status      public.task_status not null default 'new',
  author_id   uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_object_id_idx   on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- ---------------------------------------------------------------------
-- История смены статусов (только добавление записей)
-- ---------------------------------------------------------------------
create table public.task_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  actor_id    uuid not null references public.profiles (id) on delete restrict,
  from_status public.task_status,              -- null = создание задачи
  to_status   public.task_status not null,
  comment     text check (comment is null or length(comment) <= 2000),
  created_at  timestamptz not null default now()
);

create index task_history_task_id_idx on public.task_history (task_id, created_at);
