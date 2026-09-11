# Erros corrigidos (anti-repetição)

## V5 (pré-existente, round documentada em docs/DIRECAO-VISUAL-V5.md)

- **Contraste 1.52:1 em painel tingido** (texto `-800` sobre prato com 30% do tom 600): corrigido trocando para variante clara 300/700 nos 5 pontos (event-card, jogar pausada/registrada, diagnóstico/resultado console azul, home "Sou aluno"). **Regra vigente:** texto sobre `terr-*` tingido = sempre variante clara (300 em fundo escuro, 700 em corpo).
- **`terra-500` rente ao piso 4.5:1** (usado em `.rotulo`): clareado. **Regra:** rótulo pequeno nunca abaixo de 5:1.

## Riscos ativos do redesign V6 (mitigar na execução)

- Agentes inventarem classes/tokens fora do contrato → revisão de diff no gate; contrato explícito no prompt.
- Laços de ambiência vazarem para painéis de decisão → só `animate-*` cênicos, conferir no diff.
- Quebra de contrato TS (imports, tipos) → `npm run typecheck` por agente + `verify` no gate.
- `prefers-reduced-motion` quebrando laços → classes estáticas explícitas já definidas em globals.css.