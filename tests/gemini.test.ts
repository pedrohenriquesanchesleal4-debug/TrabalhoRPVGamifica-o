import { describe, expect, it } from 'vitest';
import { buildDebateSnapshot } from '@/lib/gemini';
import type { HostView } from '@/lib/game-service';

/**
 * O snapshot é a fronteira de cota do roteiro de debate: tudo que a IA pode
 * citar, em menos de 7k caracteres (~2-3k tokens), sem segredo de jogador.
 * Pureza total: nenhum destes testes toca rede nem banco.
 */

const VIEW: HostView = {
  game: {
    id: 'partida-1',
    code: 'ABC123',
    status: 'finished',
    currentRound: 5,
    roundStatus: 'resolved',
    roundEndsAt: null,
    totalRounds: 5,
    config: {
      initialBudget: 80_000,
      roundSeconds: 180,
      teamCount: 2,
      maxPlayersPerTeam: 6,
      weights: { finances: 25, production: 25, technology: 20, sustainability: 30 },
    },
    phase: 'colheita',
  },
  teams: [
    {
      id: 'equipe-1',
      name: 'Vale Verde',
      propertyKey: 'vale_verde',
      orderIndex: 0,
      state: {
        cash: 12_400,
        production: 62,
        technology: 40,
        sustainability: 71,
        traits: {
          trained: true,
          idleTech: 0,
          debtInstallments: 0,
          debtPerRound: 0,
          inPublicProgram: true,
          inCooperative: false,
          irrigation: true,
          storage: false,
          cashCrises: 0,
          opportunitiesTaken: 1,
        },
      },
      players: [],
      currentEvent: null,
      currentDecision: null,
      history: [
        {
          roundIndex: 1,
          optionLabel: 'Entrar no programa de compra institucional',
          tags: ['public_policy', 'risk_low'],
        },
        {
          roundIndex: 2,
          optionLabel: 'Contratar capacitação técnica',
          tags: ['training', 'tech_invest'],
        },
      ],
    },
    {
      id: 'equipe-2',
      name: 'Cerrado Seco',
      propertyKey: 'cerrado_seco',
      orderIndex: 1,
      state: {
        cash: -3_100,
        production: 78,
        technology: 30,
        sustainability: 45,
        traits: {
          trained: false,
          idleTech: 2,
          debtInstallments: 3,
          debtPerRound: 4_000,
          inPublicProgram: false,
          inCooperative: false,
          irrigation: false,
          storage: false,
          cashCrises: 2,
          opportunitiesTaken: 0,
        },
      },
      players: [],
      currentEvent: null,
      currentDecision: null,
      history: [
        {
          roundIndex: 1,
          optionLabel: 'Arrendar terra vizinha',
          tags: ['production_first', 'risk_high'],
        },
      ],
    },
  ],
  playerCount: 0,
  decidedTeams: 0,
  diagnostics: [
    {
      tag: 'public_policy',
      label: 'Buscou política pública',
      teams: 1,
      totalTeams: 2,
      decisions: 1,
    },
  ],
  teachingHooks: ['Programas públicos destravaram o caixa de quem aderiu cedo.'],
  policyConnections: [
    {
      tag: 'public_policy',
      policy: {
        key: 'psa-df',
        name: 'Programa de Sementes do DF',
        acronym: 'PSA-DF',
        scope: 'Distrito Federal',
        description: 'Programa público real de apoio à agricultura familiar no DF.',
        simulatedIn: 'A rodada 1 simula a adesão com preço estável.',
      },
      note: 'A equipe Vale Verde aderiu ao programa e manteve preço estável nas duas primeiras rodadas.',
    },
  ],
  scores: [
    {
      teamId: 'equipe-1',
      teamName: 'Vale Verde',
      finances: 81,
      production: 70,
      technology: 55,
      sustainability: 76,
      composite: 0.73,
      profile: 'articulada',
      awards: ['best_sustainability', 'best_finance'],
      rank: 1,
    },
    {
      teamId: 'equipe-2',
      teamName: 'Cerrado Seco',
      finances: 42,
      production: 85,
      technology: 45,
      sustainability: 52,
      composite: 0.58,
      profile: 'produtiva',
      awards: ['best_production'],
      rank: 2,
    },
  ],
};

describe('buildDebateSnapshot', () => {
  it('serializa a partida em JSON compacto sem segredo de jogador', () => {
    const snapshot = buildDebateSnapshot(VIEW);

    const parsed = JSON.parse(snapshot) as {
      partida: string;
      equipes: { nome: string; perfil: string; premios: string[]; historico: unknown[] }[];
      politicasPublicas: { sigla: string; nome: string }[];
    };

    expect(parsed.partida).toBe('ABC123');
    expect(parsed.equipes).toHaveLength(2);
    expect(parsed.equipes[0].perfil).toBe('Articulação Institucional');
    expect(parsed.equipes[0].premios).toEqual([
      'Maior sustentabilidade',
      'Melhor desempenho financeiro',
    ]);
    expect(parsed.equipes[0].historico).toHaveLength(2);
    expect(parsed.equipes[1].historico).toHaveLength(1);
    expect(parsed.politicasPublicas[0].sigla).toBe('PSA-DF');
  });

  it('cabe na janela de cota (menos de 7k caracteres, ~2-3k tokens)', () => {
    const snapshot = buildDebateSnapshot(VIEW);
    expect(snapshot.length).toBeLessThan(7_000);
  });

  it('traduz tags técnicas em rótulos legíveis para a IA', () => {
    const snapshot = buildDebateSnapshot(VIEW);
    expect(snapshot).toContain('Buscou política pública');
    expect(snapshot).not.toContain('public_policy');
  });
});