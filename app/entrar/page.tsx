'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { joinGame, RequestError } from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { Button, Field } from '@/components/ui/primitives';

/**
 * Entrada do aluno: a ficha de inscrição na safra.
 *
 * Meta de sala de aula: menos de um minuto entre abrir esta tela e estar
 * jogando. Sem tutorial, sem etapa extra, sem login: código, nome, confirmar.
 * O campo do código é grande e monoespaçado de propósito, porque ele vai ser
 * copiado de um telão do outro lado da sala.
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
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
        <div className="ficha ficha-margem py-6 pr-5">
          <span className="rotulo text-carimbo-600">Safra DF · retomar</span>
          <h1 className="mt-1 text-2xl uppercase leading-tight text-tinta-900">
            Continuar como {existing.playerName}
          </h1>

          <div className="regua my-4" />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="rotulo">Equipe</span>
              <span className="pontilhado" aria-hidden="true" />
              <span className="tabular text-sm text-tinta-900">{existing.teamName}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="rotulo">Partida</span>
              <span className="pontilhado" aria-hidden="true" />
              <span className="tabular text-sm text-tinta-900">{existing.gameCode}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="button"
              variant="principal"
              size="grande"
              onClick={() => router.push('/jogar')}
            >
              Voltar para a partida
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
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="ficha ficha-margem py-6 pr-5">
        <span className="rotulo text-carimbo-600">Safra DF · inscrição</span>
        <h1 className="mt-1 text-2xl uppercase leading-tight text-tinta-900">
          Entrar na partida
        </h1>
        <p className="mt-2 font-caderno text-sm text-tinta-500">
          Peça o código de 4 a 8 letras que o professor está projetando na tela.
        </p>

        <div className="regua my-5" />

        <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
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
            placeholder="SAFRA1"
            className="h-16 text-center text-3xl font-bold uppercase tracking-[0.3em]"
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
            <p
              role="alert"
              className="border border-carimbo-500 px-3 py-2 font-maquina text-sm text-carimbo-600"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="principal" size="grande" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar na safra'}
          </Button>
        </form>
      </div>
    </main>
  );
}
