'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import {
  CanalArco,
  CanalIcone,
  GAUGE_LABEL,
  GAUGE_TERRACO,
  useCountUp,
  type CanalSize,
  type IndicatorKind,
} from './gauges';

/**
 * Primitivas compartilhadas entre a tela do aluno (celular) e as telas do
 * professor (projetor). Direção visual V6 "Amanhecer do Cerrado" (herda a
 * física de degrau da V3, preservada pelas V4/V5).
 *
 * A regra estrutural da direção vive aqui: não existe card com borda nos
 * quatro lados, sombra difusa e raio uniforme. Existe DEGRAU, composto de
 * prato e parede sólida, em três altitudes, e a altitude é a hierarquia da
 * tela. Uma tela usa no máximo um `mirante`.
 */

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export type { IndicatorKind, CanalSize };
export { GAUGE_LABEL };

// ---------------------------------------------------------------------------
// Degrau: a superfície elevada do projeto
// ---------------------------------------------------------------------------

/** Altitude do degrau. Sobe a parede e FECHA o raio de canto. */
export type Nivel = 'banco' | 'terraco' | 'mirante';

/** Família de cor. A parede é sempre o tom 800 da própria família. */
export type Familia =
  | 'neutro'
  | 'claro'
  | 'verde'
  | 'azul'
  | 'financas'
  | 'sustentabilidade'
  | 'alerta'
  | 'fundo-verde'
  | 'fundo-azul';

const FAMILIA: Record<Familia, string> = {
  neutro: 'terr-neutro',
  claro: 'terr-claro',
  verde: 'terr-verde',
  azul: 'terr-azul',
  financas: 'terr-financas',
  sustentabilidade: 'terr-sustentabilidade',
  alerta: 'terr-alerta',
  'fundo-verde': 'terr-fundo-verde text-white',
  'fundo-azul': 'terr-fundo-azul text-white',
};

/**
 * Um degrau de terraço.
 *
 * `pisavel` liga o movimento de toque: o prato desce e a parede comprime pela
 * metade. Use só no que é de fato tocável, nunca em bloco decorativo.
 */
export function Degrau({
  nivel = 'terraco',
  familia = 'neutro',
  pisavel = false,
  className,
  children,
}: {
  nivel?: Nivel;
  familia?: Familia;
  pisavel?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classes('degrau', nivel, FAMILIA[familia], pisavel && 'pisavel', className)}
    >
      {children}
    </div>
  );
}

