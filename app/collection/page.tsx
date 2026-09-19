import Link from 'next/link';

export const metadata = {
  title: 'Collection — Wobbleheads',
  description: 'Explore the Wobbleheads collection.',
};

export default function CollectionPage() {
  return <main className="collection-landing"><Link href="/">← Back to studio</Link><h1>The collection is still taking shape.</h1><p>Individual Wobbleheads will be revealed here as the collection opens.</p></main>;
}