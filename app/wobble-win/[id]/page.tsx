import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

type Props = { params: Promise<{ id: string }> };

async function winner(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from('whitelist_eligibility').select('tier,x_handle,game_runs(validated_survival_time)').eq('id', id).in('status', ['verified', 'claimed']).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params; const data = await winner(id);
  if (!data) return { title: 'Verified Wobbleheads run' };
  const run = Array.isArray(data.game_runs) ? data.game_runs[0] : data.game_runs;
  const seconds = Number(run?.validated_survival_time || 0).toFixed(1);
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';
  const title = `@${data.x_handle} kept it wobbling for ${seconds}s`;
  const description = `A server-verified ${data.tier} Downhill Wobble run.`;
  return { title, description, openGraph: { title, description, type: 'website', images: [{ url: `${origin}/api/game/share-card/${id}`, width: 1200, height: 630 }] }, twitter: { card: 'summary_large_image', title, description, images: [`${origin}/api/game/share-card/${id}`] } };
}

export default async function WobbleWin({ params }: Props) {
  const { id } = await params; const data = await winner(id); if (!data) notFound();
  const run = Array.isArray(data.game_runs) ? data.game_runs[0] : data.game_runs;
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5f0e7', color: '#25231f' }}><article style={{ border: '2px solid #25231f', padding: 32, maxWidth: 620, boxShadow: '10px 10px 0 #fa6b44' }}><p style={{ fontWeight: 900, letterSpacing: '.12em' }}>SERVER-VERIFIED WOBBLE</p><h1 style={{ fontSize: 'clamp(48px,9vw,86px)', lineHeight: .9, margin: '24px 0' }}>{Number(run?.validated_survival_time || 0).toFixed(1)} seconds</h1><h2>@{data.x_handle} secured {data.tier}</h2><p>Think you can keep it wobbling longer?</p><Link href="/downhill-wobble.html" style={{ display: 'inline-block', marginTop: 18, padding: '14px 18px', background: '#fa6b44', border: '2px solid #25231f', fontWeight: 900 }}>Play Downhill Wobble →</Link></article></main>;
}
