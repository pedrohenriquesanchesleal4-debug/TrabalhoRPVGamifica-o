import type {
  OficinaAcao,
  OficinaAcaoKey,
  OficinaCartao,
  OficinaEvento,
  OficinaLocal,
  OficinaPersonagem,
  OficinaPista,
  TagOficina,
} from '@/types/oficina';

/**
 * Conteúdo narrativo do modo Oficina Safra DF.
 *
 * A comunidade "Comunidade Boa Vista do Cerrado" é fictícia, inspirada nos
 * núcleos rurais do Distrito Federal. Nenhuma propriedade, pessoa ou número
 * citado aqui corresponde a alguém real.
 *
 * Regras de voz do arquivo: frases curtas, português oral e acolhedor, dignidade
 * do interior do cerrado, sem caricatura. Nunca "certo/errado", nunca
 * "estratégia ótima", nunca punir criatividade. Tecnologia ajuda, mas depende de
 * acesso, capacitação, infraestrutura, assistência e organização.
 */

export interface OficinaContent {
  locais: OficinaLocal[];
  personagens: OficinaPersonagem[];
  pistas: OficinaPista[];
  acoes: OficinaAcao[];
  eventos: OficinaEvento[];
  cartoes: OficinaCartao[];
  reflexao_perguntas: string[];
}

// ---------------------------------------------------------------------------
// Locais — 10 pontos da comunidade
// ---------------------------------------------------------------------------

const LOCAIS: OficinaLocal[] = [
  {
    id: 'propriedades',
    nome: 'Área de produção das famílias',
    tipo: 'producao',
    situacao:
      'Cerca de trinta famílias plantam hortaliça, mandioca e fruta em sítios pequenos, cada um cuidando do seu pedaço com as próprias mãos.',
    problema:
      'A produção é boa, mas cada família entrega do seu jeito — e muita caixa chega atrasada, amassada ou nem chega na banca.',
    personagem_id: 'rosa',
    pista_id: 'p1',
    acao_sugerida: 'investigar',
  },
  {
    id: 'cooperativa',
    nome: 'Cooperativa Boa Vista',
    tipo: 'organizacao',
    situacao:
      'Galpão com escritório, balança e uma câmara fria que trabalha de segunda a sexta.',
    problema:
      'A cooperativa reúne doze famílias, mas não consegue organizar a entrega de todo mundo: falta combinado, falta rota, falta gente.',
    personagem_id: 'antonio',
    pista_id: 'p2',
    acao_sugerida: 'conversar',
  },
  {
    id: 'feira',
    nome: 'Feira do Produtor de sábado de manhã',
    tipo: 'mercado',
    situacao:
      'Todo sábado, vinte bancas montam na praça do núcleo; o movimento bom dura até o meio-dia, quando o sol aperta.',
    problema:
      'Banca sobra em sábado chuvoso e a divulgação não sai do boca a boca — muita gente de Brasília nem sabe que a feira existe.',
    personagem_id: 'nestor',
    pista_id: 'p3',
    acao_sugerida: 'comercializacao',
  },
  {
    id: 'escola',
    nome: 'Escola Classe Boa Vista',
    tipo: 'servico',
    situacao:
      'Escola pública com 240 alunos, cozinha própria e merenda todos os dias letivos.',
    problema:
      'A merenda usa muita verdura vinda de longe, enquanto a verdura da comunidade passa na porta da escola a caminho da feira.',
    personagem_id: 'claudia',
    pista_id: 'p4',
    acao_sugerida: 'parceria',
  },
  {
    id: 'mercado',
    nome: 'Mercadinhos e quitandas do entorno',
    tipo: 'mercado',
    situacao:
      'Quatro mercadinhos e duas quitandas compram verdura toda semana em Sobradinho e Planaltina, com venda garantida.',
    problema:
      'Eles querem fornecedor fixo, com nota e horário; hoje compram de atravessador porque a comunidade não entrega com regularidade.',
    personagem_id: 'paula',
    pista_id: 'p5',
    acao_sugerida: 'comercializacao',
  },
  {
    id: 'estrada',
    nome: 'Estrada de acesso do núcleo',
    tipo: 'infraestrutura',
    situacao:
      'Seis quilômetros de terra entre o asfalto da BR e a sede da comunidade, com buraco que tem nome próprio.',
    problema:
      'Na chuva, a estrada vira lama e o horário da feira vira brincadeira: o que sai quatro da manhã chega nove, se chegar.',
    personagem_id: 'dija',
    pista_id: 'p6',
    acao_sugerida: 'transporte',
  },
  {
    id: 'atec',
    nome: 'Escritório da Emater-DF na região',
    tipo: 'servico',
    situacao:
      'A técnica Marina atende o núcleo uma vez por semana, com agenda aberta e o carro cheio de caderno e de lupa.',
    problema:
      'Pouca família chama: assistência gratuita existe, mas a comunidade ainda acha que "técnico é para fazenda grande".',
    personagem_id: 'marina',
    pista_id: 'p7',
    acao_sugerida: 'apoio_tecnico',
  },
  {
    id: 'centro_distribuicao',
    nome: 'Centro de distribuição da associação',
    tipo: 'organizacao',
    situacao:
      'Galpão coberto, com banheiro, energia e espaço para quarenta caixas, levantado em mutirão pela própria comunidade.',
    problema:
      'Fica de portas abertas só na terça-feira; no resto da semana, o espaço parado vê a produção passar na rua sem entrar.',
    personagem_id: null,
    pista_id: 'p8',
    acao_sugerida: 'solucao_conjunta',
  },
  {
    id: 'conectividade',
    nome: 'Antena comunitária e ponto de internet',
    tipo: 'infraestrutura',
    situacao:
      'Antena de rádio instalada no alto da sede divide sinal com quem mora perto, sem cobrar mensalidade.',
    problema:
      'O sinal alcança metade da região: quem mora no fim da estrada fica sem internet, sem aplicativo e sem pedido.',
    personagem_id: 'lucas',
    pista_id: 'p9',
    acao_sugerida: 'compartilhar',
  },
  {
    id: 'sede',
    nome: 'Sede comunitária Boa Vista',
    tipo: 'organizacao',
    situacao:
      'Salão onde cabe reunião, curso e festa junina, com cozinha, mesa comprida e a parede dos combinados.',
    problema:
      'É onde a comunidade decide tudo — mas as reuniões quase sempre esbarram na mesma pergunta: "e quem faz?".',
    personagem_id: 'ivonete',
    pista_id: 'p11',
    acao_sugerida: 'capacitacao',
  },
];

