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
