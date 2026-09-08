import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * Primitivas do caderno de campo.
 *
 * Não é design system: é o mínimo para que a tela do aluno (celular) e as
 * telas do professor (projetor) não divirjam em botão, campo, selo e leitura
 * de indicador. Tudo obedece à mesma metáfora, que é folha de caderno com
 * pauta, régua pontilhada e carimbo.
 */

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Botão
// ---------------------------------------------------------------------------

type ButtonVariant = 'principal' | 'secundario' | 'silencioso' | 'perigo';
type ButtonSize = 'normal' | 'grande';

/**
 * O botão principal é o único elemento com tinta cheia na tela, e existe no
 * máximo um por vez: é sempre a ação que fecha alguma coisa. Os demais são
 * traço sobre papel.
 */
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  principal:
    'bg-carimbo-500 text-papel-000 border-carimbo-600 hover:bg-carimbo-600 active:translate-y-px',
  secundario:
    'bg-papel-000 text-tinta-900 border-tinta-900/35 hover:border-tinta-900 hover:bg-papel-100',
  silencioso:
    'bg-transparent text-tinta-700 border-transparent underline decoration-dotted underline-offset-4 hover:text-tinta-900',
  perigo:
    'bg-papel-000 text-carimbo-600 border-carimbo-500/50 hover:border-carimbo-500 hover:bg-carimbo-500/8',
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
        'inline-flex items-center justify-center gap-2 rounded-ficha border font-maquina font-bold uppercase tracking-[0.1em]',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Campo de preenchimento
// ---------------------------------------------------------------------------

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

/**
 * Campo desenhado como lacuna de formulário em papel: sem caixa fechada, só a
 * linha de baixo, que é onde se escreve. A linha engrossa no foco.
 */
