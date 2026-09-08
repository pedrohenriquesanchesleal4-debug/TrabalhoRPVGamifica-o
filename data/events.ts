import type { GameEventCard, RoundPhase } from '@/types/game';

/**
 * O coração do jogo: as situações que cada equipe enfrenta.
 *
 * Princípios que o conteúdo obedece, e que devem ser mantidos ao editar:
 *
 * 1. Nenhuma opção é a resposta certa. Toda opção resolve um problema e cria
 *    outro. Se ao ler as opções ficar óbvio qual escolher, a carta está ruim.
 * 2. Nada de pergunta escolar. A carta descreve uma situação da propriedade,
 *    não um enunciado de prova.
 * 3. Toda tecnologia tem requisito. Comprar equipamento sem capacitação gera
 *    `idleTech`: tecnologia parada, que só vira produção depois do treinamento.
 * 4. `roleHints` distribui informação por função. Cada jogador vê apenas a
 *    dica da sua função, então a equipe precisa conversar em voz alta.
 * 5. Valores são fictícios e existem para pesar dentro do orçamento do jogo.
 *
 * Como editar: acrescente ou troque cartas dentro do array da fase. O sorteio
 * é determinístico por equipe, então basta manter pelo menos 2 cartas por fase
 * para que equipes diferentes vivam situações diferentes.
 */

