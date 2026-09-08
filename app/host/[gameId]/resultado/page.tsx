'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Carimbo, SectionHeading } from '@/components/ui/primitives';
import { RankingTable } from '@/components/host/ranking-table';
import { DiagnosticBars } from '@/components/host/diagnostic-bars';
import { POLICY_DISCLAIMER } from '@/data/policies';
import type { HostView } from '@/lib/game-service';

/**
 * O fechamento do caderno, em três folhas navegáveis.
 *
 * A ordem é proposital: primeiro a ata com o placar concreto (e prêmios que
 * não são só dinheiro), depois o levantamento com os contrastes da turma, e
 * por último uma pergunta sozinha na folha, sem resposta pronta, que é onde a
 * exposição teórica começa.
 */

const BLOCK_COUNT = 3;

const BLOCK_LABEL = ['Ata da safra', 'Levantamento', 'A pergunta'];

export default function ResultadoPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : null;

  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState(0);

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
          : 'Não foi possível carregar o resultado. Verifique a conexão.',
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
          Carregando resultado
        </p>
      </main>
    );
  }

  if (view.scores.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6">
        <div className="ficha ficha-margem py-6 pr-5">
          <span className="rotulo text-carimbo-600">Ata em branco</span>
          <h1 className="mt-1 text-3xl uppercase text-tinta-900">
            O resultado ainda não foi calculado
          </h1>
          <p className="mt-3 font-caderno text-tinta-700">
            Volte ao caderno de bordo em <span className="tabular">/admin</span> e use
            &ldquo;Encerrar partida&rdquo; para fechar as cinco rodadas e gerar o ranking, os
            perfis e os prêmios de cada equipe.
          </p>
        </div>
      </main>
    );
  }

  const propertyByTeam = Object.fromEntries(
    view.teams.map((team) => [team.id, team.propertyKey]),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-7 px-6 py-8 sm:px-10">
      {/*
        A navegação é uma lombada de caderno: as três folhas listadas, a atual
        marcada. O professor precisa saber quantas faltam antes de abrir o
        debate, e a turma acompanha junto no telão.
      */}
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-papel-300 pb-4">
        <ol className="flex items-baseline gap-5">
          {BLOCK_LABEL.map((label, index) => (
            <li key={label} className="flex items-baseline gap-2">
              <span
                className={
                  index === block
                    ? 'tabular text-sm font-bold text-carimbo-600'
                    : 'tabular text-sm text-tinta-400'
                }
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={
                  index === block
                    ? 'font-maquina text-sm font-bold uppercase tracking-[0.12em] text-tinta-900 underline decoration-carimbo-500 decoration-2 underline-offset-4'
                    : 'font-maquina text-sm uppercase tracking-[0.12em] text-tinta-400'
                }
                aria-current={index === block ? 'step' : undefined}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex gap-2">
          <Button
            variant="secundario"
            onClick={() => setBlock((value) => Math.max(0, value - 1))}
            disabled={block === 0}
          >
            Anterior
          </Button>
          <Button
            variant="principal"
            onClick={() => setBlock((value) => Math.min(BLOCK_COUNT - 1, value + 1))}
            disabled={block === BLOCK_COUNT - 1}
          >
            Próxima folha
          </Button>
        </div>
      </nav>

      {block === 0 ? (
        <section className="flex flex-col gap-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <SectionHeading
              overline="Folha 1"
              title="A safra terminou"
              description="Dinheiro é um dos quatro indicadores, não o único jeito de se destacar: os prêmios abaixo reconhecem estratégias diferentes."
            />
            <Carimbo detail={`${view.scores.length} equipes`} bate>
              Safra encerrada
            </Carimbo>
          </div>
          <RankingTable scores={view.scores} propertyByTeam={propertyByTeam} />
        </section>
      ) : null}

      {block === 1 ? (
        <section className="flex flex-col gap-7" aria-live="polite">
          <SectionHeading
            overline="Folha 2"
            title="Mas o que realmente aprendemos?"
            description="O que a turma fez, agregado, sem apontar equipe certa ou errada."
          />

          <div className="ficha ficha-margem py-5 pr-5">
            <DiagnosticBars entries={view.diagnostics} />
          </div>

          {view.teachingHooks.length > 0 ? (
            <div className="flex flex-col gap-3">
              <span className="rotulo">Ganchos para o debate</span>
              <ul className="flex flex-col gap-3">
                {view.teachingHooks.map((hook, index) => (
                  <li key={index} className="ficha flex items-baseline gap-4 p-5">
                    <span className="tabular shrink-0 text-lg text-carimbo-600" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-caderno text-lg leading-relaxed text-tinta-900">
                      {hook}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-dashed border-papel-300 pt-4 font-maquina text-xs leading-relaxed text-tinta-400">
            {POLICY_DISCLAIMER}
          </p>
        </section>
      ) : null}

      {block === 2 ? (
        /*
          A última folha tem uma coisa só, escrita grande no meio do papel, do
          jeito que se escreve a pergunta central no quadro antes de abrir o
          debate. Nenhum indicador, nenhum placar, nenhuma resposta.
        */
        <section className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="ficha ficha-furos w-full max-w-4xl py-14 pl-12 pr-10">
            <span className="rotulo text-carimbo-600">Para pensar</span>
            <h1 className="mt-4 text-balance text-3xl leading-tight text-tinta-900 sm:text-4xl xl:text-5xl">
              O principal problema da agricultura familiar é a falta de tecnologia ou a
              dificuldade de acesso e adoção dessas tecnologias?
            </h1>
            <div className="regua mt-8" />
          </div>
        </section>
      ) : null}
    </main>
  );
}
