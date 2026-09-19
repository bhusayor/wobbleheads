import { database, settings } from '@/lib/server';
import { shortWallet } from '@/lib/site-config';
import Link from 'next/link';
import '../dashboard.css';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const db = database();
  const row = await db.prepare("SELECT value FROM settings WHERE key='resultsPublished'").first<{ value: string }>();
  const published = row?.value === 'true';
  const winners = published ? (await db.prepare("SELECT wallet,wl_category,approved_at FROM participants WHERE wl_status='approved' AND wallet IS NOT NULL ORDER BY approved_at DESC").all<{ wallet: string; wl_category: string; approved_at: string }>()).results : [];
  const config = await settings();
  return <main className="results-page"><Link href="/">← Wobbleheads</Link><div className="results-hero"><span>OFFICIAL WHITELIST STATUS</span><h1>{published ? 'The WL list' : 'The list is taking shape.'}</h1><p>{published ? 'Approved wallets appear here once the team confirms them.' : 'WL winners have not been published yet. Check back after the official announcement.'}</p></div>{published && <div className="results-list"><div><strong>WALLET</strong><strong>CATEGORY</strong><strong>CONFIRMED</strong></div>{winners.map((winner) => <div key={winner.wallet}><span>{shortWallet(winner.wallet)}</span><span>{winner.wl_category}</span><time>{new Date(winner.approved_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</time></div>)}{!winners.length && <p>No approved winners are listed yet.</p>}</div>}<aside><h2>Verify before you act</h2><p>Use only official project links. Never share a seed phrase or sign an unexpected wallet request. This page shows shortened wallets for privacy; contact the team through an official channel if you need help verifying your entry.</p><div>{config.xUrl && <a href={config.xUrl} target="_blank" rel="noopener noreferrer">Official X ↗</a>}{config.discordUrl && <a href={config.discordUrl} target="_blank" rel="noopener noreferrer">Official Discord ↗</a>}</div></aside></main>;
}
