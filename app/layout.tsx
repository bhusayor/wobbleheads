import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wobbleheads.xyz';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Wobbleheads — A little off. A lot alive.',
  description: 'Meet 3,333 one-of-one Wobbleheads on Robinhood. Play Downhill Wobble, earn your place, and help bring the Heads to life.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Wobbleheads',
    title: 'Wobbleheads — A little off. A lot alive.',
    description: '3,333 one-of-one Heads. One beautifully unbalanced world. Keep it wobbling.',
    images: [{ url: '/social-card-v3.jpg', width: 1200, height: 630, type: 'image/jpeg', alt: 'Wobbleheads — A little off. A lot alive.' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Wobbleheadds',
    title: 'Wobbleheads — A little off. A lot alive.',
    description: '3,333 one-of-one Heads. One beautifully unbalanced world. Keep it wobbling.',
    images: [{
      url: '/social-card-v3.jpg',
      width: 1200,
      height: 630,
      alt: 'Wobbleheads — A little off. A lot alive.',
    }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
