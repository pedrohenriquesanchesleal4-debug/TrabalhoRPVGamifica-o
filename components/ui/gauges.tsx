'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cpu, Leaf, Sprout, Wallet, type LucideIcon } from 'lucide-react';
import type { IndicatorKey } from '@/types/game';

/*
  Os quatro indicadores, herdados da V3 e re-tingidos para a paleta noturna da V4.

  Forma unificada: um CANAL, a valeta que corre no pé do terraço conduzindo
  água. Trilha escavada, preenchimento sólido na cor do indicador, ícone fixo
  à esquerda e número impresso à direita.

  Três canais redundantes de leitura, e nenhum deles é a cor:
  · o ícone diz QUAL indicador é (forma);
  · o comprimento do preenchimento diz a proporção;
  · o número impresso diz o valor exato.

  Isso é requisito de acessibilidade (daltonismo) e de projeção (a seis metros
  numa sala com luz acesa, matiz próximo vira o mesmo cinza).

  Movimento 3 · vazão: o preenchimento cresce por `transform: scaleX()` a
  partir da borda esquerda. É `transition`, não `animation`, de propósito:
  transição não dispara na primeira pintura, então o canal só se move quando o
  valor MUDA de verdade pelo realtime, nunca a cada troca de tela. Zero
  JavaScript, e `transform` é a única propriedade animada, o que mantém o
  movimento liso em celular popular.
*/

export type IndicatorKind = 'financas' | 'producao' | 'tecnologia' | 'sustentabilidade';

/**
 * Ícone de cada indicador: o canal de leitura que não depende de cor.
 *
 * Exportado (não só usado internamente) porque a identidade visual das 6
 * propriedades (mapa do DF, faixa de propriedades, selo na cena) reaproveita
 * exatamente este ícone e esta cor: zero glifo novo fora do sistema de
 * indicadores já existente.
 */
export const GAUGE_ICON: Record<IndicatorKind, LucideIcon> = {
  financas: Wallet,
  producao: Sprout,
  tecnologia: Cpu,
  sustentabilidade: Leaf,
};
const ICONE = GAUGE_ICON;

/** Converte a chave de indicador do domínio (`cash`, `production`...) na família de cor/ícone do canal. */
export const INDICATOR_KEY_TO_KIND: Record<IndicatorKey, IndicatorKind> = {
  cash: 'financas',
  production: 'producao',
  technology: 'tecnologia',
  sustainability: 'sustentabilidade',
};

/** Rótulo canônico. Usado em toda superfície, sem variação. */
export const GAUGE_LABEL: Record<IndicatorKind, string> = {
  financas: 'Finanças',
  producao: 'Produção',
  tecnologia: 'Tecnologia',
  sustentabilidade: 'Sustentabilidade',
};

/**
 * Cor de preenchimento do canal, por indicador.
 *
 * O tom "600" (ou o `financas` cheio) só aparece como superfície e ícone. Para
 * TEXTO pequeno existe `GAUGE_INK_TEXTO`, porque o 600 não passa AA em corpo.
 */
const PREENCHIMENTO: Record<IndicatorKind, string> = {
  financas: 'bg-financas',
  producao: 'bg-producao',
  tecnologia: 'bg-tecnologia',
  sustentabilidade: 'bg-sustentabilidade',
};

/** Cor de ícone: mesma família do preenchimento, tamanho de UI. */
export const GAUGE_INK: Record<IndicatorKind, string> = {
  financas: 'text-financas-texto',
  producao: 'text-verde-700',
  tecnologia: 'text-azul-700',
  sustentabilidade: 'text-sustentabilidade',
};

/** Família de terraço correspondente, para tingir um degrau do indicador. */
export const GAUGE_TERRACO: Record<IndicatorKind, string> = {
  financas: 'terr-financas',
  producao: 'terr-verde',
  tecnologia: 'terr-azul',
  sustentabilidade: 'terr-sustentabilidade',
};

export type CanalSize = 'aluno' | 'projecao' | 'compacto';

const ALTURA: Record<CanalSize, string> = {
  compacto: 'h-1.5',
  aluno: 'h-2',
  // Grosso de propósito: o professor lê isto do fundo da sala.
  projecao: 'h-4',
};

const ICONE_PX: Record<CanalSize, number> = {
  compacto: 14,
  aluno: 18,
  projecao: 28,
};

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * A trilha do canal com o preenchimento proporcional.
 *
 * Decorativa por si: quem descreve o valor para leitor de tela é o `role`
 * e o `aria-label` do componente que a envolve.
 */
