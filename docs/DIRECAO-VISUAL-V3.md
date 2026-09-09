# SAFRA DF · Direção Visual V3 · "Curva de Nível"

> Substitui integralmente o "Boletim de Safra" (`docs/CONTRATO-VISUAL.md`,
> `app/globals.css` atuais). As duas direções anteriores ("Terra Cerrado" e
> "Boletim de Safra") foram rejeitadas pelo mesmo motivo, ainda que com
> paletas diferentes: eram claras, chapadas e impressas. Sem profundidade
> real, sem cor viva, sem nada tátil, sem movimento que importe. Esta direção
> ataca exatamente esses quatro pontos e não é reformulação de nenhuma das
> duas: troca a metáfora (impressão → relevo de terreno), troca a paleta
> (sépia/terracota → verde e azul saturados), troca o sistema de profundidade
> (filete/sombra → terraço sólido) e troca a cena da propriedade (corte de
> solo didático → parcela vista de cima com curvas de nível).

## 1. Nome da direção e tese

**"Curva de Nível."** A identidade nasce do terraceamento em curva de nível:
a técnica real que produtores do Cerrado usam para conter erosão e reter
água, degraus de terra que seguem o relevo. Cada superfície da interface é
um desses degraus: um "prato" colorido apoiado sobre uma "parede" (riser)
sólida da mesma família de cor, sem borrão, sem vidro, sem sombra genérica
de card. A hierarquia da tela vira hierarquia de altitude: o elemento mais
importante fica no degrau mais alto, com a parede mais funda; o resto desce
em degraus menores. Não é genérica porque a profundidade tem uma regra
física (a parede é sempre a cor "800" da mesma família da cor do prato, nunca
cinza, nunca preto translúcido) e porque a cor deixa de ser decoração: verde
e azul cobrem áreas grandes de tela, não só texto e ícone.

## 2. Paleta

Base: verde e azul, por pedido explícito. Nada de roxo, violeta ou rosa em
nenhum tom.

| Token | Hex | Papel |
|---|---|---|
| `nevoa-50` | `#eef6f4` | fundo de página, as duas superfícies |
| `nevoa-100` | `#dcefe9` | prato neutro (terraço nível 1, sem tingimento) |
| `terra-900` | `#10241d` | texto principal |
| `terra-700` | `#35493f` | texto de apoio |
| `terra-500` | `#5c7268` | rótulo, texto terciário |
| `verde-300` | `#8fd9ae` | destaque claro sobre parede escura |
| `verde-600` | `#1f7a4d` | acento vivo: CTA, ícone, prato de produção |
| `verde-700` | `#155c3a` | texto verde em corpo pequeno (garante AA) |
| `verde-800` | `#145536` | parede (riser) dos terraços verdes |
| `azul-300` | `#8fcaf0` | destaque claro sobre parede escura |
| `azul-600` | `#1c6fa8` | acento vivo: tecnologia, água, prato de destaque |
| `azul-700` | `#12507d` | texto azul em corpo pequeno (garante AA) |
| `azul-800` | `#124a72` | parede (riser) dos terraços azuis |
| `financas` | `#b6791a` | prato/ícone/preenchimento do indicador |
| `financas-texto` | `#8a5a14` | rótulo e valor em texto pequeno |
| `financas-800` | `#6b4310` | parede do terraço de finanças |
| `producao` | `#1f7a4d` (= `verde-600`) | indicador |
| `tecnologia` | `#1c6fa8` (= `azul-600`) | indicador |
| `sustentabilidade` | `#0e7d72` | indicador (terceiro matiz, entre verde e azul) |
| `sustentabilidade-800` | `#0a5f57` | parede do terraço de sustentabilidade |
| `alerta` | `#b23a1f` | erro, urgência |
| `sucesso` | `#1f7a4d` | positivo (nunca rotulado como "certo") |

### Contraste calculado (luminância relativa, fórmula WCAG)

Vale para as duas superfícies: celular do aluno e projetor do professor usam
o mesmo fundo claro `nevoa-50`, então o número abaixo é o mesmo nas duas.

