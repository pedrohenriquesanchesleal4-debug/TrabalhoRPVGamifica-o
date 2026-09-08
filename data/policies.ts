import type { PublicPolicy } from '@/types/game';

/**
 * Políticas públicas e assistência citadas pelo jogo.
 *
 * IMPORTANTE, e proposital: nenhuma regra, percentual, teto de valor ou
 * critério de habilitação real é afirmado aqui. O jogo cita os programas pelo
 * nome e descreve a FINALIDADE de cada um. Todo número que aparece na partida
 * é fictício e existe apenas para dar peso à decisão dentro do orçamento do
 * jogo. O professor apresenta os dados oficiais na exposição, depois da partida.
 *
 * Fonte para a aula: portais oficiais do Governo do Distrito Federal, da
 * Emater-DF, do FNDE (PNAE) e da Conab (PAA).
 */
export const POLICY_DISCLAIMER =
  'Valores e prazos exibidos no jogo são fictícios e servem apenas à simulação. Regras, critérios e limites reais de cada programa devem ser consultados nas fontes oficiais.';

export const POLICIES: PublicPolicy[] = [
  {
    key: 'paa',
    name: 'Programa de Aquisição de Alimentos',
    acronym: 'PAA',
    scope: 'Federal',
    description:
      'Compra pública de alimentos da agricultura familiar destinada, entre outros fins, ao abastecimento de entidades socioassistenciais e à formação de estoques.',
    simulatedIn: 'Aparece como oportunidade de venda institucional: escoamento garantido e preço estável, em troca de organização de produção, documentação e regularidade de entrega.',
  },
  {
    key: 'pnae',
    name: 'Programa Nacional de Alimentação Escolar',
    acronym: 'PNAE',
    scope: 'Federal',
    description:
      'Alimentação escolar da rede pública, com previsão de aquisição de alimentos da agricultura familiar por meio de chamada pública.',
    simulatedIn: 'Aparece como contrato de entrega periódica para escolas: exige constância e capacidade de cumprir cronograma, mesmo em semana ruim.',
  },
  {
    key: 'papa-df',
    name: 'Programa de Aquisição de Produtos da Agricultura Familiar do Distrito Federal',
    acronym: 'PAPA-DF',
    scope: 'Distrital',
    description:
      'Aquisição de produtos da agricultura familiar do Distrito Federal por órgãos e entidades distritais, com foco no fortalecimento da produção local.',
    simulatedIn: 'Aparece como chamada pública local: demanda menos deslocamento que o mercado privado, mas exige regularidade documental e produção organizada.',
  },
  {
    key: 'emater-df',
    name: 'Emater-DF · assistência técnica e extensão rural',
    acronym: 'Emater-DF',
    scope: 'Distrital',
    description:
      'Assistência técnica e extensão rural no Distrito Federal, incluindo orientação produtiva, apoio à gestão e acesso a programas.',
    simulatedIn: 'Aparece como capacitação e acompanhamento técnico: no jogo, é o que destrava o ganho pleno das tecnologias compradas.',
  },
  {
    key: 'credito-rural',
    name: 'Crédito rural para agricultura familiar',
    acronym: 'Crédito',
    scope: 'Federal e distrital',
    description:
      'Linhas de financiamento voltadas ao custeio e ao investimento na produção familiar, com condições próprias definidas em normas oficiais.',
    simulatedIn: 'Aparece como financiamento parcelado: libera investimento imediato e cria parcela fixa descontada ao fim de cada rodada.',
  },
  {
    key: 'cooperativismo',
    name: 'Cooperativas e associações de produtores',
    acronym: 'Cooperativa',
    scope: 'Organização social',
    description:
      'Organização coletiva de produtores para compra de insumos, beneficiamento, logística e acesso conjunto a mercados e programas públicos.',
    simulatedIn: 'Aparece como proposta de cooperativa: reduz o risco de mercado e o custo de logística, em troca de margem menor por unidade e de decisão compartilhada.',
  },
];

export const POLICY_BY_KEY: Record<string, PublicPolicy> = Object.fromEntries(
  POLICIES.map((policy) => [policy.key, policy]),
);
