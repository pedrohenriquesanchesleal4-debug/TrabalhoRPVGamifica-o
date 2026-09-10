import type { PropertyProfile } from '@/types/game';

/**
 * As 6 propriedades jogáveis.
 *
 * Cada uma existe para gerar uma partida diferente com o MESMO orçamento:
 * a assimetria vem de vantagem/dificuldade inicial, não de dinheiro extra.
 * As regiões são núcleos rurais reais do Distrito Federal; as propriedades e
 * seus números são fictícios.
 *
 * Editável pelo professor: mudar nome, região, foco e modificadores aqui muda
 * o jogo inteiro, sem tocar em nenhum componente React.
 */
export const PROPERTIES: PropertyProfile[] = [
  {
    key: 'sitio-horizonte',
    name: 'Sítio Horizonte',
    region: 'Núcleo Rural Taquara · Planaltina',
    tagline: 'Hortaliças em área pequena, com o mercado de Brasília logo ali.',
    focus: 'Alface, couve e cheiro-verde entregues duas vezes por semana.',
    strength: 'Perto do consumidor: o frete é curto e a verdura chega fresca.',
    weakness: 'Área pequena demais para errar: sem espaço para desperdício.',
    modifiers: { production: 6, sustainability: -4 },
    highlight: { indicator: 'production', label: 'Produção intensiva' },
  },
  {
    key: 'cerrado-vivo',
    name: 'Cerrado Vivo',
    region: 'Rio Preto · Paranoá',
    tagline: 'Produção agroecológica em área com nascente preservada.',
    focus: 'Hortaliças sem agrotóxico, frutas do cerrado e polpa congelada.',
    strength: 'Solo e água em boas condições: a base produtiva é sólida.',
    weakness: 'Longe do centro: cada entrega custa tempo e combustível.',
    modifiers: { sustainability: 14, production: -6, cash: -4000 },
    highlight: { indicator: 'sustainability', label: 'Sustentabilidade' },
  },
  {
    key: 'boa-esperanca',
    name: 'Boa Esperança',
    region: 'Núcleo Rural Alexandre Gusmão · Brazlândia',
    tagline: 'Morango em túnel baixo, tradição de família na região.',
    focus: 'Morango e olerícolas de ciclo curto para feira e atravessador.',
    strength: 'Produto de valor alto: bem vendido, o morango paga a safra.',
    weakness: 'Cultura sensível: uma chuva fora de hora derruba a colheita.',
    modifiers: { production: 10, sustainability: -8 },
    highlight: { indicator: 'cash', label: 'Alto valor de mercado' },
  },
  {
    key: 'riacho-verde',
    name: 'Riacho Verde',
    region: 'PAD-DF · Paranoá',
    tagline: 'Grãos e mandioca em área maior, com maquinário antigo.',
    focus: 'Milho, feijão e mandioca, parte para consumo e parte para venda.',
    strength: 'Escala: a área permite volume que os vizinhos não alcançam.',
    weakness: 'Trator com 20 anos de uso: quebra sempre na hora errada.',
    modifiers: { production: 4, technology: -8, cash: 6000 },
    highlight: { indicator: 'sustainability', label: 'Recursos hídricos' },
  },
  {
    key: 'nova-safra',
    name: 'Nova Safra',
    region: 'Núcleo Rural Rajadinha · Planaltina',
    tagline: 'Assentamento recente: tudo por construir, nada consolidado.',
    focus: 'Hortaliças, galinha caipira e ovos vendidos na porta e na feira.',
    strength: 'Família jovem e disposta a aprender coisa nova.',
    weakness: 'Nenhuma estrutura pronta: falta água encanada e galpão.',
    modifiers: { technology: -10, production: -8, cash: 8000 },
    highlight: { indicator: 'technology', label: 'Tecnologia emergente' },
  },
  {
    key: 'planalto-familiar',
    name: 'Planalto Familiar',
    region: 'Núcleo Rural Ponte Alta · Gama',
    tagline: 'Leite e queijo artesanal, com um freezer que vive no limite.',
    focus: 'Leite, queijo curado e hortaliças para complementar a renda.',
    strength: 'Renda que entra toda semana: o leite não espera a safra.',
    weakness: 'Depende de frio: se o equipamento falha, o prejuízo é no dia.',
    modifiers: { technology: 6, sustainability: -6, cash: -2000 },
    highlight: { indicator: 'production', label: 'Operação diária' },
  },
];

export const PROPERTY_BY_KEY: Record<string, PropertyProfile> = Object.fromEntries(
  PROPERTIES.map((property) => [property.key, property]),
);

/** Nomes de equipe na ordem de distribuição do lobby. */
export const TEAM_ORDER = PROPERTIES.map((property) => property.key);
