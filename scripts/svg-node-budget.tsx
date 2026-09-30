/**
 * Contagem de nós SVG por tela, medida no DOM de verdade.
 *
 * Por que um script e não uma conta de cabeça: o orçamento de
 * `docs/CONTRATO-VISUAL.md` ("~45 nós SVG por cena de propriedade e ~75 na
 * tela de projeção inteira") é o teto que segura o jogo num celular 2019 com
 * 30 aparelhos na mesma rede. Um teto que ninguém mede deixa de ser teto.
 *
 * O método aqui é deliberadamente literal, sem regex e sem estimativa:
 *   1. os componentes REAIS são renderizados com `renderToStaticMarkup` (o
 *      mesmo markup que o navegador recebe no primeiro quadro, com os laços já
 *      expandidos pelo próprio React);
 *   2. esse markup é injetado numa página de verdade no Chromium via
 *      Playwright (`setContent`), então a contagem sai do DOM, não do texto;
 *   3. a contagem é feita com um `TreeWalker` sobre `document.body` somando
 *      todo elemento cujo `namespaceURI` é o do SVG — incluindo o próprio
 *      `<svg>` raiz, os `<g>` e os `<symbol>` de `<defs>`, e incluindo os
 *      `<svg>` aninhados do `lucide-react`.
 *
 * A regra de contagem foi validada contra as três medições de referência do
 * projeto, medidas antes desta redução: `CerradoLandscape` 68 nós,
 * `CanalArco size="projecao"` 20 por instância e `CanalArco size="compacto"`
 * 12 por instância. Os dois primeiros continuam valendo como âncora; o terceiro
 * virou 0 de propósito, e é a prova de que a troca da Tarefa 1 aconteceu.
 *
 * A tela de projeção é montada aqui com os MESMOS componentes que
 * `app/host/[gameId]/page.tsx` monta, na mesma quantidade de instâncias
 * (paisagem + mirante da equipe em foco + as 5 linhas da encosta + cabeçalho e
 * rodapé). A página viva exigiria uma partida real no Supabase; o que este
 * script mede é a composição de tela, instância por instância. Os ícones lucide
 * do cabeçalho entram pela primeira vez por aqui: eles entram na contagem desde
 * a primeira medição, e somar 11 nós era mais honesto que deixar de fora.
 *
 * `--shots` grava as capturas de tela das cenas em `screenshots/`, com o CSS
 * REAL do projeto compilado. Contagem diz quanto custa; a captura diz se ainda
 * parece a mesma coisa. Ela não substitui ninguém: um script não tem olhos, e
 * quem tem precisa olhar os PNG gerados.
 *
 * A verificação geométrica roda SEMPRE (sem `--shots`), porque é a parte
 * asserível: provê-la ou refutá-la a cada execução é o que impede o comentário
 * da densidade de voltar a mentir.
 *
 * Uso:
 *   npx tsx scripts/svg-node-budget.tsx
 *   npx tsx scripts/svg-node-budget.tsx --shots
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import type { ReactNode } from 'react';

import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { PropertyScene } from '@/components/game/property-scene';
import { FocusTeamBoard, TeamRow } from '@/components/host/team-board';
import { CanalArco, CanalIcone, CanalTrilha } from '@/components/ui/gauges';
import { Meter, Pill, Rotulo } from '@/components/ui/primitives';
import { Timer, Trophy, Users } from 'lucide-react';
import type { HostTeamView } from '@/lib/game-service';
import type { TeamTraits } from '@/types/game';

const NS_SVG = 'http://www.w3.org/2000/svg';

/**
 * Os cinco tokens `--animate-*` INFINITOS de ambiência declarados no `@theme`
 * de `app/globals.css` (linhas 136-140). São eles, e só eles, que consomem
 * trabalho de quadro contínuo em background: as entradas (`animate-emergir`,
 * `animate-copa`, `animate-trava`, `animate-eclode`) são `both`, ou seja
 * uma passada só, e `animate-nascente` não é usado por nenhum destes
 * componentes. A lista é conferida contra o `@theme`, não contra memória.
 */