// ---------------------------------------------------------------------------
// Personagens — 9 vozes da comunidade
// ---------------------------------------------------------------------------

const PERSONAGENS: OficinaPersonagem[] = [
  {
    id: 'rosa',
    nome: 'Dona Rosa',
    papel: 'Agricultora familiar, alface e couve',
    local_id: 'propriedades',
    fala:
      'Planto desde menina e não é a terra que reclama de mim, não. O que me aperta é a hora de entregar: sozinha, de carroça, a feira já abriu quando eu chego. Verdura boa não pode esperar — e eu não gosto de ver trabalho bom estragar na caixa.',
    problema:
      'Colhe farta, mas entrega sozinha e perde horário, preço e parte do que plantou.',
    pista_id: 'p1',
    tags: ['producao', 'mercado', 'logistica'],
  },
  {
    id: 'antonio',
    nome: 'Seu Antônio',
    papel: 'Representante da cooperativa',
    local_id: 'cooperativa',
    fala:
      'Aqui cabe o que a comunidade produz, se a comunidade quiser entrar. Já tenho doze famílias, balança boa e uma câmara fria que não vive no aperto. O que falta é combinar a entrega como gente grande: dia certo, rota certa, cada um na sua parte.',
    problema:
      'A cooperativa quer organizar as entregas, mas esbarra em rota, horário e no receio de cada um de "perder a vez".',
    pista_id: 'p2',
    tags: ['organizacao', 'logistica'],
  },
  {
    id: 'nestor',
    nome: 'Seu Nestor',
    papel: 'Feirante há vinte anos',
    local_id: 'feira',
    fala:
      'Meu pé de alface é o melhor da feira — e o mais esquecido. Sábado de sol, a praça enche; sábado de chuva, eu converso com as caixas. O povo de Brasília compra verdura boa, só precisa saber que a gente existe.',
    problema:
      'Feira tem demanda e produto, mas a divulgação é o mesmo cartaz de quando o núcleo foi fundado.',
    pista_id: 'p3',
    tags: ['mercado', 'organizacao'],
  },
  {
    id: 'claudia',
    nome: 'Professora Cláudia',
    papel: 'Diretora da Escola Classe',
    local_id: 'escola',
    fala:
      'Aqui dentro eu vejo as crianças comendo verdura de outro estado, com a verdura da vizinhança passando na porta. A escola pode comprar da agricultura familiar — a lei permite, a cozinha quer, falta a comunidade se organizar para entregar em dia.',
    problema:
      'A escola é compradora institucional em potencial (PNAE), mas sem regularidade de entrega a chamada pública fica fora do alcance.',
    pista_id: 'p4',
    tags: ['politicas', 'mercado'],
  },
  {
    id: 'marina',
    nome: 'Técnica Marina',
    papel: 'Assistência técnica rural, Emater-DF',
    local_id: 'atec',
    fala:
      'Assistência gratuita existe, o caderno da agenda está aberto e eu conheço cada nascente deste núcleo. O que eu não consigo é atender quem não chama. Técnico aqui não é fiscal: é quem ajuda a decidir antes do prejuízo.',
    problema:
      'ATER/Emater-DF é gratuita, mas a comunidade não usa: falta o hábito de chamar antes, não depois do problema.',
    pista_id: 'p7',
    tags: ['politicas', 'capacitacao', 'sustentabilidade'],
  },
  {
    id: 'ivonete',
    nome: 'Dona Ivonete',
    papel: 'Agente de programas públicos (PAA, PNAE, ATER)',
    local_id: 'sede',
    fala:
      'Programa público não cai do céu: cai na mesa de quem tem papel em ordem e entrega no dia. Já vi chamada do PAA passar pela comunidade com ninguém inscrito. Falta casa, e o que falta é organização no tempo certo.',
    problema:
      'Os programas existem e pagam em dia, mas a comunidade perde prazo por falta de documentação e de combinado.',
    pista_id: 'p11',
    tags: ['politicas', 'capacitacao', 'inclusao'],
  },
  {
    id: 'dija',
    nome: 'Dija',
    papel: 'Motorista da associação',
    local_id: 'estrada',
    fala:
      'Conheço cada buraco desta estrada pelo nome. O caminhão da associação sai com meia carga porque cada um entrega no seu dia. Se a gente juntasse a carga de todo mundo, um frete pagava o que hoje pagam três.',
    problema:
      'O caminhão roda subutilizado; carga agrupada cortaria o custo de transporte pela metade.',
    pista_id: 'p12',
    tags: ['logistica', 'organizacao'],
  },
  {
    id: 'lucas',
    nome: 'Lucas',
    papel: 'Jovem do núcleo, mexe com tecnologia',
    local_id: 'conectividade',
    fala:
      'Tem aplicativo de gestão de feira que parece feito pra nossa comunidade — eu mesmo já instalei e ensinei. Mas o sinal da antena chega até a metade da estrada. Quem mora no fim fica de fora, e o aplicativo vira papel de parede.',
    problema:
      'Ferramenta digital existe e alguém sabe usar, mas a conectividade cobre só metade da região.',
    pista_id: 'p10',
    tags: ['tecnologia', 'conectividade', 'capacitacao'],
  },
  {
    id: 'paula',
    nome: 'Paula',
    papel: 'Consumidora da feira e quitandeira da cidade',
    local_id: 'mercado',
    fala:
      'Eu venho de Brasília toda semana pra comprar verdura que tem gosto de verdade. O problema é acostumar: sábado tem, outro sábado não tem, e eu volto pro mercadinho da esquina. Regularidade é o que segura cliente.',
    problema:
      'Consumidor quer regularidade; a banca falhar faz a cliente voltar ao supermercado e o hábito da feira esfria.',
    pista_id: 'p13',
    tags: ['mercado', 'inclusao'],
  },
];

