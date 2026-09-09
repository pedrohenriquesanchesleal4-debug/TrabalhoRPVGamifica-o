import { CircleDashed, CircleCheck, WifiOff } from 'lucide-react';
import { ROLE_LABEL } from '@/types/game';
import type { Role } from '@/types/game';

/**
 * Integrantes da equipe: função, estado de decisão e conexão.
 *
 * Estado nunca depende só de cor: cada linha carrega um ícone e uma palavra,
 * pensada para ser lida a um braço de distância de um celular. Lista simples,
 * separada por divisor fino, sem pilha de cartões.
 */

export interface RosterMember {
  playerId: string;
  name: string;
  role: Role;
  connected: boolean;
  state: 'thinking' | 'decided';
  isSelf: boolean;
}

export function TeamRoster({ members }: { members: RosterMember[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-terra-700">Ainda ninguém entrou na equipe.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-nevoa-200">
      {members.map((member) => (
        <li key={member.playerId} className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-terra-900">
              {member.name}
              {member.isSelf ? <span className="font-normal text-terra-500"> (você)</span> : null}
            </span>
            <span className="text-xs text-terra-500">{ROLE_LABEL[member.role]}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!member.connected ? (
              <span className="flex items-center gap-1 text-xs text-terra-500">
                <WifiOff size={14} aria-hidden="true" />
                Fora
              </span>
            ) : member.state === 'decided' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-sucesso">
                <CircleCheck size={14} aria-hidden="true" />
                Decidiu
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-terra-500">
                <CircleDashed size={14} aria-hidden="true" />
                Pensando
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
