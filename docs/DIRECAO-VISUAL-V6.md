# Direção Visual V6 — "Amanhecer do Cerrado"

> Status: ativo · Aplicada em toda a aplicação · Decisão D-01 (ver `.agents/memoria/decisoes.md`)
> Substitui a V5 ("Painel de Silo") como camada de apresentação. Nenhuma API, rota, tipo, contrato de dados ou arquitetura muda nesta direção: só apresentação.

---

## Tese

O jogo acontece às 06:20, no limiar entre a noite do Cerrado e o dia que a plantação constrói. Cada rodada é uma **decisão antes do sol subir**: os recursos do 1º ano compram as escolhas que viram paisagem. A interface é feita de **terra-noite** (painéis escuros, quase pretos, quentes) e a **luz dourada do amanhecer** (destaques, CTAs, foco). Os quatro indicadores — recursos, produção, tecnologia, sustentabilidade — são a vegetação e a água do território: cada um com a sua casa de cor, nunca misturados.

A V5 era um painel de silo: correta, legível, mas fria e estática. A V6 mantém a física de elevação, a tipografia, o sistema de medidores e a disciplina de movimento; troca a textura de blueprint por **paisagem viva** e o cinza-azulado por **noite de terra + ouro do amanhecer**.

## O que mudou vs V5

| Aspecto | V5 (Painel de Silo) | V6 (Amanhecer do Cerrado) |
|---|---|---|
| Metáfora central | Painel industrial / silo de concreto | Paisagem do Cerrado ao amanhecer |
| Fundo base | `#0a0e13` (azul-noite frio) | `#0d0f0b` (noite de terra, quente) |
| Textura | Blueprint / grade técnica | Brilho de amanhecer, serra velada, grão de filme |
| Clima de cor | Cinza-azulado | Terra + dourado (ouro reservado a destaque/foco) |
| Keyframes | 4 (`emergir`, `nascente`, `copa`, `trava`) | 11 (+ `amanhecer`, `voo`, `balanco`, `nuvem`, `cintilar` — apenas paisagem; + `surgir` e `cena-paralaxe` — V6.1 scroll) |
| Componente herói | — | `cerrado-landscape` (SVG full-bleed reutilizável) |
| Título de hero | Tipografia chapada | `titulo-amanhecer` (gradiente dourado sobre preto) |
| CTA primário | Verde | Ouro (`destaque` / `bg-financas`) |
| Divisórias | Linhas técnicas | `filete-amanhecer` (filete de 1px dourado) |

## Paleta (tokens nominais preservados, valores V6)

Os nomes `--color-*` não mudaram desde a V3. Nenhum call site foi tocado para isso.

| Token | Valor | Papel |
|---|---|---|
| `nevoa-50` | `#0d0f0b` | Fundo raiz da aplicação |
| `nevoa-100` | `#161a13` | Camada contígua |
| `nevoa-200` | `#22281d` | Borda/separação |
| `terra-900` | `#f1e9d8` | Texto primário sobre terra-noite |
| `terra-700` | `#c4b89e` | Texto secundário |
| `terra-500` | `#9a8f76` | Rótulo/suporte |
| `verde-300/600/700/800` | `#d3e3a8 / #7f9953 / #b0cd7f / #1e2a12` | Indicador **produção** (vegetação) + terreno verde |
| `azul-300/600/700/800` | `#bfe0e6 / #547f93 / #96c5d3 / #12252c` | Indicador **tecnologia** + terreno azul (água) |
| `sustentabilidade` `-texto` `-800` | `#4f9a72 / #96cdab / #12291d` | Indicador sustentabilidade + terreno |
| `financas` `-texto` `-800` | `#e5a93c / #f2c968 / #3c2b10` | Indicador recursos + **ouro reservado a CTA/foco** |
| `alerta` `-texto` `-800` | `#b0562f / #d98b5f / #33180c` | Erro/alerta |
| `sucesso` | `#b0cd7f` | Confirmação |
| `amanhecer` | `#d9843f` | Única cor nova: atmosfera da paisagem. Nunca para indicador |

Regra de contraste (lição da V5): texto sobre `terr-*` tingido usa **sempre a variante clara** (300/700) do token, nunca a `-800`. Exceção: os painéis `terr-fundo-verde/azul` carregam `text-white` embutido.

### Tabela de contraste (sobre `nevoa-50` `#0d0f0b`)

Luminância relativa do fundo ≈ 0.005. Contrastes WCAG 2.2:

| Par | Razão | Nível |
|---|---|---|
| `terra-900` sobre `nevoa-50` | ~16.0:1 | AAA |
| `terra-700` sobre `nevoa-50` | ~9.8:1 | AAA |
| `terra-500` sobre `nevoa-50` | ~6.0:1 | AA |
| `financas` (`#e5a93c`) sobre `nevoa-50` | ~9.2:1 | AAA |
| `nevoa-50` sobre `financas` (CTA `destaque`) | ~9.2:1 | AAA |
| `verde-700` sobre `nevoa-50` | ~11:1 | AAA |
| `azul-700` sobre `nevoa-50` | ~10:1 | AAA |
| `alerta-texto` sobre `nevoa-50` | ~7.2:1 | AA |
| branco sobre `verde-800`/`azul-800` | ~15:1 | AAA |
| `financas-texto` sobre `nevoa-50` | >10:1 | AAA |

## Tipografia (inalterada)

- **Títulos**: Oswald (display condensado, uppercase, `tracking` apertado).
- **Corpo**: Manrope.
- **Dados**: JetBrains Mono (`dado-xl`, `dado-lg`, etc.).

## Movimento — 12 momentos

