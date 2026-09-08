import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

/*
  Tipografia com personalidade, e nenhuma delas é a fonte padrão de todo
  projeto gerado por IA. Fraunces tem eixo ótico variável e dá o ar editorial
  aos títulos; IBM Plex Sans tem números tabulares de verdade, que é o que um
  painel de indicadores precisa. Ambas são autoexpedidas no build pelo
  next/font: nenhuma requisição a servidor de fonte em tempo de execução.
*/

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK'],
  variable: '--font-fraunces',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex',
});

export const metadata: Metadata = {
  title: 'SAFRA DF · Decisões que Alimentam',
  description:
    'Jogo multiplayer sobre agricultura familiar no Distrito Federal: cada equipe administra uma propriedade e decide sob orçamento limitado.',
  applicationName: 'SAFRA DF',
};

export const viewport: Viewport = {
  themeColor: '#f4efe6',
  width: 'device-width',
  initialScale: 1,
  // O aluno joga no celular com uma mão: zoom liberado é acessibilidade.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${plex.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
