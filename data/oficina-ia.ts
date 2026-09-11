import type {
  OficinaIaFallbacks,
  OficinaPerfil,
  OficinaStage,
} from '@/types/oficina';

/**
 * Fallback estático da IA do modo Oficina Safra DF.
 *
 * O jogo roda 100% sem chamada de modelo: estes textos são o narrador padrão
 * quando o cache de IA está vazio ou fora do alcance. Voz do interior do
 * cerrado: digna, frases curtas, calor humano, humor leve quando cabe.
 */

/** Nome da comunidade fictícia usada em toda a oficina. */
export const OFICINA_COMUNIDADE_NOME = 'Comunidade Boa Vista do Cerrado';

const NARRATIVA_INICIAL = `Lá no fim da BR-020, um caminho de terra leva à ${OFICINA_COMUNIDADE_NOME}. Não é mapa de turista: são cerca de trinta famílias que plantam verdura, criam galinha e tiram do chão o sustento de casa. De longe, parece que tudo vai bem. De perto, dá para ver o esforço de cada um andando sozinho.

O problema não é plantio. A terra dá. O problema é o caminho que o alimento faz depois de colhido: a alface boa madura no pé enquanto a feira do sábado espera banca vazia; o caminhão da associação roda com meia carga; o centro de distribuição fica de portas abertas sem nada para guardar. Cada família resolve o seu lado, e o lado do vizinho continua sem solução.

Pois é aí que vocês entram. Seis equipes, seis olhares diferentes sobre o mesmo quintal. Tem quem conhece o chão e a colheita; quem entende de juntar gente e regra; quem pensa no mercado e na banca; quem vive de estrada e horário; quem tem a cabeça nas ferramentas digitais; e quem costura parceria com escola, política pública e assistência técnica. Nenhum olhar sozinho enxerga a comunidade inteira.

Nesta oficina, vocês vão andar pela comunidade, conversar com as pessoas e juntar as peças. Cada descoberta ajuda o grupo — e, se for compartilhada, ajuda todo mundo. No fim, cada equipe desenha uma proposta para a Boa Vista. Não existe resposta pronta: existe a resposta que a comunidade constrói junto.

O dia está bonito, o café está quente e o cerrado está florido. Bom trabalho.`;

const TRANSICOES: Record<OficinaStage, string> = {
  briefing:
    'As equipes já estão formadas e o mapa da comunidade está na mesa. Antes de sair andando, vale combinar: quem investiga onde, quem conversa com quem, e o que cada grupo quer descobrir primeiro.',
  investigacao:
    'A comunidade foi percorrida e as conversas estão rendendo. Compartilhar o que cada equipe achou muda a leitura de todo mundo — e alguma coisa importante ainda pode estar escondida pelo caminho.',
  eventos:
    'A comunidade não parou de viver enquanto vocês investigavam. Situações novas apareceram e precisam de decisão. O que cada equipe escolher agora ecoa direto na proposta final.',
  solucao:
    'Hora de desenhar a proposta. Cada bloco do cartão é uma decisão: problema, parceiros, ferramenta, transporte, política pública. Falta pouco para a Boa Vista ter um plano com nome e sobrenome.',
  resultado:
    'As propostas estão na mesa e a comunidade ouviu cada uma. Este é o momento de olhar os indicadores e o caminho que cada equipe percorreu — não só o que foi escrito, mas o que foi construído no meio do caminho.',
  encerrada:
    'A oficina terminou, mas a Boa Vista continua plantando. O que cada equipe leva daqui não é uma nota: é um jeito de olhar problema de comunidade e enxergar gente, recurso e solução no mesmo quadro.',
};

const FEEDBACK_POR_PERFIL: Record<OficinaPerfil, string> = {
  produtores:
    'O olhar de quem planta manteve a proposta com os pés no chão. Quando a equipe pensou em custo, colheita e renda no campo, a solução não virou ideia solta: virou coisa que dá para fazer na propriedade, sem depender de milagre. A Boa Vista percebeu que produção sem mercado é só metade da resposta.',
  cooperativa:
    'O olhar de quem organiza segurou a proposta de pé. Regra, prazo, divisão de tarefa — foi o que fez a ideia virar compromisso que todo mundo honra. Sem esse olhar, a Boa Vista teria um desejo bonito com a agenda vazia.',
  comercializacao:
    'O olhar de quem vende lembrou a todo mundo que produto bom precisa chegar a quem compra, no dia certo, com preço justo. Foi o que deu regularidade à proposta: feira, mercadinho, escola, cada um no seu ritmo e sem promessa vazia.',
  logistica:
    'O olhar de quem transporta colocou a proposta na estrada. Horário, rota, frete, perda: nada disso é detalhe. Foi a equipe de logística que lembrou que a alface não espera, e que caminhão cheio é o único que paga o próprio custo.',
  juventude_tech:
    'O olhar da juventude mostrou que ferramenta digital ajuda — quando tem quem ensine, quem mantenha e sinal que funcione. A proposta ganhou o aplicativo certo e ganhou também o plano B para quando a antena falhar, porque tecnologia sem plano B é enfeite.',
  articulacao:
    'O olhar de quem costura foi o que abriu as portas. Escola, Emater-DF, chamada pública, assistência técnica: nada disso aparece sozinho na porteira. Foi a articulação que fez a proposta conversar com a política pública e com a vida real do Distrito Federal.',
};

const REFLEXAO_PERGUNTAS: string[] = [
  'A tecnologia resolveu sozinha em alguma equipe, ou sempre precisou de gente, tempo e organização por trás?',
  'O que as equipes mostraram pesar mais: a ferramenta escolhida ou o combinado entre as pessoas?',
  'Quem ficou de fora das propostas — e o que essa pessoa diria se estivesse sentada na mesa?',
  'Onde a assistência técnica da Emater-DF apareceu? Sem ela, o que teria sido diferente na proposta?',
  'Qual política pública encaixou nas propostas — PAA, PNAE, ATER ou crédito? O que ela exige de uma comunidade?',
  'Como a conectividade limitada apareceu nas decisões — e que plano B as equipes inventaram para não parar?',
  'O que vocês viram na Boa Vista existe nos núcleos rurais de verdade, aqui no Distrito Federal?',
  'Se a proposta saísse do papel amanhã, qual seria o primeiro risco real a aparecer na frente?',
  'Que combinado simples mantém a solução viva daqui a seis meses, sem depender de uma pessoa só?',
];

const PROVOCACAO = `Fechem os olhos por um segundo: a feira da Boa Vista em um sábado cheio, caminhão carregado saindo no horário, escola recebendo verdura fresca. Agora abram. O que separa essa cena da que vocês viram hoje não é máquina, não é dinheiro e não é sorte: é decisão. Vocês acabaram de provar que sabem tomar. Levem isso para a próxima comunidade que cruzarem o caminho.`;

export const OFICINA_IA_FALLBACKS: OficinaIaFallbacks = {
  narrativa_inicial: NARRATIVA_INICIAL,
  transicoes: TRANSICOES,
  feedback_por_perfil: FEEDBACK_POR_PERFIL,
  reflexao_perguntas: REFLEXAO_PERGUNTAS,
  provocacao: PROVOCACAO,
};