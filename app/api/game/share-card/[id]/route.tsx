import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
/* oxlint-disable next/no-img-element -- ImageResponse renders remote OAuth avatars directly. */

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const admin = createAdminClient();
  const { data } = await admin.from('whitelist_eligibility').select('user_id,tier,x_handle,x_avatar_url,game_runs(validated_survival_time)').eq('id', id).in('status', ['verified', 'claimed']).maybeSingle();
  if (!data) return new Response('Not found', { status: 404 });
  const { data: previousFcfs } = data.tier === 'GTD' ? await admin.from('reward_reservations').select('id').eq('user_id', data.user_id).eq('tier', 'FCFS').eq('status', 'released').limit(1).maybeSingle() : { data: null };
  const run = Array.isArray(data.game_runs) ? data.game_runs[0] : data.game_runs;
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', background: '#f5f0e7', color: '#25231f', padding: 60, position: 'relative', fontFamily: 'sans-serif' }}><div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', border: '4px solid #25231f', padding: 46, boxShadow: '16px 16px 0 #fa6b44' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>{data.x_avatar_url && <img src={data.x_avatar_url} alt="" width="82" height="82" style={{ borderRadius: 999, border: '3px solid #25231f' }}/>}<div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 28, fontWeight: 800 }}>@{data.x_handle}</span><span style={{ fontSize: 18 }}>{previousFcfs ? 'UPGRADED FCFS → GTD' : 'KEPT IT WOBBLING'}</span></div></div><strong style={{ fontSize: 28 }}>WOBBLEHEADS.</strong></div><div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 112, lineHeight: .9, fontWeight: 900 }}>{Number(run?.validated_survival_time || 0).toFixed(1)}s</span><span style={{ fontSize: 24, marginTop: 14 }}>SERVER-VERIFIED SURVIVAL TIME</span></div><div style={{ display: 'flex', background: data.tier === 'GTD' ? '#f8d666' : '#b6c6d5', border: '4px solid #25231f', padding: '18px 28px', fontSize: 42, fontWeight: 900 }}>{data.tier}</div></div></div></div>, { width: 1200, height: 630 });
}
