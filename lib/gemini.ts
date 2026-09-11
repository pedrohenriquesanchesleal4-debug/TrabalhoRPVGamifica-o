import { ApiError } from '@/lib/http';
import { adminClient } from '@/lib/supabase';
import { montarMaterialDeApoio } from '@/lib/corpus';
import type { HostView } from '@/lib/game-service';
import {
  AWARD_META,
  DECISION_TAG_LABEL,
  PROFILE_META,
  type DecisionTag,
} from '@/types/game';

/**
 * Roteiro de debate pós-partida, gerado por IA para o professor.
 *
 * Disciplina de cota (Gemini plano gratuito):
 * - UMA chamada por partida. O resultado é gravado em `debate_prep` e reabrir
 *   a tela / clicar de novo lê do banco, sem gastar nada.
 * - Singleflight em memória: dois cliques simultâneos compartilham a MESMA
 *   chamada, em vez de dispararem duas (proteção extra contra RPM).
 * - Timeout de 25s com AbortController: chamada pendurada não trava a sala.
 * - Sem retry em 429 (cota): esperar e tentar de novo é gastar a cota que já
 *   está estourando. Retry único só para rede / 5xx transitório.
 * - `maxOutputTokens` enxuto (800) e snapshot compacto (~2-4k tokens de
 *   entrada), só com os fatos que o roteiro precisa citar.
 */

const DEFAULT_MODEL = 'gemini-3.6-flash';
// O 3.6-flash consome tokens de SAÍDA no "pensamento" antes do texto visível
// (medido: 469 tokens de thinking numa resposta de 41). 1500 garante margem
// para o raciocínio + os ~800 tokens do roteiro, sem inflar a janela.
const MAX_OUTPUT_TOKENS = 1_500;
const TIMEOUT_MS = 25_000;
const SNAPSHOT_CHAR_CAP = 7_000;

export interface DebatePrep {
  roteiro: string;
  modelo: string;
  /** true quando a resposta veio do cache (não gastou chamada de IA). */
  doCache: boolean;
  /** true quando o roteiro veio com fichas citáveis (RAG Fase 2). */
  materialUsado: boolean;
}

type RoteiroSalvo = { roteiro: string; modelo: string; materialUsado: boolean };

// ---------------------------------------------------------------------------
// Instrução de sistema: pequena, estática, toda a política pedagógica aqui.
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `Você é um professor experiente de educação do campo, apoiando um colega que acabou de mediar o SAFRA DF: jogo de simulação de agricultura familiar no Distrito Federal, 5 rodadas (Preparação, Produção, Mercado, Desafio, Colheita) e 4 indicadores por equipe (finanças, produção, tecnologia, sustentabilidade).

Com base APENAS nos dados reais da partida fornecidos, escreva um roteiro para o professor conduzir a roda de conversa com a turma depois do jogo. Regras rígidas:
1. Não invente números, nomes, programas ou eventos: cite somente fatos presentes nos dados.
2. Nunca diga que uma equipe está certa ou errada, e nunca declare "estratégia ótima". Trate as escolhas como trade-offs legítimos.
3. Português do Brasil, linguagem oral de mediação, dirigindo-se ao professor ("você"). Tom acolhedor, nunca punitivo, nunca irônico.
4. Políticas públicas e tecnologias reais só podem ser citadas se aparecerem em "politicasPublicas" do snapshot ou na seção "## Materiais de apoio" (o nome real e a Fonte vêm junto). Fora isso, use sempre "programa público" genérico.
5. Cada ponto deve ancorar em pelo menos um fato concreto da partida (um indicador final, uma escolha repetida, um evento, um contraste entre equipes).
6. Markdown permitido apenas: # título, ## subtítulo, - listas, 1. listas numeradas e **negrito** para destacar o fato. Nada além disso.

Formato exato de saída, com exatamente estes 4 blocos, nesta ordem:

# Fala de abertura
(2 a 3 frases: acolher a turma, nomear um contraste real que a partida revelou)

## Pontos para sustentar
- **Fato:** <o que aconteceu na partida> — **Você pode dizer:** <1-2 frases de interpretação pedagógica>
(3 a 5 pontos, todos ancorados nos dados)

## Provocação
(uma pergunta forte, sem resposta única, ancorada em um fato da partida)

## Perguntas para a sala
1. <pergunta direta que qualquer equipe consiga responder pela própria experiência>
2. <pergunta direta que force comparar estratégias diferentes>

7. Quando citar um programa ou técnica da seção "## Materiais de apoio", acrescente a Fonte exatamente como fornecida, no formato: (Fonte: <fonte>). Cite apenas nomes presentes na seção.`;

