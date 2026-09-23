'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, Menu, Shuffle, Sparkles, X } from 'lucide-react';
import NextImage from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { deriveWobbleWLStats, FCFS_TOTAL, GTD_TOTAL, TOTAL_GAME_WL } from '@/lib/site-config';
import XAuthButton from '@/components/x-auth-button';
import traitOptions from './trait-options.json';

gsap.registerPlugin(ScrollTrigger);

type Layer = keyof typeof traitOptions;
type Selection = Record<Layer, number>;
const layers = Object.keys(traitOptions) as Layer[];
const initial = Object.fromEntries(layers.map((layer) => [layer, 0])) as Selection;
const traitNames: Record<string, Record<number, string>> = {
  Background: { 1: 'Sage', 6: 'Dusty Rose', 17: 'Sage', 204: 'Sand', 317: 'Dusty Rose', 445: 'Plum', 1031: 'Sand', 1240: 'Slate Blue', 1367: 'Sand', 1870: 'Plum', 2327: 'Sage', 3094: 'Sand' },
  Face: { 1: 'Light Tan', 6: 'Olive', 17: 'Tan', 204: 'Deep Brown', 317: 'Light Tan', 445: 'Tan', 1031: 'Brown', 1240: 'Golden', 1367: 'Deep Brown', 1870: 'Tan', 2327: 'Deep Brown', 3094: 'Olive' },
  Hair: { 1: 'Bald', 6: 'Curly', 17: 'Mohawk', 204: 'Curly', 317: 'Mohawk', 445: 'Bald', 1031: 'Flame Crown', 1240: 'Beanie', 1367: 'Mohawk', 1870: 'Side Part', 2327: 'Beanie', 3094: 'Short' },
  Eyes: { 1: 'Wide', 6: 'Wide', 17: 'Laser Eyes', 204: 'Round Glasses', 317: 'Wide', 445: 'Round Glasses', 1031: 'Square Glasses', 1240: 'Round Glasses', 1367: 'Monocle', 1870: 'Monocle', 2327: 'Sleepy', 3094: 'Sleepy' },
  Nose: { 1: 'Curve', 6: 'Button', 17: 'Curve', 204: 'Dot', 317: 'Dot', 445: 'Curve', 1031: 'Dot', 1240: 'Curve', 1367: 'Dot', 1870: 'Line', 2327: 'Dot', 3094: 'Button' },
  Mouth: { 1: 'Smile', 6: 'Smile', 17: 'Open', 204: 'Smirk', 317: 'Smirk', 445: 'Flat', 1031: 'Flat', 1240: 'Smirk', 1367: 'Flat', 1870: 'Smirk', 2327: 'Flat', 3094: 'Smile' },
  Extra: { 1: 'Dimple', 6: 'Bowtie', 17: 'Freckles', 204: 'None', 445: 'Mustache', 1031: 'Dimple', 1240: 'Eyepatch', 1367: 'Freckles', 1870: 'Eyepatch', 3094: 'Headphones' },
};
const traitDisplayName = (layer: Layer, id: number) => traitNames[layer]?.[id] || `Signature ${String(id).padStart(4, '0')}`;
const uniqueTraitOptions = (layer: Layer) => {
  const seen = new Set<string>();
  return traitOptions[layer].filter((option) => {
    const label = traitDisplayName(layer, option.id);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
};
type LiveWobbleWLStats = ReturnType<typeof deriveWobbleWLStats>;
const trackAnalytics = (event: string, properties: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wobble:analytics', { detail: { event, ...properties } }));
  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  dataLayer?.push({ event, ...properties });
};

export default function Studio() {
  const shellRef = useRef<HTMLDivElement>(null);
  const generatorRef = useRef<HTMLDivElement>(null);
  const traitPortraitRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<Selection>(initial);
  const [name, setName] = useState('The beautiful mistake');
  const [nameTouched, setNameTouched] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [wlStats, setWlStats] = useState<LiveWobbleWLStats | null>(null);
  const [wlStatsError, setWlStatsError] = useState(false);
  const sources = layers.map((layer) => traitOptions[layer][selection[layer]].file);
  const heroSources = layers.map((layer) => traitOptions[layer][0].file);
  const uncommonSources = new Set([6, 204, 445]);
  const rareSources = new Set([317, 1367, 1870, 2327, 3094]);
  const legendarySources = new Set([17, 1031, 1240]);
  const rarityScore = layers.reduce((score, layer) => {
    const sourceId = traitOptions[layer][selection[layer]].id;
    return score + (legendarySources.has(sourceId) ? 3 : rareSources.has(sourceId) ? 2 : uncommonSources.has(sourceId) ? 1 : 0);
  }, 0);
  const estimatedRarity = rarityScore >= 9 ? 'Legendary' : rarityScore >= 5 ? 'Rare' : rarityScore >= 2 ? 'Uncommon' : 'Common';
  const track = async (action: string, extra: Record<string, unknown> = {}) => {
    try {
      const response = await fetch('/api/experience', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      if (response.ok) window.dispatchEvent(new Event('wobble:progress'));
      return response;
    } catch { return null; }
  };
  const randomise = () => {
    const next = Object.fromEntries(layers.map((layer) => {
      const options = uniqueTraitOptions(layer);
      return [layer, traitOptions[layer].indexOf(options[Math.floor(Math.random() * options.length)])];
    })) as Selection;
    setSelection(next);
    setNotice('A new happy accident appeared.');
    void track('generate', { traits: layers.map((layer) => next[layer]) });
    return next;
  };
  const rename = () => { if (nameTouched && name.trim()) void track('name', { name }); };
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const removeListeners: Array<() => void> = [];
    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro.from('.site-header', { y: -24, autoAlpha: 0, duration: 0.8 })
        .from('.intro-copy .eyebrow, .intro-copy h1, .intro-copy .intro-lede, .intro-copy .intro-actions, .intro-copy .intro-note', { y: 38, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, '-=0.35')
        .from('.generator-card', { y: 70, rotate: 5, scale: 0.92, autoAlpha: 0, duration: 1.1 }, '-=0.7')
        .from('.trait-strip', { y: 50, autoAlpha: 0, duration: 0.8 }, '-=0.55');

      gsap.utils.toArray<HTMLElement>('.landing-section').forEach((section) => {
        gsap.from(section, {
          y: 70,
          autoAlpha: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 82%', once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>('.preview-gallery > div, .landing-roadmap > div, .mint-checklist > div').forEach((item) => {
        gsap.from(item, {
          y: 28,
          autoAlpha: 0,
          duration: 0.75,
          ease: 'power2.out',
          scrollTrigger: { trigger: item, start: 'top 88%', once: true },
        });
      });

      const magneticItems = gsap.utils.toArray<HTMLElement>('.button-primary, .header-link, .trait-actions button');
      magneticItems.forEach((item) => {
        const move = (event: PointerEvent) => {
          const bounds = item.getBoundingClientRect();
          const x = (event.clientX - bounds.left - bounds.width / 2) * 0.12;
          const y = (event.clientY - bounds.top - bounds.height / 2) * 0.12;
          gsap.to(item, { x, y, duration: 0.35, ease: 'power3.out' });
        };
        const reset = () => gsap.to(item, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' });
        item.addEventListener('pointermove', move);
        item.addEventListener('pointerleave', reset);
        removeListeners.push(() => { item.removeEventListener('pointermove', move); item.removeEventListener('pointerleave', reset); });
      });
    }, shell);
    return () => { removeListeners.forEach((remove) => remove()); context.revert(); };
  }, []);
  useEffect(() => {
    if (!traitPortraitRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(traitPortraitRef.current, { scale: 0.96, rotate: -1 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(1.7)' });
  }, [selection]);
  const tiltGenerator = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!generatorRef.current || event.pointerType === 'touch') return;
    const bounds = generatorRef.current.getBoundingClientRect();
    const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
    const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -8;
    gsap.to(generatorRef.current, { rotateX, rotateY, transformPerspective: 900, duration: 0.5, ease: 'power2.out' });
  };
  const resetGenerator = () => { if (generatorRef.current) gsap.to(generatorRef.current, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' }); };
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: 0.08 });
    document.querySelectorAll('.world-section,.hunt-band').forEach((element) => observer.observe(element));
    return () => { observer.disconnect(); root.classList.remove('motion-ready'); };
  }, []);
  useEffect(() => {
    let active = true;
    const loadStats = () => fetch('/api/wl-stats', { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error('Stats unavailable'); return response.json() as Promise<LiveWobbleWLStats>; })
      .then((data) => { if (active) { setWlStats(data); setWlStatsError(false); } })
      .catch(() => { if (active) setWlStatsError(true); });
    void loadStats();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void loadStats(); }, 20_000);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void loadStats(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => { active = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', refreshWhenVisible); };
  }, []);
  useEffect(() => {
    const section = document.querySelector('.wl-allocation-section');
    if (!section || !wlStats) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      trackAnalytics('wl_section_viewed');
      trackAnalytics('gtd_spots_viewed', { claimed: wlStats.gtdClaimed, remaining: wlStats.gtdRemaining });
      trackAnalytics('fcfs_spots_viewed', { claimed: wlStats.fcfsClaimed, remaining: wlStats.fcfsRemaining });
      if (wlStats.fcfsRemaining < 100) trackAnalytics('fcfs_low_supply_viewed', { remaining: wlStats.fcfsRemaining });
      if (wlStats.totalRemaining === 0) trackAnalytics('wl_allocation_full_viewed');
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [wlStats]);
  useEffect(() => {
    type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { void Promise.resolve(context.registerTool({ name: 'generate_wobblehead', title: 'Generate a Wobblehead', description: 'Randomise all seven trait layers in the visible Wobblehead studio.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async () => { const next = randomise(); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); return { name, traits: layers.map((layer) => traitOptions[layer][next[layer]].label) }; } }, { signal: lifecycle.signal })).catch(() => {}); } catch { /* unsupported browser */ }
    return () => lifecycle.abort();
  });
  const download = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1200;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      for (const source of sources) {
        const image = new Image();
        image.src = source;
        await image.decode();
        context.drawImage(image, 0, 0, 1200, 1200);
      }
      const link = document.createElement('a');
      link.download = `${name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'wobblehead'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setNotice('Your Wobblehead is on its way.');
    } catch { setNotice('The image could not be downloaded. Please try again.'); }
  };
  return <div className="site-shell" id="home" ref={shellRef}>
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Wobbleheads home"><span className="brand-mark">w<span className="brand-eye">•</span></span><span>WOBBLEHEADS<span className="brand-dot">.</span></span></a>
      <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation"><a href="#studio" onClick={() => setMenuOpen(false)}>Studio</a>{/* <a href="/tasks" onClick={() => setMenuOpen(false)}>Tasks</a> */}<a href="#collection-preview" onClick={() => setMenuOpen(false)}>Collection</a><a href="#traits" onClick={() => setMenuOpen(false)}>Traits</a><a href="#story" onClick={() => setMenuOpen(false)}>Story</a><a href="#roadmap" onClick={() => setMenuOpen(false)}>Roadmap</a></nav>
      <div className="header-actions"><XAuthButton/><button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X/> : <Menu/>}</button></div>
    </header>
    <main>
      <section className="intro-studio" id="studio">
        <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE COLLECTION IS A PLAYGROUND <span className="eyebrow-star">✳</span></div><h1>3,333 imperfect faces.<br/><em>Think you belong?</em></h1><p className="intro-lede">Prove you can wobble. Play Downhill Wobble, discover your kind of strange, and find out where you fit.</p><div className="intro-actions"><Link className="button-primary" href="/downhill-wobble.html">Play Downhill Wobble <ArrowDownRight size={18}/></Link><a className="text-link" href="#traits">Meet the faces <ArrowDownRight size={19}/></a></div><div className="intro-note"><span className="scribble-arrow">↗</span><span>There is no<br/>perfect way in.</span></div></div>
        <div className="generator-card" ref={generatorRef} onPointerMove={tiltGenerator} onPointerLeave={resetGenerator} aria-label="Wobblehead generator"><div className="generator-top"><span><Sparkles size={16}/> THE WOBBLE STUDIO</span><span>NO. 001 / ∞</span></div><div className="portrait-frame"><div className="portrait-scribble">made of<br/>happy accidents</div><figure className="layer-stack" aria-label={`Generated Wobblehead named ${name}`}>{heroSources.map((source, index) => <NextImage key={layers[index]} src={source} alt="" draggable={false} width={600} height={600} unoptimized />)}</figure><span className="portrait-spark one">✳</span><span className="portrait-spark two">✴</span></div><div className="generator-name"><label htmlFor="wobble-name">CALL YOUR WOBBLEHEAD</label><input id="wobble-name" value={name} maxLength={40} onChange={(event) => { setName(event.target.value); setNameTouched(true); }} onBlur={rename} /></div><p className="rarity-estimate">Studio rarity estimate: <strong>{estimatedRarity}</strong></p><output className="notice">{notice || 'Every Wobblehead starts somewhere.'}</output></div>
        <div className="vertical-caption">NOT QUITE RIGHT. EXACTLY RIGHT. — EST. 2026</div>
      </section>
      <section className="trait-strip" id="traits" aria-label="Wobblehead traits"><div className="trait-intro"><span>THE INGREDIENTS</span><h2>Seven small choices.<br/><em>One unmistakable you.</em></h2><p>Build your character without losing sight of it. Choose a layer, watch the face change, and keep going until it feels like someone you would know.</p></div><div className="trait-workbench"><div className="trait-controls trait-controls-left">{layers.slice(0, 4).map((layer, index) => <label key={layer} className="trait-select"><span>{String(index + 1).padStart(2, '0')} / {layer === 'Face' ? 'Skin' : layer}</span><select value={selection[layer]} onChange={(event) => setSelection({ ...selection, [layer]: Number(event.target.value) })} aria-label={`Choose ${layer.toLowerCase()} trait`}>{uniqueTraitOptions(layer).map((option) => <option value={traitOptions[layer].indexOf(option)} key={option.file}>{traitDisplayName(layer, option.id)}</option>)}</select></label>)}</div><figure className="trait-portrait" ref={traitPortraitRef}><div className="layer-stack" aria-label={`Live Wobblehead named ${name}`}>{sources.map((source, index) => <NextImage key={`trait-${layers[index]}`} src={source} alt="" draggable={false} width={600} height={600} unoptimized />)}</div><figcaption>Every choice changes the character.</figcaption><div className="trait-actions"><button type="button" className="control-shuffle" onClick={randomise}><Shuffle size={17}/> Surprise me</button><button type="button" onClick={download} aria-label="Download Wobblehead"><Download size={18}/></button></div></figure><div className="trait-controls trait-controls-right">{layers.slice(4).map((layer, index) => <label key={layer} className="trait-select"><span>{String(index + 5).padStart(2, '0')} / {layer === 'Extra' ? 'Accessory' : layer}</span><select value={selection[layer]} onChange={(event) => setSelection({ ...selection, [layer]: Number(event.target.value) })} aria-label={`Choose ${layer.toLowerCase()} trait`}>{uniqueTraitOptions(layer).map((option) => <option value={traitOptions[layer].indexOf(option)} key={option.file}>{traitDisplayName(layer, option.id)}</option>)}</select></label>)}</div></div></section>
      <section className="landing-section wl-allocation-section" aria-labelledby="wl-allocation-title"><div className="landing-kicker">THE COMMUNITY COUNT</div><div className="wl-allocation-heading"><div><h2 id="wl-allocation-title">{TOTAL_GAME_WL.toLocaleString()} game WL spots</h2><p>For players who beat the Wobble. Claim your place.</p></div>{wlStats && <span className="wl-total-note">{wlStats.totalRemaining === 0 ? 'WOBBLE LIST FULL' : `${wlStats.totalRemaining} spots still open`}</span>}</div>{wlStatsError && <output className="wl-stats-error">Live WL numbers are temporarily unavailable.</output>}<div className="wl-stat-grid" aria-live="polite">{wlStats ? <><article className="wl-stat-card wl-activity-card"><span>CHALLENGE ACTIVITY</span><div className="wl-activity-counts"><div><strong>{wlStats.uniquePlayers.toLocaleString()}</strong><p>Unique players</p></div><div><strong>{wlStats.challengeAttempts.toLocaleString()}</strong><p>Total attempts</p></div></div></article><article className={`wl-stat-card wl-stat-gtd${wlStats.gtdRemaining === 0 ? ' is-full' : ''}`}><span>GTD</span><strong>{wlStats.gtdClaimed.toLocaleString()} / {GTD_TOTAL.toLocaleString()} claimed</strong>{wlStats.gtdRemaining === 0 ? <p>All {GTD_TOTAL.toLocaleString()} GTD spots have been claimed.{wlStats.fcfsRemaining > 0 && ' FCFS is still available.'}</p> : <p>{wlStats.gtdRemaining.toLocaleString()} spots remaining</p>}</article><article className={`wl-stat-card wl-stat-fcfs${wlStats.fcfsRemaining < 100 ? ' is-low' : ''}${wlStats.fcfsRemaining === 0 ? ' is-full' : ''}`}><span>FCFS</span><strong>{wlStats.fcfsClaimed.toLocaleString()} / {FCFS_TOTAL.toLocaleString()} claimed</strong>{wlStats.fcfsRemaining === 0 ? <p>FCFS allocation has been fully claimed.</p> : <p>{wlStats.fcfsRemaining < 100 ? `Only ${wlStats.fcfsRemaining.toLocaleString()} FCFS spots left` : `${wlStats.fcfsRemaining.toLocaleString()} FCFS spots remaining`}</p>}</article></> : <><div className="wl-stat-card wl-stat-skeleton" aria-label="Loading player activity"></div><div className="wl-stat-card wl-stat-skeleton" aria-label="Loading GTD allocation"></div><div className="wl-stat-card wl-stat-skeleton" aria-label="Loading FCFS allocation"></div></>}</div><div className="wl-allocation-footer"><Link className="button-primary" href="/downhill-wobble.html" onClick={() => trackAnalytics('wobble_game_cta_clicked')}>Play Downhill Wobble <ArrowDownRight size={18}/></Link></div></section>
      <section id="story" className="landing-section story-landing"><div className="landing-kicker">01 / A WORLD FOR THE UNPOLISHED</div><div className="landing-story-grid"><div><h2>Different is the beginning of belonging.</h2><p>Wobbleheads started with a simple belief: the details we try to smooth away are often the details people remember. Each face is a tiny permission slip to show up curious, unfinished, and fully yourself.</p><p>After mint, this becomes more than a collection. It becomes a shared table for odd ideas, kind collaborations, and people who make room for one another. Your Wobblehead is your invitation to the table.</p></div><div className="story-pullquote"><span>KEEP THE<br/>ODD PARTS.</span><strong>We are building a community with room to wobble.</strong></div></div></section>
      <section id="collection-preview" className="landing-section collection-preview"><div className="landing-kicker">02 / A SMALL WINDOW</div><div className="collection-preview-head"><div><h2>Come closer.<br/><em>Not all the way.</em></h2><p>There are 3,333 Wobbleheads in the world, but you do not need to see everything to feel the pull. We will reveal a considered handful here: enough to discover the range, never enough to spoil the surprise.</p><p className="preview-note">The best one may be the one you have not met yet.</p></div></div><div className="preview-gallery"><div><NextImage src="/images/piece-0001-common.svg" alt="A common Wobblehead preview" width={260} height={260} unoptimized/></div><div><NextImage src="/images/piece-1240-legendary.svg" alt="A legendary Wobblehead preview" width={260} height={260} unoptimized/></div><div><NextImage src="/images/piece-3301-legendary.svg" alt="A legendary Wobblehead preview" width={260} height={260} unoptimized/></div></div></section>
      <section id="mint" className="landing-section mint-section"><div className="landing-kicker">03 / THE DOOR, WHEN IT OPENS</div><div className="mint-grid"><div><h2>Know the facts.<br/><em>Keep the wonder.</em></h2><p>Wobbleheads will mint when the official details are ready. No countdown theatre, no mystery links in the dark: this is the one place to check the current plan.</p><div className="mint-links"><a className="text-link" href="https://x.com/Wobbleheadds" target="_blank" rel="noopener noreferrer">Official updates <ArrowUpRight size={17}/></a></div></div><div className="mint-facts" aria-label="Mint information"><div><span>SUPPLY</span><strong>3,333</strong></div><div><span>NETWORK</span><strong>TBA</strong></div><div><span>PRICE</span><strong>TBA</strong></div><div><span>MINT DATE</span><strong>TBA</strong></div><div><span>GAME WL ALLOCATION</span><strong>{TOTAL_GAME_WL.toLocaleString()} spots</strong><small>For players who beat the game · {GTD_TOTAL.toLocaleString()} GTD · {FCFS_TOTAL.toLocaleString()} FCFS</small></div><div><span>MAX PER WALLET</span><strong>TBA</strong></div><div><span>MINT STATUS</span><strong>Not announced</strong></div><div><span>OFFICIAL LINKS</span><strong><a href="https://x.com/Wobbleheadds" target="_blank" rel="noopener noreferrer">X ↗</a></strong></div></div></div></section>
      <section id="roadmap" className="landing-section roadmap-landing"><div className="landing-kicker">04 / THE WOBBLEHEADS UNIVERSE</div><div className="roadmap-heading"><h2>The roadmap is a story.<br/><em>You are in it.</em></h2><p>Each chapter opens a little more of the world. The details can change; the invitation stays the same: show up, make it stranger, and help decide what happens next.</p></div><div className="landing-roadmap chapter-grid"><div><span>CHAPTER 00</span><h3>The First Wobble</h3><p>A sketch, seven layers, and the permission to keep the odd parts.</p></div><div><span>CHAPTER 01</span><h3>3,333 Arrive</h3><p>The first faces find their people and the Wobbleheads story leaves the page.</p></div><div><span>CHAPTER 02</span><h3>The Wobbleverse</h3><p>Holders become characters, collaborators, and co-authors of a growing world.</p></div><div><span>CHAPTER 03</span><h3>Strange Things Happen</h3><p>New traits, holder challenges, community-created characters, and lore begin to collide.</p></div><div><span>CHAPTER 04</span><h3>???</h3><p>The next chapter belongs to the people who keep showing up.</p></div></div><div className="post-mint-story"><div><span>STAY AFTER MINT</span><h3>The collection is the beginning, not the ending.</h3></div><div className="post-mint-beats"><p><strong>Vote on what comes next.</strong> Community choices can steer new traits, challenges, and corners of the Wobbleverse.</p><p><strong>Tell your Wobble story.</strong> Holder spotlights, strange encounters, and community-created characters become part of the lore.</p><p><strong>Build with us.</strong> Collaborations and evolving characters keep the world moving beyond the first drop.</p></div></div><div className="roadmap-promise"><strong>Bring your oddness. Help decide what we build next.</strong><span>Follow along on X for chapter drops and community invitations.</span></div></section>
    </main>
    <footer className="landing-footer"><div><strong>WOBBLEHEADS<span className="brand-dot">.</span></strong><p>Think you&apos;re one of us? Keep It Wobbling.</p><Link className="footer-game-cta" href="/downhill-wobble.html">Play Downhill Wobble <ArrowDownRight size={17}/></Link></div><div className="landing-footer-links"><a href="#mint">Mint details</a><a href="#roadmap">The chapters</a><a href="https://x.com/Wobbleheadds" target="_blank" rel="noopener noreferrer">Follow on X ↗</a></div><small>The story is still taking shape.</small></footer>
  </div>;
}
