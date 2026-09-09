import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Gauge, GAUGE_INK, type IndicatorKind } from './gauges';

/**
 * Primitivas compartilhadas entre a tela do aluno (celular) e as telas do
 * professor (projetor).
 *
 * Não é design system: é o mínimo para que as duas superfícies não divirjam em
 * botão, campo, filete e medidor. Tudo com token de "Boletim de Safra".
 *
 * A regra estrutural da direção visual vive aqui: não existe card com borda
 * nos quatro lados, raio uniforme e sombra suave. Existe bloco separado por
 * filete, e hierarquia por escala tipográfica.
 */

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export type { IndicatorKind };

// ---------------------------------------------------------------------------
// Botão
// ---------------------------------------------------------------------------

type ButtonVariant = 'principal' | 'secundario' | 'silencioso' | 'perigo';
type ButtonSize = 'normal' | 'grande' | 'projecao';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  /*
    Tinta escura como ação principal, não o vermelho de manchete. O vermelho é
    o acento do boletim: se ele virar cor de botão, deixa de destacar o que
    importa. Contraste do papel sobre a tinta passa de 15:1.
  */
  principal:
    'bg-tinta-900 text-papel-50 border-tinta-900 hover:bg-manchete-escura hover:border-manchete-escura',
  secundario:
    'bg-papel-50 text-tinta-900 border-tinta-700 hover:bg-papel-200 hover:border-tinta-900',
  silencioso:
    'bg-transparent text-tinta-700 border-transparent hover:bg-papel-200 hover:text-tinta-900',
  perigo: 'bg-papel-50 text-alerta border-alerta/50 hover:bg-alerta/10 hover:border-alerta',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  // 44px de altura mínima: alvo de toque confortável no celular.
  normal: 'min-h-11 px-4 text-sm',
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
        'inline-flex items-center justify-center gap-2 rounded-bloco border font-semibold',
        'tracking-wide transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
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
  /** Campo de código de partida: monoespaçado, caixa alta, bem espaçado. */
  codigo?: boolean;
}

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
          /* Linha de preenchimento de formulário impresso: fio embaixo, sem caixa. */
          'min-h-14 rounded-none border-0 border-b-2 bg-transparent px-1 text-tinta-900',
          'placeholder:text-tinta-500/45 focus:outline-none',
          codigo ? 'dado text-3xl font-bold uppercase tracking-[0.28em]' : 'text-lg',
          error
            ? 'border-b-alerta'
            : 'border-b-regua/60 focus:border-b-tinta-900',
          className,
        )}
      />

      {error ? (
        <p id={`${inputId}-erro`} role="alert" className="text-sm font-semibold text-alerta">
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
// Pílula de estado
// ---------------------------------------------------------------------------

type PillTone = 'neutro' | 'ativo' | 'pronto' | 'alerta';

const PILL_TONE: Record<PillTone, string> = {
  neutro: 'border-regua/50 text-tinta-500',
  ativo: 'border-manchete/60 bg-manchete/8 text-manchete',
  pronto: 'border-sucesso/60 bg-sucesso/8 text-sucesso',
  alerta: 'border-alerta bg-alerta/10 text-alerta',
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
        'inline-flex items-center gap-1.5 rounded-bloco border px-2.5 py-1',
        'font-mono text-[0.6875rem] font-bold uppercase tracking-[0.12em]',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Selo de canto para estado físico: decisão registrada, equipe em foco. */
export function Carimbo({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={classes('carimbo inline-block', className)}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Medidor de indicador
// ---------------------------------------------------------------------------

type MeterSize = 'aluno' | 'projecao' | 'compacto';

const GAUGE_BOX: Record<MeterSize, string> = {
  aluno: 'h-9 w-9 shrink-0',
  // Grande de propósito: o professor lê isto do fundo da sala.
  projecao: 'h-14 w-14 shrink-0 xl:h-16 xl:w-16',
  compacto: 'h-5 w-5 shrink-0',
};

const VALUE_TYPE: Record<MeterSize, string> = {
  aluno: 'dado-lg text-tinta-900',
  projecao: 'dado-xl text-tinta-900',
  compacto: 'dado text-sm font-bold text-tinta-900',
};

/**
 * Indicador 0..100 com forma própria em SVG e valor sempre em texto.
 *
 * Duas garantias que não podem ser removidas: a forma do medidor identifica o
 * indicador sem depender de cor (daltonismo, projetor desbotado), e o número
 * aparece por extenso ao lado (leitura a seis metros, leitor de tela).
 */
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
  /** 0..100 para desenhar o medidor. */
  value: number;
  /** Texto do valor: pode ser "R$ 62.000" ou "58". */
  display: string;
  /** Variação da última rodada, se houver. */
  delta?: number | null;
  size?: MeterSize;
}) {
  const pct = Math.max(0, Math.min(100, value));

  if (size === 'compacto') {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${display}`}
      >
        <Gauge kind={kind} value={pct} className={classes(GAUGE_BOX.compacto, GAUGE_INK[kind])} />
        <span className={VALUE_TYPE.compacto}>{display}</span>
      </span>
    );
  }

  const variacao =
    delta !== undefined && delta !== null && delta !== 0 ? (
      <span
        className={classes('dado text-xs font-bold', delta > 0 ? 'text-sucesso' : 'text-alerta')}
      >
        {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
      </span>
    ) : null;

  /*
    Na projeção o medidor fica ACIMA do valor, não ao lado. Lado a lado, uma
    cifra longa como "R$ 76.000" em 64px atropela o desenho do indicador
    vizinho no grid de quatro colunas. Empilhado, o número recebe a largura
    inteira da coluna e continua legível do fundo da sala.
  */
  if (size === 'projecao') {
    return (
      <div
        className="flex min-w-0 flex-col gap-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${display}`}
      >
        <span className="rotulo">{label}</span>
        <Gauge kind={kind} value={pct} className={classes(GAUGE_BOX[size], GAUGE_INK[kind])} />
        <span className={classes(VALUE_TYPE[size], 'whitespace-nowrap')}>{display}</span>
        {variacao}
      </div>
    );
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-1.5"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${display}`}
    >
      <span className="rotulo">{label}</span>

      <div className="flex items-center gap-3">
        <Gauge kind={kind} value={pct} className={classes(GAUGE_BOX[size], GAUGE_INK[kind])} />

        <div className="flex min-w-0 flex-col">
          <span className={classes(VALUE_TYPE[size], 'whitespace-nowrap')}>{display}</span>
          {variacao}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estrutura editorial
// ---------------------------------------------------------------------------

/** Chapéu: linha curta em monoespaçada vermelha acima de um título. */
export function Chapeu({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={classes('chapeu', className)}>{children}</p>;
}

type FileteEspessura = 'grosso' | 'medio' | 'fino' | 'duplo';

const FILETE: Record<FileteEspessura, string> = {
  grosso: 'filete-grosso',
  medio: 'filete-medio',
  fino: 'filete-fino',
  duplo: 'filete-duplo',
};

/** Régua horizontal. Substitui borda de card em todo o projeto. */
export function Filete({
  espessura = 'fino',
  className,
}: {
  espessura?: FileteEspessura;
  className?: string;
}) {
  return <div aria-hidden="true" className={classes(FILETE[espessura], className)} />;
}

/**
 * Cabeçalho de seção no formato do boletim: chapéu, manchete e filete grosso.
 *
 * O filete fica no TOPO, não embaixo: é assim que se abre uma seção de jornal,
 * e é o que impede a seção de virar caixa fechada.
 */
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
    <header className="filete-grosso flex flex-col gap-1.5 pt-3">
      {overline ? <Chapeu>{overline}</Chapeu> : null}
      <h2 className={escala === 'lg' ? 'manchete-lg text-tinta-900' : 'manchete-md text-tinta-900'}>
        {title}
      </h2>
      {description ? (
        <p className="max-w-[62ch] text-sm text-tinta-500">{description}</p>
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
