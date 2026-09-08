@AGENTS.md

# SAFRA DF

Jogo web multiplayer educacional sobre agricultura familiar no Distrito Federal,
usado como atividade diagnóstica de 15 a 20 minutos numa aula universitária. O
briefing pedagógico completo e o passo a passo de operação estão no
[`README.md`](README.md); o contrato interno de API e design está em
[`docs/CONTRATO.md`](docs/CONTRATO.md).

## Comandos

```bash
npm run dev         # servidor local em http://localhost:3000
npm run test        # vitest: engine, conteúdo, diagnóstico, sorteio
npm run test -- tests/engine.test.ts     # um arquivo só
npm run test -- -t "não converte tecnologia"   # um teste por nome
npm run typecheck   # tsc --noEmit (strict)
npm run lint
npm run simulate    # partida completa de 6 equipes sem banco
npm run verify      # typecheck + lint + test + build
```

`npm run dev` e `npm run build` exigem `.env.local` preenchido (copie de
`.env.example`). `npm run test` e `npm run simulate` NÃO exigem: a engine é pura
e roda sem Supabase, o que é o ponto principal da separação de camadas.

## A arquitetura em uma frase

O navegador nunca escreve no banco: toda mutação passa por route handler em
`app/api/**` com a `service_role` key, que chama `lib/game-service.ts`, que chama
`game/engine.ts` (regras puras) e publica um evento em `game_events`, de onde os
clientes recebem push via Supabase Realtime.

Consequências que mudam como se escreve código aqui:

- **Nada de `supabase.from(...).insert()` em componente.** Se uma tela precisa
  mudar estado, ela chama `@/lib/client-api`, e se o endpoint não existe, ele é
  criado em `app/api/**`. A chave anon tem só `SELECT`, revogado o resto no
  schema: tentar escrever do cliente falha em runtime, não em revisão.
- **`game/engine.ts` não importa I/O.** Sem React, sem Supabase, sem `Date.now`,
  sem `Math.random`. A incerteza vem de `game/rng.ts` com semente derivada de
  `(gameId, roundIndex, teamId, optionKey)`: a mesma decisão sempre resolve
  igual, e é isso que permite testar e reexecutar sem divergir do que o aluno
  viu na tela.
- **Estado de jogo nunca vem do payload de realtime.** O evento diz que algo
  mudou; a tela rebusca `fetchPlayerView` ou `fetchHostView`. Não existe polling
  em nenhum lugar do projeto, e não deve passar a existir: é o que mantém o uso
  dentro do plano gratuito.
- **A decisão da equipe é imutável.** Garantida por `unique (round_id, team_id)`
  em `decisions`, não por checagem na interface.
- **`data/*.ts` é conteúdo, não código de jogo.** O professor edita evento,
  tecnologia, política e propriedade sem tocar em componente. Se uma regra nova
  exigir editar componente para funcionar, o desenho está errado.

## O mecanismo pedagógico que não pode ser simplificado

`productionIfTrained` em `DecisionEffects`: tecnologia comprada sem capacitação
NÃO vira produção, vira `traits.idleTech` e fica parada até a equipe se
capacitar, quando `applyRoundClosing` converte. É o jogo fazendo a turma
descobrir na prática que "ter tecnologia" e "conseguir adotar tecnologia" são
problemas diferentes, que é a pergunta central da aula. Qualquer refatoração que
transforme isso em "ganho imediato" destrói o objetivo do projeto.

Na mesma linha: o jogo é **diagnóstico, não avaliação**. Nenhuma tela, texto ou
tag pode dizer "resposta certa", "errou" ou "parabéns pela escolha correta". A
interface mostra consequência; o professor interpreta.

## Convenções de escrita

- Textos de interface, comentários, nomes de teste e mensagens de erro em
  português do Brasil.
- Zero travessão "—" e zero hífen duplo "--" em qualquer texto: use "·", ":" ou
  ponto final. Hífen simples em palavra composta continua normal. Há teste
  (`tests/content.test.ts`) que falha se aparecer no conteúdo.
- Zero emoji decorativo em UI. Ícone só em `/admin`, via `lucide-react`, onde o
  professor opera sob pressão e a forma do triângulo de "iniciar" é lida mais
  rápido que a palavra. Nas outras telas o sinal é tipográfico (`×`, `○`, `/`).
- Duas superfícies com exigências opostas: telas do aluno são mobile-first com
  alvo de toque de 44px; telas `/admin` e `/host/**` são para projetor, com
  número grande e sem depender de hover.

## A direção visual: "Caderno de Campo"

A tela é uma folha do caderno em que o agricultor familiar anota tudo, não um
painel de software. Tokens e classes em `app/globals.css`; primitivas em
`components/ui/primitives.tsx`. Quatro regras que sustentam a direção:

1. **Nada flutua.** Não existe card: existe `.ficha`, que é folha com borda de
   1px, deslocamento duro de 2px (papel sobre papel), linha de margem
   (`.ficha-margem`) e furos de fichário (`.ficha-furos`). Raio zero
   (`--radius-ficha: 0px`). O separador é a `.regua` pontilhada, e a relação
   entre rótulo e valor é o `.pontilhado`, o preenchimento de livro-caixa.
2. **Número é registro datilografado.** Courier Prime (`font-maquina`) em dado,
   rótulo, código, título e opção; Archivo (`font-caderno`) só na narrativa das
   cartas, que é o único texto longo. Não troque a hierarquia: sans em rótulo
   descaracteriza a direção inteira.
3. **Decisão é carimbo.** `<Carimbo bate>` marca os dois momentos irreversíveis
   do jogo (decisão confirmada e safra encerrada). Não use carimbo em mais nada:
   ele vale porque é raro.
4. **Indicador nunca depende só de cor.** `Meter` desenha dez blocos com trama
   própria por indicador (`.trama-financas`, `.trama-producao`,
   `.trama-tecnologia`, `.trama-sustentabilidade`), mais o número escrito ao
   lado. São quatro canais: quantidade, textura, número e cor.

Proibido, como antes: gradiente roxo/violeta/rosa, glassmorphism, `rounded-2xl`
uniforme, sombra difusa, imagem, vídeo, WebGL e qualquer biblioteca de animação.
A propriedade é um croqui a nanquim gerado em
`components/game/property-scene.tsx`: traço de tinta e hachura, com lápis de cor
só nos três pontos que os indicadores governam (lavoura, equipamentos, água e
mata). Ali, jitter e coordenadas passam por `round2` e por um hash inteiro, e não
por `Math.sin`, porque `Math.sin` é definido pela implementação e divergia entre
servidor e cliente, quebrando a hidratação nas telas que desenham o croqui.
