# Contrato visual · V3 "Curva de Nível"

Direção completa em `DIRECAO-VISUAL-V3.md`. Este documento é o contrato de
implementação: a fundação em `app/globals.css`, `app/layout.tsx`,
`components/ui/gauges.tsx` e `components/ui/primitives.tsx` já está escrita, e
toda tela consome dela. Nenhuma tela define token próprio.

**Substitui integralmente as duas direções anteriores.** "Terra Cerrado"
(areia + serifada) e "Boletim de Safra" (papel + manchete de jornal) foram
rejeitadas pelo mesmo motivo: claras, chapadas, impressas, sem profundidade,
sem cor viva, sem movimento. Todo vocabulário delas está morto.

## A tese

Terraceamento em curva de nível: a técnica real que o produtor do Cerrado usa
para conter erosão e reter água. Cada superfície é um degrau, um PRATO
colorido apoiado sobre uma PAREDE sólida da mesma família de cor.

## Regras estruturais

1. **Não existe card. Existe degrau.** Use `<Degrau>` ou as classes
   `degrau banco|terraco|mirante terr-*`. A parede é `box-shadow` com blur
   ZERO, deslocada só para baixo. Proibido: sombra difusa, `blur`,
   transparência decorativa, glassmorphism, borda nos quatro lados.
2. **Hierarquia é altitude, e uma tela usa no máximo UM `mirante`.** É o que
   torna impossível voltar ao grid de seis blocos iguais.
3. **O raio de canto DIMINUI conforme a altitude sobe**: `banco` 10px,
   `terraco` 6px, `mirante` 3px. Já vem nas classes. Nunca aplique
   `rounded-2xl` nem raio uniforme.
4. **Cor cobre área grande.** Verde e azul são superfície, não só texto e
   ícone. Mas atenção ao contraste: o tom **600 é só superfície, ícone e UI**;
   para texto de corpo pequeno use `verde-700`, `azul-700` ou
   `financas-texto`. `financas` cheio nunca carrega texto pequeno.
5. **Todo número usa `.dado`, `.dado-lg` ou `.dado-xl`** (JetBrains Mono
   tabular): cifra, indicador, cronômetro, código de partida, posição.
6. **Nenhum indicador depende de cor.** Use sempre `<Meter>`: ícone (forma) +
   trilha (proporção) + número impresso (valor exato).
7. **Movimento só em `transform` e `opacity`.** Precisa rodar liso em celular
   popular com 30 aparelhos na mesma rede.

## Tokens (Tailwind 4, em `app/globals.css`)

Tokens das direções antigas **não existem mais** e falham em silêncio
(Tailwind simplesmente não gera a regra). Mortos: `areia-*`, `mata-*`,
`papel-*`, `tinta-*`, `regua`, `manchete*`, `financas-800` como texto,
`rounded-carta`, `shadow-carta`, `faixa-terra`, `filete-*`, `bloco*`,
`manchete-*` (as classes de tipografia), `chapeu`, `carimbo`, `olho`.

| Token | Uso |
|---|---|
| `nevoa-50` | fundo da página (já no `body`) |
| `nevoa-100` | prato neutro, trilha de campo |
| `nevoa-200` | trilha do canal, pílula neutra |
| `terra-900` | texto principal (14.8:1) |
| `terra-700` | texto de apoio |
| `terra-500` | rótulo, terciário |
| `verde-300` / `azul-300` | prato claro tingido, destaque sobre parede escura |
| `verde-600` / `azul-600` | superfície, ícone, UI (4.8:1 e 4.9:1: só texto ≥ 1.25rem) |
| `verde-700` / `azul-700` | texto de corpo pequeno (7.3:1 e 7.8:1) |
| `verde-800` / `azul-800` | parede do degrau; texto branco em cima passa AAA |
| `financas` | preenchimento e ícone |
| `financas-texto` | rótulo e valor em texto pequeno (5.4:1) |
| `producao` `tecnologia` `sustentabilidade` | preenchimento dos indicadores |
| `alerta` / `alerta-800` | erro e urgência |
| `sucesso` | positivo (nunca rotulado como "certo") |

