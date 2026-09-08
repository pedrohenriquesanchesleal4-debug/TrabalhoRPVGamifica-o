import type { Metadata, Viewport } from 'next';
import { Archivo, Courier_Prime } from 'next/font/google';
import './globals.css';

/*
  Duas fontes, cada uma com um trabalho.

  Courier Prime é uma Courier redesenhada para tela: é a máquina de escrever do
  caderno de campo e carrega tudo que é registro, rótulo, número, código e
  opção de decisão. Archivo é uma grotesca de caráter, com boa leitura em
  corpo pequeno, e carrega só a narrativa das cartas, que é o único texto longo
  que o aluno lê no celular.

  Nenhuma das duas é a fonte padrão de projeto gerado por IA, e as duas são
  autoexpedidas no build pelo next/font: nenhuma requisição a servidor de fonte
  em tempo de execução, nenhum salto de layout.
*/

const courier = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-courier',
});

const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  title: 'SAFRA DF · Decisões que Alimentam',
  description:
    'Jogo multiplayer sobre agricultura familiar no Distrito Federal: cada equipe administra uma propriedade e decide sob orçamento limitado.',
  applicationName: 'SAFRA DF',
};

export const viewport: Viewport = {
  themeColor: '#f5f0e2',
  width: 'device-width',
  initialScale: 1,
  // O aluno joga no celular com uma mão: zoom liberado é acessibilidade.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${courier.variable} ${archivo.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