const LACOS_AMBiencia = [
  'animate-amanhecer',
  'animate-voo',
  'animate-balanco',
  'animate-nuvem',
  'animate-cintilar',
] as const;

const INITIAL_TRAITS: TeamTraits = {
  trained: false,
  idleTech: 0,
  debtInstallments: 0,
  debtPerRound: 0,
  inPublicProgram: false,
  inCooperative: false,
  irrigation: false,
  storage: false,
  cashCrises: 0,
  opportunitiesTaken: 0,
};

const PROPRIEDADES = [
  'sitio-horizonte',
  'cerrado-vivo',
  'boa-esperanca',
  'riacho-verde',
  'nova-safra',
  'planalto-familiar',
] as const;

function equipe(
  index: number,
  cash: number,
  production: number,
  technology: number,
  sustainability: number,
  decided: boolean,
): HostTeamView {
  return {
    id: `t${index}`,
    name: `Equipe ${index + 1}`,
    propertyKey: PROPRIEDADES[index] ?? 'sitio-horizonte',
    orderIndex: index,
    state: { cash, production, technology, sustainability, traits: INITIAL_TRAITS },
    players: [
      { id: `p${index}a`, name: `Aluno ${index}a`, role: 'produtor', state: 'thinking', connected: true },
      { id: `p${index}b`, name: `Aluno ${index}b`, role: 'financeiro', state: 'thinking', connected: true },
    ],
    currentEvent: null,
    currentDecision: decided
      ? { optionKey: 'a', optionLabel: 'Comprar à vista' }
      : null,
    history: [],
  };
}

/** Estado intermediário de partida: o que a maior parte das rodadas mostra. */
const TIPICA: HostTeamView[] = [
  equipe(0, 62000, 72, 48, 64, true),
  equipe(1, 55000, 64, 35, 71, true),
  equipe(2, 78000, 81, 60, 55, true),
  equipe(3, 41000, 58, 28, 82, false),
  equipe(4, 69000, 76, 42, 60, true),
  equipe(5, 58000, 68, 30, 47, false),
];

/** Estado no fim da partida, com os três ativos de tecnologia e everybody no teto. */
const MAXIMA: HostTeamView[] = TIPICA.map((t, i) =>
  equipe(i, 96000, 100, 100, 100, true),
);

const ORCAMENTO_CENA = 45;
const ORCAMENTO_PROJECAO = 75;

interface Bloco {
  nome: string;
  jsx: ReactNode;
}

interface Cenario {
  rotulo: string;
  /** Blocos disjuntos: a soma dos blocos é o total da tela. */
  blocos: Bloco[];
}

/**
 * A tela de `/host`. O parâmetro `paisagemAnimada` existe porque a Tarefa 3
 * entrega a prop e o ARQUIVO que a liga é de outro agente: enquanto ninguém
 * ligar, a tela ainda paga os 19 laços da paisagem, e medir só o estado final
 * seria medir uma página que ainda não existe. Por isso os dois estados saem
 * daqui.
 */
function telaProjecao(linhas: HostTeamView[], paisagemAnimada = true): Bloco[] {
  const foco = linhas[0];
  const encosta = linhas.slice(1);
  if (!foco) throw new Error('a tela de projeção precisa de pelo menos uma equipe');

  return [
    {
      nome: 'paisagem de fundo',
      jsx: <CerradoLandscape animado={paisagemAnimada} />,
    },
    {
      nome: 'cabeçalho e rodapé',
      jsx: (
        <>
          <Pill tone="pronto" className="text-sm">
            <Users size={14} aria-hidden />
            12 de 30 equipes decidiram
          </Pill>
          <Timer className="text-terra-700" size={30} aria-hidden />
          <Rotulo>
            <span className="inline-flex items-center gap-1.5">
              <Trophy size={12} aria-hidden />
              Classificados
            </span>
          </Rotulo>
        </>
      ),
    },
    {
      nome: 'mirante da equipe em foco',
      jsx: <FocusTeamBoard team={foco} initialBudget={80000} revealDecision />,
    },
    ...encosta.map((team, i) => ({
      nome: `linha da encosta ${i + 1}`,
      jsx: (
        <ol>
          <TeamRow
            team={team}
            position={i + 2}
            wallPx={5}
            initialBudget={80000}
            revealDecision
          />
        </ol>
      ),
    })),
  ];
}

