-- Girigo v2 schema — run this in Supabase SQL Editor
-- 1) Enable pgvector
create extension if not exists vector;

-- 2) Papers — one row per source paper
create table if not exists papers (
  id            text primary key,                -- e.g. "s2:DOI" or "arxiv:..."
  title         text not null,
  abstract      text,
  doi           text,
  year          int,
  authors       text[],
  source        text not null,                   -- "s2" | "arxiv" | "openalex"
  external_url  text,
  text_source   text,                            -- "pdf" | "abstract"
  created_at    timestamptz not null default now()
);
create index if not exists papers_year_idx on papers(year desc);

-- 3) Chunks — chunked text + embedding (Voyage 3 = 1024 dim)
create table if not exists chunks (
  id            bigserial primary key,
  paper_id      text not null references papers(id) on delete cascade,
  chunk_index   int  not null,
  chunk_text    text not null,
  token_count   int,
  embedding     vector(1024) not null,
  unique (paper_id, chunk_index)
);

-- IVFFLAT index for fast cosine similarity search
-- (build after rows inserted; rebuild lists ~ sqrt(rowcount))
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4) Sessions — interrogation sessions
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  suspect_name    text not null,
  relation        text not null,                 -- "연인" | "친구" | "사제" | etc
  situation       text not null,
  status          text not null default 'active',-- 'active' | 'closed'
  verdict         text,                          -- 'TRUTHFUL' | 'PARTIAL' | 'EVASIVE' | 'DECEPTIVE' | null
  confidence      int,                           -- 0-100
  report          jsonb,                         -- final report payload
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);

-- 5) Messages — full transcript per session
create table if not exists messages (
  id          bigserial primary key,
  session_id  uuid not null references sessions(id) on delete cascade,
  role        text not null,                    -- 'profiler' | 'suspect'
  content     text not null,
  rag_chunks  bigint[],                          -- chunks.id[] used for this turn (audit trail)
  created_at  timestamptz not null default now()
);
create index if not exists messages_session_idx on messages(session_id, created_at);

-- 6) Vector search RPC — top-K chunks for a query embedding
create or replace function match_chunks(
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id          bigint,
  paper_id    text,
  chunk_text  text,
  similarity  float,
  title       text,
  authors     text[],
  year        int
)
language sql stable as $$
  select
    c.id,
    c.paper_id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity,
    p.title,
    p.authors,
    p.year
  from chunks c
  join papers p on p.id = c.paper_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