| Par | Razão | Veredicto |
|---|---|---|
| `terra-900` sobre `nevoa-50` | 14.8:1 | AAA, corpo de texto em qualquer tamanho |
| `verde-700` sobre `nevoa-50` | 7.3:1 | AAA, corpo de texto pequeno |
| `verde-600` sobre `nevoa-50` | 4.8:1 | AA, só texto grande (≥ 1.25rem) ou UI/ícone |
| `azul-700` sobre `nevoa-50` | 7.8:1 | AAA, corpo de texto pequeno |
| `azul-600` sobre `nevoa-50` | 4.9:1 | AA, só texto grande ou UI/ícone |
| `financas-texto` sobre `nevoa-50` | 5.4:1 | AA, corpo de texto pequeno |
| `financas` sobre `nevoa-50` | 3.3:1 | falha para texto normal; só gráfico/preenchimento/texto ≥ 1.5rem |
| `sustentabilidade` sobre `nevoa-50` | 4.6:1 | AA, corpo de texto pequeno (margem curta: preferir negrito) |
| `alerta` sobre `nevoa-50` | 5.4:1 | AA, corpo de texto pequeno |
| branco sobre `verde-800` (parede) | 8.8:1 | AAA, texto em cabeçalho de terraço nível 3 |
| branco sobre `azul-800` (parede) | 9.3:1 | AAA, texto em cabeçalho de terraço nível 3 |

Regra prática: **o tom "600" de cada família é para superfície grande, ícone
e UI; o tom "700"/"texto" é o único autorizado para texto de corpo pequeno.**
`financas` puro nunca carrega texto de corpo, só preenchimento de gráfico e
rótulo em `.dado-lg`/`.dado-xl` para cima.

## 3. Tipografia

Nenhuma família repete as duas direções anteriores (fora Fraunces, banida:
foi usada nas duas tentativas rejeitadas).

- **Display: Space Grotesk** (`next/font/google`), peso 700 e 800. Geométrica
  com personalidade de instrumento técnico, não editorial: onde Fraunces
  falava "reportagem", Space Grotesk fala "painel de campo". `h1`/manchete em
  `clamp(2.25rem, 6vw, 6.5rem)`, `line-height: 0.92`, `letter-spacing:
  -0.02em`.
- **Corpo/UI: Manrope**, pesos 500 (corpo) e 700 (título de componente e
  botão). Humanista, x-height alta, lê bem em 0.875rem no celular sem
  precisar de serifa nem de grotesca institucional (não é Public Sans, não é
  IBM Plex, não é Inter). `tracking` neutro (`0`) no corpo, `0.01em` em botão
  caixa alta.
- **Dado/mono: JetBrains Mono**, peso 500 e 700, `font-variant-numeric:
  tabular-nums`. Todo valor numérico: cifra, indicador, cronômetro, código de
  partida. Ligaduras desativadas (`font-feature-settings: 'liga' 0`) porque
  ligadura de mono em painel de dado distrai.

Escala (rem, mobile-first, `clamp` sobe no host):

| Classe | `font-size` | Uso |
|---|---|---|
| `.relevo-xl` | `clamp(2.5rem, 6.5vw, 7rem)` | manchete de projeção (nome da equipe em foco) |
| `.relevo-lg` | `clamp(1.75rem, 4vw, 3.25rem)` | título de tela, manchete do evento no host |
| `.relevo-md` | `clamp(1.375rem, 2.4vw, 1.875rem)` | título de evento no celular, subtítulo de host |
| `.relevo-sm` | `1.125rem` | título de bloco, nome de equipe em linha |
| `.rotulo` | `0.6875rem`, `letter-spacing: 0.14em`, caixa alta | rótulo de campo |
| `.dado` | herda do contexto | valor inline |
| `.dado-lg` | `clamp(1.375rem, 1.9vw, 2rem)` | indicador em destaque |
| `.dado-xl` | `clamp(2rem, 3.4vw, 4rem)` | indicador e cronômetro no host |

## 4. Sistema de profundidade: terraço, não card

Regra única que substitui `.bloco`/filete do contrato anterior: **todo
elemento elevado é composto por dois planos, o `prato` (superfície, cor
clara/tingida da família) e o `paredao` (parede, cor "800" da mesma família),
sem `blur`, sem transparência, sem `border-radius` uniforme.** A parede é um
`box-shadow` sólido (`blur-radius: 0`) deslocado só para baixo, nunca para os
lados, simulando a face vertical de um degrau de terra vista de frente.