Classes utilitárias prontas: `.relevo-xl` `.relevo-lg` `.relevo-md`
`.relevo-sm` `.rotulo` `.dado` `.dado-lg` `.dado-xl` `.degrau` `.banco`
`.terraco` `.mirante` `.pisavel` e as famílias `.terr-neutro` `.terr-claro`
`.terr-verde` `.terr-azul` `.terr-financas` `.terr-sustentabilidade`
`.terr-alerta` `.terr-fundo-verde` `.terr-fundo-azul`.

Animação, via `animate-*`: `animate-emergir` (entrada de bloco),
`animate-nascente` (pulso de urgência do cronômetro, único laço infinito do
sistema, com a classe `.nascente-anel` no anel para o fallback de
`prefers-reduced-motion`), `animate-copa` (produção sobe de faixa).

## API dos primitivos

```ts
// components/ui/primitives.tsx
Degrau({ nivel?: 'banco'|'terraco'|'mirante',
         familia?: 'neutro'|'claro'|'verde'|'azul'|'financas'
                 |'sustentabilidade'|'alerta'|'fundo-verde'|'fundo-azul',
         pisavel?: boolean, className?, children })
Rotulo({ children })
Button({ variant?: 'principal'|'secundario'|'silencioso'|'perigo',
         size?: 'normal'|'grande'|'projecao' })
Field({ label, hint?, error?, codigo? })
Pill({ tone?: 'neutro'|'ativo'|'pronto'|'alerta' })
Meter({ kind, label, value, display, delta?,
        size?: 'aluno'|'projecao'|'compacto' })
SectionHeading({ overline?, title, description?, escala?: 'md'|'lg' })
formatMoney(value: number): string
GAUGE_LABEL[kind]      // rótulo canônico do indicador
GAUGE_TERRACO[kind]    // classe terr-* da família do indicador
type IndicatorKind = 'financas'|'producao'|'tecnologia'|'sustentabilidade'
```

```ts
// components/ui/gauges.tsx
CanalTrilha({ kind, value, size?, className })  // trilha + preenchimento
CanalIcone({ kind, size?, className })          // ícone lucide do indicador
GAUGE_INK[kind]                                 // classe text-* segura para texto
```

`Meter` com `size="projecao"` usa ícone de 28px, valor em `.dado-xl` e trilha
de 16px. É obrigatório em qualquer tela `/host/**`: o requisito é leitura do
fundo de uma sala de aula, a seis metros, com a luz acesa.

## Mobile-first

30 dos 31 usuários de uma partida estão no celular. Uma coluna sempre; alvo de
toque mínimo de 44px, padrão do projeto 48px, opção de decisão 56px; nenhum
estado depende de hover; nada de `height` animado (use `transform`, evita
reflow). A partir de 768px a tela do aluno pode ir para duas colunas
(narrativa 60% / opções 40% com `position: sticky`). `/host/**` e `/admin`
assumem projetor a partir de 1024px.

## Restrições duras

- Zero imagem raster, zero vídeo, zero WebGL, zero 3D, zero biblioteca de
  animação. Só SVG, CSS e animação CSS.
- Zero roxo, violeta ou rosa. Zero glassmorphism. Zero emoji decorativo
  (ícone via `lucide-react`).
- Zero travessão e zero hífen duplo em qualquer texto: use "·", ":" ou ponto
  final. Há teste que falha se aparecer no conteúdo de `data/events`.
- Texto de interface em português do Brasil.
- O jogo é diagnóstico, não avaliação: nenhuma tela pode dizer "resposta
  certa", "errou" ou "parabéns pela escolha correta". A interface mostra
  consequência; o professor interpreta.
- Orçamento de peso: teto de ~45 nós SVG por cena de propriedade e ~75 na
  tela de projeção inteira. O jogo precisa aguentar 100 conexões simultâneas
  no plano gratuito.
