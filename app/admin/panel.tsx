'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight, ShieldCheck, Trash2, X } from 'lucide-react';
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
        <td data-label="#">{String(index + 1).padStart(3, '0')}</td>
        <td data-label="X username"><strong>{claim.x_handle ? `@${claim.x_handle}` : 'Unavailable'}</strong></td>
        <td data-label="X post">{claim.share_url ? <a href={claim.share_url} target="_blank" rel="noreferrer">View post <ArrowUpRight size={14}/></a> : <span>Unavailable</span>}</td>
        <td data-label="EVM wallet"><code>{claim.wallet_address}</code></td>
      </tr>) : <tr><td colSpan={4}><div className="claim-empty">No completed {tier} claims yet.</div></td></tr>}</tbody>
    </table></div>
  </section>;
}

export default function AdminPanel() {
  const [data, setData] = useState<ClaimData | null>(null);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/game/admin', { cache: 'no-store' }).then(async (response) => {
      const body = await response.json() as ClaimData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load claims.');
      if (active) setData(body);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load claims.'); });
    return () => { active = false; };
  }, []);

  async function resetLiveData() {
    setResetting(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/game/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset-live-data', confirmation: resetText }) });
      const body = await response.json() as ClaimData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not reset live data.');
      setData({ gtd: [], fcfs: [], generatedAt: body.generatedAt });
      setResetOpen(false); setResetText(''); setNotice('Live game data has been reset. Homepage counts will now start from zero.');
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Could not reset live data.'); }
    finally { setResetting(false); }
  }

  const total = (data?.gtd.length || 0) + (data?.fcfs.length || 0);
  return <main className="claims-admin">
    <header className="admin-topbar"><Link className="admin-brand" href="/"><span>W</span> WOBBLEHEADS.</Link><div className="admin-security"><ShieldCheck size={16}/> PRIVATE ADMIN</div></header>
    <section className="admin-hero"><div><span>CLAIM OPERATIONS</span><h1>Whitelist dashboard</h1><p>Review completed game claims and export clean allocation lists for distribution.</p></div><div className="admin-live"><i></i> Live Supabase data</div></section>
    <section className="admin-metrics"><article><span>TOTAL CLAIMED</span><strong>{data ? total.toLocaleString() : '—'}</strong><small>of 2,200 spots</small></article><article className="metric-gtd"><span>GTD CLAIMED</span><strong>{data ? data.gtd.length.toLocaleString() : '—'}</strong><small>of 700 spots</small></article><article className="metric-fcfs"><span>FCFS CLAIMED</span><strong>{data ? data.fcfs.length.toLocaleString() : '—'}</strong><small>of 1,500 spots</small></article></section>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <output className="admin-notice">{notice}</output>}
    {data ? <div className="claim-panels"><ClaimTable tier="GTD" claims={data.gtd}/><ClaimTable tier="FCFS" claims={data.fcfs}/></div> : !error && <div className="admin-loading"><i></i><span>Loading claimed wallets…</span></div>}
    <section className="admin-danger">
      <div><span>DATA CONTROLS</span><h2>Start the challenge fresh</h2><p>Clear all game attempts, reward reservations, submitted posts, wallets, claims, and homepage counters.</p></div>
      <button type="button" onClick={() => setResetOpen(true)}><Trash2 size={17}/> Reset live game data</button>
    </section>
    {resetOpen && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !resetting) setResetOpen(false); }}>
      <dialog className="admin-reset-modal" open aria-modal="true" aria-labelledby="reset-title">
        <button className="admin-modal-close" type="button" aria-label="Close" disabled={resetting} onClick={() => setResetOpen(false)}><X size={18}/></button>
        <span>PERMANENT RESET</span><h2 id="reset-title">Clear all live game data?</h2>
        <p>This removes every attempt, FCFS and GTD reservation, X post, and submitted wallet. This action cannot be undone.</p>
        <label htmlFor="reset-confirmation">Type <strong>RESET</strong> to continue</label>
        <input id="reset-confirmation" value={resetText} disabled={resetting} autoComplete="off" onChange={(event) => setResetText(event.target.value)} />
        <div><button className="admin-cancel" type="button" disabled={resetting} onClick={() => setResetOpen(false)}>Cancel</button><button className="admin-confirm-reset" type="button" disabled={resetText !== 'RESET' || resetting} onClick={() => void resetLiveData()}>{resetting ? 'Resetting…' : 'Clear everything'}</button></div>
      </dialog>
    </div>}
  </main>;
}
