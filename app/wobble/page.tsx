import type { Metadata } from 'next';
import Studio from '../studio';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wobbleheads.xyz';
const shareUrl = new URL('/wobble', siteUrl).toString();
const imageUrl = new URL('/social-card-v3.jpg', siteUrl).toString();

export const metadata: Metadata = {
  title: 'Wobbleheads — A little off. A lot alive.',
  description: 'Meet 3,333 one-of-one Wobbleheads on Robinhood. Play Downhill Wobble and keep it wobbling.',
  alternates: { canonical: shareUrl },
  openGraph: {
    type: 'website',
    url: shareUrl,
    siteName: 'Wobbleheads',
    title: 'Wobbleheads — A little off. A lot alive.',
    description: '3,333 one-of-one Heads. One beautifully unbalanced world. Keep it wobbling.',
    images: [{
      url: imageUrl,
      width: 1200,
      height: 630,
      type: 'image/jpeg',
      alt: 'Wobbleheads with a gamepad — A little off. A lot alive.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Wobbleheadds',
    creator: '@Wobbleheadds',
    title: 'Wobbleheads — A little off. A lot alive.',
    description: '3,333 one-of-one Heads. One beautifully unbalanced world. Keep it wobbling.',
    images: [{
      url: imageUrl,
      width: 1200,
      height: 630,
      alt: 'Wobbleheads with a gamepad — A little off. A lot alive.',
    }],
  },
};

export default function WobbleSharePage() {
  return <Studio />;
}