export function Field({ label, hint, error, id, className, ...props }: FieldProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const describedBy = error ? `${inputId}-erro` : hint ? `${inputId}-dica` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="rotulo">
        {label}
      </label>

      <input
        {...props}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={classes(
          'min-h-14 rounded-ficha border-0 border-b-2 bg-transparent px-1 font-maquina text-lg text-tinta-900',
          'placeholder:text-tinta-200 focus:outline-none',
          error
            ? 'border-b-carimbo-500'
            : 'border-b-papel-400 focus:border-b-tinta-900',
          className,
        )}
      />

      {error ? (
        <p id={`${inputId}-erro`} role="alert" className="font-maquina text-sm text-carimbo-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-dica`} className="text-sm text-tinta-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selo de estado
// ---------------------------------------------------------------------------

type PillTone = 'neutro' | 'ativo' | 'pronto' | 'alerta';

const PILL_TONE: Record<PillTone, string> = {
  neutro: 'border-papel-400 text-tinta-700',
  ativo: 'border-carimbo-500 text-carimbo-600',
  pronto: 'border-producao text-producao',
  alerta: 'border-alerta text-alerta',
};

/**
 * Selo: etiqueta datilografada de estado, com traço fino e nada de fundo
 * colorido. Fica legível tanto no celular quanto projetado.
 */
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
        'inline-flex items-center gap-1.5 rounded-selo border px-2 py-1',
        'font-maquina text-[0.6875rem] font-bold uppercase leading-none tracking-[0.12em]',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Carimbo
// ---------------------------------------------------------------------------

/**
 * O carimbo é a marca de "isto está fechado".
 *
 * Aparece quando a equipe confirma a decisão e quando a partida encerra: os
 * dois momentos irreversíveis do jogo. Com `bate`, entra girado e grande e
 * assenta torto; com movimento reduzido, o CSS global zera a duração e ele
 * simplesmente já está lá.
 */
export function Carimbo({
  children,
  detail,
  bate = false,
  className,
}: {
  children: ReactNode;
  /** Linha pequena embaixo do carimbo: rodada, horário, o que datar. */
  detail?: string;
  bate?: boolean;
  className?: string;
}) {
  return (
    <span className={classes('inline-flex flex-col items-center gap-1', className)}>
      <span className={classes('carimbo', bate && 'animate-bate')}>{children}</span>
      {detail ? (
        <span className="tabular text-[0.6875rem] uppercase tracking-[0.14em] text-tinta-400">
          {detail}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Linha de registro
// ---------------------------------------------------------------------------

/**
 * Linha de livro-caixa: rótulo à esquerda, pontinhos preenchendo o vão, valor
 * à direita. É o jeito de listar dado neste projeto, no lugar de tabela ou de
 * grade de cartõezinhos.
 */
export function LinhaRegistro({
  label,
  value,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={emphasis ? 'rotulo text-tinta-900' : 'rotulo'}>{label}</span>
      <span className="pontilhado" aria-hidden="true" />
      <span
        className={classes(
          'tabular shrink-0',
          emphasis ? 'text-base font-bold text-tinta-900' : 'text-sm text-tinta-700',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicador
// ---------------------------------------------------------------------------

const TRAMA = {
  financas: 'trama-financas',
  producao: 'trama-producao',
  tecnologia: 'trama-tecnologia',
  sustentabilidade: 'trama-sustentabilidade',
} as const;

const TOTAL_BLOCOS = 10;

/**
 * Indicador em blocos, não em barra.
 *
 * Dez quadrinhos preenchidos por décimo, cada indicador com uma trama própria
 * (sólido, listra, contra-listra, pontilhado). São três canais para a mesma
 * informação: quantidade de blocos, textura e o número escrito ao lado. Cor é
 * o quarto, e nunca o único, que é o requisito de acessibilidade do contrato e
 * também o que salva a leitura num projetor desbotado.
 */
export function Meter({
  kind,
  label,
  value,
  display,
  delta,
  size = 'normal',
}: {
  kind: keyof typeof TRAMA;
  label: string;
  /** 0..100 para preencher os blocos. */
  value: number;
  /** Texto do valor: pode ser "R$ 62.000" ou "58". */
  display: string;
  /** Variação da última rodada, se houver. */
  delta?: number | null;
  size?: 'normal' | 'grande';
}) {
  const percent = Math.max(0, Math.min(100, value));
  const cheios = Math.round((percent / 100) * TOTAL_BLOCOS);
  const grande = size === 'grande';

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="rotulo truncate tracking-[0.06em]">{label}</span>
        <span className="pontilhado" aria-hidden="true" />
        <span
          className={classes(
            'tabular shrink-0 font-bold text-tinta-900',
            grande ? 'text-2xl' : 'text-base',
          )}
        >
          {display}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={classes('flex', grande ? 'gap-1' : 'gap-[3px]')}
          role="meter"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${display}`}
        >
          {Array.from({ length: TOTAL_BLOCOS }).map((_, index) => (
            <span
              key={index}
              className={classes(
                grande ? 'h-4 w-4' : 'h-2.5 w-2.5',
                'border',
                index < cheios
                  ? `${TRAMA[kind]} border-tinta-900/25`
                  : 'border-papel-300 bg-papel-100',
              )}
            />
          ))}
        </div>

        {delta !== undefined && delta !== null && delta !== 0 ? (
          <span
            className={classes(
              'tabular text-xs font-bold',
              delta > 0 ? 'text-sucesso' : 'text-carimbo-600',
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalho de seção
// ---------------------------------------------------------------------------

/**
 * Cabeçalho no formato de abertura de página de caderno: número ou etiqueta em
 * cima, título datilografado, e a régua pontilhada que fecha o bloco.
 */
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
      {overline ? <span className="rotulo text-carimbo-600">{overline}</span> : null}
      <h2 className="text-2xl uppercase tracking-tight text-tinta-900">{title}</h2>
      {description ? (
        <p className="max-w-prose text-sm text-tinta-500">{description}</p>
      ) : null}
      <div className="regua mt-2 origin-left animate-risca" />
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
