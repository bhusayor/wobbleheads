import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wobbleheads — A little off. A lot alive.',
  description: 'Build a Wobblehead from seven hand-sketched layers and follow the story toward the OpenSea mint.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