Três níveis de altitude. Cada tela usa no máximo UM nível 3 (é o que força
hierarquia real em vez de seis blocos iguais):

| Nível | Nome | Deslocamento da parede | Raio de canto | Uso |
|---|---|---|---|---|
| 0 | `chao` | nenhum | `0` | fundo da página, texto solto |
| 1 | `banco` | `4px` sólido, cor "800" | `10px` (relaxado, degrau baixo) | opção de decisão, linha de ranking, rótulo de campo |
| 2 | `terraco` | `8px` sólido, cor "800" | `6px` | carta de evento, medidor, bloco de resultado |
| 3 | `mirante` | `14px` sólido, cor "800" | `3px` (compacto, degrau alto e firme) | ÚNICO por tela: decisão ativa no celular, equipe em foco na projeção, insight de abertura no diagnóstico |

O raio de canto diminui conforme a altitude sobe: fisicamente, um degrau mais
alto é mais compacto e reto; um degrau baixo é mais largo e relaxado. Isso
substitui `rounded-2xl` uniforme por uma regra que muda com a hierarquia.

Reforço tátil sem gradiente: o `prato` recebe uma "linha de nível" (contour
line), um `inset box-shadow` de 2px na borda superior com o tom "300" da
mesma família (`inset 0 2px 0 0 var(--cor-300)`), simulando a borda
compactada pegando luz. É o único highlight permitido: sem gradiente
radial, sem brilho difuso.

Ao pressionar (celular) ou focar (teclado), a parede "comprime": o prato
translada `2px` para baixo e a altura do deslocamento da parede cai para a
metade, dando feedback físico de degrau sendo pisado (detalhe em `motion #5`).

## 5. Anatomia dos componentes-chave

**Carta de evento (celular).** Nível `terraco`, prato `nevoa-100` neutro
(o evento em si não pertence a nenhum indicador). Do topo para baixo:
`.rotulo` com "Rodada X de N · Fase" em `JetBrains Mono`; `.relevo-md` com a
manchete do evento em `Space Grotesk`; corpo em `Manrope` 1rem/1.6 sem
itálico (o itálico editorial morre com o Fraunces); o bloco "só você sabe
disto" vira um `banco` aninhado tingido em `financas` claro (informação
assimétrica, não erro, por isso a cor neutra-quente, não `alerta`). As opções
de decisão NÃO ficam dentro da carta: cada uma é o próprio componente
seguinte, em sequência vertical logo abaixo, com espaçamento de `0.75rem`
entre paredes visíveis.

**Opção de decisão tocável.** Nível `banco`, prato `nevoa-50` em repouso,
altura mínima `56px` (acima do piso de 44px, folga para o polegar). Layout:
título em `Manrope` 600 `1rem` à esquerda, custo em `JetBrains Mono` à
direita; descrição em `terra-700` `0.875rem` abaixo. Ao tocar, `motion #5`.
Ao ser a escolha registrada, sobe para `terraco`, prato tingido `verde-300`
sobre `verde-800`, ícone `CircleCheck` (`lucide-react`) no canto superior
direito, texto de estado "Registrada" (nunca "certa").

**Os 4 indicadores.** Forma unificada: um "canal" (`rect` arredondado, trilha
em `nevoa-100`, preenchimento sólido na cor do indicador) com ícone
`lucide-react` fixo à esquerda (`Wallet` finanças, `Sprout` produção, `Cpu`
tecnologia, `Leaf` sustentabilidade) e valor em `.dado`/`.dado-lg` à direita.
Três canais redundantes de leitura, nenhum dependente só de cor: ícone
(forma), comprimento do preenchimento (proporção) e número impresso (valor
exato). Ao mudar de valor, `motion #3`. Tamanho `aluno` = canal de `8px` de
altura; tamanho `projecao` = canal de `16px` de altura com `.dado-xl`.

