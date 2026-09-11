import { Rotulo } from '@/components/ui/primitives';

/**
 * Roteiro de debate em markdown enxuto, renderizado sem dependência.
 *
 * O gerador de IA é obrigado a usar apenas: `#` título, `##` subtítulo,
 * `-`/`1.` itens e `**negrito**`. Este renderizador cobre exatamente esse
 * subconjunto, linha a linha, sem regex de cauda e sem biblioteca de markdown
 * (que inflaria o bundle para uma tela de professor).
 */

function InlineBold({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-terra-900">
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (trimmed === '') return null;

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={index} className="relevo-sm pt-2 text-terra-900">
              <InlineBold text={trimmed.slice(4)} />
            </h3>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <Rotulo key={index} className="pt-3 text-financas-texto">
              {trimmed.slice(3)}
            </Rotulo>
          );
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={index} className="relevo-lg text-terra-900">
              <InlineBold text={trimmed.slice(2)} />
            </h2>
          );
        }

        const numbered = /^(\d+)[.)]\s+/.exec(trimmed);
        if (numbered) {
          return (
            <div key={index} className="flex items-start gap-2 text-base leading-[1.6] text-terra-700">
              <span className="mt-[0.1em] font-semibold text-financas-texto">
                {numbered[1]}.
              </span>
              <span>
                <InlineBold text={trimmed.slice(numbered[0].length)} />
              </span>
            </div>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <div key={index} className="flex items-start gap-2 text-base leading-[1.6] text-terra-700">
              <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-financas-texto" aria-hidden />
              <span>
                <InlineBold text={trimmed.slice(2)} />
              </span>
            </div>
          );
        }

        return (
          <p key={index} className="text-base leading-[1.6] text-terra-700">
            <InlineBold text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}