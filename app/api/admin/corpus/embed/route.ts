import { buildCorpusDocs, embedText } from '@/lib/corpus';
import { adminClient } from '@/lib/supabase';
import { ApiError, ok, toResponse } from '@/lib/http';

/**
 * POST /api/admin/corpus/embed · gera/atualiza o corpus vetorial (uma vez).
 *
 * Protegida por `EMBED_ADMIN_KEY` (Bearer): qualquer partida tem token de
 * professor, mas NENHUM token de partida deve conseguir escrever o corpus.
 * Idempotente (upsert por `slug`): rodar de novo só re-embedda as fichas.
 *
 * Custo: 15 embeddings fixos do `gemini-embedding-001` (plano gratuito
 * cobre com folga) — é o ÚNICO momento de custo do RAG; por aluno, zero.
 */
export async function POST(request: Request) {
  try {
    const adminKey = process.env.EMBED_ADMIN_KEY;
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!adminKey || adminKey.trim() === '' || provided !== adminKey) {
      throw new ApiError('unauthorized', 'Chave de administração ausente ou inválida.');
    }

    const docs = buildCorpusDocs();
    const client = adminClient();
    let gravados = 0;

    for (const doc of docs) {
      const embedding = await embedText(`${doc.titulo}\n${doc.trecho}`);
      const { error } = await client.from('corpus_politicas').upsert(
        {
          slug: doc.slug,
          tipo: doc.tipo,
          titulo: doc.titulo,
          fonte: doc.fonte,
          texto: doc.trecho,
          embedding,
        },
        { onConflict: 'slug' },
      );

      if (error) {
        console.error('[safra-df] falha ao gravar ficha do corpus:', doc.slug, error.message);
        throw new ApiError('server_error', `Falha ao gravar a ficha "${doc.slug}".`, error.message);
      }
      gravados += 1;
    }

    return ok({ ok: true, documentos: gravados });
  } catch (error) {
    return toResponse(error);
  }
}