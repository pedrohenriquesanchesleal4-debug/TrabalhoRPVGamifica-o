import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope, Newsreader } from 'next/font/google';
import './globals.css';

/*
  Três famílias, três funções. Nenhuma repete as três direções visuais
  rejeitadas ("Terra Cerrado" com Fraunces, "Boletim de Safra" com Fraunces,
  "Curva de Nível" com Space Grotesk), e nenhuma é a fonte padrão de projeto
  gerado por IA.

  Newsreader é serifada editorial de verdade: onde Space Grotesk falava
  "painel geométrico", ela fala "manchete de jornal de safra lido à luz de
  lampião". É o "80% clareza, 20% espetáculo" pedido para os momentos de
  entrada, transição, decisão e resultado, sem recair no Fraunces já banido.
  Carrega só título (`h1`/`h2`/`h3`, `.relevo-*`).

  Manrope é humanista de x-height alta: lê bem em 0.875rem na tela de celular,
  que é onde 30 dos 31 usuários de uma partida estão. Segue da V3: nunca foi
  o problema, só o resto do sistema em volta dela.

  JetBrains Mono carrega todo número, com tabular ligado e ligadura desligada.

  Só os pesos usados, subconjunto latino, autoexpedidas no build pelo
  next/font: nenhuma requisição a servidor de fonte em tempo de execução, o
  que importa numa sala de aula com rede ruim e 30 celulares.
*/

const editorial = Newsreader({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-editorial',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-manrope',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'SAFRA DF · Decisões que Alimentam',
  description:
    'Jogo multiplayer sobre agricultura familiar no Distrito Federal: cada equipe administra uma propriedade e decide sob orçamento limitado.',
  applicationName: 'SAFRA DF',
};

export const viewport: Viewport = {
  themeColor: '#110d09',
  width: 'device-width',
  initialScale: 1,
  // O aluno joga no celular com uma mão: zoom liberado é acessibilidade.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${editorial.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