export function CanalTrilha({
  kind,
  value,
  size = 'aluno',
  className,
}: {
  kind: IndicatorKind;
  value: number;
  size?: CanalSize;
  className?: string;
}) {
  const pct = clamp(value);

  return (
    <div
      aria-hidden="true"
      className={[
        'w-full overflow-hidden rounded-full bg-nevoa-200',
        // A borda superior escurecida é a parede da valeta vista de cima.
        'shadow-[inset_0_1px_0_0_rgba(16,36,29,0.18)]',
        ALTURA[size],
        className ?? '',
      ].join(' ')}
    >
      <div
        className={[
          'h-full w-full origin-left rounded-full',
          'transition-transform duration-500 ease-out',
          PREENCHIMENTO[kind],
        ].join(' ')}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

/** Ícone do indicador, no tamanho da superfície. */
export function CanalIcone({
  kind,
  size = 'aluno',
  className,
}: {
  kind: IndicatorKind;
  size?: CanalSize;
  className?: string;
}) {
  const Icone = ICONE[kind];
  return (
    <Icone
      size={ICONE_PX[size]}
      strokeWidth={2.2}
      aria-hidden="true"
      className={[GAUGE_INK[kind], 'shrink-0', className ?? ''].join(' ')}
    />
  );
}

// ---------------------------------------------------------------------------
// Arco: substitui a barra horizontal como forma primária dos 4 indicadores
// ---------------------------------------------------------------------------

/*
  Anel parcial (donut), não barra. Mesmas três leituras redundantes de sempre
  (ícone, comprimento do traço, número impresso), só que a proporção agora é
  um ângulo em vez de um comprimento horizontal: em uma tela com 4
  indicadores lado a lado, 4 anéis se diferenciam de relance por FORMA
  ocupada (um quarto cheio lê diferente de três quartos cheios), enquanto 4
  barras horizontais da mesma largura só se diferenciam pelo comprimento do
  preenchimento, o que exige mais atenção deliberada do professor a 6 metros
  de distância.

  O traço nasce no topo (rotate -90) e cresce em sentido horário. Só
  `stroke-dashoffset` transiciona (mesma disciplina da V3/V4: sem
  `animation`, `transition` que só dispara quando o valor muda de verdade).
*/

interface ArcoDimensao {
  diametro: number;
  espessura: number;
}

const ARCO_DIMENSAO: Record<CanalSize, ArcoDimensao> = {
  compacto: { diametro: 30, espessura: 4 },
  aluno: { diametro: 58, espessura: 6 },
  // Grosso e grande de propósito: o professor lê isto do fundo da sala.
  projecao: { diametro: 108, espessura: 10 },
};

export function CanalArco({
  kind,
  value,
  size = 'aluno',
  className,
  children,
}: {
  kind: IndicatorKind;
  value: number;
  size?: CanalSize;
  className?: string;
  /** Conteúdo centralizado dentro do anel (o ícone do indicador). */
  children?: ReactNode;
}) {
  const pct = clamp(value);
  const { diametro, espessura } = ARCO_DIMENSAO[size];
  const raio = (diametro - espessura) / 2;
  const centro = diametro / 2;
  const perimetro = 2 * Math.PI * raio;
  const offset = perimetro * (1 - pct / 100);

  return (
    <span
      aria-hidden="true"
      className={['relative inline-flex shrink-0 items-center justify-center', className ?? ''].join(' ')}
      style={{ width: diametro, height: diametro }}
    >
      <svg width={diametro} height={diametro} viewBox={`0 0 ${diametro} ${diametro}`}>
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke="var(--color-nevoa-200)"
          strokeWidth={espessura}
        />
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke={`var(--color-${kind})`}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${centro} ${centro})`}
          style={{ transition: 'stroke-dashoffset 550ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {children ? <span className="absolute inset-0 flex items-center justify-center">{children}</span> : null}
    </span>
  );
}

/**
 * Contador que sobe/desce até `target` em vez de trocar de número seco.
 *
 * Só anima quando o alvo muda de fato (não na primeira pintura, mesma regra
 * do resto do sistema de movimento) e respeita `prefers-reduced-motion`
 * lendo a media query diretamente: quando reduzido, o valor salta direto
 * para o alvo, sem passo intermediário.
 */
export function useCountUp(target: number, durationMs = 550): number {
  const [displayed, setDisplayed] = useState(target);
  // `fromRef` nasce igual a `target`: no primeiro efeito, `from === target` é
  // verdadeiro e a função sai sem tocar em estado, então não existe pintura
  // extra na montagem, só quando o alvo muda de verdade depois.
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      // Ainda assim agendado via rAF (não uma chamada síncrona solta no corpo
      // do efeito): o valor salta direto para o alvo, sem passo intermediário.
      fromRef.current = target;
      rafRef.current = requestAnimationFrame(() => setDisplayed(target));
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const start = performance.now();

    function passo(now: number) {
      const decorrido = now - start;
      const progresso = Math.min(1, decorrido / durationMs);
      // Ease-out: acelera no início, assenta no fim, mesma curva do resto do motion system.
      const facilitado = 1 - Math.pow(1 - progresso, 3);
      const atual = from + (target - from) * facilitado;
      setDisplayed(atual);

      if (progresso < 1) {
        rafRef.current = requestAnimationFrame(passo);
      } else {
        fromRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(passo);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return displayed;
}
