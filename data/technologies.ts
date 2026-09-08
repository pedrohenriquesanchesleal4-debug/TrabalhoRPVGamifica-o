import type { Technology } from '@/types/game';

/**
 * Catálogo de tecnologias citadas pelos eventos.
 *
 * Serve para duas coisas: alimentar a tela de referência do jogador e deixar
 * explícito, em texto, que toda tecnologia tem REQUISITO. Custos são fictícios
 * e existem só para dar peso à decisão dentro do orçamento do jogo.
 *
 * Regra de ouro do jogo: nenhuma tecnologia é boa por si só. Todas dependem de
 * capacitação, energia, água, manutenção ou escala para entregar o benefício.
 */
export const TECHNOLOGIES: Technology[] = [
  {
    key: 'irrigacao-inteligente',
    name: 'Irrigação por gotejamento com controle automático',
    cost: 20000,
    benefit: 'Água na medida certa: menos perda na estiagem e produção estável.',
    requirement: 'Alguém precisa saber programar e manter o sistema. Sem isso, o equipamento fica ligado errado.',
    risk: 'Entupimento de gotejador e falha de bomba param a irrigação no pior momento.',
  },
  {
    key: 'sensor-umidade',
    name: 'Sensores de umidade de solo',
    cost: 6000,
    benefit: 'Mostra quando irrigar de verdade, em vez de irrigar por hábito.',
    requirement: 'Só faz diferença se existir irrigação para ajustar e alguém para ler o dado.',
    risk: 'Dado que ninguém interpreta é dado que não muda decisão nenhuma.',
  },
  {
    key: 'monitoramento-clima',
    name: 'Estação meteorológica e alerta de chuva',
    cost: 4500,
    benefit: 'Antecipa chuva e geada, permitindo colher ou proteger antes.',
    requirement: 'Depende de internet estável na propriedade e de olhar o alerta todo dia.',
    risk: 'Previsão errada gera decisão errada com a mesma confiança.',
  },
  {
    key: 'automacao-estufa',
    name: 'Automação de estufa e túnel baixo',
    cost: 28000,
    benefit: 'Controla temperatura e ventilação, ampliando a janela de plantio.',
    requirement: 'Exige energia elétrica confiável e manutenção periódica paga.',
    risk: 'Queda de energia com estufa fechada cozinha a cultura em poucas horas.',
  },
  {
    key: 'conectividade-rural',
    name: 'Internet rural com antena e roteamento',
    cost: 5000,
    benefit: 'Destrava tudo o que é digital: nota, pedido, alerta, assistência remota.',
    requirement: 'Precisa de ponto de energia e de sinal disponível no núcleo rural.',
    risk: 'Sem conectividade, sensor e automação viram enfeite caro.',
  },
  {
    key: 'gestao-digital',
    name: 'Gestão digital de custo e produção',
    cost: 3000,
    benefit: 'Mostra o custo real por caixa produzida: revela onde o dinheiro vaza.',
    requirement: 'Alguém da família precisa lançar os dados toda semana, sem falhar.',
    risk: 'Planilha abandonada no meio da safra não serve para decidir nada.',
  },
  {
    key: 'armazenamento-frio',
    name: 'Câmara fria e armazenamento pós-colheita',
    cost: 24000,
    benefit: 'Segura o produto por dias: permite vender fora do pico de preço baixo.',
    requirement: 'Energia contínua e limpeza rigorosa, senão contamina o lote todo.',
    risk: 'Conta de energia sobe e come a margem que o armazenamento gerou.',
  },
  {
    key: 'logistica-refrigerada',
    name: 'Transporte próprio com caixa isotérmica',
    cost: 32000,
    benefit: 'Entrega direta ao comprador institucional, sem depender de atravessador.',
    requirement: 'Exige habilitação, manutenção, combustível e volume que justifique o veículo.',
    risk: 'Veículo parado por manutenção derruba o contrato de entrega.',
  },
];

export const TECHNOLOGY_BY_KEY: Record<string, Technology> = Object.fromEntries(
  TECHNOLOGIES.map((technology) => [technology.key, technology]),
);
