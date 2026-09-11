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
- Copy em pt-BR; nunca rotular decisão como certa/errada/parabéns; jogo é diagnóstico pedagógico.**V6.3 - Tema claro + ticker + COMO FUNCIONA** (2026-09-11). Ver `decisoes.md` D-07. Tema por troca de tokens (`[data-tema="claro"]` no fim do globals.css): superfícies/tintas invertem, cena (`--cor-cena-*`) e consoles fixos não. `components/ui/theme-toggle.tsx` (uSES + localStorage + anti-FOUC no layout), presente em home/entrar/admin. Landing ganhou fita ticker (`ticker-rola` em globals.css) + banda "COMO FUNCIONA". Texto sobre cena: `.sobre-cena*`; texto sobre console: `--cor-tinta-panel*`.
**Relatório final:** `docs/RELATORIO-FINAL.md` (2026-09-11) — escolhas V6.1-V6.3, retrospectiva (o que faria melhor: testar ambiente do usuário antes da entrega, uSES getServerSnapshot, contraste misto por construção), políticas públicas (crédito condicional ABC+/PSA-DF/ATER/outorga simplificada/PNAE/educação ambiental) + tecnologias (NDVI para targeting, sensores de umidade, conectividade rural) + plano de IA+RAG em 3 fases (Fase 1 pós-partida com fatos da partida como contexto; vetores pgvector no Supabase; citação obrigatória; nunca estratégia ótima nem substituir professor).

**Fase 1 de IA ENTREGUE (2026-09-11):** roteiro de debate pós-partida (`lib/gemini.ts` + rota `POST /api/host/[gameId]/debate` + painel no Bloco 5 do resultado). Disciplina de cota: 1 chamada Gemini por partida (cache na tabela `debate_prep` — migration em `supabase/migrations/0001_debate_prep.sql`, COPIAR no Supabase), singleflight em memória p/ clique duplo, timeout 25s, sem retry em 429, `maxOutputTokens 1500` (3.6-flash consome saída com "pensamento" antes do texto), snapshot JSON compacto (<7k chars). Modelo obrigatório: **gemini-3.6-flash** (2.5-flash deprecado p/ chaves novas — 404 validado ao vivo). Chave em `.env.local` (`GEMINI_API_KEY`, `GEMINI_MODEL`). Teste puro em `tests/gemini.test.ts`. Gate `npm run verify` verde.