**Cena da propriedade (SVG).** Parcela vista de cima, não corte lateral de
solo (isso pertencia à direção rejeitada). Três anéis concêntricos em
perspectiva levemente oblíqua (trapézios simples, sem isometria):
anel externo = vegetação nativa, textura pontilhada (`circle` pequenos,
`opacity` e contagem crescem com sustentabilidade); anel médio = área de
plantio, cor `producao`, com traços verticais (`line`) representando fileiras
de cultivo, cuja contagem sobe em degraus de +2 a cada faixa de valor; núcleo
= sede da propriedade, com ícones acumulativos de tecnologia (`Sun` solar,
`Wifi` antena, `Droplets` poço) que aparecem e nunca somem conforme
tecnologia sobe, igual ao comportamento já validado no projeto atual. Um
traço azul sinuoso (`path`, `sustentabilidade`/`azul-600`) atravessa os anéis
representando a água disponível: sua `stroke-width` transiciona (não anima em
loop) entre `2px` (crise) e `6px` (saudável) quando finanças cruza um limiar.

**Tela de projeção com 6 equipes.** Sem grid. Um `mirante` no topo com a
equipe em foco (a de maior variação na última rodada resolvida, calculado no
cliente, sem endpoint novo): cena completa, nome em `.relevo-xl`, os 4
indicadores em tamanho `projecao`. Abaixo, as outras 5 formam uma "encosta":
uma coluna única onde a altura da parede de cada linha é proporcional à
posição no ranking (2º lugar = parede de `10px`, 3º = `9px`, ... 6º = `5px`),
lendo como um degrau descendo fisicamente da esquerda para a direita da tela.
Cada linha carrega posição em `.dado-lg`, nome em `.relevo-sm`, glifo
reduzido da cena (só o núcleo, sem os anéis) e os 4 indicadores em linha,
tamanho `aluno`. Isso resolve, de vez, o "grid de 6 iguais": não existe mais
geometria capaz de tratar as seis como iguais, porque a régua do layout é o
próprio rank.

**Tela de resultado/diagnóstico.** Nível `mirante` único no topo: "pergunta
para abrir o debate" (o gancho mais forte, já calculado hoje pela lógica de
diagnóstico existente), prato `azul-300`/parede `azul-800`. Abaixo, cada
métrica da turma ("investiu em tecnologia", "buscou crédito" etc) é um
`banco` com o canal do item 3 reaproveitado (trilha + preenchimento
proporcional a "quantas equipes"), não mais a barra cinza genérica da versão
atual.

## 6. Hierarquia das 6 equipes na projeção

Coberto em detalhe no item 5: 1 `mirante` (equipe em foco) + 5 linhas em
"encosta" com parede proporcional ao rank. Nenhuma equipe além da equipe em
foco tem cena completa; as 5 restantes têm só o núcleo. A equipe em foco muda
ao longo da partida por lógica de apresentação (maior variação na rodada
resolvida), sem exigir novo dado do backend.

## 7. Motion system (CSS puro, `transform` e `opacity` prioritários)

1. **Emergência do terraço.** Entrada de um bloco novo: `transform:
   translateY(6px)` → `translateY(0)` e `opacity: 0` → `1`, `340ms
   cubic-bezier(0.16, 1, 0.3, 1)`. A parede acompanha via `transform: scaleY()`
   com `transform-origin: bottom`, mesmo timing.
2. **Pulso de nascente.** Só quando o cronômetro cruza 30 segundos: um
   glifo circular (fonte de água) emite dois anéis via `transform: scale(1)`
   → `scale(1.6)` com `opacity: 0.6` → `0`, `1800ms ease-out infinite`,
   defasados `600ms` entre si (`animation-delay`).
3. **Vazão.** Preenchimento dos 4 canais de indicador: `transform:
   scaleX()` a partir de `transform-origin: left` (ou `scaleY`/`bottom` no
   layout vertical do host), `500ms ease-out`, disparado só quando o valor
   muda via realtime, nunca no `mount` inicial (evita ruído visual a cada
   troca de tela).
4. **Troca de relevo.** Reordenação do ranking na projeção: técnica FLIP,
   `transform: translateY()`, `420ms cubic-bezier(0.22, 1, 0.36, 1)`.
5. **Toque de decisão.** `:active` da opção tocável: `transform: scale(0.97)
   translateY(1px)`, `120ms linear`; a parede reduz `translateY` pela metade
   no mesmo intervalo, soltando ao `release`.
