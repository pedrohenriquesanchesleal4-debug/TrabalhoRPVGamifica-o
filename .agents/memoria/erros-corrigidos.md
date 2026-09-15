# Erros corrigidos (anti-repetição)

## V5 (pré-existente, round documentada em docs/DIRECAO-VISUAL-V5.md)

- **Contraste 1.52:1 em painel tingido** (texto `-800` sobre prato com 30% do tom 600): corrigido trocando para variante clara 300/700 nos 5 pontos (event-card, jogar pausada/registrada, diagnóstico/resultado console azul, home "Sou aluno"). **Regra vigente:** texto sobre `terr-*` tingido = sempre variante clara (300 em fundo escuro, 700 em corpo).
- **`terra-500` rente ao piso 4.5:1** (usado em `.rotulo`): clareado. **Regra:** rótulo pequeno nunca abaixo de 5:1.

## Riscos ativos do redesign V6 (mitigar na execução)

- Agentes inventarem classes/tokens fora do contrato → revisão de diff no gate; contrato explícito no prompt.
- Laços de ambiência vazarem para painéis de decisão → só `animate-*` cênicos, conferir no diff.
- Quebra de contrato TS (imports, tipos) → `npm run typecheck` por agente + `verify` no gate.
- `prefers-reduced-motion` quebrando laços → classes estáticas explícitas já definidas em globals.css.

## 2026-09-11 · "Pássaros parados / nada mudou" (V6.1)

