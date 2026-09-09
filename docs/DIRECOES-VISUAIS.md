# SAFRA DF · Direções Visuais

> Diagnóstico do usuário: "não gostei desse visual, tá muito cara de IA". A
> direção atual ("Terra Cerrado": areia + mata + terracota, Fraunces + IBM
> Plex Mono) não está tecnicamente errada, mas caiu no problema que este
> documento resolve: grid 3x2 de cards idênticos sem hierarquia, contraste
> insuficiente para projetor com luz acesa, propriedade em SVG com desenho
> infantil (casa = quadrado + triângulo, árvore = círculo + retângulo,
> plantação = fileira de bolinhas), barra fina genérica nos 4 indicadores e
> tipografia display tímida.
>
> As 3 direções abaixo rompem com a paleta areia/mata/terracota atual (não
> são variações de cor da mesma ideia: são identidades diferentes), respeitam
> as restrições duras do projeto (zero raster, zero 3D/WebGL, zero biblioteca
> de animação, zero travessão, zero gradiente roxo/glassmorphism/rounded-2xl
> uniforme, ícone via `lucide-react`, texto em PT-BR) e endereçam os 5
> problemas concretos das screenshots ponto a ponto.
>
> Contraste: valores estimados por cálculo de luminância relativa (fórmula
> WCAG), não substituem rodar um contrast checker real antes de implementar,
> mas são confiáveis o bastante para decidir a direção.

---

## Resumo comparativo

| | A · Cadastro Rural | B · Boletim de Safra | C · Painel de Controle |
|---|---|---|---|
| Base | Papel técnico claro + grafite escuro | Papel manteiga + tinta de imprensa | Quase-preto (dark) |
| Tese | Documento cadastral georreferenciado | Relatório agronômico impresso | Sala de controle / placar ao vivo |
| Propriedade em SVG | Planta cadastral (mapa, vista de cima) | Corte lateral do solo (didático) | Miniatura isométrica (tycoon) |
| Layout das 6 equipes | 1 parcela em destaque + ficha densa das outras | Manchete + coluna de classificados | Placar de posições, altura por rank |
| Risco em sala com luz acesa | Baixo | Baixo | Médio-alto (preto pode lavar) |
| Tom | Técnico, oficial, sério | Editorial, didático, sóbrio | Competitivo, gamificado, alta energia |

---

## Direção A · "Cadastro Rural"

**Tese:** a identidade nasce do documento que decide quem é dono da terra no Brasil: o mapa cadastral georreferenciado (CAR/INCRA), com coordenadas, escala e legenda, não a ilustração fofa de uma fazendinha.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `grafite-950` | `#12181a` | fundo da projeção (host) |
| `grafite-800` | `#1c2426` | superfície elevada sobre o grafite |
| `papel-100` | `#f4efe0` | fundo das telas do aluno e dos cartões |
| `papel-050` | `#f9f6ec` | superfície de cartão sobre o papel |
| `tinta-900` | `#1c2321` | texto principal sobre papel |
| `linha-topo` | `#1f5f6b` | linha de levantamento, água, tecnologia |
| `acento-selo` | `#c65a1e` | CTA, ênfase, marcador de decisão pendente |
| `financas` | `#a87a1f` | indicador |
| `producao` | `#4f7a3f` | indicador |
| `tecnologia` | `#2f6e82` | indicador |
| `sustentabilidade` | `#3f7a55` | indicador |
| `alerta` | `#b23a1f` | erro |
| `sucesso` | `#3f7a4a` | positivo |

Contraste: `tinta-900` sobre `papel-100` ≈ 14:1 (AAA). `papel-100` sobre
`grafite-950` ≈ 15:1 (AAA, uso em host). `acento-selo` sobre `grafite-950`
≈ 5.5:1 (AA para texto grande/UI, não usar em corpo de texto pequeno sobre
fundo escuro).

### Tipografia (`next/font/google`)

- Display/título: **Newsreader** (serif com peso de documento oficial, não
  Fraunces) · pesos 500/600 · `h1` 88-96px tracking `-0.02em` no host, 32px no
  aluno.
- Dados/números: **IBM Plex Mono** · tabular, usado em TODO número (coordenada,
  código de parcela, valor de indicador, cronômetro) · 14-64px conforme
  hierarquia.
- UI/corpo: **IBM Plex Sans Condensed** · 13-16px, tracking `0.01em`, para
  rótulos e texto corrido.

