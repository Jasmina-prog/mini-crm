\set M  '11111111-1111-1111-1111-111111111111'
\set E1 '22222222-2222-2222-2222-222222222222'
\set E2 '33333333-3333-3333-3333-333333333333'
\set QUIET on
\pset footer off

-- Пользователи (как если бы их создал админ в Supabase)
insert into auth.users (id, email, raw_app_meta_data) values
 (:'M',  'boss@test.local', '{"role":"manager","full_name":"Иван Начальник"}'),
 (:'E1', 'e1@test.local',   '{"role":"executor","full_name":"Пётр Исполнитель"}'),
 (:'E2', 'e2@test.local',   '{"full_name":"Анна Исполнитель"}');
\echo '== profiles (роль из app_metadata, по умолчанию executor)'
select email, full_name, role from public.profiles order by email;

-- ===== Постановщик создаёт данные =====
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
insert into public.objects (name, address) values ('ЖК Север', 'ул. Ленина 1') returning id as o1 \gset
insert into public.objects (name, address) values ('ЖК Юг', 'ул. Мира 5') returning id as o2 \gset
insert into public.tasks (object_id, title, description, assignee_id) values (:'o1', 'Залить фундамент', 'desc', :'E1') returning id as t1, status as t1_status, author_id as t1_author \gset
insert into public.tasks (object_id, title, assignee_id) values (:'o2', 'Кладка стен', :'E2') returning id as t2 \gset
commit;
\echo '== T01 задача создана: статус/автор проставлены сервером'
\echo :t1_status :t1_author

\echo '== T02 постановщик пытается вставить задачу сразу со статусом accepted (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
insert into public.tasks (object_id, title, assignee_id, status) values (:'o1', 'hack', :'E1', 'accepted');
rollback;

\echo '== T03 постановщик назначает исполнителем постановщика (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
insert into public.tasks (object_id, title, assignee_id) values (:'o1', 'x', :'M');
rollback;

\echo '== T04 исполнитель создаёт объект (ожидаем ERROR RLS)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
insert into public.objects (name) values ('Мой объект');
rollback;

\echo '== T05 E1 видит задачи (ожидаем 1 — только свою)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select count(*) as tasks_visible from public.tasks;
\echo '== T06 E1 видит объекты (ожидаем 1 — ЖК Север)'
select name from public.objects;
\echo '== T07 E1 читает чужую задачу по id (ожидаем 0)'
select count(*) from public.tasks where id = :'t2';
\echo '== T08 E1 читает историю чужой задачи (ожидаем 0)'
select count(*) from public.task_history where task_id = :'t2';
commit;

\echo '== T09 E1 меняет статус напрямую UPDATE (ожидаем ERROR permission)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
update public.tasks set status = 'accepted' where id = :'t1';
rollback;

\echo '== T10 E1 меняет название своей задачи (ожидаем UPDATE 0 — RLS не пускает)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
\set QUIET off
update public.tasks set title = 'hacked' where id = :'t1';
\set QUIET on
rollback;

\echo '== T11 E1 пишет в историю (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
insert into public.task_history (task_id, actor_id, from_status, to_status) values (:'t1', :'M', 'on_review', 'accepted');
rollback;

\echo '== T12 E1: Новая -> Принята (запрещённый переход, ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select status from public.change_task_status(:'t1', 'accepted');
rollback;

\echo '== T13 E1 берёт в работу ЧУЖУЮ задачу (ожидаем ERROR Задача не найдена)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select status from public.change_task_status(:'t2', 'in_progress');
rollback;

\echo '== T14 постановщик берёт задачу в работу за исполнителя (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
select status from public.change_task_status(:'t1', 'in_progress');
rollback;

\echo '== T15 E1: Новая -> В работе -> На проверке (ожидаем OK)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select status from public.change_task_status(:'t1', 'in_progress');
select status from public.change_task_status(:'t1', 'on_review', 'Готово');
commit;

\echo '== T16 E1 сам принимает свою задачу (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select status from public.change_task_status(:'t1', 'accepted');
rollback;

\echo '== T17 постановщик возвращает без комментария (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
select status from public.change_task_status(:'t1', 'rework', '   ');
rollback;

\echo '== T18 постановщик возвращает с комментарием, E1 снова в работу (ожидаем OK)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
select status from public.change_task_status(:'t1', 'rework', 'Переделать опалубку');
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select status from public.change_task_status(:'t1', 'in_progress');
commit;

\echo '== T19 история задачи t1 глазами E1'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
select h.from_status, h.to_status, p.full_name as actor, h.comment from public.task_history h join public.profiles p on p.id = h.actor_id where h.task_id = :'t1' order by h.id;
commit;

\echo '== T20 постановщик меняет статус напрямую UPDATE (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
update public.tasks set status = 'accepted' where id = :'t1';
rollback;

\echo '== T21 постановщик подделывает автора (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
update public.tasks set author_id = :'E2' where id = :'t1';
rollback;

\echo '== T22 постановщик удаляет / меняет историю (ожидаем ERROR x2)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
delete from public.task_history where task_id = :'t1';
rollback;
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
update public.task_history set comment = 'fake' where task_id = :'t1';
rollback;

\echo '== T23 service_role пишет в историю (ожидаем ERROR)'
begin; set local role service_role;
insert into public.task_history (task_id, actor_id, to_status) values (:'t1', :'M', 'accepted');
rollback;

\echo '== T24 админ БД (postgres) меняет / удаляет историю (ожидаем ERROR x2)'
update public.task_history set comment = 'x' where task_id = :'t1';
delete from public.task_history where task_id = :'t1';

\echo '== T25 исполнитель меняет себе роль (ожидаем ERROR)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true) \gset x_
update public.profiles set role = 'manager' where id = :'E1';
rollback;

\echo '== T26 anon читает задачи / вызывает RPC (ожидаем ERROR x2)'
begin; set local role anon;
select count(*) from public.tasks;
rollback;
begin; set local role anon;
select public.change_task_status(:'t1', 'on_review');
rollback;

\echo '== T27 вызов служебной функции через private от anon (ожидаем ERROR)'
begin; set local role anon;
select private.is_manager();
rollback;

\echo '== T28 удаление объекта с задачами (ожидаем ERROR FK)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
delete from public.objects where id = :'o1';
rollback;

\echo '== T29 постановщик удаляет задачу t2 — история уходит каскадом (ожидаем OK, история 0)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true) \gset x_
\set QUIET off
delete from public.tasks where id = :'t2';
\set QUIET on
commit;
select count(*) as history_left_for_t2 from public.task_history where task_id = :'t2';

\echo '== T30 E2 после удаления задачи больше не видит объект ЖК Юг (ожидаем 0)'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true) \gset x_
select count(*) from public.objects;
commit;
