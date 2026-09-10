# SAFRA DF · Direção Visual V4 · "Noite de Cerrado"

> Substitui a paleta e a tipografia de `docs/DIRECAO-VISUAL-V3.md` /
> `docs/CONTRATO-VISUAL.md`, mantendo integralmente a física estrutural que a
> V3 acertou: o sistema de terraço (prato + parede sólida, blur zero,
> hierarquia por altitude, raio de canto que fecha conforme o degrau sobe) e
> o repertório de componentes (`Degrau`, `Meter`/canal, `PropertyScene`,
> `FocusTeamBoard`/`TeamRow` na projeção). Nenhuma dessas peças foi o motivo
> da rejeição das direções anteriores; a paleta clara e a tipografia
> só-sans, sim. V4 troca exatamente essas duas coisas, e reaproveita o resto
> por trás dos MESMOS nomes de token (`nevoa-*`, `terra-*`, `verde-*`,
> `azul-*`, `financas`, `producao`, `tecnologia`, `sustentabilidade`,
> `alerta`, `sucesso`), o que significa que toda tela já escrita ganhou a
> direção nova sem precisar ser reescrita: só o valor por trás de cada nome
> mudou de dia para noite.

## 1. Por que mudar de novo, e por que não do zero

"Terra Cerrado" e "Boletim de Safra" foram rejeitadas por serem claras,
chapadas e impressas. A resposta a isso foi a V3 ("Curva de Nível"): degrau
sólido, cor cobrindo área grande, movimento físico. Estruturalmente correta,
mas ainda de manhã, ainda em tom pastel de folheto escolar: o pedido explícito
desta rodada foi "quero que a primeira reação seja 'uau', 80% clareza, 20%
espetáculo, nos momentos certos", com paleta escura e sofisticada,
terra/areia/dourado discreto/verde de destaque, tipografia editorial forte e
textura sutil. Isso é um problema de **luz e tom**, não de **estrutura**:
por isso a V4 é uma re-luminação da V3, não uma reconstrução.

## 2. Nome e tese

**"Noite de Cerrado."** A partida agora acontece de noite: terra escura,
areia clara iluminada como se por fogueira baixa, dourado como brasa e verde
como o único brilho vivo que sobra depois que o sol se põe. Onde a V3 lia
"painel técnico de manhã de campo", a V4 lê "decisão tomada à luz de lampião,
depois que o dia de trabalho na propriedade terminou e a conversa em família
começa". A hierarquia de "prato mais claro que o fundo, parede mais escura
que o prato" continua igual; a diferença é que agora as duas pontas dessa
escala vivem no lado escuro, então o efeito físico passa a ser "a peça brilha
suspensa sobre o breu" em vez de "a peça é impressa sobre o papel".

## 3. Paleta

Os NOMES de token são os mesmos da V3 de propósito (zero reescrita de tela);
só o valor mudou.

| Token | Hex (V4) | Papel |
|---|---|---|
| `nevoa-50` | `#110d09` | fundo de página: o breu |
| `nevoa-100` | `#1c150e` | prato neutro |
| `nevoa-200` | `#2b2116` | trilha de canal, pílula neutra |
| `terra-900` | `#f3e9d6` | texto principal: areia clara |
| `terra-700` | `#cbb896` | texto de apoio |
| `terra-500` | `#94815f` | rótulo, terciário |
| `verde-300` | `#bfe2ac` | destaque claro sobre parede escura |
| `verde-600` | `#5c9a52` | acento: CTA secundário, ícone, prato de produção |
| `verde-700` | `#8ecb7f` | texto verde em corpo pequeno |
| `verde-800` | `#142912` | parede dos terraços verdes |
| `azul-300` | `#a6d9dd` | destaque claro sobre parede escura |
| `azul-600` | `#3e8f9a` | tecnologia, água |
| `azul-700` | `#7fc7cf` | texto azul em corpo pequeno |
| `azul-800` | `#0f272a` | parede dos terraços azuis |
| `financas` | `#c9963c` | dourado: o único acento quente e precioso do sistema |
| `financas-texto` | `#e3bd6d` | rótulo e valor em texto pequeno |
| `financas-800` | `#3c2a10` | parede do terraço de finanças |
| `sustentabilidade` | `#3f8f74` | terceiro matiz, entre verde e azul |
| `sustentabilidade-800` | `#0f2a20` | parede |
| `alerta` | `#b8431f` | preenchimento/ícone/parede com texto branco em cima |
| `alerta-texto` | `#e08257` | **novo em V4**: texto de erro sobre fundo escuro (o `alerta` puro não passa AA como texto pequeno na noite) |
| `sucesso` | `#5c9a52` | positivo, nunca rotulado como "certo" |

