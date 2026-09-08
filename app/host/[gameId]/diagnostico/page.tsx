'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { SectionHeading } from '@/components/ui/primitives';
import { DiagnosticBars } from '@/components/host/diagnostic-bars';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { POLICY_DISCLAIMER } from '@/data/policies';
import { ROUND_META } from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * O levantamento da turma: a peça central da aula.
 *
 * Nada aqui classifica equipe como certa ou errada. A folha só conta o que a
 * turma fez, com a régua de contagem e o histórico rodada a rodada de cada
 * grupo, para o professor puxar o fio da exposição teórica a partir de fatos
 * que acabaram de acontecer na sala.
 */
export default function DiagnosticoPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : null;

  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gameId) return;
    try {
      const next = await fetchProjection(gameId);
      setView(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof RequestError
          ? err.message
          : 'Não foi possível carregar o diagnóstico. Verifique a conexão.',
      );
    }
  }, [gameId]);

  // A busca inicial roda dentro de uma função assíncrona local, e não como
  // chamada direta no corpo do efeito: assim nenhum setState acontece de forma
  // sincrona durante a sincronização, e o guarda de cancelamento evita
  // atualizar uma tela que já foi desmontada.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await load();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  useGameChannel({
    gameId,
    onEvent: () => void load(),
    onTeamUpdate: () => void load(),
  });

  if (!gameId) return null;

  if (error && !view) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="rotulo text-carimbo-600">Falhou</span>
        <p className="font-caderno text-lg text-tinta-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-maquina text-xl uppercase tracking-[0.14em] text-tinta-500 cursor-maquina">
          Carregando diagnóstico
        </p>
      </main>
    );
  }

  const hasDecisions = view.diagnostics.some((entry) => entry.decisions > 0);
  const showPolicyDisclaimer = view.diagnostics.some(
    (entry) => entry.tag === 'public_policy' && entry.decisions > 0,
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10">
      <div className="ficha ficha-furos pl-10 pr-8 py-7">
        <SectionHeading
          overline="Safra DF · levantamento da turma"
          title="O que a turma decidiu"
          description="Esta folha não diz quem acertou. Ela mostra o que aconteceu na turma inteira, para virar pergunta na aula."
        />

        <div className="mt-6">
          {!hasDecisions ? (
            <p className="font-caderno text-tinta-700">
              Ainda não há decisões suficientes registradas. O levantamento ganha corpo à medida
              que as equipes jogam as rodadas.
            </p>
          ) : (
            <DiagnosticBars entries={view.diagnostics} />
          )}
        </div>
      </div>

      {view.teachingHooks.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeading overline="Ganchos para o debate" title="Perguntas prontas para a turma" />
          <ul className="flex flex-col gap-3">
            {view.teachingHooks.map((hook, index) => (
              <li key={index} className="ficha flex items-baseline gap-4 p-5">
                <span className="tabular shrink-0 text-lg text-carimbo-600" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-caderno text-lg leading-relaxed text-tinta-900">{hook}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeading overline="Por equipe" title="Histórico de decisões, rodada a rodada" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {view.teams.map((team) => {
            const property = PROPERTY_BY_KEY[team.propertyKey];
            return (
              <div key={team.id} className="ficha ficha-margem py-4 pr-4">
                <header className="flex flex-col">
                  <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
                  <h3 className="text-xl uppercase text-tinta-900">{team.name}</h3>
                </header>

                <div className="regua my-3" />

                {team.history.length === 0 ? (
                  <p className="font-caderno text-sm text-tinta-400">
                    Nenhuma decisão registrada ainda.
                  </p>
                ) : (
                  <ol className="flex flex-col">
                    {team.history.map((entry) => {
                      const phase = ROUND_META[
                        (Object.keys(ROUND_META) as (keyof typeof ROUND_META)[]).find(
                          (key) => ROUND_META[key].index === entry.roundIndex,
                        ) ?? 'preparacao'
                      ];
                      return (
                        <li
                          key={`${team.id}-${entry.roundIndex}`}
                          className="flex items-baseline gap-2 border-t border-dotted border-papel-300 py-1.5 first:border-t-0 first:pt-0"
                        >
                          <span className="rotulo shrink-0">
                            R{entry.roundIndex} {phase.title}
                          </span>
                          <span className="pontilhado" aria-hidden="true" />
                          <span className="shrink-0 text-right font-maquina text-sm font-bold text-tinta-900">
                            {entry.optionLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {showPolicyDisclaimer ? (
        <p className="border-t border-dashed border-papel-300 pt-4 font-maquina text-xs leading-relaxed text-tinta-400">
          {POLICY_DISCLAIMER}
        </p>
      ) : null}
    </main>
  );
}
