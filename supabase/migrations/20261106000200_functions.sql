-- =====================================================================
-- Функции и триггеры: роли, создание задач, смена статусов, история
-- Все SECURITY DEFINER-функции фиксируют search_path = '' и обращаются
-- к объектам только по полному имени (защита от подмены через search_path).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Является ли текущий пользователь постановщиком.
-- SECURITY DEFINER — чтобы читать profiles без рекурсии в RLS.
-- ---------------------------------------------------------------------
create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- Человекочитаемое название статуса (для сообщений об ошибках)
create or replace function private.status_label(s public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'on_review'   then 'На проверке'
    when 'accepted'    then 'Принята'
    when 'rework'      then 'На доработке'
  end;
$$;

-- ---------------------------------------------------------------------
-- Профиль создаётся автоматически при создании пользователя в Supabase Auth.
-- Роль берётся ТОЛЬКО из app_metadata: её может задать лишь администратор
-- (user_metadata пользователь может менять сам — ей не доверяем).
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_app_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    case when new.raw_app_meta_data ->> 'role' = 'manager'
         then 'manager'::public.user_role
         else 'executor'::public.user_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Задачи: проверки перед вставкой / изменением
-- ---------------------------------------------------------------------
create or replace function private.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Новая задача всегда начинается со статуса «Новая»,
    -- автор — текущий пользователь, дата — серверное время.
    new.status     := 'new';
    new.author_id  := coalesce(auth.uid(), new.author_id);
    new.created_at := now();
  else
    -- Статус меняется только через public.change_task_status()
    if new.status is distinct from old.status
       and coalesce(current_setting('app.status_change', true), '') <> 'on' then
      raise exception 'Статус задачи меняется только через действие (change_task_status)'
        using errcode = '42501';
    end if;
    -- Автор и дата создания неизменяемы
    new.author_id  := old.author_id;
    new.created_at := old.created_at;
  end if;

  new.updated_at := now();

  -- Исполнителем может быть только пользователь с ролью «исполнитель»
  if tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id then
    if not exists (
      select 1 from public.profiles
      where id = new.assignee_id and role = 'executor'
    ) then
      raise exception 'Исполнителем можно назначить только пользователя с ролью «исполнитель»'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Запись в историю о создании задачи (— → Новая)
create or replace function private.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_history (task_id, actor_id, from_status, to_status)
  values (new.id, new.author_id, null, new.status);
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

-- ---------------------------------------------------------------------
-- История неизменяема: UPDATE запрещён всегда, DELETE — только каскадом
-- при удалении самой задачи постановщиком (pg_trigger_depth() > 1).
-- Работает даже для администратора БД, не только для API.
-- ---------------------------------------------------------------------
create or replace function private.task_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'История статусов не может быть изменена' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and pg_trigger_depth() < 2 then
    raise exception 'История статусов не может быть удалена' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger task_history_immutable
  before update or delete on public.task_history
  for each row execute function private.task_history_immutable();

-- ---------------------------------------------------------------------
-- Смена статуса задачи — единственный путь изменить status.
--
--   Из            В              Кто
--   Новая       → В работе       назначенный исполнитель
--   В работе    → На проверке    назначенный исполнитель
--   На проверке → Принята        постановщик
--   На проверке → На доработке   постановщик (комментарий обязателен)
--   На доработке→ В работе       назначенный исполнитель
--
-- Кто и когда — берётся на сервере (auth.uid(), now()), подделать нельзя.
-- ---------------------------------------------------------------------
create or replace function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    public.user_role;
  v_task    public.tasks;
  v_from    public.task_status;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_is_assignee boolean;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Требуется вход в систему' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = '42501';
  end if;

  -- Блокируем строку, чтобы два одновременных запроса не прошли оба
  select * into v_task from public.tasks where id = p_task_id for update;

  -- Исполнитель не должен даже узнать о существовании чужой задачи
  if not found or (v_role = 'executor' and v_task.assignee_id <> v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  v_from        := v_task.status;
  v_is_assignee := v_role = 'executor' and v_task.assignee_id = v_uid;

  v_allowed := case
    when v_from = 'new'         and p_new_status = 'in_progress' then v_is_assignee
    when v_from = 'in_progress' and p_new_status = 'on_review'   then v_is_assignee
    when v_from = 'rework'      and p_new_status = 'in_progress' then v_is_assignee
    when v_from = 'on_review'   and p_new_status = 'accepted'    then v_role = 'manager'
    when v_from = 'on_review'   and p_new_status = 'rework'      then v_role = 'manager'
    else false
  end;

  if not v_allowed then
    raise exception 'Переход «%» → «%» вам недоступен',
      private.status_label(v_from), private.status_label(p_new_status)
      using errcode = '42501';
  end if;

  if p_new_status = 'rework' and v_comment is null then
    raise exception 'Для возврата на доработку нужен комментарий' using errcode = '23514';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.tasks set status = p_new_status where id = p_task_id
  returning * into v_task;
  perform set_config('app.status_change', 'off', true);

  insert into public.task_history (task_id, actor_id, from_status, to_status, comment)
  values (p_task_id, v_uid, v_from, p_new_status, v_comment);

  return v_task;
end;
$$;