const CENARIOS: Cenario[] = [
  {
    rotulo: 'PropertyScene completa · estado típico',
    blocos: [
      {
        nome: 'cena',
        jsx: (
          <PropertyScene
            propertyKey="cerrado-vivo"
            production={72}
            technology={48}
            sustainability={64}
          />
        ),
      },
    ],
  },
  {
    rotulo: 'PropertyScene completa · estado máximo',
    blocos: [
      {
        nome: 'cena',
        jsx: (
          <PropertyScene
            propertyKey="cerrado-vivo"
            production={100}
            technology={100}
            sustainability={100}
          />
        ),
      },
    ],
  },
  {
    rotulo: 'CerradoLandscape · animada',
    blocos: [{ nome: 'paisagem', jsx: <CerradoLandscape /> }],
  },
  {
    rotulo: 'CerradoLandscape · estática (animado={false})',
    blocos: [{ nome: 'paisagem', jsx: <CerradoLandscape animado={false} /> }],
  },
  {
    rotulo: 'Meter size="projecao" · 1 instância',
    blocos: [
      {
        nome: 'medidor',
        jsx: (
          <Meter
            kind="financas"
            label="Finanças"
            value={77}
            display="R$ 62.000"
            size="projecao"
          />
        ),
      },
    ],
  },
  {
    rotulo: 'Meter size="compacto" · 1 instância',
    blocos: [
      {
        nome: 'medidor',
        jsx: (
          <Meter
            kind="producao"
            label="Produção"
            value={58}
            display="58"
            size="compacto"
          />
        ),
      },
    ],
  },
  {
    rotulo: 'CanalArco size="projecao" · só o mostrador',
    blocos: [
      {
        nome: 'mostrador',
        jsx: <CanalArco kind="financas" value={77} size="projecao" />,
      },
    ],
  },
  {
    rotulo: 'CanalArco size="aluno" · só o mostrador',
    blocos: [{ nome: 'mostrador', jsx: <CanalArco kind="producao" value={58} size="aluno" /> }],
  },
  {
    rotulo: 'CanalArco size="compacto" · só o mostrador',
    blocos: [
      {
        nome: 'mostrador',
        jsx: <CanalArco kind="producao" value={58} size="compacto" />,
      },
    ],
  },
  {
    rotulo: 'CanalTrilha size="compacto" · trilha em HTML',
    blocos: [
      {
        nome: 'trilha',
        jsx: (
          <span className="inline-flex items-center gap-1.5">
            <CanalIcone kind="producao" size="compacto" />
            <CanalTrilha kind="producao" value={58} size="compacto" className="w-10" />
          </span>
        ),
      },
    ],
  },
  {
    rotulo: 'PropertyScene compact · 1 instância',
    blocos: [
      {
        nome: 'cena reduzida',
        jsx: (
          <PropertyScene
            propertyKey="boa-esperanca"
            production={72}
            technology={48}
            sustainability={64}
            compact
            className="w-16"
          />
        ),
      },
    ],
  },
  {
    rotulo: 'Tela de projeção inteira · estado típico',
    blocos: telaProjecao(TIPICA),
  },
  {
    rotulo: 'Tela de projeção inteira · estado máximo',
    blocos: telaProjecao(MAXIMA),
  },
  {
    rotulo: 'Tela de projeção inteira · típica, paisagem estática (/host depois da prop)',
    blocos: telaProjecao(TIPICA, false),
  },
  {
    rotulo: 'Tela de projeção inteira · máxima, paisagem estática (/host depois da prop)',
    blocos: telaProjecao(MAXIMA, false),
  },
];

/**
 * Compila o `app/globals.css` REAL (Tailwind v4 via `@tailwindcss/postcss`) para
 * as capturas. Sem isto a verificação é sobre nós e não sobre a interface.
 */
