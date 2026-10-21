create extension if not exists pgcrypto;
create type public.content_status as enum ('draft','published','archived');
create type public.subscription_status as enum ('pending','active','expired','cancelled','refunded');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 preferred_language text not null default 'mn' check (preferred_language in ('mn','en')),
 created_at timestamptz not null default now()
);
create table public.manga (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 title_mn text not null, title_en text, description_mn text, description_en text,
 cover_url text, genres text[] not null default '{}', status public.content_status not null default 'draft',
 is_published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.chapters (
 id uuid primary key default gen_random_uuid(), manga_id uuid not null references public.manga(id) on delete cascade,
 chapter_number numeric(8,2) not null, title_mn text, title_en text, is_vip boolean not null default false,
 status public.content_status not null default 'draft', published_at timestamptz, created_at timestamptz not null default now(),
 unique (manga_id, chapter_number)
);
create table public.chapter_pages (
 id uuid primary key default gen_random_uuid(), chapter_id uuid not null references public.chapters(id) on delete cascade,
 page_number integer not null check (page_number > 0), image_url text not null,
 translation_mn text, translation_en text, created_at timestamptz not null default now(), unique (chapter_id, page_number)
);
create table public.vip_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 provider text not null, provider_reference text unique, status public.subscription_status not null default 'pending',
 starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
create table public.reading_progress (
 user_id uuid not null references public.profiles(id) on delete cascade,
 manga_id uuid not null references public.manga(id) on delete cascade,
 chapter_id uuid references public.chapters(id) on delete set null,
 page_number integer not null default 1 check (page_number > 0), updated_at timestamptz not null default now(),
 primary key (user_id, manga_id)
);
create index idx_manga_published on public.manga(is_published, created_at desc);
create index idx_chapters_manga on public.chapters(manga_id, chapter_number);
create index idx_pages_chapter on public.chapter_pages(chapter_id, page_number);
create index idx_vip_user_status on public.vip_subscriptions(user_id, status, ends_at);

alter table public.profiles enable row level security;
alter table public.manga enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_pages enable row level security;
alter table public.vip_subscriptions enable row level security;
alter table public.reading_progress enable row level security;
create policy "Public can read published manga" on public.manga for select using (is_published = true);
create policy "Public can read published chapters" on public.chapters for select using (status = 'published' and exists (select 1 from public.manga m where m.id = manga_id and m.is_published = true));
create policy "Public can read pages of free published chapters" on public.chapter_pages for select using (exists (select 1 from public.chapters c join public.manga m on m.id = c.manga_id where c.id = chapter_id and c.status = 'published' and m.is_published = true and c.is_vip = false));
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users read own subscriptions" on public.vip_subscriptions for select using (auth.uid() = user_id);
create policy "Users read own progress" on public.reading_progress for select using (auth.uid() = user_id);
create policy "Users insert own progress" on public.reading_progress for insert with check (auth.uid() = user_id);
create policy "Users update own progress" on public.reading_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name','Reader')) on conflict (id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
