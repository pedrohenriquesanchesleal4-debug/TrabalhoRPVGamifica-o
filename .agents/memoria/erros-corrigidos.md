# Erros corrigidos

## 2026-09-09 · criação de partida podia cair no fallback genérico de erro

**Sintoma**: professor via "Algo falhou no servidor. Tente de novo." (o fallback
genérico de `toResponse` em `lib/http.ts:83`) ao criar partida, de forma
intermitente.

**Investigação (RCA)**: percorri todo `POST /api/games` → `createGame` →
`lib/supabase.ts` → `lib/env.ts` → `game/engine.ts` e inspecionei o código-fonte
instalado de `@supabase/supabase-js` 2.116.0 (`node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts`).
Achado que refuta a hipótese inicial: nesta versão da lib, `shouldThrowOnError`
é `false` por padrão e este projeto nunca chama `.throwOnError()`, então TODA
falha de rede do `fetch` (inclusive `TypeError: fetch failed`) já é capturada
internamente pela lib e devolvida como `{ data: null, error }`, nunca como
exceção. Leituras (GET) inclusive já têm retry automático com backoff
embutido na lib; só escritas (POST/PATCH) não retriam sozinhas.

Os pontos que realmente lançam exceção crua (não-`ApiError`) no caminho de
criação, confirmados por leitura de código-fonte:
1. `lib/env.ts` `required()` → `Error` puro se `NEXT_PUBLIC_SUPABASE_URL` ou
   `SUPABASE_SERVICE_ROLE_KEY` estiver ausente/vazia.
2. `createClient()` de `@supabase/supabase-js` (`helpers.ts`) → `Error` puro
   síncrono para URL inválida ou chave ausente (`adminClient()` em
   `lib/supabase.ts` chama isso sem try/catch).
3. `game/engine.ts` `initialTeamState()` → `Error` puro para chave de
   propriedade desconhecida (defensivo, mas alcançável se `data/properties.ts`
   divergir do mapa de traços da engine).
