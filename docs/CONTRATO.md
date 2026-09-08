# Contrato interno · SAFRA DF

Referência para quem escreve interface. O backend, a engine e o conteúdo já
estão implementados: **não altere nada fora dos arquivos da sua frente.**

## Arquitetura

```
navegador  ──fetch──▶  route handler (app/api/**)  ──▶  lib/game-service.ts  ──▶  game/engine.ts
    │                        (service_role)                  (I/O + regras)        (regras puras)
    └──realtime (anon, só SELECT)──▶  Supabase: tabela game_events
```

Regra inviolável: **a interface nunca escreve no Supabase.** Toda mutação é
`fetch` para um route handler. O cliente anon só tem `SELECT` e realtime.

## Módulos prontos para consumir

| Módulo | O que oferece |
|---|---|
| `@/lib/client-api` | `createGame`, `fetchHostView`, `runHostAction`, `fetchProjection`, `joinGame`, `fetchPlayerView`, `submitDecision`, `sendHeartbeat`, `RequestError` |
| `@/lib/client-session` | `playerSession` e `hostSession` (`get`/`set`/`clear`) em localStorage |
| `@/hooks/use-game-channel` | `useGameChannel({ gameId, onEvent, onTeamUpdate })`, `useRoundTimer(endsAt, active)`, `formatClock` |
| `@/types/game` | tipos e rótulos: `ROLE_LABEL`, `ROLE_MISSION`, `ROUND_META`, `INDICATOR_LABEL`, `PROFILE_META`, `AWARD_META`, `DECISION_TAG_LABEL` |
| `@/data/properties` | `PROPERTIES`, `PROPERTY_BY_KEY` (nome, região, tagline, força, fraqueza) |
| `@/data/technologies`, `@/data/policies` | catálogo de referência e `POLICY_DISCLAIMER` |
| `@/game/diagnostics` | `diagnosticBar`, `diagnosticSentence` |
| `@/lib/game-service` | tipos `PlayerView`, `HostView`, `HostTeamView` (importe só o **tipo**, nunca a função, de código cliente) |

## API

| Método e rota | Auth | Corpo | Devolve |
|---|---|---|---|
| `POST /api/games` | nenhuma | `Partial<GameConfig>` | `{ gameId, code, hostToken, config, teams }` |
| `POST /api/games/join` | nenhuma | `{ code, name }` | `{ playerToken, gameId, team, role, roleLabel, roleMission }` |
| `GET /api/player/view` | Bearer jogador | | `PlayerView` |
| `POST /api/player/decision` | Bearer jogador | `{ optionKey }` | `{ optionLabel, locked }` |
| `POST /api/player/heartbeat` | Bearer jogador | | `{ ok }` |
| `GET /api/host/[gameId]` | Bearer professor | | `HostView` |
| `POST /api/host/[gameId]/action` | Bearer professor | `{ action, remainingSeconds? }` | `{ action, outcomes, view }` |
| `GET /api/projection/[gameId]` | nenhuma | | `HostView` |

`action` aceita: `start_round`, `resolve_round`, `pause`, `resume`, `finish`, `reset`.

Erros chegam como `{ error: { code, message, details } }`. Códigos relevantes
para a interface: `not_found` (código de partida errado), `game_full`,
`conflict` (rodada fechada, equipe já decidiu), `invalid_decision`
(`details.reason` é `insufficient_cash` ou `missing_trait`), `unauthorized`.
**Mostre `error.message`: ele já vem escrito em português para o aluno.**

## Eventos realtime

`PLAYER_JOINED`, `PLAYER_LEFT`, `TEAM_READY`, `ROUND_STARTED`,
`DECISION_SUBMITTED`, `DECISION_LOCKED`, `EVENT_RESOLVED`, `ROUND_ENDED`,
`GAME_PAUSED`, `GAME_RESUMED`, `GAME_FINISHED`, `GAME_RESET`.

Padrão de uso: ao receber evento, rebusque a visão (`fetchPlayerView` ou
`fetchHostView`). Nunca monte estado de jogo a partir do `payload` do evento:
ele existe para dizer que algo mudou e para animações pontuais.

## Fluxo das telas

**Aluno**: `/` escolhe "Entrar na partida" → `/entrar` (código e nome) →
`/jogar`. Em `/jogar`: aguarda início, recebe evento, discute, confirma opção,
vê consequência quando a rodada é resolvida, repete, vê resultado no fim.