6. **Copa cresce.** Cena da propriedade: quando produção cruza uma faixa,
   anel de plantio anima `transform: scaleY()` com `transform-origin:
   bottom` e `opacity: 0.6` → `1`, `600ms`, disparo único (não loop).

`prefers-reduced-motion: reduce`: mantém a regra global já em vigor
(`animation-duration` e `transition-duration` em `0.01ms`), e adicionalmente
o "pulso de nascente" (item 2, único loop infinito do sistema) passa a
renderizar o anel externo já na `opacity` final estática, sem depender de um
frame de animação para ficar visível. Os demais movimentos, ao colapsar a
duração, já terminam no estado final correto porque nenhum é decorativo:
todos comunicam uma mudança de dado real.

## 8. Estratégia mobile-first

Uma coluna sempre no celular: cabeçalho compacto e fixo (`.rotulo` +
cronômetro) que recua com `transform: translateY()` ao rolar, nunca `height`
(evita reflow); cena da propriedade com `viewBox` responsivo que reduz o
número de fileiras de cultivo desenhadas abaixo de `400px` de largura (regra
de contagem, não CSS `display:none` de nó já custoso); opções de decisão
empilhadas verticalmente, sempre com no mínimo `56px` de altura tocável e
`12px` de respiro entre uma e outra. Nada de hover: todo estado (selecionada,
registrada, indisponível) é visível sem passar o mouse.

A partir de `768px` (tablet/desktop, tela do aluno acessada num notebook em
sala): carta de evento e lista de opções migram para duas colunas (narrativa
`60%` à esquerda, opções `40%` à direita, coluna de opções com `position:
sticky`). As telas `/host/**` e `/admin` assumem contexto de projetor
(`≥1024px`): não replicam o layout de uma coluna, usam diretamente o `.dado-xl`
e o `mirante` em largura cheia descritos no item 5.

## 9. Orçamento de peso

Cena da propriedade: anel externo (1 `path` de contorno + até 24 `circle` de
textura pontilhada, geradas por faixa de sustentabilidade, tetos em 24 para
não crescer sem limite), anel médio (1 `path` de contorno + até 12 `line` de
fileira), núcleo (1 `path` de contorno + até 4 `use` referenciando ícones
compartilhados de um único `<defs>`/`<symbol>` por página, nunca `<svg>`
completo repetido por ícone), 1 `path` de canal de água. Teto por cena: **~45
nós SVG**, a maioria `circle`/`line` triviais para o navegador. Numa tela de
projeção com 6 propriedades simultâneas (1 cena completa em `mirante` + 5
núcleos reduzidos de ~6 nós cada), o teto da tela inteira fica em torno de
**75 nós SVG**, sem nenhuma imagem, sem canvas, sem WebGL. Ícones de UI
(`lucide-react`) já são tree-shaken pelo bundler, cada um é um `<svg>` de
poucos `path`. Nenhuma fonte de peso extra: 3 famílias tipográficas via
`next/font/google` com `display: swap` e subconjunto latino, sem varivável
completa (só os pesos usados: 500/700/800). Nada disso soma requisição de
rede por frame, e a única fonte de tráfego contínuo já é o Supabase Realtime
existente (evento, não polling), então 100 conexões simultâneas continuam
limitadas pelo plano do banco, não pelo peso desta camada visual.

## 10. O que essa direção deliberadamente não faz

Não usa papel, tinta de imprensa, filete editorial ou qualquer vocabulário de
jornal/relatório impresso (era a tese inteira da direção rejeitada). Não usa
serifada em lugar nenhum, nem itálico editorial. Não usa fundo escuro em
nenhuma superfície (risco de projetor em sala iluminada permanece real e não
testado fisicamente; se o professor confirmar sala sempre escurecida, isso
pode ser revisitado como variante, não como base). Não usa glassmorphism,
`blur`, transparência decorativa ou sombra suave: toda profundidade é sólida.
Não usa `border-radius` uniforme em todos os elementos. Não usa grid de seis
elementos com o mesmo peso visual em lugar nenhum do produto. Não introduz
nenhuma biblioteca de animação, imagem raster, vídeo, 3D ou WebGL. Não rotula
nenhuma decisão como certa, errada ou parabéns.
