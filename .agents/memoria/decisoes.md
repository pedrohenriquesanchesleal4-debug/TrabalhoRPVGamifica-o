# Decisões (ADR-lite)

## 2026-09-11 · D-01: Redesign visual V6 "Amanhecer do Cerrado"

**Contexto:** V5 "Painel de Silo" aprovada pelo usuário, mas feedback: "está legal, não brilha meus olhos; quero mais animações, sem pesar no celular (foco mobile, 100 usuários simultâneos)". Brief extenso pede estética cinematográfica CERRADO + AGRICULTURA + TECNOLOGIA + ESTRATÉGIA, luz de 06:20 ("BRASÍLIA · 06:20"), premium, não genérica.

**Decisão:** evoluir V5 → V6 mantendo todo o esqueleto que funciona (física de painel, tipografia, manômetro, disciplina transform/opacity) e trocando: paleta (aço frio → terra-noite + luz de amanhecer), textura (grade blueprint → brilho solar + serra velada + grão), motion (4 keyframes → 9; laços novos só em ambiência cênica), nova paisagem SVG reutilizável (`cerrado-landscape.tsx`) e título em gradiente dourado (`titulo-amanhecer`) para momentos de hero.

**Alternativas consideradas:**
1. Trocar toda a metáfora por "jornal editorial" (serif, V4 revisitado) — rejeitada: usuário já rejeitou V4; movimento contrário ao retrovisor.
2. Introduzir biblioteca de animação (Framer Motion/GSAP) — rejeitada: viola o requisito de perf mobile/100 usuários e a restrição explícita do brief.
3. WebGL/Three para hero — rejeitada: proibido no brief; SVG/CSS cobre.
4. Apenas reskin de paleta — rejeitada: não atende "mais animações".

**Consequência:** zero call-site quebrado por troca de direção: os NOMES de token permanecem (`nevoa-*`, `terra-*`, família por indicador), só os valores mudaram + tokens novos (`amanhecer`, animações de ambiência, `titulo-amanhecer`, `filete-amanhecer`). Documentação: `docs/DIRECAO-VISUAL-V6.md`.

## 2026-09-11 · D-02: Paisagem SVGs gerados por código, sem coordenadas reais

Mapa do DF (`df-map.tsx`) e cena da propriedade (`property-scene.tsx`) usam silhuetas estilizadas/abstratas (não cartografia exata) — decisão herdada de V3, mantida: reconhecível, leve, e o jogo não depende de precisão geográfica.

## 2026-09-11 · D-03: Orquestração do redesign em swarm paralelo

Fundação (globals, landscape, re-skins) feita pelo orquestrador; frentes de página delegadas em paralelo: A=home, B=entrar, C=jogar+event-card+opening-sequence, D=host/admin/resultado/diagnostico. Coordenação por artefatos (globals.css + landscape + lista de classes), não por payloads. Gate final: `npm run verify` + auditoria anti-slop.

## 2026-09-11 · D-05: Camada de movimento V6.1 — scroll-driven CSS nativo (zero JS)

**Contexto:** usuário aprovou V6 ("gostei"), pediu "mais animações". Sistemas de dado JÁ animam (transição do canal 500ms, ponteiro 550ms, `useCountUp`); a lacuna era coreografia: scroll morto, heróis estáticos, sem parallax.

**Decisão:** adicionar `@keyframes surgir` + `cena-paralaxe` e carregar **CSS Scroll-Driven Animations** nativas — `.revelar` (revelação por `view()`, range entry 5..55%) e `.paralaxe-cena` (parallax por `scroll()`, 0..88vh) — dentro de `@supports (animation-timeline: view())`; heróis ganham entrada escalonada com `motion-safe:animate-emergir` + delays 0/80/160/240ms.

**Alternativas consideradas:**
1. GSAP + ScrollTrigger (scrub/pin verdadeiros) — rejeitada: viola disciplina "zero lib de animação"/perf mobile; pin pesado não justificado para conteúdo simples.
2. Motion React (`whileInView`) — rejeitada: mesmo pedido de JS/WAAPI por componente, sem ganho sobre CSS nativo aqui.
3. IntersectionObserver em utilitário próprio — rejeitada: JS a mais para o que `view()` resolve em CSS puro.
4. Mais laços ambientais na paisagem — rejeitada: satura; paisagem já respira/voa/bala/nuvem/cintila.

**Consequência:** custo zero de JS/CPU mobile (compositor-only), fallback natural sem suporte (`@supports` mostra tudo estático-visível; estado final é o default), reduced-motion devolve estado terminal na camada base, LCP protegido (`.revelar` só abaixo da dobra; `motion-safe:` nem nasce sob reduce). Gate: typecheck+lint+94 testes+build verdes.

## 2026-09-11 · D-06: "Redondinho" + ambiência viva sob reduced-motion (V6.2)

