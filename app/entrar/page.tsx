'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, TriangleAlert } from 'lucide-react';
import { joinGame, RequestError } from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { Button, Field, Rotulo } from '@/components/ui/primitives';
import { PropertyScene } from '@/components/game/property-scene';

/**
 * Entrada do aluno.
 *
 * Meta de sala de aula: menos de um minuto entre abrir esta tela e estar
 * jogando. Sem tutorial, sem etapa extra: código, nome, confirmar.
 */

export default function EntrarPage() {
  const router = useRouter();
  const existing = playerSession.get();

  const [showForm, setShowForm] = useState(!existing);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCodeChange(raw: string) {
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(normalized);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (code.length < 4) {
      setError('O código da partida tem pelo menos 4 caracteres.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Digite seu nome para entrar na equipe.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await joinGame(code, trimmedName);
      playerSession.set({
        token: response.playerToken,
        gameId: response.gameId,
        gameCode: response.gameCode,
        playerName: response.player.name,
        teamName: response.team.name,
        role: response.role,
      });
      router.push('/jogar');
    } catch (err) {
      if (err instanceof RequestError) {
        setError(err.message);
      } else {
        setError('Não foi possível conectar. Verifique a internet e tente de novo.');
      }
      setSubmitting(false);
    }
  }

  if (!showForm && existing) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 md:justify-between px-5 py-8 sm:px-6 sm:py-10 md:max-w-3xl md:py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
          <div className="flex flex-col gap-5 md:w-2/5 md:shrink-0">
            <div className="degrau terraco terr-fundo-azul flex items-center gap-4 px-5 py-5">
              <div className="w-16 shrink-0">
                <PropertyScene compact propertyKey="cerrado-vivo" production={55} technology={45} sustainability={60} />
              </div>
              <div className="flex flex-col gap-1">
                <Rotulo className="text-azul-300">Safra DF</Rotulo>
                <h1 className="relevo-md text-white">Continuar como {existing.playerName}</h1>
              </div>
            </div>
            <p className="text-sm text-terra-700 md:max-w-[32ch]">
              Você já está na equipe {existing.teamName}, partida {existing.gameCode}.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-1">
            <Button
              type="button"
              variant="principal"
              size="grande"
              onClick={() => router.push('/jogar')}
            >
              Continuar como {existing.playerName}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="silencioso"
              onClick={() => {
                playerSession.clear();
                setShowForm(true);
              }}
            >
              Entrar com outro código
            </Button>
          </div>
        </div>

        <p className="text-xs text-terra-500">
          Sem senha e sem e-mail: só o código da turma e o seu nome ficam guardados neste
          aparelho.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 md:justify-between px-5 py-8 sm:px-6 sm:py-10 md:max-w-3xl md:py-16">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
        <div className="flex flex-col gap-5 md:w-2/5 md:shrink-0">
          <div className="degrau terraco terr-fundo-azul flex items-center gap-4 px-5 py-5">
            <div className="w-16 shrink-0">
              <PropertyScene compact propertyKey="cerrado-vivo" production={55} technology={45} sustainability={60} />
            </div>
            <div className="flex flex-col gap-1">
              <Rotulo className="text-azul-300">Safra DF</Rotulo>
              <h1 className="relevo-md text-white">Entrar na partida</h1>
            </div>
          </div>
          <p className="text-sm text-terra-700 md:max-w-[32ch]">
            Peça o código de 4 a 8 letras que o professor está projetando na tela. Sua equipe já
            tem uma propriedade esperando.
          </p>
        </div>

        <form className="flex flex-col gap-6 md:flex-1" onSubmit={handleSubmit} noValidate>
          <Field
            label="Código da partida"
            name="codigo"
            value={code}
            onChange={(event) => handleCodeChange(event.target.value)}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            placeholder="EX: SAFRA1"
            codigo
            hint="Só letras e números, sem espaço."
            disabled={submitting}
          />

          <Field
            label="Seu nome"
            name="nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={40}
            placeholder="Como o time deve te chamar"
            disabled={submitting}
          />

          {error ? (
            <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-alerta-texto">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="principal" size="grande" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Entrando...
              </>
            ) : (
              <>
                Entrar
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
      </div>

      <p className="text-xs text-terra-500">
        Sem cadastro: em menos de um minuto sua equipe já está esperando você na propriedade.
      </p>
    </main>
  );
}