// ---------------------------------------------------------------------------
// Snapshot compacto da partida (tudo que o roteiro pode citar, sem ruído).
// ---------------------------------------------------------------------------

const TAG_LABEL = (tag: DecisionTag) => DECISION_TAG_LABEL[tag] ?? tag;

/** Cabeçalho estático + dados; separados para manter o prefixo cacheável. */
export function buildDebateSnapshot(view: HostView): string {
  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

  const scoreByTeam = new Map(view.scores.map((score) => [score.teamId, score]));

  const profileLabelOf = (profile: string) =>
    (PROFILE_META as Record<string, { label: string }>)[profile]?.label ?? profile;
  const awardLabelOf = (award: string) =>
    (AWARD_META as Record<string, { label: string }>)[award]?.label ?? award;

  const compact = {
    partida: view.game.code,
    orcamentoInicial: money.format(view.game.config.initialBudget),
    equipes: view.teams.map((team) => {
      const score = scoreByTeam.get(team.id);
      return {
        nome: team.name,
        perfil: score ? profileLabelOf(score.profile) : null,
        premios: (score?.awards ?? []).map(awardLabelOf).slice(0, 3),
      caixa: money.format(team.state.cash),
      producao: team.state.production,
      tecnologia: team.state.technology,
      sustentabilidade: team.state.sustainability,
      historico: team.history.map((decision) => ({
        rodada: `R${decision.roundIndex}`,
        escolha: decision.optionLabel,
        tags: decision.tags.slice(0, 4).map(TAG_LABEL),
      })),
      };
    }),
    diagnostico: view.diagnostics.map((entry) => ({
      tag: TAG_LABEL(entry.tag),
      equipes: `${entry.teams}/${entry.totalTeams}`,
      decisoes: entry.decisions,
    })),
    ganchos: view.teachingHooks.slice(0, 6),
    politicasPublicas: view.policyConnections.map((connection) => ({
      sigla: connection.policy.acronym,
      nome: connection.policy.name,
      nota: connection.note.slice(0, 180),
    })),
  };

  const json = JSON.stringify(compact);
  if (json.length > SNAPSHOT_CHAR_CAP) {
    // Ajuste de emergência: nunca enviar um snapshot que estoura a janela.
    throw new ApiError(
      'server_error',
      'A partida gerou dados grandes demais para o roteiro. Tente de novo em instantes.',
    );
  }
  return json;
}

// ---------------------------------------------------------------------------
// Chamada ao Gemini (regras de cota aplicadas aqui).
// ---------------------------------------------------------------------------

const IN_FLIGHT = new Map<string, Promise<RoteiroSalvo>>();

function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    throw new ApiError(
      'server_error',
      'A chave da IA não está configurada no servidor (GEMINI_API_KEY).',
    );
  }
  return key.trim();
}