A disciplina da V5 permanece: **transform/opacity apenas**, animações declaradas no CSS, classes utilitárias `animate-*` do framework. Laços infinitos só na paisagem (`cerrado-landscape`) e no timer de projeção do host (`animate-nascente` nas últimas 30s). Nenhuma biblioteca de animação; nenhum loop em painel de dados.

| Keyframe | Duração | Onde |
|---|---|---|
| `emergir` | 0.34s | Entrada de qualquer bloco de conteúdo |
| `nascente` | 1.8s | Pulso do timer ≤30s (host) |
| `copa` | 0.6s | Entrada do dossel/faixa |
| `trava` | 0.22s | Trauma do clique de confirmação (`event-card`) |
| `amanhecer` | 9s | Respiração do brilho do sol (paisagem) |
| `voo` | 17s | Bando de aves cruzando o céu |
| `balanco` | 5s | Oscilação da vegetação |
| `nuvem` | 46s | Deriva lenta de nuvem |
| `cintilar` | 3.4s | Luzes acesas da casa rural |
| `surgir` | 0.7s | Revelação dirigida por scroll (`.revelar`, V6.1) |
| `cena-paralaxe` | linear | Parallax da cena no hero (`.paralaxe-cena`, V6.1) |

### V6.1 — camada de movimento dirigido por scroll (CSS nativo, zero JS)

Camada adicionada após a entrega da V6 ("gostei, mas quero mais animação"). Técnica: **CSS Scroll-Driven Animations** (`animation-timeline: view()`/`scroll()`), nativas no Chrome/Edge 115+, Firefox 132+, Safari 18+; sem biblioteca, sem JS, sem rAF — custo ~zero em celular.

- `.revelar` — módulo abaixo da dobra nasce da terra ao entrar na viewport (`surgir`, range `entry 5%..55%`). Guarda `@supports (animation-timeline: view())`: navegador sem suporte mostra tudo estático e visível (estado final é o default). Aplicado só ABAIXO da dobra — LCP intocado.
- `.paralaxe-cena` — a paisagem do hero desce 8vh e cresce 6% conforme o scroll sai do topo (range `0..88vh`).
- Heróis usam coreografia de entrada única: `motion-safe:animate-emergir` + `animationDelay` escalonado (0/80/160/240ms). O prefixo `motion-safe:` faz a classe nem nascer sob `prefers-reduced-motion` — conteúdo estático-visível imediato, sem janela de invisibilidade por delay.
- `prefers-reduced-motion: reduce` devolve `.revelar` (opacity 1, transform none, animation none) e `.paralaxe-cena` (off) ao estado terminal na camada base.
- Páginas já completas (zero edição, sem duplicar): todos os estados de `app/jogar`, transições de `app/entrar`, blocos de `resultado`/`diagnostico`, `event-card` (trava preservada).

**`prefers-reduced-motion`**: os cinco novos keyframes têm estado estático equivalente (`.ceu-respiro`, `.bando`, `.nuvem-painel`, `.folhagem`, `.luz-pisca`); `emergir`/`copa`/`trava` zeram duração; o fluxo da abertura troca o timer automático por botão explícito.

## Novas classes e componentes

- `.titulo-amanhecer` — gradiente dourado (background-clip) para títulos de hero.
- `.filete-amanhecer` — filete de 1px dourado; divisor estrutural.
- `ButtonVariant.destaque` / `bg-financas text-nevoa-50` — CTA primário ouro.
- `components/game/cerrado-landscape.tsx` — paisagem SVG full-bleed reutilizável (céu, sol, serras, ipês, aves, nuvens, fileiras de plantio, estrada de terra, casa rural, capim). `viewBox 1440×760`, `preserveAspectRatio="xMidYMid slice"`. Usada em: home, entrar, abertura da partida, projeção do host, resultado. Sempre com overlay de leitura por cima.

## O que NÃO mudou (preservado de propósito)

- Física de elevação: `.degrau` (nevoa-100), `.banco` (nevoa-200), `.terraco` (claro), `.mirante` (tingido).
- Família `terr-*` e utilitários `relevo-*`, `elevado`/`pressionado`, `focus-*`.
- Sistemas `Meter`, `Rotulo`, `SectionHeading`, `Field`, `dado-*`.
- Contrato de dados (`lib/`, `types/`, `data/`, `hooks/`) e APIs (todas as rotas `/api/*`).
- Seletor reduzido de acessibilidade, roles ARIA, navegação por teclado.
- Zero imagens raster, zero vídeo, zero WebGL, zero fontes novas.

## Arquivos tocados

**Fundação (criados/alterados pelo orquestrador):** `app/globals.css` (sistema V6 completo), `components/game/cerrado-landscape.tsx` (novo), `components/ui/primitives.tsx` (variante `destaque`), `app/layout.tsx` (`themeColor` `#0d0f0b`), `components/game/property-scene.tsx`, `components/game/df-map.tsx`.

**Frentes (4 agentes em paralelo, 1 frente cada):**
- Home: `app/page.tsx`
- Entrada do aluno: `app/entrar/page.tsx`
- Partida: `components/game/opening-sequence.tsx`, `components/game/event-card.tsx`, `app/jogar/page.tsx`
- Professor: `app/admin/page.tsx`, `app/host/[gameId]/page.tsx`, `app/host/[gameId]/diagnostico/page.tsx`, `app/host/[gameId]/resultado/page.tsx`

## Verificação

`npm run verify` = typecheck ✅ · lint ✅ · 94 testes ✅ · build ✅ (15 rotas, 4 estáticas + 11 dinâmicas). Auditoria anti-slop: zero ocorrências de `rounded-2xl`, `blur-*`, `backdrop-filter`, gradientes roxo/violeta, `bg-gradient-to-*`, fonte Inter.