/** Rótulo de campo, de coluna e de seção. Mono, caixa alta, espaçado. */
export function Rotulo({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={classes('rotulo', className)}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Botão
// ---------------------------------------------------------------------------

type ButtonVariant = 'principal' | 'secundario' | 'silencioso' | 'perigo' | 'destaque';
type ButtonSize = 'normal' | 'grande' | 'projecao';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // Prato verde escuro com texto branco: segue AAA.
  principal: 'degrau banco pisavel terr-fundo-verde text-white',
  secundario: 'degrau banco pisavel terr-claro text-terra-900',
  silencioso: 'bg-transparent text-terra-700 hover:text-terra-900',
  perigo: 'degrau banco pisavel terr-alerta text-terra-900',
  /*
    Destaque dourado: FATO de CTA primário da V6 (ENTRAR NA PARTIDA, iniciar
    partida). Dourado da safra com texto em breu: ~9:1, passa AAA. A classe
    `bg-financas` vence a cor de fundo do degrau porque utilities vêm depois
    de components na cascata.
  */
  destaque: 'degrau banco pisavel bg-financas text-(--cor-tinta-escuro)',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  // 44px é o piso de toque. O padrão do projeto é 48px, com folga.
  normal: 'min-h-12 px-4 text-sm',
  grande: 'min-h-14 px-6 text-base',
  // Botão que o professor aciona olhando para o projetor, não para o mouse.
  projecao: 'min-h-16 px-8 text-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'secundario',
  size = 'normal',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={classes(
        'inline-flex items-center justify-center gap-2 font-bold tracking-[0.01em]',
        'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Campo de texto
// ---------------------------------------------------------------------------

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Campo de código de partida: mono, caixa alta, bem espaçado. */
  codigo?: boolean;
}

/**
 * Campo de entrada como valeta escavada, não como degrau elevado.
 *
 * A parede do degrau aponta para baixo, o que significa "isto está acima da
 * página". Um campo é o contrário: é onde se deposita algo. Então ele recebe
 * sombra INTERNA, e nenhuma parede.
 */
export function Field({
  label,
  hint,
  error,
  id,
  className,
  codigo = false,
  ...props
}: FieldProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const describedBy = error ? `${inputId}-erro` : hint ? `${inputId}-dica` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="rotulo">
        {label}
      </label>

      <input
        {...props}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={classes(
          'min-h-14 rounded-[10px] border-0 bg-nevoa-100 px-4 text-terra-900',
          'shadow-[inset_0_2px_2px_0_rgba(0,0,0,0.45)]',
          'placeholder:text-terra-500/60 focus:outline-none',
          'focus-visible:shadow-[inset_0_0_0_3px_var(--color-financas)]',
          codigo ? 'dado text-3xl font-bold uppercase tracking-[0.3em]' : 'text-lg',
          error && 'shadow-[inset_0_0_0_2px_var(--color-alerta-texto)]',
          className,
        )}
      />

      {error ? (
        <p id={`${inputId}-erro`} role="alert" className="text-sm font-bold text-alerta-texto">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-dica`} className="text-sm text-terra-700">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pílula de estado
// ---------------------------------------------------------------------------

type PillTone = 'neutro' | 'ativo' | 'pronto' | 'alerta';

const PILL_TONE: Record<PillTone, string> = {
  neutro: 'bg-nevoa-200 text-terra-700',
  ativo: 'bg-azul-300 text-azul-800',
  pronto: 'bg-verde-300 text-verde-800',
  alerta: 'bg-alerta text-white',
};

export function Pill({
  children,
  tone = 'neutro',
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={classes(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'font-mono text-[0.6875rem] font-bold uppercase tracking-[0.12em]',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Medidor de indicador
// ---------------------------------------------------------------------------

/**
 * Indicador 0..100 no formato canal: ícone, rótulo, valor impresso e trilha
 * com preenchimento proporcional.
 *
 * Três garantias que não podem ser removidas: o ícone identifica o indicador
 * sem depender de cor, o número aparece por extenso (leitura a seis metros e
 * leitor de tela) e a trilha só se move quando o valor muda de verdade.
 */
/**
 * Extrai um alvo numérico do texto de exibição, para o contador poder subir e
 * descer em vez de trocar de número seco. Só reconhece dígitos puros (o caso
 * de produção/tecnologia/sustentabilidade); "R$ 62.000" fica como está, o
 * anel ao redor já mostra a variação sem precisar reformatar moeda quadro a
 * quadro.
 */
function numeroPuro(display: string): number | null {
  const limpo = display.trim();
  return /^-?\d+$/.test(limpo) ? Number(limpo) : null;
}

export function Meter({
  kind,
  label,
  value,
  display,
  delta,
  size = 'aluno',
}: {
  kind: IndicatorKind;
  label: string;
  /** 0..100 para preencher o anel. */
  value: number;
  /** Texto do valor: pode ser "R$ 62.000" ou "58". */
  display: string;
  /** Variação da última rodada, se houver. */
  delta?: number | null;
  size?: CanalSize;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const alvoNumerico = numeroPuro(display);
  const contador = useCountUp(alvoNumerico ?? 0);
  const displayAnimado = alvoNumerico !== null ? String(Math.round(contador)) : display;

  const variacao =
    delta !== undefined && delta !== null && delta !== 0 ? (
      <span
        className={classes('dado text-xs font-bold', delta > 0 ? 'text-sucesso' : 'text-alerta-texto')}
      >
        {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
      </span>
    ) : null;

  if (size === 'compacto') {
    return (
      <span
        className="inline-flex items-center gap-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${display}`}
      >
        <CanalArco kind={kind} value={pct} size="compacto">
          <CanalIcone kind={kind} size="compacto" />
        </CanalArco>
        <span className="dado text-sm font-bold text-terra-900">{displayAnimado}</span>
      </span>
    );
  }

  /*
    Na projeção o anel cresce (108px, traço de 10px): a proporção ocupada vira
    FORMA, legível de relance a 6 metros, não só comprimento de barra. O
    número mora ao lado em `dado-xl`, nunca dentro do anel (uma cifra longa
    como "R$ 76.000" em 64px não cabe num círculo de 108px).
  */
  if (size === 'projecao') {
    return (
      <div
        className="flex min-w-0 items-center gap-5"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${display}`}
      >
        <CanalArco kind={kind} value={pct} size="projecao">
          <CanalIcone kind={kind} size="projecao" />
        </CanalArco>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="rotulo">{label}</span>
          <span className="dado-xl whitespace-nowrap text-terra-900">{displayAnimado}</span>
          {variacao}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-w-0 items-center gap-3"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${display}`}
    >
      <CanalArco kind={kind} value={pct} size="aluno">
        <CanalIcone kind={kind} size="aluno" />
      </CanalArco>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="rotulo min-w-0 truncate">{label}</span>
        <span className="dado-lg whitespace-nowrap text-terra-900">{displayAnimado}</span>
        {variacao}
      </div>
    </div>
  );
}

/** Família de terraço do indicador, para tingir um degrau inteiro com ele. */
export { GAUGE_TERRACO };

// ---------------------------------------------------------------------------
// Cabeçalho de seção
// ---------------------------------------------------------------------------

export function SectionHeading({
  overline,
  title,
  description,
  escala = 'md',
}: {
  overline?: string;
  title: string;
  description?: string;
  escala?: 'md' | 'lg';
}) {
  return (
    <header className="flex flex-col gap-1.5">
      {overline ? <Rotulo>{overline}</Rotulo> : null}
      <h2 className={escala === 'lg' ? 'relevo-lg text-terra-900' : 'relevo-md text-terra-900'}>
        {title}
      </h2>
      {description ? (
        <p className="max-w-[62ch] text-sm text-terra-700">{description}</p>
      ) : null}
    </header>
  );
}

/** Formata reais fictícios do jogo. */
export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}