4. Falha de rede persistente numa escrita (`game_secrets`/`teams` insert) já
   virava `ApiError`, mas com a mesma mensagem de erro de negócio (ex.: "Falha
   ao criar as equipes."), sem distinguir rede de config de constraint: o
   professor não sabia se adiantava tentar de novo.

**Causa raiz**: nenhuma dessas quatro exceções tinha um handler específico;
todas caíam no catch genérico de `toResponse`, que classifica só `ApiError`,
`InvalidDecisionError` e `ZodError`.

**Correção** (`lib/game-service.ts`):
- `createGame` inteiro agora roda dentro de um try/catch que classifica
  qualquer exceção não prevista via `classifyGameCreationError`: mensagens
  distintas para erro de configuração (`/configura/i`), erro de rede
  (`/rede|conex/i`) e erro genérico, sempre logando tipo, causa e stack no
  servidor.
- `withNetworkRetry` reexecuta escritas (`game_secrets`, `teams` insert) até
  2 vezes com backoff curto (150ms, 400ms) só quando a falha detectada é de
  rede (`isNetworkError`); erro de negócio (ex.: `unique_violation`) falha na
  hora, sem esperar.
- Se o retry se esgota por rede persistente, o erro final é reclassificado
  como erro de rede em vez da mensagem genérica de negócio da etapa.

**Teste de regressão**: `tests/game-service.test.ts` (`describe('createGame ·
classificação de erro inesperado')`), 4 casos: config ausente vira ApiError
acionável; rede transitória se recupera sozinha; rede persistente vira ApiError
de rede (não a genérica); erro de negócio continua imediato, sem retry.

**Prevenção**: qualquer novo throw síncrono introduzido no caminho de
`createGame` (nova dependência, nova validação) precisa passar pelo try/catch
existente ou ganhar sua própria branch em `classifyGameCreationError` para não
regressar ao fallback genérico.

---

## 2026-09-09 · latência patológica em `/api/player/view` (até 20s sob carga)

**Sintoma**: logs de `next dev` mostravam `application-code: 20-21s` em
`GET /api/player/view`, sob ~30 abas concorrentes de um teste automatizado.

**Investigação (RCA, 5 Porquês)**:
1. Por que 20s dentro do handler? `getPlayerView` (`lib/game-service.ts`)
   encadeava até 11 consultas ao Supabase **em série**, quando várias eram
   independentes entre si.
2. Por que em série se são independentes? `authenticatePlayer` buscava
   `player_secrets` → `players` → `team_members` → `teams` → `games`, um
   `await` depois do outro, embora `players`/`team_members` dependam só do
   `player_id` do primeiro resultado (não um do outro), e `teams`/`games`
   dependam só de `member`/`player` respectivamente (não um do outro).
   `getPlayerView` repetia o padrão: roster → jogadores por id (join
   evitável) e evento → dica → decisão (decisão não depende do evento).
3. Por que isso importa tanto aqui? O Supabase deste projeto fica em
   us-west-2, acessível só pelo pooler IPv4 (ver `safra-df-supabase.md`), com
   ~250-400ms medidos por round-trip nesta rede. Round-trips em série somam;
   em paralelo, custam o máximo do grupo, não a soma.
4. Por que a carga de 30 abas piora desproporcionalmente? Cada requisição
   segura conexões do pool do Supabase (plano gratuito) por mais tempo
   quanto mais round-trips em série ela faz, então a fila de conexão cresce
   com o quadrado do número de round-trips sob concorrência, não linear.
5. Por que não foi pego antes? Não havia teste medindo round-trips/latência
   de `game-service.ts`, só testes puros de `game/engine.ts`.

**Medição empírica** (chamada direta de `getPlayerView` contra o Supabase
real deste projeto, sem servidor HTTP no meio, 5 chamadas sequenciais):
- Antes: HTTP end-to-end com `curl`, evento ativo: 2.97s / 3.34s / 3.15s /
  3.00s / 2.97s (média ~3.1s).
- Depois: 3.36s / 2.30s / 2.08s / 2.30s / 2.84s (média ~2.6s; excluindo o
  primeiro, que sempre paga o custo de conexão a frio, ~2.0-2.3s vs ~3.0s
  antes: -30% a -35%).

**Correção** (`lib/game-service.ts`):
- `authenticatePlayer`: `players`+`team_members` agora rodam em
  `Promise.all` (ambos dependem só de `secret.player_id`); `teams`+`games`
  também (dependem só de `member`/`player`, não um do outro). 5 passos em
  série viram 3.
- `getPlayerView`: roster + jogadores da equipe viram uma única consulta com
  embedding de FK (`team_members.select('player_id, role,
  players(id, name, connected, state, last_seen)')`), eliminando um
  round-trip inteiro. Evento e decisão da rodada (independentes entre si)
  agora rodam em `Promise.all`; a dica de função continua depois do evento
  porque depende do `event.id`.
- Nenhuma mudança de semântica: mesmos dados, mesma forma de resposta,
  confirmado por teste de conteúdo (`view.event`, `view.teammates`,
  `view.decision`) e pela suíte completa (81 testes, incluindo os 75 já
  existentes de `game/engine.ts`/diagnóstico/conteúdo).

**Teste de regressão**: `tests/game-service.test.ts` (`describe('getPlayerView
/ authenticatePlayer · paralelismo de consultas')`) usa um cliente Supabase
falso que conta quantas consultas ficam "em voo" ao mesmo tempo
(`maxConcurrency`). Os dois testes falham (`maxConcurrency === 1`) se alguém
reintroduzir a versão 100% em série.

**Honestidade sobre o número de 20s do log original**: não reproduzi 20s
isoladamente; a carga de 30 abas de `next dev` é saturação real de ambiente de
desenvolvimento (single-threaded, sem cache de build) e amplifica qualquer
latência de rede. O que fica provado por evidência é a causa estrutural (11
round-trips em série, vários evitáveis) e a redução real de ~30-35% por
chamada; a fração exata do 20s atribuível a cada fator (saturação do dev vs.
round-trips em série vs. concorrência no pool do Supabase) não foi isolada
porque exigiria reproduzir a carga de 30 abas, fora do escopo desta correção.