Dourado (`financas`) é o único tom quente do sistema, e por isso carrega o
peso de "identidade própria": aparece em CTA principal, no rótulo de abertura
da partida, no foco de teclado (`:focus-visible`) e nas linhas de nível do
fundo da página, sempre com reserva, nunca como preenchimento de área grande
(essa continua sendo função do verde e do azul, como na V3).

### Contraste (checado manualmente, fórmula de luminância relativa WCAG)

| Par | Razão aproximada | Veredicto |
|---|---|---|
| `terra-900` sobre `nevoa-50` | ~16.7:1 | AAA |
| `terra-700` sobre `nevoa-50` | ~10.2:1 | AAA |
| `verde-700` sobre `nevoa-50` | ~9:1 | AAA, corpo pequeno |
| `azul-700` sobre `nevoa-50` | ~10:1 | AAA, corpo pequeno |
| `financas-texto` sobre `nevoa-50` | ~10:1 | AAA, corpo pequeno |
| `alerta` sobre `nevoa-50` | ~3.6:1 | falha para texto normal; só ícone/gráfico (não-texto precisa de 3:1) |
| `alerta-texto` sobre `nevoa-50` | ~6.9:1 | AAA, corpo pequeno: usar em vez de `alerta` para qualquer texto de erro |
| branco sobre `bg-alerta` (pílula) | ~5.4:1 | AA |
| `terra-900` sobre `terr-alerta` (botão perigo) | alto | trocado nesta rodada: a V3 usava `alerta-800` como texto sobre o próprio prato de alerta, o que virava escuro-sobre-escuro na paleta noturna e falhava; agora usa `terra-900` (areia clara) |

Regra prática que muda em relação à V3: **`alerta` sozinho nunca carrega
texto**, só preenchimento/ícone/parede; todo texto de erro usa
`alerta-texto`, o par novo desta direção.

## 4. Tipografia

- **Display/editorial: Newsreader** (`next/font/google`, pesos 600/700,
  itálico incluído). É a serifada que faltava: as três direções anteriores
  usaram só sans (Space Grotesk na V3) ou a serifada já banida (Fraunces, nas
  duas primeiras). Newsreader não é Fraunces: menos ornamento de reportagem,
  mais peso de manchete de safra lida à luz de lampião. Carrega só título
  (`h1`/`h2`/`h3`, `.relevo-*`). Tracking bem mais suave que a V3 (a serifada
  perde a curva da letra sob tracking apertado; a V3 usava até `-0.03em`, a
  V4 usa no máximo `-0.012em`).
- **Corpo/UI: Manrope**, pesos 500/700. Repetida da V3 de propósito: nunca foi
  o problema, e trocar a fonte de corpo no meio de uma sala de aula por
  motivo estético seria custo sem ganho.
- **Dado/mono: JetBrains Mono**, pesos 500/700, tabular, ligadura desligada.
  Repetida da V3 pelo mesmo motivo.

## 5. Textura sutil (o item que a V3 não tinha)

Três camadas, todas CSS puro, custo zero de rede:

1. Duas "fogueiras" (`radial-gradient`) de dourado e verde no canto superior
   esquerdo e inferior direito da página, ~8-9% de opacidade: luz baixa vinda
   de dois pontos, não um clarão central.