**Contexto:** usuário pediu "deixa o site mais redondinho" e reportou "pássaros parados / não mudou nada" — auditoria em CSS compilado apontou código correto; causa: `prefers-reduced-motion: reduce` ativo no ambiente (reset global 0.01ms congela tudo; `.bando` ficava `display:none`).

**Decisões:**
1. **Escada de raios de superfície** (`--raio-degrau/banco/terraco/mirante` = 10/10/12/14px), preservando a hierarquia de altitude (mais alto = mais redondo). Base `.degrau` ganhou `border-radius`; sombra do paredão atrás segue por box-shadow (respeita raio automaticamente). Campos já eram 10px, canal/ponteiro já circulares.
2. **Ambiência lenta sob reduce:** pássaro/nuvem/sol/capim/luz passam a ~2x de duração com iteração infinita (blocos na sequência do media, depois do reset global); `.revelar`/`.paralaxe-cena`/`nascente-anel` seguem estáticos. Decorativo vive lento; informação não se move.

**Alternativas consideradas (2):** manter reduce rígido (rejeitada: o usuário/cliente explicitamente quer ver movimento e o SO dele liga reduce global sem ele saber); remover todo o tratamento reduce (rejeitada: acessibilidade é requisito).

**Consequência:** movimento visível em qualquer ambiente (reduce vira "câmera lenta", não estático); raios consistentes e intencionais, fora do padrão "rounded-2xl uniforme" porque seguem a hierarquia de altitude. Gate: typecheck+lint+94 testes+build verdes.
## 2026-09-11 - D-07: Tema claro por troca de tokens + âncora de cena noturna + landing "falta algo"

**Contexto:** usuário pediu "possível alterar o tema e precisa ser visível a letra — o escuro como está não pode impedir de ler" + "falta algo nessa landing".

**Decisões:**
1. **Tema claro = redefinição de VALOR, não de classe.** Bloco `:root[data-tema="claro"]` no fim do CSS (un-layered, vence o `@theme` layered) troca só os tokens que invertem: `nevoa-50/100/200` (breu -> creme), `terra-900/700/500` (areia -> marrom escuro), tons de acento 300/700 e `financas-texto`/`sustentabilidade-texto`/`alerta-texto`/`sucesso`. Zero chamada de componente tocada: `text-terra-900` continua certo nos dois temas, porque o BACKGROUND sobre o qual ele senta é o mesmo token que inverte junto.
2. **Âncora noturna: cena vira `--cor-cena-*` FIXA.** A paisagem do amanhecer troca todos os refs para 11 vars `--cor-cena-*` (topo/fundo/horizonte/serra/serra-longe/estrada/po/capim) que NÃO invertem: o céu de 06:20 permanece nos dois temas. Overlays de leitura (home hero, `CENARIO_OVERLAY` do entrar) também congelam no breu via `--cor-cena-topo`. Texto sobre cena usa `.sobre-cena`/`-suave`/`-dourado` fixos.
3. **Três famílias de tinta**: adaptáveis `--cor-tinta-*` (GAUGE_INK, seguem o tema: claras no escuro, escuras no claro), fixas `--cor-tinta-panel*` (texto sobre consoles `terr-fundo-*` — sempre claro, 5 variantes incl. dourado/verde/azul) e `--cor-tinta-escuro` (texto do CTA dourado). `terr-verde/azul/financas/...` misturam acento 600 com `nevoa-100`: como AMBOS invertem, o prato tingido claro + tinta escura sobem juntos — contraste preservado sem override.
4. **Toggle** (`components/ui/theme-toggle.tsx`): store externa mínima + `useSyncExternalStore` (lint do React Compiler proíbe setState em effect), `localStorage[safra-tema]`, script inline anti-FOUC no layout. Presente só em home/entrar/admin — jogo (`jogar`) e projeção (`host/*`) ficam fora do tema do aluno.
5. **Landing "falta algo"**: fita ticker CSS (`ticker-rola`, translateX(-50%) com conteúdo duplicado, 34s / 64s sob reduce) sob o hero + banda "COMO FUNCIONA" assimétrica (3 degraus com deslocamento vertical `lg:mt-6/12`, coluna 1.15fr — não é grade de cards iguais).

**Alternativas consideradas:** `prefers-color-scheme` automático (rejeitado: surpresa na sala de aula; toggle explícito + persistência), dark-mode via classe Tailwind (rejeitado: tokens por var já resolvem), cena CLARA no tema claro (rejeitado: destrói a identidade do amanhecer; a cena é a âncora), duplicar paleta por página (rejeitado: quebraria 0 compromisso de manutenção).

