import { describe, expect, it } from 'vitest';
import { ALL_EVENTS, EVENTS_BY_PHASE } from '@/data/events';
import { DECISION_TAGS, DEFAULT_CONFIG, ROUND_PHASES, type RoundPhase } from '@/types/game';

/**
 * Validação do conteúdo pedagógico (as cartas de evento).
 *
 * Este é o arquivo mais provável de ser editado por outra pessoa depois da
 * entrega, então cada teste aqui protege uma regra estrutural do conteúdo, não
 * do código da engine. Falhar aqui deve apontar exatamente qual carta ou
 * opção quebrou a regra.
 */

const FORBIDDEN_DASH = /—|--/;

/** Todos os textos de uma carta que vão para a tela do jogador ou do professor. */
function cardTexts(card: (typeof ALL_EVENTS)[number]): string[] {
  const texts = [card.title, card.narrative, card.debriefPrompt];
  for (const option of card.options) {
    texts.push(option.label, option.detail);
    if (option.risk?.bonusNote) texts.push(option.risk.bonusNote);
    if (option.risk?.penaltyNote) texts.push(option.risk.penaltyNote);
  }
  for (const hint of Object.values(card.roleHints)) {
    if (hint) texts.push(hint);
  }
  return texts;
}

describe('estrutura das fases', () => {
  it('toda fase tem ao menos 2 cartas', () => {
    for (const phase of ROUND_PHASES) {
      const cards = EVENTS_BY_PHASE[phase];
      expect(cards.length, `fase "${phase}" tem menos de 2 cartas`).toBeGreaterThanOrEqual(2);
    }
  });

  it('a fase declarada na carta corresponde ao array em que ela está', () => {
    for (const phase of ROUND_PHASES) {
      for (const card of EVENTS_BY_PHASE[phase]) {
        expect(card.phase, `carta "${card.key}" está no array "${phase}" mas declara fase diferente`).toBe(
          phase satisfies RoundPhase,
        );
      }
    }
  });
});

describe('estrutura das cartas', () => {
  it('toda carta tem entre 3 e 5 opções', () => {
    for (const card of ALL_EVENTS) {
      expect(
        card.options.length,
        `carta "${card.key}" tem ${card.options.length} opções (esperado 3 a 5)`,
      ).toBeGreaterThanOrEqual(3);
      expect(card.options.length).toBeLessThanOrEqual(5);
    }
  });

  it('nenhuma carta repete a chave de opção', () => {
    for (const card of ALL_EVENTS) {
      const keys = card.options.map((option) => option.key);
      const unique = new Set(keys);
      expect(unique.size, `carta "${card.key}" tem chaves de opção duplicadas: ${keys.join(',')}`).toBe(
        keys.length,
      );
    }
  });

  it('toda carta tem debriefPrompt preenchido', () => {
    for (const card of ALL_EVENTS) {
      expect(card.debriefPrompt, `carta "${card.key}" sem debriefPrompt`).toBeTruthy();
      expect(card.debriefPrompt.trim().length).toBeGreaterThan(0);
    }
  });

  it('toda carta tem ao menos 3 roleHints', () => {
    for (const card of ALL_EVENTS) {
      const count = Object.values(card.roleHints).filter(Boolean).length;
      expect(count, `carta "${card.key}" tem só ${count} roleHints (esperado ao menos 3)`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });
});

describe('estrutura das opções', () => {
  it('toda opção tem ao menos uma tag', () => {
    for (const card of ALL_EVENTS) {
      for (const option of card.options) {
        expect(
          option.tags.length,
          `opção "${card.key}/${option.key}" não tem nenhuma tag`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('toda tag usada existe em DECISION_TAGS', () => {
    const known = new Set<string>(DECISION_TAGS);
    for (const card of ALL_EVENTS) {
      for (const option of card.options) {
        for (const tag of option.tags) {
          expect(known.has(tag), `opção "${card.key}/${option.key}" usa tag desconhecida "${tag}"`).toBe(
            true,
          );
        }
      }
    }
  });

  it('a chance de risco está sempre em (0, 1) quando existe', () => {
    for (const card of ALL_EVENTS) {
      for (const option of card.options) {
        if (!option.risk) continue;
        expect(
          option.risk.chance,
          `opção "${card.key}/${option.key}" tem risk.chance fora de (0,1): ${option.risk.chance}`,
        ).toBeGreaterThan(0);
        expect(option.risk.chance).toBeLessThan(1);
      }
    }
  });

  it('nenhuma opção com requiresCash custa mais que o orçamento inicial padrão', () => {
    for (const card of ALL_EVENTS) {
      for (const option of card.options) {
        if (!option.requiresCash) continue;
        expect(
          option.displayCost,
          `opção "${card.key}/${option.key}" custa R$ ${option.displayCost}, mais que o orçamento inicial (R$ ${DEFAULT_CONFIG.initialBudget}): é impossível de escolher em qualquer cenário`,
        ).toBeLessThanOrEqual(DEFAULT_CONFIG.initialBudget);
      }
    }
  });
});

describe('linguagem proibida', () => {
  it('nenhum texto de carta contém travessão "—" ou hífen duplo "--"', () => {
    for (const card of ALL_EVENTS) {
      for (const text of cardTexts(card)) {
        expect(
          FORBIDDEN_DASH.test(text),
          `carta "${card.key}" tem texto com travessão ou hífen duplo proibido: "${text}"`,
        ).toBe(false);
      }
    }
  });
});