2. Linhas de nível bem afastadas (`repeating-radial-gradient`, anéis a cada
   ~130px, ~5% de opacidade): o eco do relevo topográfico do Cerrado, quase
   subliminar, sem competir com o conteúdo.
3. Grão fino via SVG `feTurbulence` embutido como `data:` URI de fundo
   (5% de opacidade, ladrilhado a 180px): tira a chapadez de uma cor escura
   lisa, que é o requisito explícito de "textura tátil" do pedido. Zero
   requisição de rede, zero imagem raster: é um filtro SVG gerado no
   navegador.

## 6. O que continua igual, herdado da V3 e mantido de propósito

- O sistema de terraço inteiro (`.degrau`, `.banco`/`.terraco`/`.mirante`,
  `terr-*`), incluindo a regra de "uma tela usa no máximo um `mirante`".
- `Meter`/canal com três leituras redundantes (ícone, trilha, número).
- `PropertyScene`: os mesmos três anéis concêntricos, o mesmo orçamento de
  ~45 nós por cena, agora desenhados sob a paleta noturna (o SVG já usava só
  `var(--color-*)`, então herdou o novo tom sem qualquer edição de path).
  Continua aparecendo cedo (capa, entrada, lobby, tela principal do jogo,
  projeção com foco e encosta), como pedido.
- `FocusTeamBoard`/`TeamRow` (`components/host/team-board.tsx`): a projeção
  com 6 equipes já era "1 mirante + 5 linhas em encosta com parede
  proporcional ao rank", não um grid. Continua assim.
- O motion system inteiro (emergir, nascente, vazão, FLIP, toque de decisão,
  copa cresce), porque nenhum movimento ali era decorativo.

## 7. O que mudou de fato nesta rodada (arquivos tocados)

- `app/globals.css`: todos os valores de token (mesmos nomes), textura de
  fundo, escala tipográfica ajustada para serifada, `alerta-texto` novo.
- `app/layout.tsx`: troca de fonte de display (Space Grotesk → Newsreader) e
  `themeColor` da viewport para o tom escuro.
- `components/ui/primitives.tsx`, `components/ui/gauges.tsx`: dois
  `box-shadow` com `rgba` fixo (grafados a mão, não em token, herdados da
  V3) foram ajustados para funcionar sobre fundo escuro; variante `perigo`
  do botão trocou o texto de `alerta-800` (ficava escuro sobre escuro na
  paleta nova) para `terra-900`.
- `components/game/event-card.tsx`, `components/game/round-timer.tsx`,
  `app/admin/page.tsx`, `app/entrar/page.tsx`, `app/jogar/page.tsx`: usos de
  `text-alerta` em texto de corpo pequeno trocados por `text-alerta-texto`
  (ícones continuam em `text-alerta`, que passa o contraste de 3:1 exigido
  para elemento gráfico, mas não os 4.5:1 de texto).
- Nenhuma tela precisou de reescrita estrutural: o resto do produto (home,
  entrada, abertura, tela do jogo, lobby, host, resultado, diagnóstico,
  admin) já usava só classes de token (`terr-*`, `bg-nevoa-*`,
  `text-terra-*`, `.dado*`, `.relevo-*`), então herdou a direção nova ao
  vivo.

## 8. O que essa direção deliberadamente não faz

Não usa papel, filete editorial ou vocabulário de jornal impresso (era a
tese das duas primeiras direções). Não usa roxo, violeta ou rosa em nenhum
tom. Não usa glassmorphism, `blur` ou sombra difusa: toda profundidade
continua sólida, herdada da física da V3. Não usa `rounded-2xl` uniforme. Não
usa emoji decorativo. Não introduz nenhuma biblioteca de animação, imagem
raster, vídeo, 3D ou WebGL: a textura de grão é um filtro SVG embutido, não
uma imagem. Não rotula nenhuma decisão como certa, errada ou parabéns.
