# Contrato visual · Boletim de Safra

Direção escolhida em `DIRECOES-VISUAIS.md` (Direção B). Este documento é o
contrato: a fundação em `app/globals.css`, `app/layout.tsx`,
`components/ui/gauges.tsx` e `components/ui/primitives.tsx` já está escrita, e
toda tela do projeto deve consumir dela. Nenhuma tela define token próprio.

## A tese

A identidade nasce do relatório técnico que a extensão rural entrega ao
produtor: papel manteiga, tinta de imprensa, filete editorial, manchete em
serifa pesada e dado numérico em monoespaçada. É reportagem impressa, não
dashboard.

## Regras estruturais

1. **Não existe card.** Caixa com borda nos quatro lados, raio uniforme e
   sombra suave está proibida. Use `.bloco` (filete grosso no topo, sem borda
   lateral, sem sombra) ou apenas filete separando registros. Se uma tela
   precisar de seis elementos iguais, eles NÃO podem ter o mesmo peso visual:
   um vira matéria principal e o resto vira classificado.
2. **Hierarquia por escala, não por peso.** A escala tem salto real:
   `.manchete-xl` (até 140px) para o clímax, `.manchete-lg`, `.manchete-md`,
   `.manchete-sm`, e rótulo em 11px. Proibido resolver hierarquia deixando
   tudo entre 16px e 24px com `font-weight` diferente.
3. **Todo número usa `.dado`, `.dado-lg` ou `.dado-xl`** (Space Mono tabular).
   Cifra, indicador, cronômetro, código de partida, posição no ranking.
4. **Nenhum indicador depende de cor.** Use sempre `<Meter>`: ele desenha a
   forma em SVG (selo, caule, barras, lençol) e imprime o valor por extenso.
5. **Filete no topo, não embaixo.** Assim se abre seção de jornal, e é o que
   impede a seção de virar caixa fechada.

## Tokens (Tailwind 4, definidos em `app/globals.css`)

Cores. **Os tokens antigos `areia-*`, `mata-*` e `terra-*` não existem mais.**
Qualquer classe com eles falha silenciosamente (Tailwind não gera a regra).

| Token | Uso |
|---|---|
| `papel-100` | fundo da página (já aplicado no `body`) |
| `papel-50` | superfície de bloco, coluna |
| `papel-200` | superfície de realce |
| `papel-300`, `papel-400` | fio, moldura de tabela |
| `tinta-900` | texto principal e fundo de botão principal |
| `tinta-700` | texto de apoio forte |
| `tinta-500` | texto secundário, rótulo |
| `regua` | filete e fio de coluna. Nunca texto de corpo (3.7:1) |
| `manchete` | acento único: chapéu, carimbo, urgência |
| `manchete-escura` | hover do botão principal |
| `financas` `producao` `tecnologia` `sustentabilidade` | indicadores |
| `alerta` `sucesso` | erro e positivo |

Classes utilitárias de composição, já prontas: `.manchete-xl` `.manchete-lg`
`.manchete-md` `.manchete-sm` `.olho` `.chapeu` `.rotulo` `.dado` `.dado-lg`
`.dado-xl` `.filete-grosso` `.filete-medio` `.filete-fino` `.filete-duplo`
`.fio-coluna` `.bloco` `.bloco-realce` `.carimbo` `.tabular`.

Animação, via `animate-*`: `animate-manchete` (espacejamento fechando, para
título de entrada), `animate-sobe`, `animate-caule`, `animate-selo`,
`animate-brasa` (pulso de urgência do cronômetro). Nenhuma biblioteca de
animação: só CSS.

## API dos primitivos

```ts
// components/ui/primitives.tsx
Button({ variant?: 'principal' | 'secundario' | 'silencioso' | 'perigo',
         size?: 'normal' | 'grande' | 'projecao' })
Field({ label, hint?, error?, codigo? })   // codigo: mono, caixa alta, espaçado
Pill({ tone?: 'neutro' | 'ativo' | 'pronto' | 'alerta' })
Carimbo({ children })
Meter({ kind, label, value, display, delta?,
        size?: 'aluno' | 'projecao' | 'compacto' })
Chapeu({ children })
Filete({ espessura?: 'grosso' | 'medio' | 'fino' | 'duplo' })
SectionHeading({ overline?, title, description?, escala?: 'md' | 'lg' })
formatMoney(value: number): string
```

```ts
// components/ui/gauges.tsx
Gauge({ kind, value, className })          // o SVG cru, sem rótulo
GAUGE_INK[kind]                            // classe text-* do indicador
GAUGE_LABEL[kind]                          // rótulo canônico
type IndicatorKind = 'financas' | 'producao' | 'tecnologia' | 'sustentabilidade'
```

`Meter` com `size="projecao"` desenha medidor de 56 a 64px e valor em
`.dado-xl`. É o tamanho obrigatório em qualquer tela `/host/**`: o requisito é
leitura do fundo de uma sala de aula.

## Restrições duras do projeto

- Zero imagem raster, zero vídeo, zero WebGL, zero 3D, zero biblioteca de
  animação. Só SVG, CSS e animação CSS.
- Zero gradiente roxo, violeta ou rosa. Zero glassmorphism. Zero
  `rounded-2xl`. Zero emoji decorativo (ícone via `lucide-react`).
- Zero travessão e zero hífen duplo em qualquer texto: use "·", ":" ou ponto
  final. Há teste que falha se aparecer no conteúdo de `data/events`.
- Texto de interface em português do Brasil.
- O jogo é diagnóstico, não avaliação: nenhuma tela pode dizer "resposta
  certa", "errou" ou "parabéns pela escolha correta". A interface mostra
  consequência; o professor interpreta.
- Celular do aluno: uma coluna, alvo de toque de 44px. Projetor do professor:
  número grande, sem depender de hover.
