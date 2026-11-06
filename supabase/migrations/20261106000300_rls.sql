-- =====================================================================
-- Доступ к данным: права на таблицы (GRANT) + построчная защита (RLS)
--
-- Supabase по умолчанию выдаёт ролям anon/authenticated все права на
-- таблицы в public. Здесь мы их сначала отзываем, а потом выдаём ровно то,
-- что нужно. Поверх прав работает RLS: даже разрешённая операция затронет
-- только те строки, которые пользователю положены.
-- =====================================================================

alter table public.profiles     enable row level security;
alter table public.objects      enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_history enable row level security;

-- ---------------------------------------------------------------------
-- Права на уровне таблиц и столбцов
-- ---------------------------------------------------------------------
-- Неавторизованный пользователь (anon) не получает ничего
revoke all on public.profiles, public.objects, public.tasks, public.task_history from anon;
revoke all on public.profiles, public.objects, public.tasks, public.task_history from authenticated;

-- Профили: только чтение (сменить себе роль через API нельзя)
grant select on public.profiles to authenticated;

-- Объекты: автор и дата создания проставляются сервером
grant select, delete              on public.objects to authenticated;
grant insert (name, address)      on public.objects to authenticated;
grant update (name, address)      on public.objects to authenticated;

-- Задачи: столбцы status / author_id / created_at клиенту недоступны
-- ни при вставке, ни при изменении. Статус — только через change_task_status().
grant select, delete                                         on public.tasks to authenticated;
grant insert (object_id, title, description, assignee_id)   on public.tasks to authenticated;
grant update (object_id, title, description, assignee_id)   on public.tasks to authenticated;

-- История: только чтение. Записи создают серверные функции.
grant select on public.task_history to authenticated;
-- Даже сервисный ключ не может переписать историю через API
revoke insert, update, delete, truncate on public.task_history from service_role;

-- Служебная схема: нужна для вычисления политик, но не видна через API
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_manager() to authenticated;

-- RPC смены статуса — только для вошедших пользователей
revoke all on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

-- ---------------------------------------------------------------------
-- Политики RLS
-- (select auth.uid()) / (select private.is_manager()) обёрнуты в select,
-- чтобы Postgres вычислял их один раз на запрос, а не на каждую строку.
-- ---------------------------------------------------------------------

-- PROFILES: все вошедшие видят имена коллег (нужно для автора, исполнителя
-- и истории). Изменять профили через API нельзя — политик на запись нет.
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

-- OBJECTS
-- Постановщик видит всё; исполнитель — только объекты, где у него есть задачи.
create policy "objects_select"
  on public.objects for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id
        and t.assignee_id = (select auth.uid())
    )
  );

create policy "objects_insert_manager"
  on public.objects for insert to authenticated
  with check ((select private.is_manager()));

create policy "objects_update_manager"
  on public.objects for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy "objects_delete_manager"
  on public.objects for delete to authenticated
  using ((select private.is_manager()));

-- TASKS
-- Постановщик видит все задачи; исполнитель — только назначенные ему.
create policy "tasks_select"
  on public.tasks for select to authenticated
  using (
    (select private.is_manager())
    or assignee_id = (select auth.uid())
  );

create policy "tasks_insert_manager"
  on public.tasks for insert to authenticated
  with check ((select private.is_manager()));

-- Редактировать поля задачи (название, описание, объект, исполнитель)
-- может только постановщик. Исполнитель меняет только статус и только через RPC.
create policy "tasks_update_manager"
  on public.tasks for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy "tasks_delete_manager"
  on public.tasks for delete to authenticated
  using ((select private.is_manager()));

-- TASK_HISTORY: видна тем, кто видит саму задачу. Политик на запись нет.
create policy "task_history_select"
  on public.task_history for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id
        and t.assignee_id = (select auth.uid())
    )
  );
