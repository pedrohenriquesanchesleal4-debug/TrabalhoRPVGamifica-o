import { ROLE_LABEL } from '@/types/game';
import type { Role } from '@/types/game';

/**
 * A lista de presença da equipe, no formato da folha de ponto.
 *
 * Estado nunca depende só de cor: cada linha carrega um sinal gráfico próprio
 * (× carimbado, ○ vazio, risco sobre o nome) e a palavra por extenso, para ser
 * lida a um braço de distância de um celular.
 */

export interface RosterMember {
  playerId: string;
  name: string;
  role: Role;
  connected: boolean;
  state: 'thinking' | 'decided';
  isSelf: boolean;
}

/** Abreviação da função para caber na coluna estreita do celular. */
const ROLE_SIGLA: Record<Role, string> = {
  produtor: 'PRD',
  financeiro: 'FIN',
  tecnologia: 'TEC',
  comercializacao: 'COM',
  politicas: 'POL',
};

export function TeamRoster({ members }: { members: RosterMember[] }) {
  if (members.length === 0) {
    return <p className="font-caderno text-sm text-tinta-400">Ainda ninguém entrou na equipe.</p>;
  }

  return (
    <ul className="flex flex-col">
      {members.map((member) => {
        const decidiu = member.state === 'decided';

        return (
          <li
            key={member.playerId}
            className="flex items-center gap-3 border-t border-dotted border-papel-300 py-2 first:border-t-0"
          >
            <span
              aria-hidden="true"
              className={[
                'flex h-6 w-6 shrink-0 items-center justify-center border font-maquina text-xs font-bold',
                !member.connected
                  ? 'border-papel-300 text-papel-400'
                  : decidiu
                    ? 'border-producao bg-producao text-papel-000'
                    : 'border-tinta-900/35 text-tinta-400',
              ].join(' ')}
            >
              {!member.connected ? '/' : decidiu ? '×' : '○'}
            </span>

            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span
                className={[
                  'truncate font-maquina text-sm font-bold',
                  member.connected ? 'text-tinta-900' : 'text-papel-400 line-through',
                ].join(' ')}
              >
                {member.name}
                {member.isSelf ? <span className="font-normal text-tinta-400"> (você)</span> : null}
              </span>
              <span className="pontilhado" aria-hidden="true" />
              <span className="rotulo shrink-0" title={ROLE_LABEL[member.role]}>
                {ROLE_SIGLA[member.role]}
              </span>
            </span>

            <span className="w-16 shrink-0 text-right font-maquina text-[0.6875rem] uppercase tracking-wider text-tinta-500">
              {!member.connected ? 'fora' : decidiu ? 'decidiu' : 'pensando'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
