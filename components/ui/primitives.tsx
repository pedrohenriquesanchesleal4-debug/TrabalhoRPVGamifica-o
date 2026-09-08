import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * Primitivas compartilhadas entre a tela do aluno (celular) e as telas do
 * professor (projetor).
 *
 * Não é design system: é o mínimo para que as duas superfícies não divirjam em
 * botão, campo e barra de indicador. Tudo com token de "Terra Cerrado" e alvo
 * de toque adequado ao celular.
 */

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Botão
// ---------------------------------------------------------------------------

type ButtonVariant = 'principal' | 'secundario' | 'silencioso' | 'perigo';
type ButtonSize = 'normal' | 'grande';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  principal:
    'bg-terra-500 text-areia-50 border-terra-600 hover:bg-terra-600 active:bg-terra-600',
  secundario:
    'bg-areia-50 text-mata-800 border-areia-300 hover:border-mata-500 hover:bg-areia-100',
  silencioso:
    'bg-transparent text-mata-700 border-transparent hover:bg-areia-200/70 hover:text-mata-900',
  perigo: 'bg-areia-50 text-alerta border-alerta/40 hover:bg-alerta/10',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  // 44px de altura mínima: alvo de toque confortável no celular.
  normal: 'min-h-11 px-4 text-sm',
  grande: 'min-h-14 px-6 text-base',
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
        'inline-flex items-center justify-center gap-2 rounded-carta border font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
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
}

export function Field({ label, hint, error, id, className, ...props }: FieldProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const describedBy = error ? `${inputId}-erro` : hint ? `${inputId}-dica` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="rotulo">
        {label}
      </label>

      <input
        {...props}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={classes(
          'min-h-14 rounded-carta border bg-areia-50 px-4 text-lg text-mata-900',
          'placeholder:text-areia-400',
          error ? 'border-alerta' : 'border-areia-300 focus:border-mata-500',
          className,
        )}
      />

      {error ? (
        <p id={`${inputId}-erro`} role="alert" className="text-sm text-alerta">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-dica`} className="text-sm text-mata-600">
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
  neutro: 'border-areia-300 bg-areia-100 text-mata-700',
  ativo: 'border-terra-400 bg-terra-500/10 text-terra-600',
  pronto: 'border-mata-400 bg-mata-500/10 text-mata-700',
  alerta: 'border-alerta/40 bg-alerta/10 text-alerta',
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
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1',
        'text-xs font-medium tracking-wide',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Barra de indicador
// ---------------------------------------------------------------------------

const METER_COLOR = {
  financas: 'bg-financas',
  producao: 'bg-producao',
  tecnologia: 'bg-tecnologia',
  sustentabilidade: 'bg-sustentabilidade',
} as const;

/**
 * Barra 0..100 com valor sempre em texto ao lado.
 *
 * O número acompanha a barra de propósito: cor e comprimento não podem ser a
 * única forma de ler o indicador (requisito de acessibilidade e de projeção).
 */
export function Meter({
  kind,
  label,
  value,
  display,
  delta,
}: {
  kind: keyof typeof METER_COLOR;
  label: string;
  /** 0..100 para desenhar a barra. */
  value: number;
  /** Texto do valor: pode ser "R$ 62.000" ou "58". */
  display: string;
  /** Variação da última rodada, se houver. */
  delta?: number | null;
}) {
  const width = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="rotulo">{label}</span>
        <span className="tabular text-base font-semibold text-mata-900">{display}</span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-pill bg-areia-200"
        role="meter"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${display}`}
      >
        <div
          className={classes('h-full rounded-pill transition-[width] duration-500', METER_COLOR[kind])}
          style={{ width: `${width}%` }}
        />
      </div>

      {delta !== undefined && delta !== null && delta !== 0 ? (
        <span
          className={classes(
            'tabular text-xs',
            delta > 0 ? 'text-sucesso' : 'text-alerta',
          )}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalho de seção
// ---------------------------------------------------------------------------

export function SectionHeading({
  overline,
  title,
  description,
}: {
  overline?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      {overline ? <span className="rotulo">{overline}</span> : null}
      <h2 className="text-2xl text-mata-900">{title}</h2>
      {description ? <p className="max-w-prose text-sm text-mata-600">{description}</p> : null}
      <div className="faixa-terra mt-2" />
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