### Layout das 6 equipes (projeção)

Não é grid 3x2. É uma "folha de matrícula": uma equipe em destaque (a última
que decidiu, ou a que o professor fixar) ocupa uma "parcela" grande à
esquerda com a cena completa e os 4 indicadores por extenso; as outras 5
aparecem como linhas de registro à direita, densas, ordenadas por rank, cada
linha com número de matrícula em mono grande, glifo reduzido da propriedade
(não a cena completa) e os 4 indicadores como diais pequenos em linha. A
equipe em destaque muda ao longo da partida: cria variação sem exigir dado
novo do backend (a lógica de "quem está em foco" é só de apresentação).

### Linguagem gráfica da propriedade

Planta cadastral vista de cima: contorno da parcela em traço técnico
tracejado com marcos de coordenada nos cantos (ex.: `23L`), seta de norte e
escala gráfica como chrome do desenho (reforça "documento oficial", custo
zero em SVG). Dentro do contorno, zonas de uso do solo como polígonos
preenchidos: zona de plantio como hachura de linhas paralelas que cresce em
área e densidade conforme a produção; zona de vegetação nativa como textura
pontilhada que cresce em área conforme a sustentabilidade; corpo d'água como
polígono azul com nível de preenchimento variável. Tecnologia aparece como
pinos de legenda cartográfica (símbolo de bomba, símbolo de painel solar,
símbolo de antena), acumulativos, nunca removidos.

### Indicadores (forma própria, não só cor)

- **Finanças:** régua de agrimensor, série de traços tipo trena com o valor
  marcando quantos traços estão "medidos" (preenchidos), não uma barra lisa.
- **Produção:** silhueta de silo de grãos preenchida de baixo para cima via
  `clip-path`, contorno técnico fino.
- **Tecnologia:** dial semicircular tipo manômetro, com ponteiro.
- **Sustentabilidade:** anéis concêntricos (dendrocronologia): cada faixa de
  valor fecha um anel completo, metáfora de anel de árvore.

### Motion signature (CSS puro)

1. **Levantamento:** o contorno da parcela se desenha via
   `stroke-dasharray`/`stroke-dashoffset` (600ms ease-out) na primeira
   renderização e a cada atualização relevante.
2. **Coordenada piscando:** quando uma decisão é registrada, o marco de
   coordenada mais próximo pulsa opacidade uma vez (`@keyframes`, 400ms).
3. **Reordenação de matrícula:** ao mudar o rank, as linhas fazem
   `transition: transform 400ms` em vez de re-render, como uma ficha sendo
   reordenada numa gaveta.

### O que essa direção NÃO faz

Não ilustra casa/árvore/plantação de forma pitoresca; não usa papel bege
"quentinho" nem verde de mata como no atual (paleta rompe de propósito); não
usa gradiente; não depende de sombra suave em card; não trata as 6 equipes
como iguais.

---

## Direção B · "Boletim de Safra"

**Tese:** a identidade nasce do relatório técnico que a Emater entrega ao
produtor: tipografia de manchete, ilustração didática de corte de solo,
dados em tabela de classificados. É reportagem, não dashboard.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `papel-manteiga` | `#f7f2e6` | fundo em ambas as superfícies |
| `papel-realce` | `#efe7d4` | superfície de cartão/destaque sobre o papel |
| `tinta-imprensa` | `#201a12` | texto principal |
| `regua` | `#8a7a5c` | linhas e filetes editoriais |
| `manchete` | `#a3341c` | título de destaque, carimbo, CTA |
| `financas` | `#8a5a1f` | indicador |
| `producao` | `#4c6b2c` | indicador |
| `tecnologia` | `#33586c` | indicador |
| `sustentabilidade` | `#2f6b4a` | indicador |
| `alerta` | `#a3341c` | erro |
| `sucesso` | `#3d6b3f` | positivo |

Contraste: `tinta-imprensa` sobre `papel-manteiga` ≈ 15:1 (AAA), inclusive a
6 metros com a sala iluminada, porque o fundo claro não depende do nível de
preto do projetor. `manchete` sobre `papel-manteiga` ≈ 7:1 (AAA para texto
grande).

### Tipografia

