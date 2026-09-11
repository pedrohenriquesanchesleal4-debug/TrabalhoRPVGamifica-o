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