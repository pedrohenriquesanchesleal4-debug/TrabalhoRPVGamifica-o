import { describe, expect, it } from 'vitest';
import {
  buildDiagnostics,
  buildTeachingHooks,
  diagnosticBar,
  diagnosticSentence,
  summarizeByTeam,
  type DecisionRecord,
} from '@/game/diagnostics';
import { DECISION_TAG_LABEL } from '@/types/game';

function record(partial: Partial<DecisionRecord> & Pick<DecisionRecord, 'teamId' | 'tags'>): DecisionRecord {
  return {
    roundIndex: 1,
    eventKey: 'evento-teste',
    optionKey: 'a',
    optionLabel: 'Opção A',
    ...partial,
  };
}

describe('buildDiagnostics', () => {
  it('conta equipes distintas e total de decisões separadamente', () => {
    const records: DecisionRecord[] = [
      record({ teamId: 'time-a', tags: ['tech_invest'], roundIndex: 1 }),
      record({ teamId: 'time-a', tags: ['tech_invest'], roundIndex: 2 }),
      record({ teamId: 'time-b', tags: ['tech_invest'], roundIndex: 1 }),
    ];

    const [entry] = buildDiagnostics(records, 4, ['tech_invest']);

    // Duas equipes tomaram a decisão, mas ao todo foram 3 decisões com a tag.
    expect(entry.teams).toBe(2);
    expect(entry.decisions).toBe(3);
    expect(entry.totalTeams).toBe(4);
    expect(entry.label).toBe(DECISION_TAG_LABEL.tech_invest);
  });

  it('devolve zero equipes e zero decisões quando a tag não ocorre', () => {
    const [entry] = buildDiagnostics([], 6, ['sustainability']);
    expect(entry.teams).toBe(0);
    expect(entry.decisions).toBe(0);
    expect(entry.totalTeams).toBe(6);
  });
});

describe('diagnosticBar', () => {
  it('preenche proporcionalmente às equipes que tomaram a decisão', () => {
    const bar = diagnosticBar(
      { tag: 'tech_invest', label: 'Investiu em tecnologia', teams: 5, totalTeams: 10, decisions: 5 },
      10,
    );
    expect(bar).toBe('█████░░░░░');
  });

  it('devolve barra totalmente vazia quando não há nenhuma equipe na partida', () => {
    const bar = diagnosticBar(
      { tag: 'tech_invest', label: 'Investiu em tecnologia', teams: 0, totalTeams: 0, decisions: 0 },
      8,
    );
    expect(bar).toBe('░'.repeat(8));
  });
});

describe('diagnosticSentence', () => {
  it('monta a frase no plural quando mais de uma equipe', () => {
    const sentence = diagnosticSentence({
      tag: 'credit',
      label: 'Buscou crédito',
      teams: 4,
      totalTeams: 6,
      decisions: 7,
    });
    expect(sentence).toBe('4 de 6 equipes: buscou crédito');
  });

  it('usa o singular "equipe" quando só uma equipe tomou a decisão', () => {
    const sentence = diagnosticSentence({
      tag: 'credit',
      label: 'Buscou crédito',
      teams: 1,
      totalTeams: 6,
      decisions: 1,
    });
    expect(sentence).toBe('1 de 6 equipe: buscou crédito');
  });

  it('funciona com zero equipes sem quebrar a frase', () => {
    const sentence = diagnosticSentence({
      tag: 'credit',
      label: 'Buscou crédito',
      teams: 0,
      totalTeams: 6,
      decisions: 0,
    });
    expect(sentence).toBe('0 de 6 equipes: buscou crédito');
  });
});

describe('summarizeByTeam', () => {
  it('agrupa as decisões por equipe e ordena cada grupo por rodada', () => {
    const records: DecisionRecord[] = [
      record({ teamId: 'time-a', tags: ['tech_invest'], roundIndex: 3, optionKey: 'c' }),
      record({ teamId: 'time-b', tags: ['sustainability'], roundIndex: 1, optionKey: 'x' }),
      record({ teamId: 'time-a', tags: ['training'], roundIndex: 1, optionKey: 'a' }),
    ];

    const summary = summarizeByTeam(records);
    const teamA = summary.find((entry) => entry.teamId === 'time-a');

    expect(summary).toHaveLength(2);
    expect(teamA?.decisions.map((decision) => decision.roundIndex)).toEqual([1, 3]);
    expect(teamA?.tagCounts.tech_invest).toBe(1);
    expect(teamA?.tagCounts.training).toBe(1);
  });
});

describe('buildTeachingHooks', () => {
  it('gera o gancho de tecnologia comprada sem capacitação quando a situação existe', () => {
    const records: DecisionRecord[] = [
      record({ teamId: 'time-a', tags: ['tech_invest'] }),
      record({ teamId: 'time-b', tags: ['tech_invest'] }),
      record({ teamId: 'time-c', tags: ['training'] }),
    ];

    const hooks = buildTeachingHooks(records, 3);

    expect(
      hooks.some((hook) => hook.includes('investiram em tecnologia') && hook.includes('capacitação')),
    ).toBe(true);
  });

  it('não gera o gancho de tecnologia sem capacitação quando todo mundo que investiu também treinou', () => {
    const records: DecisionRecord[] = [
      record({ teamId: 'time-a', tags: ['tech_invest', 'training'] }),
      record({ teamId: 'time-b', tags: ['tech_invest', 'training'] }),
    ];

    const hooks = buildTeachingHooks(records, 2);

    expect(hooks.some((hook) => hook.includes('ficou parado esperando'))).toBe(false);
    expect(hooks.some((hook) => hook.includes('tecnologia, mas só'))).toBe(false);
  });
});