**Professor**: `/` escolhe "Sou professor" → `/admin` (cria partida, projeta
código, vê equipes se formando, controla rodadas) → `/host/[gameId]` (projeção),
`/host/[gameId]/diagnostico` (diagnóstico da turma),
`/host/[gameId]/resultado` (ranking, perfis e debriefing).

## Direção visual: Caderno de Campo

A tela é uma folha do caderno em que o agricultor familiar anota tudo, e não um
painel de software. Tokens em `app/globals.css` (Tailwind v4, use como classe
utilitária: `bg-papel-100`, `text-tinta-900`, `border-papel-300`,
`text-carimbo-500`).

- **Papel**: `papel-000/100/200/300/400` · a folha, do branco da ficha nova ao
  kraft do miolo.
- **Tinta**: `tinta-900/700/500/400/200` · azul ferro-gálica quase preto, a cor
  da escrita.
- **Carimbo**: `carimbo-600/500/400` · o acento único, reservado para decisão,
  urgência e erro. Nunca decoração.
- **Indicadores**: `financas`, `producao`, `tecnologia`, `sustentabilidade`,
  cada um com uma trama própria (`.trama-*`) além da cor.
- **Fontes**: `font-maquina` (Courier Prime) em todo dado, rótulo, código,
  título e opção; `font-caderno` (Archivo) só na narrativa das cartas, que é o
  único texto longo do jogo.
- **Classes prontas**: `.ficha`, `.ficha-margem`, `.ficha-furos`, `.regua`,
  `.pontilhado`, `.rotulo`, `.carimbo`, `.trama-*`, `.tabular`,
  `.cursor-maquina`.
- **Animações**: `animate-bate` (o carimbo assentando), `animate-escreve`
  (linha saindo da máquina, na abertura), `animate-risca` (traço de caneta sob
  o título), `animate-pisca` (cursor e urgência do cronômetro).

Três decisões que sustentam a direção e não devem ser desfeitas sem trocar a
direção inteira:

1. **Nada flutua.** O contêiner é `.ficha`: borda de 1px, deslocamento duro de
   2px, raio zero. Sem card, sem sombra difusa, sem fundo cinza.
2. **Decisão é carimbo.** `<Carimbo bate>` marca só os dois momentos
   irreversíveis (decisão confirmada, safra encerrada). Ele vale porque é raro.
3. **Indicador em blocos.** `Meter` desenha dez quadrinhos com trama por
   indicador mais o número ao lado: quantidade, textura, número e cor, quatro
   canais para o mesmo dado.

Proibido, sem exceção:
1. gradiente roxo, violeta, fúcsia ou rosa;
2. travessão "—" e hífen duplo "--" em qualquer texto de UI (use "·", ":" ou
   ponto final; hífen simples em palavra composta é normal);
3. emoji decorativo em texto de interface. Ícone `lucide-react` só em `/admin`,
   onde o professor opera sob pressão; nas outras telas o sinal é tipográfico;
4. hero centralizado com três cards idênticos embaixo;
5. `rounded-2xl` uniforme em tudo, glassmorphism, sombra difusa em card branco;
6. imagem, vídeo, WebGL, Canvas grande, biblioteca de animação. Só SVG e CSS;
7. copy genérica ("Transforme", "Eleve", "O futuro é agora").

Exigido:
- **Projetor** (telas `/host/**` e `/admin`): número grande, contraste alto,
  legível a 6 metros, sem depender de hover.
- **Celular** (telas do aluno): uma coluna, alvo de toque mínimo 44px, texto
  curto, sem scroll horizontal.
- **Acessibilidade**: contraste WCGA AA, foco visível (já global), estado nunca
  comunicado só por cor (use texto ou ícone junto), navegação por teclado,
  `aria-live` para mudança de rodada e resultado.
- Números com `.tabular` para não dançarem ao atualizar.

## Conteúdo pedagógico

O jogo é atividade **diagnóstica**, feita antes da explicação teórica. Nunca
escreva "resposta certa", "você errou", "parabéns, escolha correta" em lugar
nenhum. A interface mostra consequência, não veredito. Valores são fictícios:
onde citar política pública, mostre `POLICY_DISCLAIMER`.