async function cssDoProjeto(): Promise<string> {
  const fonte = await readFile(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const compilado = await postcss([tailwindcss()]).process(fonte, {
    from: path.join(process.cwd(), 'app', 'globals.css'),
  });
  return compilado.css;
}

const CENARIOS_VISUAIS: { nome: string; corpo: ReactNode; viewport: { width: number; height: number } }[] = [
  {
    nome: 'cena-completa-maxima',
    viewport: { width: 640, height: 640 },
    corpo: (
      <PropertyScene propertyKey="cerrado-vivo" production={100} technology={100} sustainability={100} />
    ),
  },
  {
    nome: 'cena-completa-inicio',
    viewport: { width: 640, height: 640 },
    corpo: (
      <PropertyScene propertyKey="cerrado-vivo" production={50} technology={40} sustainability={55} />
    ),
  },
  {
    nome: 'cena-completa-rara',
    viewport: { width: 640, height: 640 },
    corpo: (
      <PropertyScene propertyKey="cerrado-vivo" production={10} technology={0} sustainability={12} />
    ),
  },
  {
    nome: 'encosta-compacta',
    viewport: { width: 1500, height: 260 },
    corpo: (
      <ol className="flex flex-col gap-3 p-4">
        {TIPICA.slice(1).map((team, i) => (
          <TeamRow
            key={team.id}
            team={team}
            position={i + 2}
            wallPx={5}
            initialBudget={80000}
            revealDecision
          />
        ))}
      </ol>
    ),
  },
  {
    nome: 'mirante-projecao',
    viewport: { width: 1500, height: 1100 },
    corpo: <FocusTeamBoard team={TIPICA[0] as HostTeamView} initialBudget={80000} revealDecision />,
  },
  {
    nome: 'paisagem-estatica',
    viewport: { width: 900, height: 500 },
    corpo: <CerradoLandscape animado={false} />,
  },
];

/**
 * Verificação GEOMÉTRICA da `PropertyScene`, separada da contagem de nós.
 *
 * Existe por um motivo concreto: a redução de densidade (24->10 pontos de
 * vegetação, 12->7 fileiras) foi JUSTIFICADA em comentário com afirmações que
 * este cálculo refutou — "os pontos se tocavam" e "12 fileiras liam como
 * hachura" estavam erradas nas duas. Um número medido no comentário que não
 * confere é pior que nenhum comentário, porque o próximo que mexer aqui confia
 * nele. Então agora a afirmação é conferida a cada execução, e o comentário
 * aponta para cá.
 *
 * O que é medido:
 *   · distância mínima entre dois pontos de vegetação, contra o diâmetro
 *     (2 × 2.1 = 4.2 unidades): se ficarem abaixo, os pontos SE TOCAM;
 *   · passo e vão das fileiras de plantio na borda mais apertada do anel
 *     (a de cima, 72u de largura), convertidos para pixel nos tamanhos em que a
 *     cena aparece de verdade;
 *   · número de fileiras distintas por toda a escada de produção: são as
 *     SEIS faixas, em qualquer uma das duas escadas. É este o teste que
 *     garante que a redução não achatou a leitura de produção.
 */

const MID_RING = { topY: 64, botY: 146, topX0: 64, topX1: 136, botX0: 48, botX1: 152 } as const;
const CROP_SPACING = { larguraTopo: MID_RING.topX1 - MID_RING.topX0, espessura: 2 } as const;
const VEG_RADIUS = 2.1;

/** As mesmas constantes de `property-scene.tsx`, declaradas aqui de novo. */
const VIEW = 200;
const VEG_RAIO_MIN = 58;
const VEG_RAIO_MAX = 92;
const GOLDEN_ANGLE_RAD = (137.50776 * Math.PI) / 180;

function pontosVegetacao(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const r = VEG_RAIO_MIN + (VEG_RAIO_MAX - VEG_RAIO_MIN) * Math.sqrt(t);
    const angle = i * GOLDEN_ANGLE_RAD;
    return { x: 100 + r * Math.cos(angle), y: 104 + r * Math.sin(angle) * 0.62 };
  });
}

