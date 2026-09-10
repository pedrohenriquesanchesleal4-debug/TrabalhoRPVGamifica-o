# SAFRA DF · Direção Visual V5 · "Painel de Silo"

> Substitui a metáfora e a paleta de `docs/DIRECAO-VISUAL-V4.md`, mantendo a
> física estrutural que V3/V4 acertaram (superfície elevada em dois planos,
> hierarquia por altitude, sombra sólida sem blur, raio de canto que fecha
> conforme a altitude sobe). O que muda: a propriedade rural deixa de ser
> terraço de terra à noite e passa a ser **central de controle industrial**:
> silo, painel de comando, chapa de aço parafusada. Decisão do usuário via
> skill `design-directions`, implementada à risca, não em cima da direção
> anterior escolhida por mim.

## 1. Por que mudar de novo

V4 ("Noite de Cerrado") foi rejeitada porque, apesar de resolver luz e tom,
ainda tinha "um padrão só, sem metáfora visual própria": card de terraço
repetido e arco suave em tudo. Ao mesmo tempo, o usuário reportou um problema
concreto de leitura no modo escuro (detalhado na seção 3). As duas coisas
pedem: (1) uma metáfora nova o bastante para não parecer reskin de paleta, e
(2) números de contraste auditados de verdade, não "parece ok".

## 2. Nome e tese

**"Painel de Silo."** Cada propriedade não é mais terreno com relevo: é uma
central de controle que o professor e a turma operam. O indicador não é mais
um anel de progresso suave (V4): é um **manômetro** com escala numerada e
ponteiro girando sobre um eixo, como o painel de pressão de um silo de verdade.
O card não é mais degrau de terra: é **chapa de aço presa por parafuso**, com
rebite visível nos módulos de destaque.

## 3. Paleta e contraste (auditado, fórmula de luminância relativa WCAG)

Os NOMES de token continuam os mesmos de V3/V4 (`nevoa-*`, `terra-*`,
`verde-*`, `azul-*`, `financas`, `producao`, `tecnologia`, `sustentabilidade`,
`alerta`, `sucesso`): zero call site precisou ser reescrito por causa da
direção visual, só o valor por trás de cada nome mudou.

| Token | Hex (V5) | Papel |
|---|---|---|
| `nevoa-50` | `#1a1a17` | fundo de página: aço escuro |
| `nevoa-100` | `#232320` | painel neutro |
| `nevoa-200` | `#2f2f2b` | ranhura/trilha, pílula neutra |
| `terra-900` | `#d9d2c4` | texto principal: areia |
| `terra-700` | `#b3aa96` | texto de apoio |
| `terra-500` | `#948a78` | rótulo, terciário (clareado nesta rodada, ver abaixo) |
| `verde-300` | `#c3d9a0` | destaque claro sobre painel escuro (produção) |
| `verde-600` | `#7a8f4a` | preenchimento/ícone de produção |
| `verde-700` | `#a8c47a` | texto verde em corpo pequeno |
| `verde-800` | `#1f2712` | moldura do painel de produção |
| `azul-300` | `#b8dde5` | destaque claro sobre painel escuro (tecnologia) |
| `azul-600` | `#4a7a8a` | preenchimento/ícone de tecnologia |
| `azul-700` | `#8fc0cf` | texto azul em corpo pequeno |
| `azul-800` | `#10262c` | moldura do painel de tecnologia |
| `financas` | `#e8a93a` | amarelo de segurança: único acento quente reservado |
| `financas-texto` | `#f0c268` | rótulo e valor em texto pequeno |
| `financas-800` | `#3a2810` | moldura do painel de finanças |
| `sustentabilidade` | `#4a8a6a` | preenchimento/ícone de sustentabilidade |
| `sustentabilidade-texto` | `#8fcaa8` | **novo em V5**: texto/ícone com contraste garantido (antes usava o tom saturado direto) |
| `sustentabilidade-800` | `#12291f` | moldura |
| `alerta` | `#8a4a2e` | ferrugem: segunda cor de acento/superfície quente |
| `alerta-texto` | `#d4835c` | texto de erro sobre a chapa de aço |
| `alerta-800` | `#2e160c` | moldura do painel de alerta (fundo saturado com texto claro em cima) |
| `sucesso` | `#a8c47a` | positivo, nunca rotulado como "certo" |