- Display/manchete: **Fraunces** (mantém a família já licenciada no projeto,
  mas usada de forma radicalmente diferente: peso 600-900, itálico nos
  números de destaque, escala 110-140px no host para o placar de rodada,
  algo que a direção atual nunca ousa fazer).
- UI/corpo: **Public Sans** (grotesco de relatório institucional, não Inter).
- Dados/tabela: **Space Mono**, tabular, para todo valor numérico e para a
  "coluna de classificados".

### Layout das 6 equipes (projeção)

Primeira página de jornal: uma equipe vira "matéria principal" (a que teve
a maior variação na última rodada resolvida, calculado no cliente a partir
do que a API já devolve, sem endpoint novo) com nome em tamanho de manchete,
o corte de solo em largura total e uma citação da decisão tomada; as outras
5 equipes formam uma coluna de "classificados" abaixo: lista numerada densa,
sem ilustração, só nome + os 4 indicadores em mono alinhados em tabela. Isso
elimina o grid 3x2 por completo e entrega hierarquia editorial real.

### Linguagem gráfica da propriedade

Corte lateral do solo, como ilustração de livro didático de agronomia:
faixas horizontais empilhadas (solo superficial, subsolo, lençol freático)
desenhadas como preenchimentos de camada; sistema radicular da cultura
desenhado como traço ramificado que aprofunda e engrossa com a produção,
com a parte aérea (caule/folhas) crescendo acima da linha do solo na mesma
proporção; casa e silo desenhados como elevação arquitetônica em linha fina
(estilo prancha técnica, não silhueta preenchida de brinquedo); equipamentos
de tecnologia aparecem como legendas com linha de chamada (leader line)
apontando para o elemento, com uma etiqueta de texto curta, reforçando o
tom de relatório técnico. Sustentabilidade sobe a linha do lençol freático
e adensa a copa acima do solo.

### Indicadores

- **Finanças:** selo circular (carimbo) que fecha como um relógio conforme o
  valor sobe, com traços de minuto ao redor, estética de carimbo de cartório.
- **Produção:** glifo de caule com folhas que cresce em altura (sparkline
  vegetal), não barra.
- **Tecnologia:** barras de código de barras crescentes (5 barras, altura
  variável), remetendo a gráfico de jornal econômico.
- **Sustentabilidade:** linha do lençol freático dentro de um pequeno
  terrário/glifo retangular, que sobe conforme o valor, com uma folha no
  topo quando cheio.

### Motion signature

1. **Reveal de manchete:** o título entra com `letter-spacing` colapsando de
   um valor largo para o normal (500ms), efeito de "capa de jornal se
   ajustando".
2. **Ticker de classificados:** ao mudar o rank, os itens da lista fazem
   `transition: transform` no eixo Y (flip de posição), como um placar de
   estádio mecânico.
3. **Crescimento do caule:** `transform: scaleY()` com `transform-origin:
   bottom` num único passo (não loop) quando a produção sobe de faixa;
   desativado com `prefers-reduced-motion`.

### O que essa direção NÃO faz

Não usa isométrico nem qualquer sugestão de "jogo de tycoon"; não usa fundo
escuro em nenhuma superfície; não trata as 6 equipes com o mesmo peso visual;
não usa ícone decorativo sem função; não usa o bege/verde do "Terra Cerrado"
atual.

---

## Direção C · "Painel de Controle"

**Tese:** a identidade nasce da sala de controle/torre de operações de uma
cooperativa agrícola: um placar de campeonato ao vivo, quase-preto, com um
único acento dourado de alta saturação, pensado para se ler de longe como
um placar de estádio.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `carvao-950` | `#0d1210` | fundo (ambas as superfícies) |
| `carvao-800` | `#161d1a` | cartão/superfície elevada |
| `carvao-700` | `#212b26` | linha estrutural, borda |
| `branco-quente` | `#f1efe6` | texto principal |
| `cinza-texto` | `#9aa39a` | texto secundário |
| `dourado-grao` | `#e0952c` | acento único: CTA, líder, decisão pendente |
| `financas` | `#d9a441` | indicador |
| `producao` | `#6fae4e` | indicador |
| `tecnologia` | `#3fa1c2` | indicador (usar `#7cc3da` em texto pequeno) |
| `sustentabilidade` | `#4fae7a` | indicador |
| `alerta` | `#e0562c` | erro |
| `sucesso` | `#6fae4e` | positivo |

