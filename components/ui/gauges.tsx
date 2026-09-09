import { Cpu, Leaf, Sprout, Wallet, type LucideIcon } from 'lucide-react';

/*
  Os quatro indicadores da direção "Curva de Nível".

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

/** Ícone de cada indicador: o canal de leitura que não depende de cor. */
const ICONE: Record<IndicatorKind, LucideIcon> = {
  financas: Wallet,
  producao: Sprout,
  tecnologia: Cpu,
  sustentabilidade: Leaf,
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
