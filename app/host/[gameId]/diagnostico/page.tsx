'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { SectionHeading } from '@/components/ui/primitives';
import { DiagnosticBars } from '@/components/host/diagnostic-bars';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { POLICY_DISCLAIMER } from '@/data/policies';
import { ROUND_META } from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * Diagnóstico da turma: a peça central da aula.
 *
 * Nada aqui classifica equipe como certa ou errada. O painel só conta o que a
 * turma fez, com barra visual e o histórico rodada a rodada de cada grupo,
 * para o professor puxar o fio da exposição teórica a partir de fatos.
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
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={32} aria-hidden />
        <p className="text-lg text-mata-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-xl text-mata-600">Carregando diagnóstico...</p>
      </main>
    );
  }

  const hasDecisions = view.diagnostics.some((entry) => entry.decisions > 0);
  const showPolicyDisclaimer = view.diagnostics.some(
    (entry) => entry.tag === 'public_policy' && entry.decisions > 0,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-8 py-10">
      <SectionHeading
        overline="SAFRA DF · Diagnóstico da turma"
        title="O que a turma decidiu"
        description="Este painel não diz quem acertou. Ele mostra o que aconteceu na turma inteira, para virar pergunta na aula."
      />

      {!hasDecisions ? (
        <div className="carta flex items-center gap-3 p-6">
          <AlertTriangle className="shrink-0 text-mata-500" size={22} aria-hidden />
          <p className="text-mata-700">
            Ainda não há decisões suficientes registradas. O diagnóstico ganha corpo à medida que
            as equipes jogam as rodadas.
          </p>
        </div>
      ) : (
        <section className="carta p-6">
          <DiagnosticBars entries={view.diagnostics} />
        </section>
      )}

      {view.teachingHooks.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeading overline="Ganchos para o debate" title="Perguntas prontas para a turma" />
          <ul className="flex flex-col gap-3">
            {view.teachingHooks.map((hook, index) => (
              <li
                key={index}
                className="carta flex items-start gap-3 border-l-4 border-l-terra-500 p-5 text-lg text-mata-800"
              >
                <Lightbulb className="mt-1 shrink-0 text-terra-500" size={20} aria-hidden />
                <span>{hook}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeading
          overline="Por equipe"
          title="Histórico de decisões, rodada a rodada"
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {view.teams.map((team) => {
            const property = PROPERTY_BY_KEY[team.propertyKey];
            return (
              <div key={team.id} className="carta flex flex-col gap-3 p-5">
                <header className="flex flex-col gap-0.5">
                  <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
                  <h3 className="text-xl text-mata-900">{team.name}</h3>
                </header>

                {team.history.length === 0 ? (
                  <p className="text-sm text-mata-500">Nenhuma decisão registrada ainda.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {team.history.map((entry) => {
                      const phase = ROUND_META[
                        (Object.keys(ROUND_META) as (keyof typeof ROUND_META)[]).find(
                          (key) => ROUND_META[key].index === entry.roundIndex,
                        ) ?? 'preparacao'
                      ];
                      return (
                        <li
                          key={`${team.id}-${entry.roundIndex}`}
                          className="flex items-baseline justify-between gap-3 border-t border-areia-200 pt-2 first:border-t-0 first:pt-0"
                        >
                          <span className="text-sm text-mata-600">
                            Rodada {entry.roundIndex} · {phase.title}
                          </span>
                          <span className="text-right text-sm font-medium text-mata-900">
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
        <p className="border-t border-areia-200 pt-4 text-xs text-mata-500">
          {POLICY_DISCLAIMER}
        </p>
      ) : null}
    </main>
  );
}