/** Menor distância entre dois pontos quaisquer do conjunto. */
function menorDistancia(pontos: { x: number; y: number }[]): number {
  let menor = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pontos.length; i += 1) {
    for (let j = i + 1; j < pontos.length; j += 1) {
      const a = pontos[i];
      const b = pontos[j];
      if (a === undefined || b === undefined) continue;
      menor = Math.min(menor, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  return menor;
}

function verificarGeometria(): void {
  console.log('\nGeometria da cena (confere o que os comentários prometem):');

  const falhas: string[] = [];

  // 1. Vegetação: 24 pontos (antes) vs 10 (agora), contra o diâmetro.
  for (const [rotulo, n] of [
    ['antes', 24],
    ['agora', 10],
  ] as const) {
    const menor = menorDistancia(pontosVegetacao(n));
    const diametro = VEG_RADIUS * 2;
    const folga = menor / diametro;
    console.log(
      `  vegetação ${rotulo} (${String(n).padStart(2)} pts) · menor distância ${menor.toFixed(1)}u = ${folga.toFixed(1)}x o diâmetro ${diametro}u · ${menor < diametro ? 'SE TOCAM' : 'separados'}`,
    );
    if (rotulo === 'agora' && menor < diametro * 2) {
      falhas.push(`com ${n} pontos a vegetação passa a se tocar (${menor.toFixed(1)}u)`);
    }
  }

  // 2. Fileiras de plantio: passo e vão na borda apertada, em pixels reais.
  for (const [rotulo, n] of [
    ['antes', 12],
    ['agora', 7],
  ] as const) {
    const passoU = CROP_SPACING.larguraTopo / n;
    const vaoU = passoU - CROP_SPACING.espessura;
    const medidas = [200, 300, 420].map((px) => {
      const escala = px / VIEW;
      return `${px}px: passo ${(passoU * escala).toFixed(1)}px, vão ${(vaoU * escala).toFixed(1)}px`;
    });
    console.log(`  fileiras ${rotulo} (${String(n).padStart(2)}) · ${medidas.join(' | ')}`);
    if (rotulo === 'agora' && vaoU * (200 / VIEW) < 6) {
      falhas.push(`com ${n} fileiras o vão cai para ${(vaoU * (200 / VIEW)).toFixed(1)}px a 200px`);
    }
  }

  // 3. A escada de produção: seis faixas -> seis fileiras distintas. Este é o
  //    teste que diz se a leitura de produção sobreviveu à redução.
  for (const [rotulo, teto, passo] of [
    ['antes', 12, 2],
    ['agora', 7, 1],
  ] as const) {
    const fileiras = [0, 20, 40, 60, 80, 100].map((p) => {
      const tier = Math.floor(p / 20);
      return Math.min(Math.max(2 + tier * passo, 2), teto);
    });
    const distintas = new Set(fileiras).size;
    console.log(`  escada de produção ${rotulo} · ${fileiras.join(' → ')} · ${distintas} degraus distintos`);
    if (distintas !== 6) {
      falhas.push(`escada ${rotulo} tem ${distintas} degraus, e são 6 faixas de produção`);
    }
  }

  // 4. Vegetação: a contagem ainda é um canal por sustainably, não textura crua.
  for (const teto of [24, 10] as const) {
    const degraus = new Set(
      Array.from({ length: 101 }, (_, s) => Math.round((s / 100) * teto)),
    ).size;
    console.log(`  vegetação teto ${teto} · ${degraus} degraus de contagem em s = 0..100`);
    if (degraus !== teto + 1) {
      falhas.push(`vegetação com teto ${teto} dá ${degraus} degraus, esperado ${teto + 1}`);
    }
  }

  if (falhas.length > 0) {
    console.error('\nGEOMETRIA REPROVADA:');
    for (const f of falhas) console.error(`  · ${f}`);
    process.exitCode = 1;
  } else {
    console.log('  → tudo confere com o que os comentários prometem.');
  }
}

async function main(): Promise<void> {
  const querCapturas = process.argv.includes('--shots');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const cenario of CENARIOS) {
    const corpo = cenario.blocos
      .map((bloco, i) => `<div data-bloco="${i}">${renderToStaticMarkup(bloco.jsx)}</div>`)
      .join('\n');

    await page.setContent(`<!doctype html><html><body>${corpo}</body></html>`);

    const medido = await page.evaluate(
      ({ nsSvg, lacos }) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        const porBloco = new Map<number, number>();
        let total = 0;
        let lacosAtivos = 0;

        for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
          const el = n as Element;

          if (el.namespaceURI === nsSvg) {
            total += 1;
          }

          // Laço de ambiência = elemento com uma das cinco utilitárias
          // infinitas do `@theme`. Conta por ELEMENTO, que é o que o navegador
          // precisa recompor a cada quadro.
          if (el instanceof SVGElement || el instanceof HTMLElement) {
            for (const classe of el.classList) {
              if ((lacos as readonly string[]).includes(classe)) {
                lacosAtivos += 1;
                break;
              }
            }
          }

          if (el.namespaceURI !== nsSvg) continue;

          // Recorte por bloco: sobe até o `data-bloco` mais próximo para dizer
          // ONDE o peso está. A contagem total é global e não depende disso.
          let bloco: number | null = null;
          let alvo: Element | null = el;
          while (alvo && alvo !== document.body) {
            if (alvo instanceof HTMLElement && alvo.dataset.bloco !== undefined) {
              bloco = Number(alvo.dataset.bloco);
              break;
            }
            alvo = alvo.parentElement;
          }
          if (bloco !== null) porBloco.set(bloco, (porBloco.get(bloco) ?? 0) + 1);
        }

        return { total, lacos: lacosAtivos, porBloco: [...porBloco.entries()] };
      },
      { nsSvg: NS_SVG, lacos: LACOS_AMBiencia },
    );

    console.log(
      `\n${cenario.rotulo}  ->  ${medido.total} nós SVG · ${medido.lacos} laços de ambiência`,
    );
    for (const [i, bloco] of cenario.blocos.entries()) {
      const n = medido.porBloco.find(([b]) => b === i)?.[1] ?? 0;
      console.log(`    ${String(n).padStart(4)}  ${bloco.nome}`);
    }
  }

  await browser.close();

  if (querCapturas) await gravarCapturas();

  verificarGeometria();

  console.log('\nÂncoras de contagem da regra (medidas antes desta redução):');
  console.log('  CerradoLandscape animada ....... 68   ← ainda deve bater');
  console.log('  CanalArco projecao (1x) ......... 20   ← ainda deve bater');
  console.log('  CanalArco compacto (1x) .........  0   ← era 12; 0 é a Tarefa 1');
  console.log('\nOrçamentos de docs/CONTRATO-VISUAL.md:');
  console.log(`  cena de propriedade .............. ${ORCAMENTO_CENA}`);
  console.log(`  tela de projeção ................. ${ORCAMENTO_PROJECAO}`);
}

