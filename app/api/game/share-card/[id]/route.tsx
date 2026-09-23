import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
/* oxlint-disable next/no-img-element -- ImageResponse requires standard image elements. */

export const runtime = 'nodejs';

async function embeddedAvatar(url: string | null) {
  if (!url || !url.startsWith('https://')) return null;
  try {
    const response = await fetch(url.replace('_normal.', '_400x400.'), { signal: AbortSignal.timeout(3500), cache: 'force-cache' });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) return null;
    return `data:${contentType};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  } catch { return null; }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const admin = createAdminClient();
  const { data } = await admin.from('whitelist_eligibility').select('user_id,run_id,tier,x_handle,x_avatar_url,game_runs(validated_survival_time)').eq('id', id).in('status', ['verified', 'claimed']).maybeSingle();
  if (!data) return new Response('Not found', { status: 404 });
  const [{ data: previousFcfs }, avatar] = await Promise.all([
    data.tier === 'GTD' ? admin.from('reward_reservations').select('id,game_runs!inner(status,validated_survival_time)').eq('user_id', data.user_id).eq('tier', 'FCFS').eq('status', 'released').neq('run_id', data.run_id).eq('game_runs.status', 'completed').gte('game_runs.validated_survival_time', 45).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    embeddedAvatar(data.x_avatar_url),
  ]);
  const run = Array.isArray(data.game_runs) ? data.game_runs[0] : data.game_runs;
  const seconds = Number(run?.validated_survival_time || 0).toFixed(1);
  const isUpgrade = Boolean(previousFcfs);
  const accent = data.tier === 'GTD' ? '#f8d666' : '#b6d9ee';
  const wobblehead = `${new URL(request.url).origin}/images/wobble-bowtie.png`;
  const handle = data.x_handle || 'wobblehead';

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#f8f1e7', color: '#25231f', fontFamily: 'sans-serif', padding: 42 }}>
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: 999, background: '#f7b9a6', top: -135, right: 215, display: 'flex' }}/>
      <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: 999, background: accent, bottom: -130, left: 350, display: 'flex' }}/>
      <div style={{ width: '100%', height: '100%', display: 'flex', border: '4px solid #25231f', borderRadius: 28, background: '#fffaf3', boxShadow: '14px 14px 0 #fa6b44', overflow: 'hidden' }}>
        <div style={{ width: '65%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '38px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, borderRadius: 999, border: '4px solid #25231f', background: accent, boxShadow: '5px 5px 0 #25231f', fontSize: 35, fontWeight: 900 }}>
              {avatar ? <img src={avatar} alt="" width="88" height="88" style={{ width: 88, height: 88, objectFit: 'cover' }}/> : handle.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 31, fontWeight: 900, letterSpacing: -1 }}>@{handle}</span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, color: '#766d61' }}>{isUpgrade ? 'FCFS → GTD UPGRADE' : 'OFFICIAL WOBBLE WINNER'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: '#fa6b44' }}>I KEPT IT WOBBLING</span>
            <span style={{ fontSize: 118, lineHeight: .9, fontWeight: 900, letterSpacing: -7, marginTop: 8 }}>{seconds}s</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, marginTop: 14 }}>SERVER VERIFIED SURVIVAL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ display: 'flex', padding: '10px 19px', border: '3px solid #25231f', borderRadius: 999, background: accent, fontSize: 25, fontWeight: 900 }}>{isUpgrade ? 'UPGRADED TO GTD' : `${data.tier} SECURED`}</span>
            <span style={{ fontSize: 16, fontWeight: 800 }}>#KeepItWobbling</span>
          </div>
        </div>
        <div style={{ width: '35%', display: 'flex', position: 'relative', alignItems: 'center', justifyContent: 'center', background: accent, borderLeft: '4px solid #25231f', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 20, display: 'flex', border: '3px dashed #25231f', borderRadius: 24, opacity: .35 }}/>
          <img src={wobblehead} alt="" width="290" height="290" style={{ width: 290, height: 290, borderRadius: 28, border: '4px solid #25231f', transform: 'rotate(4deg)', boxShadow: '9px 9px 0 #fa6b44' }}/>
          <span style={{ position: 'absolute', right: 24, bottom: 22, display: 'flex', padding: '8px 13px', border: '3px solid #25231f', borderRadius: 999, background: '#fffaf3', fontSize: 15, fontWeight: 900 }}>WOBBLEHEADS.</span>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
  );
}
