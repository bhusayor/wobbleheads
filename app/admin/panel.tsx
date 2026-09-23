'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight, ShieldCheck } from 'lucide-react';
import '../dashboard.css';

type Claim = { user_id: string; wallet_address: string; x_handle: string | null; share_url: string | null; claimed_at: string };
type ClaimData = { gtd: Claim[]; fcfs: Claim[]; generatedAt: string };

function ClaimTable({ tier, claims }: { tier: 'GTD' | 'FCFS'; claims: Claim[] }) {
  return <section className={`claim-panel claim-panel-${tier.toLowerCase()}`}>
    <div className="claim-panel-head">
      <div><span>{tier} ALLOCATION</span><h2>{tier} claimed wallets</h2><p>{claims.length.toLocaleString()} completed {tier} claims</p></div>
      <a className="admin-export" href={`/api/game/admin?export=${tier}`}><ArrowDownToLine size={17}/> Export {tier}</a>
    </div>
    <div className="claim-table-wrap"><table>
      <thead><tr><th>#</th><th>X username</th><th>X post</th><th>EVM wallet</th></tr></thead>
      <tbody>{claims.length ? claims.map((claim, index) => <tr key={claim.user_id}>
        <td>{String(index + 1).padStart(3, '0')}</td>
        <td><strong>{claim.x_handle ? `@${claim.x_handle}` : 'Unavailable'}</strong></td>
        <td>{claim.share_url ? <a href={claim.share_url} target="_blank" rel="noreferrer">View post <ArrowUpRight size={14}/></a> : <span>Unavailable</span>}</td>
        <td><code>{claim.wallet_address}</code></td>
      </tr>) : <tr><td colSpan={4}><div className="claim-empty">No completed {tier} claims yet.</div></td></tr>}</tbody>
    </table></div>
  </section>;
}

export default function AdminPanel() {
  const [data, setData] = useState<ClaimData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/game/admin', { cache: 'no-store' }).then(async (response) => {
      const body = await response.json() as ClaimData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load claims.');
      if (active) setData(body);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load claims.'); });
    return () => { active = false; };
  }, []);

  const total = (data?.gtd.length || 0) + (data?.fcfs.length || 0);
  return <main className="claims-admin">
    <header className="admin-topbar"><Link className="admin-brand" href="/"><span>W</span> WOBBLEHEADS.</Link><div className="admin-security"><ShieldCheck size={16}/> PRIVATE ADMIN</div></header>
    <section className="admin-hero"><div><span>CLAIM OPERATIONS</span><h1>Whitelist dashboard</h1><p>Review completed game claims and export clean allocation lists for distribution.</p></div><div className="admin-live"><i></i> Live Supabase data</div></section>
    <section className="admin-metrics"><article><span>TOTAL CLAIMED</span><strong>{data ? total.toLocaleString() : '—'}</strong><small>of 2,200 spots</small></article><article className="metric-gtd"><span>GTD CLAIMED</span><strong>{data ? data.gtd.length.toLocaleString() : '—'}</strong><small>of 700 spots</small></article><article className="metric-fcfs"><span>FCFS CLAIMED</span><strong>{data ? data.fcfs.length.toLocaleString() : '—'}</strong><small>of 1,500 spots</small></article></section>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {data ? <div className="claim-panels"><ClaimTable tier="GTD" claims={data.gtd}/><ClaimTable tier="FCFS" claims={data.fcfs}/></div> : !error && <div className="admin-loading"><i></i><span>Loading claimed wallets…</span></div>}
  </main>;
}