### Tabela de contraste (relativa WCAG, calculada, não estimada)

Fórmula: `L = 0.2126·R + 0.7152·G + 0.0722·B` com cada canal linearizado
(`c ≤ 0.03928 → c/12.92`, senão `((c+0.055)/1.055)^2.4`); contraste
`(L1+0.05)/(L2+0.05)` com `L1 ≥ L2`. Piso exigido: 4.5:1 texto pequeno, 3:1
texto grande/UI (WCAG AA).

| Par | L (par 1) | L (par 2) | Razão | Veredicto |
|---|---|---|---|---|
| `terra-900` sobre `nevoa-50` | 0.648 | 0.0102 | **11.6:1** | AAA |
| `terra-700` sobre `nevoa-50` | 0.405 | 0.0102 | **7.56:1** | AAA |
| `terra-500` sobre `nevoa-50` | 0.258 | 0.0102 | **5.12:1** | AA (rótulo pequeno) |
| `verde-700` sobre `nevoa-50` | 0.492 | 0.0102 | **9.01:1** | AAA |
| `azul-700` sobre `nevoa-50` | 0.481 | 0.0102 | **8.81:1** | AAA |
| `sustentabilidade-texto` sobre `nevoa-50` | 0.509 | 0.0102 | **9.29:1** | AAA |
| `financas` sobre `nevoa-50` | 0.458 | 0.0102 | **8.44:1** | AAA |
| `financas-texto` sobre `nevoa-50` | 0.581 | 0.0102 | **10.48:1** | AAA |
| `alerta-texto` sobre `nevoa-50` | 0.310 | 0.0102 | **5.98:1** | AA |
| branco sobre `verde-800`/`azul-800` (painel de destaque, texto claro) | 1.0 | 0.0178 | **15.5:1** | AAA |

### O bug real que este cálculo encontrou (e corrigiu)

Auditando os pares que a V4 realmente usava em produção (não só os da tabela
do próprio doc da V4), apareceu um contraste que **falha**: `.terr-verde`/
`.terr-azul` misturam 30% do tom saturado (`verde-600`/`azul-600`) sobre o
painel neutro escuro (`nevoa-100`), o que resulta num painel ainda escuro
(ex.: prato de `terr-verde` em V5 ≈ `#3d432d`, L ≈ 0.052). Cinco lugares da
interface usavam a variante **escura** (`text-verde-800`/`text-azul-800`,
L ≈ 0.018) como texto sobre esse painel:

- `components/game/event-card.tsx`: rótulo e custo da opção selecionada.
- `app/jogar/page.tsx`: tela "Partida pausada" e tela "Registrada" (decisão
  confirmada), a MAIS lida da sessão inteira de jogo.
- `app/host/[gameId]/diagnostico/page.tsx` e `.../resultado/page.tsx`: o
  console de destaque com `familia="azul"`.
- `app/page.tsx`: o rótulo "Sou aluno" da porta de entrada.

