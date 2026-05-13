-- Dayflow: tasks table with soft lifecycle (no hard delete in app)
-- Run in Supabase SQL Editor or via migrations

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  task_date date not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, task_date);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.handle_task_status()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      new.completed_at = coalesce(new.completed_at, now());
    else
      new.completed_at = null;
    end if;
  else
    if new.status = 'completed' and old.status is distinct from 'completed' then
      new.completed_at = coalesce(new.completed_at, now());
    elsif new.status = 'pending' then
      new.completed_at = null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists tasks_handle_status on public.tasks;
create trigger tasks_handle_status
before insert or update on public.tasks
for each row execute function public.handle_task_status();

alter table public.tasks enable row level security;

-- Policies: users only touch their own rows
create policy "tasks_select_own"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id);

-- Intentionally no DELETE policy — app never hard-deletes

-- Realtime: add table to supabase_realtime publication (Dashboard → Database → Replication)
-- SQL:
-- alter publication supabase_realtime add table public.tasks;

comment on table public.tasks is 'Dayflow daily tasks; status toggles completion without deletion.';
