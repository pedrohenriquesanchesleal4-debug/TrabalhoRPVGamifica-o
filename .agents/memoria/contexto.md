# Contexto do Projeto SAFRA DF (atualizado 2026-09-30)

## Stack
- Next.js 16.3.4 (App Router, Turbopack)
- React 19, TypeScript strict, Tailwind v4 (CSS-first, `@theme`)
- Supabase (Auth + Postgres + Realtime), lucide-react
- Vitest + Playwright, ESLint, `npm run verify` = typecheck+lint+test+build

## Decisões de Arquitetura (ADR-style)
- **Contrato Visual V6 "Amanhecer do Cerrado"** — `docs/CONTRATO-VISUAL.md` + `DIRECAO-VISUAL-V6.md` são a fonte de verdade. Tokens V5 **não** são recriados; call sites migram para tokens vivos.
- **Sistema de Degrau** (globals.css:146-149): `banco`(10px) → `terraco`(12px) → `mirante`(14px). Mais alto = mais redondo. Parede só embaixo (4px), nunca borda 4 lados.
- **Orçamento SVG** (CONTRATO-VISUAL.md:133-135): ~45 nós/cena propriedade, ~75/tela projeção. `scripts/svg-node-budget.tsx` mede no DOM real (Playwright) e reprova se estourar.
- **Animação**: só `transform`/`opacity` (CONTRATO §39). `height`/`width` animados = reflow = proibido.
- **Alvos de toque**: mínimo 44px (WCAG 2.5.5). `Button` usa `min-h-12/14/16` por variante.
- **Safe-area**: `env(safe-area-inset-*)` habilitado globalmente (`viewportFit: cover`). Aplicado em fixos (ThemeToggle, CTA, overlay).

## Padrões Obrigatórios
- **Meter/CanalTrilha/CanalArco/CanalIcone** = primitivos de indicador. `Meter` expõe `role="meter"` + `aria-valuetext={display}` (ex.: "R$ 45.000").
- **Pill** = 4 tons semânticos (`neutro`/`ativo`/`pronto`/`alerta`). `AwardPill` custom usa cor do indicador via `GAUGE_INK`.
- **Radiogroup real** para escolha única: `role="radiogroup"` + `role="radio" aria-checked` + navegação por setas. NÃO botões soltos com `aria-pressed`.
- **Dialog modal**: focus trap nativo, foco inicial, devolução, `Esc` fecha, `aria-labelledby` para título visual.
- **Timer**: `aria-live="off"` no container; anúncios SÓ em transições ("Últimos 10s", "Tempo encerrado") via `role="status" aria-live="assertive"` oculto.
- **Botão indisponível**: `aria-disabled="true" tabIndex={0} aria-describedby={motivoId}` — NÃO `disabled` (remove do AT sem explicar).

## Otimizações de Performance (Wave 2)
- `game/finance-index.ts` — módulo folha (0 imports) para `financeIndex`/`clampIndex`; `engine.ts` reexporta.
- `next/dynamic` com `ssr: false` para `OficinaPlayerApp` e `OficinaTeacherPanel` — carregam sob demanda.
- `optimizePackageImports: ['@supabase/supabase-js', 'lucide-react']` — Supabase não elegível (0 ganho medido, comentado).
- `onEvent`/`onTeamUpdate` coalesce 400ms + guarda de geração (`requestSeqRef`) — elimina GETs redundantes.
- `-112,7 KB` JS inicial em `/jogar` (1051→939 KB raw, -10,7%).

## Redução de Nós SVG (Wave 2)
- `PropertyScene`: vegetação 24→10, plantio 12→7 → típico 37, máximo 45 (no teto).
- `Meter compacto`: 16→4 nós (CanalArco→CanalTrilha HTML).
- `CanalArco compacto`: 12→0 (removido de propósito).
- Projeção: 666→408 (ainda >75; peso residual em `FocusTeamBoard` + 4 `CanalArco projecao` + ícones lucide dentro dos medidores).

## O que NÃO Mexer (já no padrão)
- `CerradoLandscape` no SSR de `/` e `/entrar` (ambientação = produto).
- `OpeningSequence` animada (a paisagem É o produto ali).
- `PropertyScene` compacta 32×32px em cards de seleção `/entrar`.
- Sistema de tokens, degrau, primitivos — todos validados por `svg:budget` + `typecheck`.

## Pendências Conhecidas
1. **Projeção em 408 nós** (orçamento 75) — requer mexer em `FocusTeamBoard`/`TeamRow`/`primitives.tsx` (ícones lucide dentro de `Meter projecao` = 80 nós).
2. **Supabase barrel 239,8 KB** — `optimizePackageImports` não elegível; avaliar import estreito em `lib/supabase.ts` se crítico.
3. **Safe-area real** — Chromium headless devolve 0; teste em dispositivo com notch/barra gestos obrigatório antes de deploy.
4. **`OpeningSequence` focus trap** validado em código; teste com leitor de tela real (NVDA/VoiceOver) pendente.