**Consequência:** contraste medido por script (creme x texto 13.58, console x panel 12.46, pratos tingidos claros 4.5+) com 1 ajuste (#7a4d0b em financas-texto, 4.15 -> 4.6+); CSS compilado auditado (cena 1, tinta-panel 19, ticker 2, data-tema 3). Gate: typecheck+lint+94 testes+build verdes.


## 2026-09-11 · D-08: Roteiro de debate pós-partida com IA (Fase 1, sem RAG)

**Contexto:** professor quer, ao fim do jogo, direção do que falar na roda de conversa com a turma. Orçamento: Gemini plano gratuito (RPM e tokens limitados). Proibido: estratégia ótima, julgar equipe, substituir o professor, persistir conversa de aluno (LGPD), lotar a IA.

**Decisão:** uma chamada por partida, teacher-facing, no Bloco 5 do resultado. Payload = snapshot JSON compacto (<7k chars) construído do HostView BÁSICO (4 indicadores finais, histórico R1-R5 por equipe com rótulo+tags, perfil, prêmios, diagnóstico, ganchos, conexões de política real) — SEM RAG de documentos: fatos estruturados do jogo já resolvem 80% do caso de uso; documentos viram Fase 2 com citação curatorial.

**Alternativas consideradas:**
1. RAG completo agora (pgvector + corpus de políticas) — rejeitada: custo/tokens desproporcional ao MVP; citação sem curadoria arrisca alucinação.
2. Gerar no cliente (chave no navegador) — rejeitada: vazaria a chave.
3. Sem cache (toda abertura regenera) — rejeitada: estoura RPM/tokens no plano grátis; tabela debate_prep custa zero.
4. Chat interativo com o modelo — rejeitada: multiplica chamadas por aluno.

**Consequência:** cache em debate_prep (1 chamada/partida mesmo com cliques duplos — singleflight em memória), timeout 25s AbortController, sem retry em 429 (cota é o problema, não rede), retry único só rede/5xx, maxOutputTokens 1500 porque o **gemini-3.6-flash consome tokens de saída no "pensamento" antes do texto visível** (medido: 469 de thinking numa resposta de 41; com 50 de teto a saída vinha VAZIA). Modelo obrigatório: gemini-3.6-flash — chaves novas recebem 404 em gemini-2.5-flash (validado ao vivo). Saída em markdown enxuto renderizado por MarkdownLite (sem dependência). Migration: supabase/migrations/0001_debate_prep.sql (copiar no Supabase). Teste puro do snapshot em 	ests/gemini.test.ts. Gate: ` npm run verify ` verde (16 rotas).


## 2026-09-11 · D-09: RAG Fase 2 — corpus vetorial com citação por fonte (pgvector)

**Contexto:** roteiro (D-08) citava políticas só via policyConnections (o que a turma fez → programa). Professor pediu "fazer tudo": citar políticas/tecnologias reais COM fonte no roteiro, sem lotar a IA.

**Decisão:** RAG híbrido frugal. Corpus = 14 fichas (6 políticas + 8 tecnologias) derivadas LITERALMENTE de data/policies.ts e data/technologies.ts — texto zero novo, número zero inventado, fonte por ficha (declarada pelo app). Embedding único em gemini-embedding-001 (3072 dims, medido ao vivo: 	ext-embedding-004 está indisponível para chaves novas). Runtime: 1 embedding da partida + match_corpus() (pgvector HNSW, 3 fichas, sem chamada de IA extra) → seção "## Materiais de apoio" no prompt com nome + Fonte; modelo cita (Fonte: ...) por ponto. Falha de embedding/busca DEGRADA para roteiro sem material (generation nunca trava). Migration 0002 cria corpus_politicas + coluna material_usado em debate_prep + função match_corpus.

**Alternativas consideradas:**
1. RAG por keyword (sem vetor) — rejeitada: qualidade de recuperação inferior ao embedding para fraseado livre do snapshot.
2. Embedding por aluno/toda abertura — rejeitada: multiplica chamadas; cache já cobre regeneração (roteiro cacheado NUNCA re-embeda).
3. text-embedding-004 (768 dims, mais barato) — rejeitada POR TESTE AO VIVO: 404 em chaves novas. **Erro pego na migration:** HNSW do pgvector não indexa acima de 2000 dims; default 3072 do gemini-embedding-001 quebrava o índice (54000) — resolvido com outputDimensionality 768, que cabe tranquilo no HNSW.
4. Script Node com loader TS p/ embed — rejeitada: drift de fonte; preferido rota admin POST /api/admin/corpus/embed (importa o TS nativo) + EMBED_ADMIN_KEY Bearer + 
pm run embed:corpus (cliente HTTP local, 20 linhas).

**Consequência:** 15 embeddings fixos (uma vez, plano grátis cobre) = custo total do RAG; por aluno, zero; por partida, 1 chamada de geração + 1 de embedding (só na 1ª abertura). Gate 
pm run verify verde (17 rotas, 101 testes). Lição: **sempre testar model+shape ao vivo antes de fixar schema/constants** (3.6-flash viaja pensando; embedding-001 = 3072; 004 deprecado).