/**
 * Capturas das cenas com o CSS REAL compilado. É a metade da verificação que a
 * contagem não cobre: o número diz quanto custa, a imagem diz se a interface
 * continua parecendo a mesma coisa depois da redução. Uma densidade de 10 pontos
 * e 7 fileiras pode estar no orçamento e ainda assim estar ilegível.
 */
async function gravarCapturas(): Promise<void> {
  const css = await cssDoProjeto();
  const destino = path.join(process.cwd(), 'screenshots');
  await mkdir(destino, { recursive: true });

  const browser = await chromium.launch();
  for (const cenario of CENARIOS_VISUAIS) {
    const page = await browser.newPage({ viewport: cenario.viewport });
    const corpo = renderToStaticMarkup(<>{cenario.corpo}</>);
    await page.setContent(`<!doctype html><html lang="pt-BR"><head>
      <meta charset="utf-8" />
      <style>${css}</style>
    </head>
    <body class="bg-nevoa-50 text-tinta-900">${corpo}</body></html>`);
    await page.waitForTimeout(150);
    const arquivo = path.join(destino, `orcamento-${cenario.nome}.png`);
    await page.screenshot({ path: arquivo, fullPage: true });
    console.log(`  captura: ${path.relative(process.cwd(), arquivo)}`);
    await page.close();
  }
  await browser.close();
}

main().catch((error: unknown) => {
  console.error('ERRO na medição:', error);
  process.exit(1);
});
