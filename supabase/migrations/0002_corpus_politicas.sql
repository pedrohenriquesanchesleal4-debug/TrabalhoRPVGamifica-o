-- Corpus vetorial do roteiro de debate (RAG Fase 2) · 768 dims · HNSW.
--
-- Motivo do 768: o índice HNSW do pgvector aceita no máximo 2000 dims, e o
-- gemini-embedding-001 entrega 3072 por padrão. Testado ao vivo na chave do
-- projeto: `outputDimensionality: 768` funciona (768 e 1536 aceitos) — o
-- código em `lib/corpus.ts` pede 768 ao gerar cada embedding.
--
-- Idempotente e defensiva: se você rodou a versão anterior (3072) e ela
-- falhou no meio, as linhas abaixo apagam o estado parcial e recriam do zero.
-- Rode com calma: nada é apagado que não possa ser refeito por
-- `npm run embed:corpus`.

-- pgvector já vem habilitado no Supabase; idempotente por garantia.
create extension if not exists vector;

-- Roteiro ganha a marca de "veio com material de apoio citável" (RAG Fase 2).
alter table public.debate_prep
  add column if not exists material_usado boolean not null default false;

-- Limpeza defensiva do estado parcial (assinaturas de ambos os tamanhos).
drop function if exists public.match_corpus(vector(3072), int);
drop function if exists public.match_corpus(vector(768), int);
drop table if exists public.corpus_politicas;

create table if not exists public.corpus_politicas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  tipo text not null check (tipo in ('politica', 'tecnologia')),
  titulo text not null,
  fonte text not null,
  texto text not null,
  embedding vector(768) not null,
  criado_em timestamptz not null default now()
);

-- 768 ≤ 2000: o HNSW cabe (o erro de 54000 era por 3072).
create index if not exists corpus_politicas_embedding_idx
  on public.corpus_politicas
  using hnsw (embedding vector_cosine_ops);

-- Busca vetorial das 3 fichas mais próximas da partida.
create or replace function public.match_corpus(
  query_embedding vector(768),
  match_count int default 3
) returns table (
  slug text,
  tipo text,
  titulo text,
  fonte text,
  texto text,
  similidade real
) language plpgsql as $$
begin
  return query
    select
      c.slug,
      c.tipo,
      c.titulo,
      c.fonte,
      c.texto,
      1 - (c.embedding <=> query_embedding) as similidade
    from public.corpus_politicas c
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;