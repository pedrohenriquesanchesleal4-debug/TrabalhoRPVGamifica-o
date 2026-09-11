# SAFRA DF · contexto do projeto

Stack real (não presumir): Next.js 16.3.4 + React 19.2.8 + Tailwind CSS v4 (`@import 'tailwindcss'`, tokens em `@theme` no `globals.css`) + zod 4 + @supabase/supabase-js 2 + lucide-react. Testes: vitest (lógica server-side); typecheck via `tsc --noEmit`; lint eslint; build `next build` (turbopack, `next.config.ts` fixa root no diretório do projeto).

Projeto físico: `C:\Users\pedro.leal\Documents\teste2\safra-df` (monorepo aninhado; o lockfile de `teste2` pertence a OUTRO projeto — nunca rodar npm na raiz).

IMPORTANTE (AGENTS.md do projeto): Next.js 16 difere do conhecimento de treinamento — ler `node_modules/next/dist/docs/` antes de escrever código novo. Componentes `'use client'` ficam como estão: libs/`types/`/`data/`/`hooks/` NÃO são tocados em redesign visual.

Jogo: 1 professor + até ~30 alunos por turma, até 100 simultâneos no pico. 6 propriedades, ~5 jogadores por equipe, 5 rodadas, 4 indicadores (finanças/cash, produção/production, tecnologia/technology, sustentabilidade/sustainability). Comunicação por eventos realtime (`use-game-channel`), nada de polling.

## Direção visual

**V6 "Amanhecer do Cerrado"** (deste redesign; criada 2026-09-11). Ver `docs/DIRECAO-VISUAL-V6.md` e `.agents/memoria/decisoes.md`. Evolução: V3 Bento → V4 Noite de Cerrado → V5 Painel de Silo (aço frio, "correto mas sem brilho") → V6 Amanhecer do Cerrado (luz, calor, atmosfera; física de painel preservada).

Regras de ouro do visual:
- física `.degrau`/`banco`/`terraco`/`mirante` + famílias `terr-*` são CONTRATO: nomes e semântica inalteráveis.
- movimento só `transform`/`opacity`. Laços infinitos permitidos APENAS nas classes de ambiência (`animate-amanhecer`, `animate-voo`, `animate-balanco`, `animate-nuvem`, `animate-cintilar`) e sempre em superfície cênica, nunca em painel de dado.
- `prefers-reduced-motion` já é resolvido globalmente; não duplicar.
- zero imagem, zero vídeo, zero WebGL, zero biblioteca de animação nova; SVG/CSS puro.
- tipografia: Oswald (display/caixa alta), Manrope (corpo), JetBrains Mono (números/rótulos). Não trocar.
- dourado (`financas`) é o acento quente reservado: CTA primário e destaque; `amanhecer` é atmosfera, nunca indicador.
- contraste: texto sobre painel tingido usa sempre a variante CLARA (300/700) — lição da V5, nunca `-800` como texto sobre prato tingido.

## Serviços e pontos de atenção

- `npm run verify` = typecheck + lint + test + build (gate de entrega).
- Nenhuma chave de ambiente necessária para typecheck/build (Supa é runtime; `smoke-live` sim, mas exige `.env.local`).
- Copy em pt-BR; nunca rotular decisão como certa/errada/parabéns; jogo é diagnóstico pedagógico.