Contraste antes do fix: `(0.018+0.05)/(0.052+0.05) ≈ 1.52:1` · **falha grave**
(explica de forma concreta a reclamação "o texto do modo escuro está difícil
de ler"). Fix aplicado: trocar o texto para a variante **clara** de destaque
que já existia no sistema para exatamente este caso (`verde-300`/`azul-300`,
"destaque claro sobre parede escura"). Contraste depois do fix:
`(0.638+0.05)/(0.052+0.05) ≈ 6.74:1` · AA/AAA, corrigido nos 5 pontos acima.

`terra-500` também foi clareado nesta rodada (de um tom que fechava ~4.61:1,
margem perigosamente rente ao piso de 4.5:1, para `#948a78`, 5.12:1): é o tom
usado em `.rotulo`, a etiqueta uppercase pequena que aparece em praticamente
toda superfície do jogo, exatamente o texto que "fica ilegível primeiro"
quando a margem de contraste é curta.

## 4. Tipografia

- **Display/rótulo: Oswald** (`next/font/google`, pesos 500/600/700), sempre
  em caixa alta (`text-transform: uppercase` em `h1`/`h2`/`h3` e `.relevo-*`).
  Condensada de placa de máquina: onde a Newsreader da V4 falava "manchete de
  jornal", Oswald fala "rótulo gravado em chapa de equipamento". Tracking
  levemente POSITIVO (`0.004em` a `0.01em`, nunca negativo): condensada com
  tracking apertado perde a abertura da letra e vira ruído em caixa alta.
- **Corpo/UI: Manrope**, inalterada desde V3. Nunca foi o problema.
- **Dado/rótulo técnico: JetBrains Mono**, inalterada. `.rotulo` (mono,
  uppercase, espaçado) já lia como etiqueta de equipamento antes mesmo da
  mudança de direção: nesta rodada ele ganha companhia visual (Oswald nos
  títulos), não precisou ser reescrito.

## 5. Metáfora: painel de metal parafusado, não terraço de terra

A física de V3/V4 (dois planos, sombra sólida deslocada só para baixo, raio
de canto fechando conforme a altitude sobe) é reaproveitada por trás dos
MESMOS nomes de classe (`degrau`, `banco`, `terraco`, `mirante`, `terr-*`):
trocar o nome quebraria 22 arquivos sem ganho nenhum de direção visual, já que
o valor por trás de cada classe é o que muda o material lido na tela.

O que muda de fato:

- **Bisel de metal**: `.degrau` ganha uma segunda camada de `box-shadow`
  (`inset 0 1px 0 0 rgba(217,210,196,0.07)`) simulando a borda de chapa
  pegando um brilho fino de cima, além da moldura sólida deslocada para
  baixo que já existia.
- **Raio de canto mais fechado**: 5px/3px/2px (era 10px/6px/3px em V4) — chapa
  de metal industrial não arredonda tanto quanto degrau de terra.
- **Rebite nos módulos de destaque**: `.mirante` (nível 3, "um por tela") ganha
  `position: relative` e um `::before` com quatro `radial-gradient` nos
  cantos, simulando parafuso com luz e sombra. Deliberadamente só em
  `.mirante`, nunca em `.banco`/`.terraco`: o pedido foi "visível mas
  discreto... só nos módulos de destaque, senão vira ruído", e repetir o
  rebite em toda pílula pequena da interface seria exatamente esse ruído.
  Zero marcação nova no DOM: é um único pseudo-elemento por módulo.
- **Rótulo de equipamento**: `.rotulo` (mono, uppercase, `letter-spacing:
  0.14em`) já existia; o que muda é o material ao redor (Oswald em caixa alta
  nos títulos, painel de aço em vez de terraço) fazer esse rótulo ler como
  etiqueta atarraxada na chapa, não como legenda de infográfico.
- **Textura de fundo**: as "linhas de nível" topográficas da V4 (relevo do
  Cerrado) viram uma grade fina (`repeating-linear-gradient` nos dois eixos,
  64px) ecoando blueprint/grade de chapa parafusada. O grão SVG continua
  (textura tátil de metal escovado em vez de terra), só com frequência
  ligeiramente mais fina.

## 6. O indicador: manômetro, não anel

`CanalArco` em `components/ui/gauges.tsx` deixa de ser um anel de progresso
(V4) e passa a ser um **mostrador de manômetro**: domo de 240° de varredura
(ápice no topo, eixo do ponteiro no terço inferior do quadro que envolve o
SVG), com:

1. **Trilha e faixa de valor**: mesma técnica de `stroke-dashoffset` da V4
   (só transiciona quando o valor muda de verdade), agora desenhada como arco
   de domo em vez de círculo completo.
2. **Marcações de escala** (ticks maiores em 0/25/50/75/100, ticks menores a
   cada 10 nos tamanhos `aluno`/`projecao`): a referência absoluta que um
   anel sozinho nunca dava.
3. **Ponteiro**: um `<line>` dentro de um `<g>` com `transform-origin` no
   eixo, girando via `rotate()` calculado a partir do valor (150° a 390°,
   convenção de tela). Só `transform` transiciona, com `ease-out` simples
   (sem `cubic-bezier` de overshoot): "parada seca" de instrumento mecânico,
   não elástico.
4. **Cubo do eixo**: dois círculos concêntricos simulando o parafuso central
   do mostrador.

API pública preservada byte a byte: `kind`, `value`, `size`, `className`,
`children` continuam os mesmos, e o componente devolve o mesmo `CanalArco`
usado por `Meter` (`components/ui/primitives.tsx`), que por sua vez expõe
`kind`/`label`/`value`/`display`/`delta`/`size` sem nenhuma mudança de
assinatura. Nenhum call site (`app/jogar/page.tsx`,
`components/game/indicator-panel.tsx`, `components/host/team-board.tsx`,
`components/host/indicator-comparison.tsx`) precisou ser tocado por causa do
novo indicador. `CanalTrilha` (barra linear usada em
`components/host/diagnostic-bars.tsx`) não mudou: só herdou a paleta nova.

## 7. Motion novo: trava mecânica

Ao confirmar uma decisão (`EventCard.confirm` em
`components/game/event-card.tsx`), o botão "Confirmar decisão" ganha a classe
`.travado` no instante do clique (não depois da resposta do servidor): um
`@keyframes trava` de 220ms (`ease-out`, sem elástico) desce o botão 3px e
volta, simulando o encaixe seco de uma trava física fechando. O ponteiro do
manômetro usa a mesma disciplina de movimento mecânico (`ease-out`, sem
overshoot) ao girar entre valores. `prefers-reduced-motion: reduce` já é
coberto pela regra global existente em `globals.css`
(`transition-duration: 0.01ms !important` em qualquer seletor): nenhuma regra
nova precisou ser adicionada para isso.

## 8. O que essa direção deliberadamente não faz

Não usa terra, degrau de relevo ou vocabulário agrícola na metáfora visual
(era a tese de V3/V4): a fazenda vira central de controle. Não usa roxo,
violeta ou rosa em nenhum tom. Não usa glassmorphism, `blur` ou sombra difusa:
toda profundidade continua sólida. Não usa `rounded-2xl` uniforme. Não usa
emoji decorativo. Não introduz biblioteca de animação, imagem raster, vídeo,
3D ou WebGL: o manômetro e o rebite são SVG/CSS puro. Não repete o rebite em
todo elemento pequeno (só no módulo de destaque de cada tela). Não rotula
nenhuma decisão como certa, errada ou parabéns.

## 9. Escopo tocado (arquivos)

`app/globals.css` (tokens, textura, sistema de painel/rebite, trava mecânica),
`app/layout.tsx` (fonte Oswald), `components/ui/gauges.tsx` (manômetro),
`components/game/event-card.tsx` (trava mecânica + fix de contraste),
`app/jogar/page.tsx`, `app/page.tsx`,
`app/host/[gameId]/diagnostico/page.tsx`, `app/host/[gameId]/resultado/page.tsx`
(fix de contraste + bloco novo de política pública). Telas que só usam classes
de token (`terr-*`, `bg-nevoa-*`, `text-terra-*`, `.dado*`, `.relevo-*`, sem
`-800` em painel misto) herdaram a direção nova sem edição estrutural: home,
entrada (redesenhada também para o fluxo de escolha de equipe, ver seção 10),
lobby, host, admin.

## 10. Fora do escopo original, adicionado nesta rodada

- **Escolha de equipe e papel** (`app/entrar/page.tsx`,
  `GET /api/games/lobby`, `lib/game-service.ts` `getGameLobby`/
  `chooseTeamAndRoleExplicit`, `joinGame` com `choice` opcional): o jogador
  escolhe propriedade e função em vez de só receber o alocado, já na paleta e
  metáfora de painel desta direção.
- **Ponte para política pública/tecnologia sem veredito**
  (`game/diagnostics.ts` `buildPolicyConnections`, bloco 4 novo em
  `app/host/[gameId]/resultado/page.tsx`): conecta o comportamento agregado
  da turma ao programa real (`data/policies.ts`), com frase informativa, nunca
  avaliativa. Decisão de onde encaixar: bloco novo em `resultado` (não em
  `diagnostico`) porque a página de resultado já navega em blocos temáticos
  e este é mais um bloco de fechamento antes da pergunta final, enquanto
  `diagnostico` é a peça central de debate ao vivo do professor e já tem
  navegação própria por seção (não por bloco); duplicar lá criaria dois
  padrões de navegação na mesma tela.