const PREPARACAO: GameEventCard[] = [
  {
    key: 'prep-irrigacao',
    phase: 'preparacao',
    title: 'Uma proposta de irrigação chegou na porteira',
    narrative:
      'Um vendedor passou no núcleo rural oferecendo irrigação por gotejamento com controle automático por R$ 20.000. Ele garante que a água vai render mais e a produção fica estável mesmo em setembro seco. O sistema chega instalado, mas a programação e a manutenção ficam por conta da família.',
    options: [
      {
        key: 'a',
        label: 'Comprar à vista',
        detail: 'Paga R$ 20.000 do caixa agora e instala nesta semana.',
        displayCost: 20000,
        effects: {
          cash: -20000,
          technology: 14,
          productionIfTrained: 12,
          traits: { irrigation: true, opportunitiesTaken: 1 },
        },
        tags: ['tech_invest', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Financiar em parcelas',
        detail: 'Entrada de R$ 4.000 e parcela fixa descontada ao fim de cada rodada.',
        displayCost: 4000,
        effects: {
          cash: -4000,
          technology: 14,
          productionIfTrained: 12,
          traits: {
            irrigation: true,
            debtInstallments: 4,
            debtPerRound: 4800,
            opportunitiesTaken: 1,
          },
        },
        tags: ['tech_invest', 'credit'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Adiar a decisão',
        detail: 'Segura o dinheiro e observa como a safra se comporta primeiro.',
        displayCost: 0,
        effects: { sustainability: -3 },
        risk: {
          chance: 0.5,
          bonus: { cash: 2000 },
          penalty: { production: -6 },
          bonusNote: 'A chuva veio bem distribuída: dava para esperar mesmo.',
          penaltyNote: 'Duas semanas sem chuva castigaram o canteiro no pé.',
        },
        tags: ['cash_conservative', 'tech_avoid'],
      },
      {
        key: 'd',
        label: 'Procurar assistência técnica antes',
        detail: 'Chama a Emater-DF para avaliar se a irrigação faz sentido nesta área.',
        displayCost: 2500,
        effects: {
          cash: -2500,
          technology: 4,
          sustainability: 5,
          traits: { trained: true },
        },
        tags: ['training', 'public_policy', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'e',
        label: 'Investir em preparo de solo',
        detail: 'Aplica R$ 9.000 em correção de solo e cobertura verde.',
        displayCost: 9000,
        effects: { cash: -9000, production: 8, sustainability: 10 },
        tags: ['sustainability', 'production_first'],
        requiresCash: true,
      },
    ],
    roleHints: {
      tecnologia:
        'O sistema é bom, mas exige programação semanal. Sem alguém treinado, ele irriga na hora errada e a água se perde.',
      financeiro:
        'R$ 20.000 é um quarto do orçamento da safra. À vista, sobra pouco para imprevisto na rodada do desafio.',
      produtor:
        'A área sofre mais na estiagem de setembro. Com água controlada, a perda cai bastante.',
      comercializacao:
        'Comprador institucional cobra regularidade. Produção instável derruba contrato.',
      politicas:
        'A Emater-DF presta assistência técnica no DF. Existe caminho para avaliar a tecnologia antes de comprar.',
    },
    debriefPrompt:
      'Quem comprou a irrigação sem capacitação teve o ganho que esperava? Por que a mesma máquina rende diferente em propriedades diferentes?',
  },
  {
    key: 'prep-agua',
    phase: 'preparacao',
    title: 'O poço não dá conta da safra inteira',
    narrative:
      'A vazão do poço caiu em relação ao ano passado. Do jeito que está, a água atende a casa e metade da área plantada. Um vizinho ofereceu sociedade em um reservatório coletivo; um perfurador ofereceu poço novo à vista.',
    options: [
      {
        key: 'a',
        label: 'Reservatório coletivo com o vizinho',
        detail: 'Divide R$ 11.000 do custo e o uso da água com a propriedade ao lado.',
        displayCost: 11000,
        effects: {
          cash: -11000,
          production: 7,
          sustainability: 12,
          traits: { inCooperative: true, opportunitiesTaken: 1 },
        },
        tags: ['cooperation', 'sustainability', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Poço novo, só seu',
        detail: 'Paga R$ 26.000 e resolve sozinho, sem depender de acordo.',
        displayCost: 26000,
        effects: { cash: -26000, production: 12, technology: 6, sustainability: -8 },
        tags: ['production_first', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Plantar só metade da área',
        detail: 'Reduz a lavoura ao que a água atual sustenta com folga.',
        displayCost: 0,
        effects: { production: -10, sustainability: 6, cash: 3000 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'd',
        label: 'Captação de água de chuva',
        detail: 'R$ 7.000 em calhas, cisterna e canalização do galpão.',
        displayCost: 7000,
        effects: { cash: -7000, production: 4, sustainability: 14, technology: 3 },
        tags: ['sustainability', 'tech_invest'],
        requiresCash: true,
      },
    ],
    roleHints: {
      produtor:
        'Plantar a área toda sem água garantida é perder o que já foi plantado no meio do ciclo.',
      financeiro:
        'O reservatório coletivo custa menos da metade do poço novo. A diferença cobre um imprevisto adiante.',
      tecnologia:
        'Cisterna de chuva funciona bem no DF entre novembro e março, mas não resolve setembro.',
      politicas:
        'Uso de recurso hídrico tem regra e outorga. Solução coletiva costuma ter apoio técnico.',
      comercializacao:
        'Reduzir área agora significa menos volume para negociar na rodada de mercado.',
    },
    debriefPrompt:
      'Quem dividiu estrutura com o vizinho saiu na frente ou atrás? O que pesa mais: autonomia total ou custo dividido?',
  },
  {
    key: 'prep-semente',
    phase: 'preparacao',
    title: 'Duas propostas de semente e insumo na mesa',
    narrative:
      'A loja da cidade oferece pacote convencional com adubo químico e semente comum, pronto para plantar. Um técnico agroecológico oferece manejo com adubação orgânica e consórcio de culturas: mais trabalho no começo, solo melhor no fim.',
    options: [
      {
        key: 'a',
        label: 'Pacote convencional completo',
        detail: 'R$ 12.000 em semente e adubo, resultado rápido e previsível.',
        displayCost: 12000,
        effects: { cash: -12000, production: 14, sustainability: -12 },
        tags: ['production_first', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Manejo agroecológico',
        detail: 'R$ 9.000 em composto, consórcio e mais mão de obra da família.',
        displayCost: 9000,
        effects: { cash: -9000, production: 5, sustainability: 16 },
        risk: {
          chance: 0.55,
          bonus: { production: 7, cash: 3500 },
          penalty: { production: -4 },
          bonusNote: 'O produto sem agrotóxico virou diferencial na feira e saiu com preço melhor.',
          penaltyNote: 'A transição pediu mais tempo do que a família tinha: parte do canteiro rendeu menos.',
        },
        tags: ['sustainability', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Misturar as duas coisas',
        detail: 'R$ 10.000: convencional na área principal, orgânico em um lote de teste.',
        displayCost: 10000,
        effects: { cash: -10000, production: 9, sustainability: 2, technology: 2 },
        tags: ['risk_low', 'production_first'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Usar semente guardada da safra passada',
        detail: 'Gasta R$ 3.000 só no essencial e aceita o risco de germinação irregular.',
        displayCost: 3000,
        effects: { cash: -3000, sustainability: 4 },
        risk: {
          chance: 0.4,
          bonus: { production: 6 },
          penalty: { production: -12 },
          bonusNote: 'A semente guardada germinou bem: economia sem prejuízo.',
          penaltyNote: 'Germinação falhou em parte da área e o replantio atrasou o ciclo.',
        },
        tags: ['cash_conservative', 'risk_high'],
        requiresCash: true,
      },
    ],
    roleHints: {
      produtor:
        'O pacote convencional entrega volume nesta safra. O manejo orgânico paga melhor a partir da segunda.',
      financeiro:
        'A diferença entre as opções é pequena no caixa agora e grande no resultado do fim.',
      comercializacao:
        'Existe público em Brasília pagando mais por produto sem agrotóxico, mas exige constância na feira.',
      tecnologia:
        'Consórcio de culturas exige planejamento e registro do que foi plantado onde.',
      politicas:
        'Programas de compra institucional costumam valorizar produção da agricultura familiar organizada.',
    },
    debriefPrompt:
      'A escolha do insumo apareceu como decisão técnica ou financeira para o grupo? Quem decidiu pensando na safra seguinte?',
  },
];

const PRODUCAO: GameEventCard[] = [
  {
    key: 'prod-custo',
    phase: 'producao',
    title: 'O custo de produção subiu no meio do ciclo',
    narrative:
      'Adubo, combustível e embalagem subiram de uma semana para outra. A conta da safra que estava fechada agora tem um buraco de aproximadamente R$ 9.000 até a colheita.',
    options: [
      {
        key: 'a',
        label: 'Absorver o aumento e manter o plano',
        detail: 'Paga a diferença do caixa e segue com a área toda plantada.',
        displayCost: 9000,
        effects: { cash: -9000, production: 3 },
        tags: ['production_first', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Cortar insumo e reduzir o manejo',
        detail: 'Economiza agora e aceita produção menor na colheita.',
        displayCost: 0,
        effects: { production: -11, sustainability: -4, cash: 1500 },
        tags: ['cash_conservative'],
      },
      {
        key: 'c',
        label: 'Comprar em grupo com outros produtores',
        detail: 'Junta o pedido com vizinhos e negocia preço de atacado por R$ 6.000.',
        displayCost: 6000,
        effects: {
          cash: -6000,
          production: 4,
          traits: { inCooperative: true, opportunitiesTaken: 1 },
        },
        tags: ['cooperation', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Buscar crédito de custeio',
        detail: 'Financia o custeio da safra e paga em parcela fixa por rodada.',
        displayCost: 0,
        effects: {
          production: 5,
          traits: { debtInstallments: 3, debtPerRound: 3600 },
        },
        tags: ['credit', 'risk_high'],
      },
    ],
    roleHints: {
      financeiro:
        'Cortar insumo economiza R$ 9.000 agora e custa mais que isso em produto que não vai existir.',
      produtor:
        'Reduzir manejo no meio do ciclo aparece na colheita: fruto menor e mais descarte.',
      comercializacao:
        'Compra coletiva melhora o preço do insumo, mas o pedido tem prazo e não espera reunião longa.',
      tecnologia:
        'Com gestão de custo registrada, dava para saber exatamente onde o aumento pesa mais.',
      politicas:
        'Existe linha de crédito de custeio para agricultura familiar, com regra própria definida em norma oficial.',
    },
    debriefPrompt:
      'Quem cortou insumo para salvar o caixa? O que aconteceu com a produção dessa equipe duas rodadas depois?',
  },
  {
    key: 'prod-capacitacao',
    phase: 'producao',
    title: 'Curso de capacitação na sede do núcleo rural',
    narrative:
      'Foi aberta uma turma de capacitação em manejo e uso de tecnologia na produção. São duas manhãs de aula, o que significa duas manhãs fora da lavoura, mais R$ 1.800 de inscrição e deslocamento.',
    options: [
      {
        key: 'a',
        label: 'A família inteira participa',
        detail: 'Todos vão, a propriedade para por duas manhãs.',
        displayCost: 1800,
        effects: {
          cash: -1800,
          production: -3,
          technology: 8,
          traits: { trained: true, opportunitiesTaken: 1 },
        },
        tags: ['training', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Mandar uma pessoa só',
        detail: 'Um integrante assiste e repassa o conteúdo depois, do jeito que der.',
        displayCost: 900,
        effects: {
          cash: -900,
          technology: 5,
          traits: { trained: true },
        },
        risk: {
          chance: 0.6,
          bonus: { production: 4 },
          penalty: { technology: -3 },
          bonusNote: 'O repasse funcionou: a prática mudou na semana seguinte.',
          penaltyNote: 'O conteúdo ficou na cabeça de uma pessoa só e pouca coisa mudou na rotina.',
        },
        tags: ['training', 'cash_conservative'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Não ir: a lavoura não pode parar',
        detail: 'Mantém todos na produção e deixa o curso para o ano que vem.',
        displayCost: 0,
        effects: { production: 6 },
        tags: ['production_first', 'tech_avoid'],
      },
      {
        key: 'd',
        label: 'Pedir acompanhamento técnico na propriedade',
        detail: 'R$ 3.200 para o técnico vir até a área, sem ninguém sair de casa.',
        displayCost: 3200,
        effects: {
          cash: -3200,
          technology: 6,
          production: 3,
          sustainability: 4,
          traits: { trained: true, opportunitiesTaken: 1 },
        },
        tags: ['training', 'public_policy'],
        requiresCash: true,
      },
    ],
    roleHints: {
      tecnologia:
        'Sem capacitação, todo equipamento comprado até agora está rendendo menos do que poderia.',
      produtor:
        'Duas manhãs fora custam trabalho, mas a época ainda permite recuperar.',
      financeiro:
        'É o gasto mais barato da rodada e o único que muda o retorno de tudo que já foi comprado.',
      politicas:
        'A Emater-DF atua com assistência técnica e extensão rural no DF, inclusive na propriedade.',
      comercializacao:
        'Comprador institucional pede padrão de qualidade, e padrão vem de manejo aprendido.',
    },
    debriefPrompt:
      'Capacitação pareceu gasto ou investimento para o grupo? Quem tinha tecnologia parada e resolveu treinar?',
  },
  {
    key: 'prod-praga',
    phase: 'producao',
    title: 'Apareceu praga em uma parte da lavoura',
    narrative:
      'Manchas e folhas atacadas surgiram em cerca de um quinto da área. Se nada for feito, a praga caminha para o resto. Existe defensivo forte, existe manejo biológico e existe a opção de arrancar a parte afetada.',
    options: [
      {
        key: 'a',
        label: 'Aplicar defensivo químico agora',
        detail: 'R$ 4.500 e resolve rápido, com carência antes da colheita.',
        displayCost: 4500,
        effects: { cash: -4500, production: 8, sustainability: -13 },
        tags: ['production_first', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Controle biológico',
        detail: 'R$ 6.500 em manejo biológico, mais lento e sem resíduo.',
        displayCost: 6500,
        effects: { cash: -6500, sustainability: 10 },
        risk: {
          chance: 0.55,
          bonus: { production: 7 },
          penalty: { production: -9 },
          bonusNote: 'O controle pegou no tempo certo e a lavoura se recuperou.',
          penaltyNote: 'O método demorou e a praga avançou antes de ser contida.',
        },
        tags: ['sustainability', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Arrancar a parte afetada',
        detail: 'Perde a área doente de imediato e protege o resto sem gastar.',
        displayCost: 0,
        effects: { production: -8, sustainability: 3 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'd',
        label: 'Chamar o técnico antes de aplicar qualquer coisa',
        detail: 'R$ 2.000 para identificar a praga certa antes de comprar produto.',
        displayCost: 2000,
        effects: {
          cash: -2000,
          production: 4,
          sustainability: 6,
          technology: 3,
          traits: { trained: true },
        },
        tags: ['training', 'risk_low'],
        requiresCash: true,
      },
    ],
    roleHints: {
      produtor:
        'Um quinto da área ainda é recuperável. Em uma semana, deixa de ser.',
      tecnologia:
        'Aplicar produto sem identificar a praga é chute caro: pode não atingir o alvo.',
      financeiro:
        'O defensivo é mais barato que o manejo biológico agora e mais caro se o comprador exigir produto sem resíduo.',
      comercializacao:
        'Parte dos compradores de Brasília pergunta sobre agrotóxico e resíduo.',
      politicas:
        'Assistência técnica pública inclui identificação e recomendação de manejo.',
    },
    debriefPrompt:
      'Diante da urgência, o grupo priorizou velocidade ou consequência? Quem parou para diagnosticar antes de gastar?',
  },
];

const MERCADO: GameEventCard[] = [
  {
    key: 'merc-institucional',
    phase: 'mercado',
    title: 'Chamada pública para entregar alimento a instituições',
    narrative:
      'Saiu uma chamada pública de compra da agricultura familiar. A venda é garantida e o preço é estável, mas exige documentação em ordem, organização da produção e entrega em dia certo, toda semana, sem falha.',
    options: [
      {
        key: 'a',
        label: 'Entrar na chamada pública',
        detail: 'R$ 3.000 em documentação, adequação e embalagem para participar.',
        displayCost: 3000,
        effects: {
          cash: -3000,
          production: 5,
          sustainability: 4,
          traits: { inPublicProgram: true, opportunitiesTaken: 1 },
        },
        tags: ['public_policy', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Vender ao atravessador, como sempre',
        detail: 'Ele busca na porta, paga menos e resolve tudo no mesmo dia.',
        displayCost: 0,
        effects: { cash: 7000, production: 2, sustainability: -3 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'c',
        label: 'Montar banca na feira do produtor',
        detail: 'R$ 2.500 em estrutura e transporte, com preço cheio no varejo.',
        displayCost: 2500,
        effects: { cash: -2500, technology: 2 },
        risk: {
          chance: 0.5,
          bonus: { cash: 14000 },
          penalty: { cash: 2000, production: -3 },
          bonusNote: 'Feira cheia e produto vendido no preço de varejo: a melhor receita da safra.',
          penaltyNote: 'Sábado chuvoso, movimento fraco: sobrou produto na caixa.',
        },
        tags: ['market_direct', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Dividir: metade instituição, metade feira',
        detail: 'R$ 4.000 para atender os dois canais com volume menor em cada.',
        displayCost: 4000,
        effects: {
          cash: 5000, // paga R$ 4.000 de adequação e recebe pelos dois canais
          production: 3,
          traits: { inPublicProgram: true, opportunitiesTaken: 1 },
        },
        tags: ['public_policy', 'market_direct', 'risk_low'],
        requiresCash: true,
      },
    ],
    roleHints: {
      politicas:
        'PAA, PNAE e PAPA-DF são caminhos de compra institucional da agricultura familiar. As regras estão em normas oficiais.',
      comercializacao:
        'Atravessador paga menos, mas paga hoje. Chamada pública paga melhor e exige prazo e constância.',
      financeiro:
        'O atravessador é a única opção que entra dinheiro nesta rodada em vez de sair.',
      produtor:
        'Entrega semanal fixa exige planejar plantio escalonado, não colher tudo de uma vez.',
      tecnologia:
        'Entrega institucional pede controle de lote e registro. Sem gestão, o erro de entrega aparece rápido.',
    },
    debriefPrompt:
      'Quantas equipes buscaram política pública e quantas ficaram no atravessador? O que pesou na escolha: preço, prazo ou burocracia?',
  },
  {
    key: 'merc-cooperativa',
    phase: 'mercado',
    title: 'A cooperativa da região fez uma proposta',
    narrative:
      'A cooperativa local propõe reunir a produção de vários sítios, cuidar do transporte e negociar em bloco. Fica mais fácil chegar a comprador grande. Em troca, cobra taxa por unidade e as decisões de venda passam a ser coletivas.',
    options: [
      {
        key: 'a',
        label: 'Entrar na cooperativa',
        detail: 'R$ 2.000 de cota de participação e taxa sobre o que for vendido.',
        displayCost: 2000,
        effects: {
          cash: 3000, // paga a cota e recebe a venda em bloco, líquida da taxa
          production: 4,
          technology: 3,
          traits: { inCooperative: true, opportunitiesTaken: 1 },
        },
        tags: ['cooperation', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Continuar vendendo sozinho',
        detail: 'Mantém a margem inteira e o risco inteiro.',
        displayCost: 0,
        effects: { cash: 4000 },
        risk: {
          chance: 0.45,
          bonus: { cash: 8000 },
          penalty: { cash: -6000, production: -3 },
          bonusNote: 'Preço firme na semana da entrega: vender sozinho rendeu mais.',
          penaltyNote: 'Preço caiu na semana da colheita e não havia com quem negociar em bloco.',
        },
        tags: ['market_direct', 'risk_high'],
      },
      {
        key: 'c',
        label: 'Entrar só na logística compartilhada',
        detail: 'R$ 1.200 para usar o transporte coletivo, sem entrar na venda em bloco.',
        displayCost: 1200,
        effects: {
          cash: 1300, // paga o rateio do transporte e economiza o frete próprio
          production: 2,
          sustainability: 4,
          traits: { opportunitiesTaken: 1 },
        },
        tags: ['cooperation', 'cash_conservative'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Investir em transporte próprio',
        detail: 'R$ 22.000 em veículo usado com caixa isotérmica.',
        displayCost: 22000,
        effects: { cash: -22000, technology: 10, production: 6 },
        tags: ['tech_invest', 'market_direct', 'risk_high'],
        requiresCash: true,
      },
    ],
    roleHints: {
      comercializacao:
        'Sozinho, você negocia com o preço do dia. Em bloco, negocia com volume e contrato.',
      financeiro:
        'A cota é baixa, mas a taxa por unidade acompanha toda venda futura.',
      produtor:
        'Transporte coletivo tira o frete das suas costas e libera tempo na lavoura.',
      politicas:
        'Organização coletiva costuma facilitar acesso a chamadas públicas e a assistência.',
      tecnologia:
        'Veículo próprio exige manutenção, combustível e volume que justifique o investimento.',
    },
    debriefPrompt:
      'O grupo enxergou a cooperativa como perda de autonomia ou ganho de força? O que a decisão diz sobre confiar no coletivo?',
  },
  {
    key: 'merc-preco',
    phase: 'mercado',
    title: 'O preço caiu justo na semana da entrega',
    narrative:
      'Muita gente colheu ao mesmo tempo e o preço no atacado despencou. Vender agora é vender barato. Segurar exige onde guardar, e a maior parte do produto é perecível.',
    options: [
      {
        key: 'a',
        label: 'Vender tudo no preço de hoje',
        detail: 'Recebe menos, mas não perde nada por deterioração.',
        displayCost: 0,
        effects: { cash: 5000, production: -2 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'b',
        label: 'Alugar câmara fria e esperar o preço',
        detail: 'R$ 5.500 de aluguel para segurar o produto por duas semanas.',
        displayCost: 5500,
        effects: { cash: -5500, technology: 4, traits: { storage: true } },
        risk: {
          chance: 0.55,
          bonus: { cash: 17000 },
          penalty: { cash: 2000, production: -6 },
          bonusNote: 'O preço subiu na semana seguinte e o lote saiu quase no dobro.',
          penaltyNote: 'O preço não reagiu e parte do lote perdeu qualidade no armazenamento.',
        },
        tags: ['tech_invest', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Processar e agregar valor',
        detail: 'R$ 4.000 em beneficiamento simples: polpa, conserva, produto minimamente processado.',
        displayCost: 4000,
        effects: { cash: 5000, technology: 5, sustainability: 5 },
        tags: ['market_direct', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Doar o excedente e registrar a perda',
        detail: 'Evita o desperdício, ganha relação na comunidade e não recupera o custo.',
        displayCost: 0,
        effects: { cash: -1000, sustainability: 8, production: -4 },
        tags: ['sustainability', 'risk_low'],
      },
    ],
    roleHints: {
      comercializacao:
        'Excesso de oferta derruba preço. Quem tem contrato fixo não sente essa queda.',
      financeiro:
        'Segurar produto custa aluguel e não garante que o preço reaja.',
      tecnologia:
        'Câmara fria só entrega resultado com energia contínua e higiene rigorosa.',
      produtor:
        'A maior parte do que está na caixa aguenta poucos dias fora do frio.',
      politicas:
        'Contrato de compra institucional protege exatamente contra a oscilação de preço do atacado.',
    },
    debriefPrompt:
      'Quem estava em programa público sentiu menos a queda de preço? Por que preço garantido muda o risco do negócio?',
  },
];

const DESAFIO: GameEventCard[] = [
  {
    key: 'des-maquina',
    phase: 'desafio',
    title: 'O trator quebrou no pior dia possível',
    narrative:
      'O trator parou com problema no sistema hidráulico, em plena semana de operação. O mecânico da região cobra R$ 8.000 e leva quatro dias. Existe trator para alugar, existe conserto improvisado e existe a opção de trocar por um equipamento mais novo, financiado.',
    options: [
      {
        key: 'a',
        label: 'Consertar direito, com o mecânico',
        detail: 'R$ 8.000 e quatro dias parado, mas resolvido de verdade.',
        displayCost: 8000,
        effects: { cash: -8000, technology: 3, production: -3 },
        tags: ['risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Alugar trator por duas semanas',
        detail: 'R$ 5.000 de aluguel: mantém a operação e adia o conserto.',
        displayCost: 5000,
        effects: { cash: -5000, production: 4 },
        risk: {
          chance: 0.5,
          bonus: { cash: 1500 },
          penalty: { cash: -4000, technology: -4 },
          bonusNote: 'O aluguel cobriu a janela e o conserto ficou para a entressafra, mais barato.',
          penaltyNote: 'O problema piorou com o trator parado e o reparo saiu mais caro depois.',
        },
        tags: ['cash_conservative', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Improvisar o reparo em casa',
        detail: 'R$ 1.500 em peça de ferro-velho e a mão de obra da família.',
        displayCost: 1500,
        effects: { cash: -1500 },
        risk: {
          chance: 0.35,
          bonus: { production: 3 },
          penalty: { production: -10, technology: -6 },
          bonusNote: 'O improviso pegou e aguentou a safra inteira.',
          penaltyNote: 'O reparo cedeu em uma semana e a operação parou de novo, agora na colheita.',
        },
        tags: ['cash_conservative', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Financiar um trator mais novo',
        detail: 'Entrada de R$ 6.000 e parcela fixa por rodada, com equipamento sob garantia.',
        displayCost: 6000,
        effects: {
          cash: -6000,
          technology: 12,
          production: 6,
          traits: { debtInstallments: 3, debtPerRound: 5200, opportunitiesTaken: 1 },
        },
        tags: ['tech_invest', 'credit', 'risk_high'],
        requiresCash: true,
      },
    ],
    roleHints: {
      tecnologia:
        'Improviso em sistema hidráulico costuma voltar a falhar sob carga.',
      financeiro:
        'A parcela do trator novo aparece em todas as rodadas seguintes, inclusive na colheita.',
      produtor:
        'Quatro dias parado nesta semana atrasa a operação inteira do ciclo.',
      comercializacao:
        'Atraso na operação empurra a colheita para a semana de preço pior.',
      politicas:
        'Existe linha de crédito de investimento para máquina na agricultura familiar, com regra oficial própria.',
    },
    debriefPrompt:
      'A equipe escolheu o barato agora ou o resolvido de vez? Como a falta de caixa mudou o que era possível decidir?',
  },
  {
    key: 'des-estiagem',
    phase: 'desafio',
    title: 'Quinze dias sem chuva e o solo rachando',
    narrative:
      'A estiagem chegou mais forte do que o previsto. A lavoura mostra sinal de estresse e o que estava planejado para a colheita começa a encolher no pé, dia após dia.',
    options: [
      {
        key: 'a',
        label: 'Irrigar no limite da capacidade',
        detail: 'R$ 3.500 de energia e combustível para manter a água ligada.',
        displayCost: 3500,
        effects: { cash: -3500, production: 6, sustainability: -6 },
        tags: ['production_first', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Cobertura morta e sombreamento de emergência',
        detail: 'R$ 2.800 em palhada e tela para reduzir a evaporação.',
        displayCost: 2800,
        effects: { cash: -2800, production: 3, sustainability: 9 },
        tags: ['sustainability', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Comprar água de caminhão-pipa',
        detail: 'R$ 7.000 para atravessar a estiagem sem perder área.',
        displayCost: 7000,
        effects: { cash: -7000, production: 9, sustainability: -4 },
        tags: ['production_first', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Aceitar a perda e salvar o que der',
        detail: 'Concentra o esforço na melhor parte da área e abandona o resto.',
        displayCost: 0,
        effects: { production: -13, cash: 2500, sustainability: 2 },
        tags: ['cash_conservative', 'risk_low'],
      },
    ],
    roleHints: {
      produtor:
        'Cada dia sem água nesta fase custa produto que não volta mais.',
      tecnologia:
        'Quem tem irrigação instalada e regulada perde muito menos nesta situação.',
      financeiro:
        'Caminhão-pipa é a opção mais cara e a que mais salva volume. Veja o que sobrou no caixa.',
      politicas:
        'Situações de estiagem envolvem orientação técnica e, em alguns casos, medidas de apoio previstas em norma.',
      comercializacao:
        'Quebra de safra com contrato assinado gera multa ou perda do comprador.',
    },
    debriefPrompt:
      'As equipes que investiram em água na rodada 1 sofreram menos aqui? Que decisão antiga apareceu como consequência agora?',
  },
  {
    key: 'des-energia',
    phase: 'desafio',
    title: 'A energia caiu e o resfriamento parou',
    narrative:
      'Uma queda de energia deixou a propriedade sem eletricidade por horas. O que depende de frio ou de bomba parou junto. A concessionária não dá previsão exata de retorno.',
    options: [
      {
        key: 'a',
        label: 'Comprar gerador',
        detail: 'R$ 9.500 em gerador que resolve esta e as próximas quedas.',
        displayCost: 9500,
        effects: { cash: -9500, technology: 8, production: 4, sustainability: -4 },
        tags: ['tech_invest', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Alugar gerador só por hoje',
        detail: 'R$ 2.200 e resolve a emergência, sem resolver o problema.',
        displayCost: 2200,
        effects: { cash: -2200, production: 2 },
        risk: {
          chance: 0.5,
          bonus: { cash: 1000 },
          penalty: { production: -7 },
          bonusNote: 'A energia voltou rápido: o aluguel foi suficiente.',
          penaltyNote: 'A queda se repetiu na semana seguinte e o prejuízo veio dobrado.',
        },
        tags: ['cash_conservative', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Vender às pressas o que ia estragar',
        detail: 'Escoa o produto no preço que aparecer, sem negociar.',
        displayCost: 0,
        effects: { cash: 3000, production: -6, sustainability: -3 },
        tags: ['market_direct', 'risk_low'],
      },
      {
        key: 'd',
        label: 'Instalar energia solar com financiamento',
        detail: 'Entrada de R$ 5.000, parcela por rodada e independência da rede.',
        displayCost: 5000,
        effects: {
          cash: -5000,
          technology: 12,
          sustainability: 12,
          traits: { debtInstallments: 4, debtPerRound: 3400, opportunitiesTaken: 1 },
        },
        tags: ['tech_invest', 'credit', 'sustainability'],
        requiresCash: true,
      },
    ],
    roleHints: {
      tecnologia:
        'Tudo o que é automatizado depende de energia. Sem backup, a automação vira risco concentrado.',
      financeiro:
        'Aluguel é o mais barato hoje. Se a queda repetir, é o mais caro da safra.',
      produtor:
        'Produto perecível fora do frio tem prazo contado em horas, não em dias.',
      politicas:
        'Energia em área rural e alternativas de geração aparecem em programas de apoio e assistência técnica.',
      comercializacao:
        'Vender às pressas é aceitar o preço de quem sabe que você está apertado.',
    },
    debriefPrompt:
      'Quem tinha mais tecnologia sofreu mais com a falta de infraestrutura? O que isso diz sobre adotar tecnologia sem base pronta?',
  },
];

const COLHEITA: GameEventCard[] = [
  {
    key: 'colh-logistica',
    phase: 'colheita',
    title: 'A safra está no ponto e precisa sair da propriedade',
    narrative:
      'Tudo maduro ao mesmo tempo. Agora é tirar da área, embalar e entregar antes de perder qualidade. Cada caminho de escoamento cobra o seu preço e entrega um resultado diferente.',
    options: [
      {
        key: 'a',
        label: 'Contratar mão de obra extra para colher rápido',
        detail: 'R$ 6.000 em diárias para colher tudo no ponto certo.',
        displayCost: 6000,
        effects: { cash: 10000, production: 8 },
        tags: ['production_first', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Colher com a família, no ritmo possível',
        detail: 'Não gasta com diária e aceita perder parte do que amadurece antes.',
        displayCost: 0,
        effects: { cash: 9000, production: -5 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'c',
        label: 'Entregar pela cooperativa ou pelo programa público',
        detail: 'R$ 2.000 em embalagem e transporte compartilhado, com escoamento garantido.',
        displayCost: 2000,
        effects: {
          cash: 13000, // paga embalagem e transporte e recebe o escoamento garantido
          sustainability: 5,
          traits: { opportunitiesTaken: 1 },
        },
        tags: ['cooperation', 'public_policy', 'risk_low'],
        requiresCash: true,
        requiresTraits: ['inCooperative'],
      },
      {
        key: 'd',
        label: 'Beneficiar antes de vender',
        detail: 'R$ 5.000 em lavagem, seleção e embalagem para vender com valor agregado.',
        displayCost: 5000,
        effects: { cash: 14000, technology: 5, production: 3 },
        risk: {
          chance: 0.6,
          bonus: { cash: 6000 },
          penalty: { cash: -3000 },
          bonusNote: 'O produto selecionado abriu porta em comprador que paga melhor.',
          penaltyNote: 'O beneficiamento atrasou a entrega e parte do lote foi desclassificada.',
        },
        tags: ['market_direct', 'risk_high'],
        requiresCash: true,
      },
    ],
    roleHints: {
      produtor:
        'Colheita fora do ponto derruba qualidade e preço, mesmo com volume alto.',
      financeiro:
        'Esta é a rodada em que o dinheiro entra. Veja quanto ainda há para investir na saída.',
      comercializacao:
        'Produto selecionado e embalado alcança comprador que o produto solto não alcança.',
      tecnologia:
        'Quem tem armazenamento pode escalonar a saída em vez de vender tudo no mesmo dia.',
      politicas:
        'Quem já está em programa público tem entrega e preço definidos para esta colheita.',
    },
    debriefPrompt:
      'O caminho de escoamento escolhido dependia de decisões tomadas nas rodadas anteriores. Quais equipes já tinham construído esse caminho?',
  },
  {
    key: 'colh-proxima',
    phase: 'colheita',
    title: 'Fechar a safra e decidir o próximo ciclo',
    narrative:
      'A safra terminou e o dinheiro está na mão. Agora vem a decisão que ninguém vê: o que fazer com o resultado. Guardar, reinvestir, quitar o que está pendente ou preparar o terreno para o ano que vem.',
    options: [
      {
        key: 'a',
        label: 'Guardar o resultado como reserva',
        detail: 'Nenhum investimento novo: caixa reforçado para o próximo ciclo.',
        displayCost: 0,
        effects: { cash: 6000, production: -2 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'b',
        label: 'Reinvestir em tecnologia para a próxima safra',
        detail: 'R$ 12.000 em equipamento e adequação da estrutura.',
        displayCost: 12000,
        effects: { cash: -12000, technology: 14, productionIfTrained: 8 },
        tags: ['tech_invest', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'c',
        label: 'Quitar dívida e limpar o nome',
        detail: 'Antecipa as parcelas em aberto e zera o compromisso.',
        displayCost: 0,
        effects: { traits: { debtInstallments: 0, debtPerRound: 0 }, sustainability: 3 },
        tags: ['cash_conservative', 'risk_low'],
        requiresTraits: ['debtInstallments'],
      },
      {
        key: 'd',
        label: 'Recuperar solo e área de preservação',
        detail: 'R$ 8.000 em recomposição de área, cobertura e proteção de nascente.',
        displayCost: 8000,
        effects: { cash: -8000, sustainability: 18, production: 3 },
        tags: ['sustainability', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'e',
        label: 'Capacitar a família com o que sobrou',
        detail: 'R$ 4.000 em curso técnico e viagem de intercâmbio entre produtores.',
        displayCost: 4000,
        effects: {
          cash: -4000,
          technology: 7,
          production: 4,
          traits: { trained: true, opportunitiesTaken: 1 },
        },
        tags: ['training', 'cooperation'],
        requiresCash: true,
      },
    ],
    roleHints: {
      financeiro:
        'Dívida em aberto continua descontando enquanto existir. Quitar libera as rodadas seguintes.',
      tecnologia:
        'Tecnologia comprada agora só rende na próxima safra, e só com capacitação junto.',
      produtor:
        'Solo recuperado é a única coisa desta lista que melhora sozinha com o tempo.',
      politicas:
        'Capacitação e intercâmbio entre produtores costumam integrar ações de extensão rural.',
      comercializacao:
        'Reserva em caixa é o que permite recusar o primeiro comprador na safra seguinte.',
    },
    debriefPrompt:
      'Com dinheiro na mão, o grupo escolheu segurança, tecnologia, dívida ou solo? O que essa escolha revela sobre como enxergam o futuro da propriedade?',
  },
  {
    key: 'colh-oportunidade',
    phase: 'colheita',
    title: 'Um comprador grande apareceu de última hora',
    narrative:
      'Uma rede de restaurantes de Brasília quer fornecimento semanal, com volume alto e pagamento em trinta dias. É a melhor receita já oferecida na safra. Também é o compromisso mais rígido: falta de entrega quebra o contrato.',
    options: [
      {
        key: 'a',
        label: 'Assinar o contrato de fornecimento',
        detail: 'R$ 4.500 em adequação de padrão e embalagem para atender a rede.',
        displayCost: 4500,
        effects: {
          cash: 17500, // paga a adequação e recebe o primeiro ciclo do contrato
          production: 6,
          technology: 4,
          traits: { opportunitiesTaken: 1 },
        },
        risk: {
          chance: 0.6,
          bonus: { cash: 8000 },
          penalty: { cash: -9000, production: -5 },
          bonusNote: 'A entrega saiu em dia e a rede ampliou o pedido.',
          penaltyNote: 'Uma semana de entrega falhou e o contrato foi cancelado com multa.',
        },
        tags: ['market_direct', 'risk_high'],
        requiresCash: true,
      },
      {
        key: 'b',
        label: 'Recusar e manter os canais atuais',
        detail: 'Fica com a venda que já conhece, no volume que dá conta.',
        displayCost: 0,
        effects: { cash: 11000, sustainability: 3 },
        tags: ['cash_conservative', 'risk_low'],
      },
      {
        key: 'c',
        label: 'Atender junto com outros produtores',
        detail: 'R$ 2.500 para dividir o contrato e o risco com vizinhos da região.',
        displayCost: 2500,
        effects: {
          cash: 13500, // paga o rateio e recebe a parte do contrato dividido
          production: 4,
          sustainability: 4,
          traits: { inCooperative: true, opportunitiesTaken: 1 },
        },
        tags: ['cooperation', 'risk_low'],
        requiresCash: true,
      },
      {
        key: 'd',
        label: 'Negociar volume menor e prazo mais curto',
        detail: 'Aceita parte do pedido, com pagamento em quinze dias.',
        displayCost: 0,
        effects: { cash: 13000, production: 2, technology: 2 },
        tags: ['market_direct', 'risk_low'],
      },
    ],
    roleHints: {
      comercializacao:
        'Pagamento em trinta dias significa entregar quatro semanas antes de receber.',
      financeiro:
        'Contrato grande com pagamento longo exige caixa para atravessar o período.',
      produtor:
        'Volume semanal fixo exige produção escalonada, não uma colheita única.',
      tecnologia:
        'Padrão de embalagem e rastreio do lote são exigência de comprador grande.',
      politicas:
        'Atender em grupo é o que permite ao pequeno produtor acessar comprador grande.',
    },
    debriefPrompt:
      'A oportunidade maior exigia estrutura que poucas equipes tinham. O que separa quem pôde aceitar de quem teve que recusar?',
  },
];

/** Cartas de evento por fase da rodada. */
export const EVENTS_BY_PHASE: Record<RoundPhase, GameEventCard[]> = {
  preparacao: PREPARACAO,
  producao: PRODUCAO,
  mercado: MERCADO,
  desafio: DESAFIO,
  colheita: COLHEITA,
};

export const ALL_EVENTS: GameEventCard[] = Object.values(EVENTS_BY_PHASE).flat();

export const EVENT_BY_KEY: Record<string, GameEventCard> = Object.fromEntries(
  ALL_EVENTS.map((event) => [event.key, event]),
);