Contraste: `branco-quente` sobre `carvao-950` ≈ 16:1 (AAA). `dourado-grao`
sobre `carvao-950` ≈ 9:1 (AAA mesmo para corpo de texto). `tecnologia`
`#3fa1c2` sobre `carvao-950` ≈ 5.4:1 (AA, ok para ícone/dial, trocar por
`#7cc3da` se virar rótulo de texto pequeno).

**Risco a nomear:** projetor de sala de aula com luz acesa raramente produz
preto real; pixels "desligados" aparecem como cinza esverdeado, o que reduz
o contraste efetivo de qualquer fundo escuro mais do que os números acima
sugerem em papel. Esta direção pede um teste físico na sala real antes de
adotar como definitiva.

### Tipografia

- Display/placar: **Big Shoulders Display**, condensada, peso 700-900,
  caixa alta, para nome de equipe e título de rodada (88px no host).
- Dados: **JetBrains Mono**, tabular, estética de painel de LED, para todo
  indicador e cronômetro.
- UI/corpo: **IBM Plex Sans**.

### Layout das 6 equipes (projeção)

Placar de campeonato: as 6 equipes viram linhas horizontais ordenadas ao
vivo por índice composto, com **altura e peso visual proporcionais à
posição** (1º lugar é a linha mais alta/mais larga, ocupando o topo; a 6ª
linha é a mais compacta). Cada linha tem número de posição em mono gigante,
nome em display condensado, glifo reduzido da propriedade e os 4 indicadores
como mini-dials inline. Só a linha em destaque (1º lugar, ou a equipe que o
professor fixar) expande um painel lateral com a cena completa. É o layout
que mais literalmente resolve "sensação de disputa em andamento", porque a
disputa está desenhada na própria geometria da tela.

### Linguagem gráfica da propriedade

Miniatura isométrica (2.5D, achatada, sem sombreamento gradiente: só cor
chapada + contorno): um "tile" axonométrico com blocos de casa/silo em
projeção isométrica, faixa de plantio como textura de tile listrado, copas
de árvore como hexágonos achatados. Estética explicitamente de jogo de
estratégia/tycoon, o que casa com "disputa" e "decisão" sendo o núcleo do
jogo. Evolui como as demais: mais listras de plantio com produção, tiles de
equipamento (painel solar, pivô de irrigação) somados com tecnologia, tiles
de copa e nível de água subindo com sustentabilidade.

### Indicadores

- **Financas:** barra vertical segmentada tipo LED (5 a 8 blocos discretos
  que acendem, não um preenchimento contínuo).
- **Produção:** silhueta de espiga de milho preenchida de baixo para cima
  via `clip-path`.
- **Tecnologia:** barras de sinal de antena (5 barras crescentes).
- **Sustentabilidade:** arco circular tipo radar que fecha em 270 graus no
  sentido horário, com folha estilizada no centro.

### Motion signature

1. **Flip de posição:** quando o composite muda, as linhas do placar
   transicionam posição via `transition: transform 400ms` (sem biblioteca),
   efeito de placar mecânico reordenando.
2. **Pulso do líder:** glow suave (`box-shadow` opacity em keyframes, 2.4s
   loop) só na linha #1, desligado com `prefers-reduced-motion`.
3. **Acende-LED:** ao subir um indicador, os segmentos do "termômetro" LED
   acendem em cascata via `animation-delay` calculado por segmento (~80ms
   entre um e outro), sem JS de animação.

### O que essa direção NÃO faz

Não usa papel nem serifada editorial; não tenta ilustrar a fazenda de forma
realista; evita qualquer semelhança com dashboard SaaS corporativo (sem
cards brancos, sem glassmorphism, sem sombra suave); não reaproveita a
paleta do "Terra Cerrado" atual.

---

## Recomendação

**Direção B · "Boletim de Safra".** Sala de aula universitária com projetor
e luz acesa penaliza qualquer fundo escuro (Direção C) de um jeito que só se
confirma testando na sala real, e a Direção A, embora sólida, é mais fria
para uma dinâmica que precisa gerar debate em voz alta. O layout de
manchete + classificados resolve a hierarquia das 6 equipes sem contradizer
o tom "diagnóstico, não avaliação" do jogo (é um relatório que se lê em
grupo, não um placar que declara vencedor), e o corte de solo didático tira
a propriedade do território de desenho infantil com o menor risco técnico
de implementação em SVG puro.
