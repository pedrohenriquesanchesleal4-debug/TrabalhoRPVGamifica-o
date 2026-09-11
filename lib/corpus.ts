import { POLICIES } from '@/data/policies';
import { TECHNOLOGIES } from '@/data/technologies';
import { adminClient } from '@/lib/supabase';
import { ApiError } from '@/lib/http';

/**
 * Corpus vetorial de políticas públicas e tecnologias (RAG Fase 2).
 *
 * As fichas NÃO são texto novo: derivam do que o jogo já declara em
 * `data/policies.ts` e `data/technologies.ts` (finalidade, requisito, risco),
 * sem inventar número, regra ou critério de habilitação. A fonte de cada ficha
 * é a origem declarada pelo próprio app.
 *
 * Cota: 15 embeddings fixos, gerados UMA única vez pelo script
 * `embed:corpus` (rota admin). Na geração do roteiro, o servidor faz 1
 * embedding da partida + busca SQL the 3 fichas mais próximas — nenhuma
 * chamada de IA por aluno, e falha de embedding degrada para roteiro sem
 * corpus (o recurso nunca trava por causa do apoio).
 */

const DEFAULT_EMBED_MODEL = 'gemini-embedding-001';
const EMBED_TIMEOUT_MS = 15_000;
/**
 * Dimensionalidade pedida ao modelo via `outputDimensionality` (testado ao
 * vivo na chave: 768 e 1536 aceitos). Necessário porque o índice HNSW do
 * pgvector aceita no máximo 2000 dims, e o default do gemini-embedding-001 é
 * 3072 — a tabela guarda vetores maiores, o ÍNDICE não. 768 é folga de sobra
 * para 15 fichas e busca de qualidade equivalente.
 */
const EMBED_DIM = 768;

export interface CorpusDoc {
  slug: string;
  tipo: 'politica' | 'tecnologia';
  titulo: string;
  fonte: string;
  trecho: string;
}

export interface CorpusHit extends CorpusDoc {
  similidade: number;
}

// ---------------------------------------------------------------------------
// Fichas derivadas dos dados já existentes do app (fonte de verdade única).
// ---------------------------------------------------------------------------

export function buildCorpusDocs(): CorpusDoc[] {
  const docs: CorpusDoc[] = [];

  for (const policy of POLICIES) {
    docs.push({
      slug: policy.key,
      tipo: 'politica',
      titulo: `${policy.name} (${policy.acronym})`,
      fonte: 'Portais oficiais: Governo do Distrito Federal · Emater-DF · FNDE (PNAE) · Conab (PAA)',
      trecho: `${policy.description} ${policy.simulatedIn}`,
    });
  }

  for (const tech of TECHNOLOGIES) {
    docs.push({
      slug: tech.key,
      tipo: 'tecnologia',
      titulo: tech.name,
      fonte: 'SAFRA DF · catálogo do jogo (custos fictícios; requisito pedagógico real)',
      trecho: `${tech.benefit} Requisito: ${tech.requirement} Risco: ${tech.risk}`,
    });
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Embedding (gemini-embedding-001 · EMBED_DIM dims via outputDimensionality).
// ---------------------------------------------------------------------------

function requireEmbedKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    throw new ApiError(
      'server_error',
      'A chave da IA não está configurada no servidor (GEMINI_API_KEY).',
    );
  }
  return key.trim();
}

export async function embedText(text: string): Promise<number[]> {
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_EMBED_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent` +
    `?key=${encodeURIComponent(requireEmbedKey())}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBED_DIM,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[safra-df] embedContent falhou:', response.status, detail.slice(0, 200));
      throw new ApiError(
        'server_error',
        'A IA de busca não respondeu agora. O roteiro segue sem material de apoio.',
      );
    }

    const payload = (await response.json()) as {
      embedding?: { values?: number[] };
    };

    const values = payload.embedding?.values;
    if (!values || values.length === 0) {
      throw new Error('Embedding vazio retornado.');
    }
    return values;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('server_error', 'A busca demorou demais. Segue sem material de apoio.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Busca e montagem do material de apoio (pgvector, sem chamada de IA extra).
// ---------------------------------------------------------------------------

export async function buscarCorpus(embedding: number[], count = 3): Promise<CorpusHit[]> {
  const { data, error } = await adminClient().rpc('match_corpus', {
    query_embedding: embedding,
    match_count: count,
  });

  if (error || !data) {
    console.error('[safra-df] falha ao buscar corpus:', error?.message);
    return [];
  }

  return (data as CorpusHit[]).map((hit) => ({
    ...hit,
    trecho: hit.trecho.length > 240 ? `${hit.trecho.slice(0, 237)}...` : hit.trecho,
  }));
}

/**
 * Seção "Materiais de apoio" do prompt: 3 fichas mais próximas da partida.
 * Qualquer falha devolve string vazia — o roteiro sai igual, só sem citação.
 */
export async function montarMaterialDeApoio(snapshot: string): Promise<string> {
  const embedding = await embedText(snapshot);
  const hits = await buscarCorpus(embedding);

  if (hits.length === 0) return '';

  const blocos = hits.map((hit) => {
    const nome = hit.tipo === 'politica' ? hit.titulo : hit.titulo;
    return `- **${nome}** — ${hit.trecho} (Fonte: ${hit.fonte})`;
  });

  return `## Materiais de apoio\nVocê PODE citar estes pelo nome exato, cada um com sua Fonte, apenas onde encaixar no ponto:\n\n${blocos.join('\n')}`;
}