// ---------------------------------------------------------------------------
// Pistas — 13 achados da comunidade
// ---------------------------------------------------------------------------

const PISTAS: OficinaPista[] = [
  {
    id: 'p1',
    titulo: 'Produção existe, entrega falha',
    texto:
      'As famílias colhem bem, mas cada uma entrega separada, de carroça ou de carona. Muita caixa chega atrasada na feira — e verdura atrasada vende por menos, ou não vende.',
    origem: 'Personagem Dona Rosa',
    tags: ['logistica', 'mercado', 'producao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p2',
    titulo: 'Cooperativa quer organizar entregas',
    texto:
      'Seu Antônio quer montar rota única e horário fixo para as entregas da cooperativa. Câmara fria e balança já existem; falta o combinado entre as famílias.',
    origem: 'Personagem Seu Antônio',
    tags: ['organizacao', 'logistica'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p3',
    titulo: 'Feira tem demanda, divulgação pouca',
    texto:
      'A feira do sábado repete vinte bancas, mas o movimento depende do tempo. Brasília fica a menos de uma hora e quase ninguém sabe da feira: a divulgação é um cartaz na praça.',
    origem: 'Personagem Seu Nestor',
    tags: ['mercado', 'organizacao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p4',
    titulo: 'Escola compra da agricultura familiar (PNAE)',
    texto:
      'A Escola Classe recebe verdura de fora, mas a lei permite comprar da agricultura familiar da região. A cozinha quer, a diretora quer; falta produção e entrega em dia certinho.',
    origem: 'Personagem Professora Cláudia',
    tags: ['politicas', 'mercado'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p5',
    titulo: 'Mercado quer fornecedor fixo',
    texto:
      'Mercadinhos e quitandas do entorno compram verdura toda semana, mas de atravessador. Eles aceitariam a comunidade como fornecedora fixa — com nota, horário e constância.',
    origem: 'Local Mercado do entorno',
    tags: ['mercado', 'organizacao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p6',
    titulo: 'Estrada castiga carga e horário',
    texto:
      'São seis quilômetros de terra entre a BR e a comunidade. Na chuva a estrada vira lama: o que sai de madrugada chega com a feira já no meio, produto amassado, comprador desistindo.',
    origem: 'Local Estrada de acesso',
    tags: ['logistica'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p7',
    titulo: 'Assistência técnica é gratuita (Emater-DF)',
    texto:
      'A técnica Marina atende o núcleo toda semana, de graça, na propriedade ou na sede. Orientação de solo, de praga e de gestão não falta: falta a comunidade chamar.',
    origem: 'Personagem Técnica Marina',
    tags: ['politicas', 'capacitacao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p8',
    titulo: 'Centro de distribuição fica parado',
    texto:
      'O galpão da associação, com energia, banheiro e espaço para quarenta caixas, só abre na terça-feira. No resto da semana, o espaço vazio vê a produção passar na rua sem entrar.',
    origem: 'Local Centro de distribuição',
    tags: ['logistica', 'organizacao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p9',
    titulo: 'Antena comunitária cobre só metade',
    texto:
      'A antena de rádio da sede alcança quem mora perto; o fim da estrada fica sem sinal. Metade da comunidade não acessa aplicativo, pedido nem previsão de chuva.',
    origem: 'Local Antena comunitária',
    tags: ['conectividade', 'tecnologia'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p10',
    titulo: 'Ferramenta digital esbarra no sinal',
    texto:
      'Existe aplicativo de feira que organiza pedido e banca, e o Lucas sabe ensinar. Mas sem conectividade metade dos produtores instala, desiste e volta ao caderno.',
    origem: 'Personagem Lucas',
    tags: ['tecnologia', 'conectividade', 'inclusao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p11',
    titulo: 'Programa público existe, prazo passa',
    texto:
      'Chamadas do PAA e do PNAE passam pela região, pagam em dia e compram da agricultura familiar. A comunidade perde prazo por falta de documentação e de alguém organizando a inscrição.',
    origem: 'Personagem Dona Ivonete',
    tags: ['politicas', 'capacitacao', 'inclusao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p12',
    titulo: 'Caminhão roda com meia carga',
    texto:
      'O caminhão da associação entrega no dia de cada família — e sai com meia carga, pagando frete cheio. Carga agrupada em um dia só corta o custo pela metade.',
    origem: 'Personagem Dija',
    tags: ['logistica', 'organizacao'],
    unica: true,
    compartilhavel: true,
  },
  {
    id: 'p13',
    titulo: 'Consumidor volta pelo hábito da regularidade',
    texto:
      'Paula vem de Brasília toda semana pela verdura da feira. Quando a banca falta no sábado, ela volta ao mercadinho — e o hábito da feira esfria.',
    origem: 'Personagem Paula',
    tags: ['mercado', 'inclusao'],
    unica: true,
    compartilhavel: true,
  },
];

// ---------------------------------------------------------------------------
// Ações — 10 movimentos das equipes
// ---------------------------------------------------------------------------

const ACOES: OficinaAcao[] = [
  {
    key: 'investigar',
    nome: 'Investigar o lugar',
    icone: 'Search',
    descricao:
      'Visitar um ponto da comunidade e reparar no que está acontecendo. Cada canto guarda uma pista.',
    custo_acoes: 1,
    requisito_tags: [],
    efeitos: { conhecimento: 1, organizacao: 1 },
    tags: ['organizacao'],
    investiga: true,
  },
  {
    key: 'conversar',
    nome: 'Conversar com uma pessoa',
    icone: 'MessageCircle',
    descricao:
      'Bater um papo com quem vive o problema todo dia. Gente boa entrega mais que entrevista: entrega pista.',
    custo_acoes: 1,
    requisito_tags: [],
    efeitos: { confianca: 2 },
    tags: ['organizacao'],
    investiga: true,
  },
  {
    key: 'compartilhar',
    nome: 'Compartilhar descoberta',
    icone: 'Share2',
    descricao:
      'Contar para outra equipe a pista que vocês acharam. A comunidade inteira ganha quando a descoberta circula.',
    custo_acoes: 1,
    requisito_tags: [],
    efeitos: { cooperacao: 2, conhecimento: 1, organizacao: -1 },
    tags: ['organizacao'],
    investiga: false,
  },
  {
    key: 'apoio_tecnico',
    nome: 'Chamar assistência técnica',
    icone: 'Wrench',
    descricao:
      'Acionar a Emater-DF para avaliar, orientar e acompanhar. Saber técnico que chega na hora certa evita gasto errado.',
    custo_acoes: 1,
    requisito_tags: ['capacitacao'],
    efeitos: { conhecimento: 2, sustentabilidade: 1, mercado: -1 },
    tags: ['politicas', 'capacitacao'],
    investiga: false,
  },
  {
    key: 'parceria',
    nome: 'Fechar parceria',
    icone: 'Handshake',
    descricao:
      'Aproximar escola, mercado ou outro ator que tenha interesse no que a comunidade produz.',
    custo_acoes: 1,
    requisito_tags: ['organizacao'],
    efeitos: { organizacao: 2, mercado: 1, confianca: -1 },
    tags: ['organizacao', 'mercado'],
    investiga: false,
  },
  {
    key: 'transporte',
    nome: 'Organizar transporte',
    icone: 'Truck',
    descricao:
      'Juntar carga, rota e horário para o produto sair inteiro e no tempo.',
    custo_acoes: 1,
    requisito_tags: ['logistica'],
    efeitos: { mercado: 3, confianca: 1, viabilidade: 2, sustentabilidade: -2 },
    tags: ['logistica'],
    investiga: false,
  },
  {
    key: 'comercializacao',
    nome: 'Ajustar comercialização',
    icone: 'ShoppingBag',
    descricao:
      'Definir onde, como e para quem vender: banca, quitanda, escola, cesta.',
    custo_acoes: 1,
    requisito_tags: ['mercado'],
    efeitos: { mercado: 2, conhecimento: 1, inclusao: 1, cooperacao: -1 },
    tags: ['mercado'],
    investiga: false,
  },
  {
    key: 'capacitacao',
    nome: 'Oficina e capacitação',
    icone: 'GraduationCap',
    descricao:
      'Aprender fazendo: manejo, uso de ferramenta, gestão. Saber circulando muda o resultado.',
    custo_acoes: 1,
    requisito_tags: ['capacitacao'],
    efeitos: { conhecimento: 3, inclusao: 1, mercado: -1 },
    tags: ['capacitacao'],
    investiga: false,
  },
  {
    key: 'divulgacao',
    nome: 'Divulgar a feira',
    icone: 'Megaphone',
    descricao:
      'Espalhar para além da praça que no sábado tem feira viva na Boa Vista.',
    custo_acoes: 1,
    requisito_tags: ['mercado'],
    efeitos: { mercado: 2, confianca: 1, viabilidade: -1 },
    tags: ['mercado'],
    investiga: false,
  },
  {
    key: 'solucao_conjunta',
    nome: 'Propor solução conjunta',
    icone: 'HeartHandshake',
    descricao:
      'Juntar várias peças numa proposta que a comunidade inteira toca — é o passo do cartão final da oficina.',
    custo_acoes: 2,
    requisito_tags: ['organizacao'],
    efeitos: { cooperacao: 3, organizacao: 2, confianca: 1, viabilidade: -1 },
    tags: ['organizacao', 'inclusao'],
    investiga: false,
  },
];

// ---------------------------------------------------------------------------
// Eventos coletivos — 5 situações que mexem com todas as equipes
// ---------------------------------------------------------------------------

const EVENTOS: OficinaEvento[] = [
  {
    key: 'feira_comunitaria',
    titulo: 'Sábado de feira com cara de chuva',
    narrativa:
      'O sábado amanheceu nublado e a praça está vazia. As bancas montadas esperam o movimento que não vem, e a verdura já colhida de madrugada encolhe na caixa conforme o sol se esconde. As famílias estão na feira, cada uma no seu canto, cada uma com a mesma pergunta: como levar a produção de volta sem perder o dia?',
    desfecho:
      'A feira fechou sem sobrar o que sobrava antes, e o susto virou aprendizado: no sábado seguinte, o mutirão de caronas e o ponto único de coleta estavam na porta de casa antes do sol nascer.',
    opcoes: [
      {
        key: 'a',
        rotulo: 'Mobilizar caronas solidárias e rachar o frete',
        detalhe:
          'Cada família paga um tanto e nenhuma volta sozinha de mão abanando.',
        efeitos: { mercado: 1, cooperacao: 2, confianca: 1 },
        tags: ['logistica', 'organizacao'],
      },
      {
        key: 'b',
        rotulo: 'Concentrar tudo em um ponto único de coleta',
        detalhe:
          'Todo produto vai para o centro de distribuição e sai de lá uma vez só.',
        efeitos: { mercado: 2, organizacao: 2, inclusao: -1 },
        tags: ['logistica', 'organizacao'],
      },
      {
        key: 'c',
        rotulo: 'Priorizar só os produtos de maior giro',
        detalhe:
          'Leva para a feira o que vende rápido e deixa o resto para o meio da semana.',
        efeitos: { mercado: 3, inclusao: -2, conhecimento: -1 },
        tags: ['mercado'],
      },
    ],
    efeito_coletivo: { cooperacao: 1, mercado: 1 },
  },
  {
    key: 'semana_capacitacao',
    titulo: 'Semana de capacitação aberta no núcleo',
    narrativa:
      'A Emater-DF, junto com a cooperativa, abriu uma semana de oficinas na sede: manejo, gestão e uso de ferramenta digital. Tem turma de manhã e à tarde, o café é na sede e o técnico não cobra nada. O desafio é o mesmo de sempre: quem vai — e quem fica na roça para a casa não parar?',
    desfecho:
      'A semana terminou com mais gente treinada e um caderno de combinados na parede da sede. Quem não pôde ir recebeu o repasse — e o que era curso virou rotina.',
    opcoes: [
      {
        key: 'a',
        rotulo: 'Liberar um dia inteiro de oficina na sede',
        detalhe:
          'A comunidade para por um dia e vai todo mundo aprender junto.',
        efeitos: { conhecimento: 2, inclusao: 1, organizacao: -1 },
        tags: ['capacitacao', 'organizacao'],
      },
      {
        key: 'b',
        rotulo: 'Levar o técnico de propriedade em propriedade',
        detalhe: 'A oficina vai até quem não pode sair da roça.',
        efeitos: { conhecimento: 2, sustentabilidade: 1, mercado: -1 },
        tags: ['capacitacao', 'politicas'],
      },
      {
        key: 'c',
        rotulo: 'Enviar um representante por grupo para multiplicar',
        detalhe: 'Cada grupo manda um, que volta e ensina os outros.',
        efeitos: { conhecimento: 1, inclusao: 2, organizacao: 1 },
        tags: ['capacitacao', 'inclusao'],
      },
    ],
    efeito_coletivo: { conhecimento: 2 },
  },
  {
    key: 'problema_logistico',
    titulo: 'O caminhão quebrou na véspera da entrega',
    narrativa:
      'Amanhã é dia de entregar verdura para a escola e para os mercadinhos, e o caminhão da associação está no mecânico. A produção está colhida, embalada e esperando. Cada família tem um carro pequeno, uma carroça ou uma carona de última hora — e o horário combinado não perdoa.',
    desfecho:
      'A entrega saiu inteira, com umas duas horas de atraso e um punhado de estrada a mais. Na reunião seguinte, a rota passou a ser feita por três veículos menores — e o caminhão virou reforço, não espinha dorsal.',
    opcoes: [
      {
        key: 'a',
        rotulo: 'Reorganizar rotas com veículos menores',
        detalhe:
          'Cada carro cobre um pedaço da entrega, no horário que dá conta.',
        efeitos: { mercado: 1, confianca: 2, organizacao: 1 },
        tags: ['logistica', 'organizacao'],
      },
      {
        key: 'b',
        rotulo: 'Reduzir a entrega de hoje e compensar amanhã',
        detalhe:
          'Entrega menos agora e promete o resto no dia seguinte, com a escola ciente.',
        efeitos: { mercado: -1, confianca: 1, organizacao: 1 },
        tags: ['mercado', 'organizacao'],
      },
      {
        key: 'c',
        rotulo: 'Pedir reforço de outro núcleo',
        detalhe:
          'Um vizinho de outro núcleo empresta o transporte, com a conta dividida.',
        efeitos: { cooperacao: 2, confianca: 1, mercado: -1 },
        tags: ['logistica', 'organizacao'],
      },
    ],
    efeito_coletivo: { organizacao: 1, confianca: 1 },
  },
  {
    key: 'oportunidade_institucional',
    titulo: 'Chamada pública do PAA na região',
    narrativa:
      'Saiu chamada pública do PAA para compra de alimentos da agricultura familiar. Preço garantido, pagamento em dia, escola e mercadinhos na ponta compradora. A documentação exige organização: inscrição em dia, produção declarada e entrega no prazo. A comunidade tem produto de sobra — e o formulário, como sempre, é o nó.',
    desfecho:
      'A chamada foi vencida pela comunidade, com produção declarada e entrega em dia. Na primeira remessa, o centro de distribuição ficou aberto a semana inteira — e a câmara fria, pela primeira vez, trabalhou cheia.',
    opcoes: [
      {
        key: 'a',
        rotulo: 'Organizar a produção em escala coletiva',
        detalhe:
          'Todo mundo planta um quinhão combinado para a chamada, e a entrega é da associação.',
        efeitos: { organizacao: 2, mercado: 2, viabilidade: -1 },
        tags: ['organizacao', 'mercado'],
      },
      {
        key: 'b',
        rotulo: 'Candidatar só quem tem documentação pronta',
        detalhe:
          'Entra quem já está em dia; o resto fica para a próxima chamada.',
        efeitos: { mercado: 2, inclusao: -2 },
        tags: ['politicas', 'organizacao'],
      },
      {
        key: 'c',
        rotulo: 'Pedir apoio da assistência técnica para regularizar',
        detalhe:
          'A Emater-DF ajuda a levantar documento, declaração e planejamento.',
        efeitos: { conhecimento: 2, inclusao: 1, organizacao: 1 },
        tags: ['politicas', 'capacitacao'],
      },
    ],
    efeito_coletivo: { mercado: 1, conhecimento: 1 },
  },
  {
    key: 'falha_conectividade',
    titulo: 'A antena caiu no meio da semana de pedidos',
    narrativa:
      'A antena comunitária caiu depois da ventania e o sinal foi embora com ela. Metade da comunidade estava de olho no aplicativo de pedidos; do outro lado, os mercadinhos esperam a confirmação da entrega de sábado. O papel e o caderno voltaram à mão — e, no fim, deram conta. Mas a pergunta ficou: e se isso acontecer na semana da chamada pública?',
    desfecho:
      'O mutirão subiu no poste, o sinal voltou e o plano B de comunicação ficou escrito na sede. Da próxima ventania, a comunidade não descobre o que fazer depois — já sabia antes.',
    opcoes: [
      {
        key: 'a',
        rotulo: 'Voltar ao caderno de papel e planilha impressa',
        detalhe:
          'Pedido anotado na mão, confirmado no telefone da quitanda, sem depender do sinal.',
        efeitos: { organizacao: 1, inclusao: 1, conhecimento: -1 },
        tags: ['organizacao'],
      },
      {
        key: 'b',
        rotulo: 'Consertar em mutirão e criar plano B de comunicação',
        detalhe:
          'Sobe no poste, conserta e escreve o combinado de quando o sinal cair de novo.',
        efeitos: { cooperacao: 2, conhecimento: 2, mercado: -1 },
        tags: ['conectividade', 'organizacao'],
      },
      {
        key: 'c',
        rotulo: 'Concentrar pedidos num único ponto com sinal',
        detalhe:
          'Todo pedido passa pela sede, que tem o melhor sinal, e desce de uma vez.',
        efeitos: { mercado: 1, inclusao: 2, organizacao: -1 },
        tags: ['conectividade', 'inclusao'],
      },
    ],
    efeito_coletivo: { inclusao: 1, cooperacao: 1 },
  },
];

// ---------------------------------------------------------------------------
// Cartões da solução — 13 blocos, 4 opções cada
// ---------------------------------------------------------------------------

const CARTOES: OficinaCartao[] = [
  {
    bloco: 'problema_principal',
    campo_livre: true,
    opcoes: [
      { key: 'a', rotulo: 'Produto bom que não chega na banca', tags: ['logistica', 'mercado'] },
      { key: 'b', rotulo: 'Feira boa que quase ninguém conhece', tags: ['mercado', 'organizacao'] },
      { key: 'c', rotulo: 'Sinal de internet que não alcança metade da comunidade', tags: ['conectividade', 'tecnologia'] },
      { key: 'd', rotulo: 'Cada família resolvendo sozinha', tags: ['organizacao', 'inclusao'] },
    ],
  },
  {
    bloco: 'publico_beneficiado',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Famílias produtoras do núcleo', tags: ['producao', 'inclusao'] },
      { key: 'b', rotulo: 'Escola e as 240 crianças', tags: ['mercado', 'organizacao'] },
      { key: 'c', rotulo: 'Feirantes e quitandas do entorno', tags: ['mercado'] },
      { key: 'd', rotulo: 'Consumidores de Sobradinho e Brasília', tags: ['mercado', 'inclusao'] },
    ],
  },
  {
    bloco: 'recursos',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'O que cada sítio já tem: carroça, freezer, experiência', tags: ['producao', 'organizacao'] },
      { key: 'b', rotulo: 'Centro de distribuição parado no meio da semana', tags: ['logistica', 'organizacao'] },
      { key: 'c', rotulo: 'Antena comunitária e os jovens que sabem mexer', tags: ['tecnologia', 'conectividade'] },
      { key: 'd', rotulo: 'Câmara fria e balança da cooperativa', tags: ['logistica', 'organizacao'] },
    ],
  },
  {
    bloco: 'parceiros',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Emater-DF na assistência técnica', tags: ['politicas', 'capacitacao'] },
      { key: 'b', rotulo: 'Escola Classe na compra institucional', tags: ['politicas', 'mercado'] },
      { key: 'c', rotulo: 'Cooperativa e associação de produtores', tags: ['organizacao'] },
      { key: 'd', rotulo: 'Feirantes e mercadinhos do entorno', tags: ['mercado'] },
    ],
  },
  {
    bloco: 'tecnologia_ferramenta',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Sensores de umidade e imagem de satélite (NDVI) para decidir irrigar', tags: ['tecnologia', 'sustentabilidade'] },
      { key: 'b', rotulo: 'Aplicativo de gestão de feira e pedidos', tags: ['tecnologia', 'mercado'] },
      { key: 'c', rotulo: 'Drone para mapear lavoura e conferir área plantada', tags: ['tecnologia', 'producao'] },
      { key: 'd', rotulo: 'Caderno coletivo e WhatsApp quando o sinal ajuda', tags: ['tecnologia', 'organizacao'] },
    ],
  },
  {
    bloco: 'comercializacao',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Banca fixa toda semana na feira do sábado', tags: ['mercado'] },
      { key: 'b', rotulo: 'Entrega institucional para a escola (PNAE)', tags: ['mercado', 'politicas'] },
      { key: 'c', rotulo: 'Cestas fechadas por assinatura para Brasília', tags: ['mercado', 'organizacao'] },
      { key: 'd', rotulo: 'Fornecimento fixo para quitandas e mercadinhos', tags: ['mercado'] },
    ],
  },
  {
    bloco: 'transporte',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Agendamento coletivo de entregas', tags: ['logistica', 'organizacao'] },
      { key: 'b', rotulo: 'Transporte próprio da cooperativa', tags: ['logistica', 'organizacao'] },
      { key: 'c', rotulo: 'Carona solidária entre produtores', tags: ['logistica', 'inclusao'] },
      { key: 'd', rotulo: 'Contratar frete terceirizado', tags: ['logistica', 'mercado'] },
    ],
  },
  {
    bloco: 'capacitacao',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Oficina de boas práticas na sede', tags: ['capacitacao', 'producao'] },
      { key: 'b', rotulo: 'Acompanhamento da Emater-DF na propriedade', tags: ['capacitacao', 'politicas'] },
      { key: 'c', rotulo: 'Jovens ensinando o aplicativo a quem tem dificuldade', tags: ['capacitacao', 'conectividade'] },
      { key: 'd', rotulo: 'Mutirão de troca de saber entre vizinhos', tags: ['capacitacao', 'organizacao'] },
    ],
  },
  {
    bloco: 'politica_publica',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'PAA — venda institucional com preço garantido', tags: ['politicas', 'mercado'] },
      { key: 'b', rotulo: 'PNAE — alimentação escolar', tags: ['politicas', 'mercado'] },
      { key: 'c', rotulo: 'ATER/Emater-DF — assistência técnica gratuita', tags: ['politicas', 'capacitacao'] },
      { key: 'd', rotulo: 'Crédito rural acompanhado', tags: ['politicas', 'producao'] },
    ],
  },
  {
    bloco: 'risco_principal',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Chuva atrasa e estraga a entrega', tags: ['sustentabilidade', 'logistica'] },
      { key: 'b', rotulo: 'Falta de gente para manter o compromisso', tags: ['organizacao'] },
      { key: 'c', rotulo: 'Sinal de internet cai no meio do pedido', tags: ['conectividade', 'tecnologia'] },
      { key: 'd', rotulo: 'Preço cai quando todo mundo colhe junto', tags: ['mercado', 'producao'] },
    ],
  },
  {
    bloco: 'impacto_social',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Renda extra chegando toda semana', tags: ['mercado', 'inclusao'] },
      { key: 'b', rotulo: 'Juventude com ocupação e aprendizado', tags: ['inclusao', 'capacitacao'] },
      { key: 'c', rotulo: 'Famílias comendo verdura fresca da própria comunidade', tags: ['mercado', 'inclusao'] },
      { key: 'd', rotulo: 'Comunidade conhecida na região pela feira', tags: ['organizacao', 'mercado'] },
    ],
  },
  {
    bloco: 'impacto_ambiental',
    campo_livre: false,
    opcoes: [
      { key: 'a', rotulo: 'Menos desperdício: colher na hora de vender', tags: ['sustentabilidade', 'mercado'] },
      { key: 'b', rotulo: 'Manejo orientado protegendo solo e nascente', tags: ['sustentabilidade', 'producao'] },
      { key: 'c', rotulo: 'Menos viagem de caminhão, menos combustível', tags: ['sustentabilidade', 'logistica'] },
      { key: 'd', rotulo: 'Compostagem da sobra de feira', tags: ['sustentabilidade', 'organizacao'] },
    ],
  },
  {
    bloco: 'acompanhamento',
    campo_livre: true,
    opcoes: [
      { key: 'a', rotulo: 'Reunião mensal com os números da feira na parede', tags: ['organizacao'] },
      { key: 'b', rotulo: 'Caderno de vendas e escala de entregas', tags: ['organizacao', 'mercado'] },
      { key: 'c', rotulo: 'Visita da Emater-DF a cada estação', tags: ['capacitacao', 'politicas'] },
      { key: 'd', rotulo: 'Combinado simples: quem faz o quê, até quando', tags: ['organizacao'] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Perguntas de reflexão — 9, para o fechamento da oficina
// ---------------------------------------------------------------------------

const REFLEXAO_PERGUNTAS: string[] = [
  'A tecnologia resolveu o problema sozinha, ou precisou de gente, tempo e organização junto?',
  'O que pesou mais na solução de vocês: a ferramenta escolhida ou o combinado entre as pessoas?',
  'Quem ficou de fora das decisões — e que ideia essa pessoa teria trazido para a mesa?',
  'A assistência técnica da Emater-DF mudou o rumo da solução? Sem ela, o que teria sido diferente?',
  'Qual política pública encaixou na ideia — PAA, PNAE, ATER ou crédito rural? O que ela exigiu da comunidade?',
  'A conectividade limitada atrapalhou em que ponto? Que plano B a comunidade inventou para não parar?',
  'O que vocês viram na Boa Vista existe de verdade nos núcleos rurais do Distrito Federal?',
  'Se a solução saísse do papel amanhã, qual seria o primeiro risco a aparecer na frente?',
  'Que combinado simples mantém a solução viva daqui a seis meses, sem depender de uma pessoa só?',
];

// ---------------------------------------------------------------------------
// Conteúdo completo
// ---------------------------------------------------------------------------

export const OFICINA_CONTENT: OficinaContent = {
  locais: LOCAIS,
  personagens: PERSONAGENS,
  pistas: PISTAS,
  acoes: ACOES,
  eventos: EVENTOS,
  cartoes: CARTOES,
  reflexao_perguntas: REFLEXAO_PERGUNTAS,
};

/** Chaves de ação válidas, para validação cruzada fora do arquivo. */
export const OFICINA_ACAO_KEYS: OficinaAcaoKey[] = ACOES.map((acao) => acao.key);

/** Conjunto de tags válidas, para validação cruzada fora do arquivo. */
export const OFICINA_TAGS: TagOficina[] = [
  'producao',
  'mercado',
  'logistica',
  'tecnologia',
  'conectividade',
  'organizacao',
  'capacitacao',
  'politicas',
  'sustentabilidade',
  'inclusao',
];