- **Sintoma:** usuário reportou pássaros da paisagem estáticos e a camada V6.1 invisível, com código e CSS compilado corretos (utilitários `animate-voo` etc. presentes no CSS final; auditoria confirmou).
- **Causa raiz:** `prefers-reduced-motion: reduce` ATIVO no ambiente do usuário (efeitos de animação do SO/browser): o reset global `animation-duration: 0.01ms !important` congelava toda animação no 1º quadro e `.bando { display: none }` escondia pássaros; revelações/parallax/entradas ficavam estáticas por design → a página parecia não ter mudado.
- **Correção (V6.2):** sob reduce, a AMBIÊNCIA cênica passou a viver em ritmo lento (~2x: pássaro 34s, nuvem 92s, sol 18s, capim 10s, luz 6.8s) em vez de morrer — overrides de `animation-duration/iteration-count` na SEQUÊNCIA do mesmo media (depois do reset global, mesma especificidade, vence o último). Estado terminal explícito permanece para `.revelar`/`.paralaxe-cena`/`.nascente-anel` (conteúdo e alerta estáticos, legíveis).
- **Regra nova:** toda animação cênica decorativa deve ter modo reduce = "lenta e gentil", nunca display:none nem congelada; conteúdo/informação continua sem movimento. Vale para navegadores com reduce, que são mais comuns que parecem (Windows "efeitos de animação" liga reduce global no Chrome).## V6.3 (tema claro) - 2026-09-11
- **Build quebrou no prerender: "Missing getServerSnapshot"** no `useSyncExternalStore` do ThemeToggle. Corrigido com 3º argumento (`() => 'escuro'`). **Regra:** uSES em componente SSR SEMPRE com getServerSnapshot; sem ele, cliente e servidor não têm snapshot e o Next cai no client-render no build.
- **Contraste 4.15:1** `terr-financas` claro x `financas-texto` (estado inicial #8a5a10): medido por script, escurecido para #7a4d0b (~4.6). **Regra:** no tema claro, medir pares MISTOS (prato = color-mix 26-30% acento + nevoa-100 novo), nunca o acento puro.

## 2026-09-15 · Modo Oficina: banco incompleto + realtime colidindo + painel sem carga inicial

- **Sintoma (500 em /admin ao criar oficina):** migration 0003 nunca aplicou por completo.
- **Causa raiz:** na linha 211 de `0003_oficina.sql`, o comentário de coluna fechava com `"` em vez de `'` (`campo_livre extra.";`) — o parser SQL engolia até o próximo apóstrofo e as instruções seguintes (`oficina_resultados`, `oficina_ia`, RLS, grants, realtime) nunca rodavam; 0004 dependia e também não rodava.
- **Correção:** aspa trocada e 0003 + 0004 reaplicadas via psql (exit 0 as duas). Schema agora com 8 tabelas `oficina_*` + coluna `games.mode` + 7 policies.
- **Sintoma 2:** ao abrir a oficina criada, tela caía no ErrorBoundary "ALGO FALHOU NESTA TELA" com `cannot add postgres_changes callbacks for realtime:game:<id> after subscribe()`.
- **Causa raiz:** Supabase cacheia canais por nome; `/admin` (useGameChannel) e OficinaTeacherPanel assinavam o MESMO canal `game:<id>` — segundo `.on()` após `.subscribe()` lança.
- **Correção:** `/admin` só assina quando `mode !== 'oficina'` (o painel da oficina já assina).
- **Causa raiz 3:** OficinaTeacherPanel ficava preso em "Carregando a oficina..." porque só carregava por evento realtime — sem carga inicial.
- **Correção:** `useEffect(() => { void load(); }, [load])`.
- **Regra nova:** componente client que depende de realtime precisa de carga inicial, não só do callback de evento; e nunca duas assinaturas no mesmo canal Supabase.

## 2026-09-15 · Roteiro de debate da oficina cortado / sem soluções / fallback errado

- **Sintoma:** "roteiro de debate não está criando do jeito certo, ele corta e não cria tudo" — texto incompleto no painel da oficina.
- **Causa raiz 1 — chamada de IA errada:** `chamarIaOficina` chamava `_internals.callGeminiWithRetry(prompt)`, que injeta o `SYSTEM_INSTRUCTION` do Diagnóstico (formato rígido de 4 blocos) e trata o 1º argumento como snapshot de partida. O prompt da oficina ia como "dados" → resposta com formato errado.
- **Causa raiz 2 — teto de tokens:** `MAX_OUTPUT_TOKENS = 1500` no `lib/gemini.ts`; o 3.6-flash gasta ~469 tokens de "thinking" antes do texto visível → roteiro longo (fala + pontos + provocação + perguntas) cortava no meio.
- **Causa raiz 3 — slot `debate` do cache nunca usado:** `resumoParaDebate` era determinístico puro (e ignorava soluções: `solucao: undefined`); a tabela `oficina_ia` tem check `('narrativa_inicial','reflexao_final','debate')` e o slot `debate` nunca era gravado.
- **Causa raiz 4 — fallback errado:** `reflexaoFinalOficina` caía em `OFICINA_IA_FALLBACKS.narrativa_inicial` (texto de abertura no lugar da reflexão).
- **Correções:**
  1. `lib/gemini.ts`: nova `callGeminiText(system, prompt)` (system propio da oficina, sem wrapper de snapshot, sem SYSTEM_INSTRUCTION do Diagnóstico) exposta nos `_internals`; `MAX_OUTPUT_TOKENS` 1500 → 4096 (vale também para o roteiro do Diagnóstico, que podia cortar igual).
  2. `lib/oficina-service.ts`: `chamarIaOficina` agora recebe `gameId` e monta um snapshot REAL (`construirSnapshotOficina`: equipes + perfil + indicadores + solução legível com rótulos dos cartões + categorias + pistas compartilhadas + eventos resolvidos); `resumoParaDebate` usa `getOrGenerateIa(gameId, 'debate', fallback)` — slot `debate` finalmente gerado, fallback = `calcularResultadoOficinaResumo`.
  3. `reflexaoFinalOficina` usa o snapshot real e fallback próprio novo.
  4. `data/oficina-ia.ts` + `types/oficina.ts`: novo campo `reflexao_final` em `OficinaIaFallbacks` com texto estático que sustenta a síntese do debate.
- **Regra nova:** compartilhamento de IA entre modos nunca por atalho — cada modo chama o Gemini com seu próprio system; e todo texto gerado com teto 1500 em modelo com "thinking" corre risco de truncar. Testes: 166 passando (9 arquivos); lint 0 erros.