async function callGemini(snapshot: string, key: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(key)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Dados reais desta partida (use apenas estes fatos):\n' +
                  '```json\n' +
                  snapshot +
                  '\n```',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // 429 = cota/RPM estourada: NÃO tentar de novo, a cota é o problema.
      if (response.status === 429) {
        throw new ApiError(
          'server_error',
          'A IA está no limite de requisições agora. Espere um minuto e tente de novo.',
        );
      }
      // Chave/modelo recusados = problema de configuração, retry não resolve.
      if (response.status >= 400 && response.status < 500) {
        console.error('[safra-df] Gemini recusou a requisição:', response.status, detail);
        throw new ApiError(
          'server_error',
          'A configuração da IA recusou o pedido. Verifique a chave e o modelo no servidor.',
        );
      }
      // 5xx: transitório, o retry único lá embaixo cobre.
      throw new Error(`Gemini respondeu ${response.status}: ${detail}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text =
      payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    if (!text.trim()) {
      throw new Error('Gemini retornou resposta vazia.');
    }
    return text.trim();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('server_error', 'A IA demorou demais para responder. Tente de novo.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Chamada com 1 retry único para falha transitória (rede/5xx). Nunca para 429. */
async function callGeminiWithRetry(snapshot: string): Promise<string> {
  const key = requireGeminiKey();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callGemini(snapshot, key);
    } catch (error) {
      const retryable = error instanceof Error && !(error instanceof ApiError);
      if (!retryable || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
  }

  throw new ApiError('server_error', 'Não foi possível gerar o roteiro agora. Tente de novo.');
}

// ---------------------------------------------------------------------------
// Serviço: cache no banco + singleflight + geração.
// ---------------------------------------------------------------------------

/**
 * Roteiro de debate para uma partida encerrada.
 *
 * Ordem: (1) cache no banco, (2) guarda de cliques simultâneos, (3) geração.
 * Duas garantias de cota: um clique duplo não dobra a chamada, e reabrir a
 * página nunca regenera.
 */
export async function generateDebateRoteiro(
  gameId: string,
  view: HostView,
): Promise<DebatePrep> {
  const client = adminClient();

  const cached = await client.from('debate_prep')
    .select('roteiro, modelo, material_usado')
    .eq('game_id', gameId)
    .maybeSingle();

  if (cached.error) {
    console.error('[safra-df] falha ao ler roteiro salvo:', cached.error.message);
    throw new ApiError('server_error', 'Falha ao consultar o roteiro salvo.');
  }
  if (cached.data?.roteiro) {
    return {
      roteiro: cached.data.roteiro,
      modelo: cached.data.modelo,
      doCache: true,
      materialUsado: cached.data.material_usado ?? false,
    };
  }

  let promise = IN_FLIGHT.get(gameId);
  if (!promise) {
    promise = generateAndSave(gameId, view).finally(() => IN_FLIGHT.delete(gameId));
    IN_FLIGHT.set(gameId, promise);
  }

  const { roteiro, modelo, materialUsado } = await promise;
  return { roteiro, modelo, doCache: false, materialUsado };
}

async function generateAndSave(
  gameId: string,
  view: HostView,
): Promise<RoteiroSalvo> {
  const snapshot = buildDebateSnapshot(view);

  // RAG: incorpora a partida, busca 3 fichas citáveis. Falha degrada para o
  // roteiro sem material de apoio — a geração nunca trava por causa disso.
  const material = await montarMaterialDeApoio(snapshot).catch(() => '');
  const roteiro = await callGeminiWithRetry(material ? `${snapshot}\n\n${material}` : snapshot);
  const modelo = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  const saved = await adminClient()
    .from('debate_prep')
    .upsert(
      { game_id: gameId, roteiro, modelo, material_usado: material !== '' },
      { onConflict: 'game_id' },
    );

  if (saved.error) {
    console.error('[safra-df] falha ao salvar roteiro:', saved.error.message);
    throw new ApiError(
      'server_error',
      'O roteiro foi gerado, mas não pôde ser salvo. Clique em "Preparar" de novo: ele virá do cache.',
    );
  }

  return { roteiro, modelo, materialUsado: material !== '' };
}

/** Visibilidade para testes: nada aqui precisa da rede. */
export const _internals = { requireGeminiKey, callGeminiWithRetry };