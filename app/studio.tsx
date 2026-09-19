'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, Menu, Shuffle, Sparkles, X } from 'lucide-react';
import NextImage from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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

export default function Studio() {
  const shellRef = useRef<HTMLDivElement>(null);
  const generatorRef = useRef<HTMLDivElement>(null);
  const traitPortraitRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<Selection>(initial);
  const [name, setName] = useState('The beautiful mistake');
  const [nameTouched, setNameTouched] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
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
      <div className="header-actions"><a className="header-link x-follow" href="https://x.com/Wobbleheadds" target="_blank" rel="noopener noreferrer">Follow on X <ArrowUpRight size={15}/></a>{/* <a className="header-link x-login" href="https://x.com/i/flow/login" target="_blank" rel="noopener noreferrer">Sign in with X <ArrowUpRight size={15}/></a> */}<button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X/> : <Menu/>}</button></div>
    </header>
    <main>
      <section className="intro-studio" id="studio">
        <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line"/> A COLLECTIBLE FOR THE BEAUTIFULLY IMPERFECT <span className="eyebrow-star">✳</span></div><h1>A little off.<br/><em>A lot alive.</em></h1><p className="intro-lede">Wobbleheads is a limited collection of 3,333 hand-sketched characters, each assembled from seven expressive layers. Find the one that feels like it has already been waiting for you.</p><div className="intro-actions"><a className="button-primary" href="#traits">Shape your character <ArrowDownRight size={18}/></a><a className="text-link" href="#mint">How minting works <ArrowDownRight size={19}/></a></div><div className="intro-note"><span className="scribble-arrow">↗</span><span>Make room for<br/>your odd little details.</span></div></div>
        <div className="generator-card" ref={generatorRef} onPointerMove={tiltGenerator} onPointerLeave={resetGenerator} aria-label="Wobblehead generator"><div className="generator-top"><span><Sparkles size={16}/> THE WOBBLE STUDIO</span><span>NO. 001 / ∞</span></div><div className="portrait-frame"><div className="portrait-scribble">made of<br/>happy accidents</div><figure className="layer-stack" aria-label={`Generated Wobblehead named ${name}`}>{heroSources.map((source, index) => <NextImage key={layers[index]} src={source} alt="" draggable={false} width={600} height={600} unoptimized />)}</figure><span className="portrait-spark one">✳</span><span className="portrait-spark two">✴</span></div><div className="generator-name"><label htmlFor="wobble-name">CALL YOUR WOBBLEHEAD</label><input id="wobble-name" value={name} maxLength={40} onChange={(event) => { setName(event.target.value); setNameTouched(true); }} onBlur={rename} /></div><p className="rarity-estimate">Studio rarity estimate: <strong>Common</strong></p><output className="notice">{notice || 'Every Wobblehead starts somewhere.'}</output></div>
        <div className="vertical-caption">NOT QUITE RIGHT. EXACTLY RIGHT. — EST. 2026</div>
      </section>
      <section className="trait-strip" id="traits" aria-label="Wobblehead traits"><div className="trait-intro"><span>THE INGREDIENTS</span><h2>Seven small choices.<br/><em>One unmistakable you.</em></h2><p>Build your character without losing sight of it. Choose a layer, watch the face change, and keep going until it feels like someone you would know.</p></div><div className="trait-workbench"><div className="trait-controls trait-controls-left">{layers.slice(0, 4).map((layer, index) => <label key={layer} className="trait-select"><span>{String(index + 1).padStart(2, '0')} / {layer === 'Face' ? 'Skin' : layer}</span><select value={selection[layer]} onChange={(event) => setSelection({ ...selection, [layer]: Number(event.target.value) })} aria-label={`Choose ${layer.toLowerCase()} trait`}>{uniqueTraitOptions(layer).map((option) => <option value={traitOptions[layer].indexOf(option)} key={option.file}>{traitDisplayName(layer, option.id)}</option>)}</select></label>)}</div><figure className="trait-portrait" ref={traitPortraitRef}><div className="layer-stack" aria-label={`Live Wobblehead named ${name}`}>{sources.map((source, index) => <NextImage key={`trait-${layers[index]}`} src={source} alt="" draggable={false} width={600} height={600} unoptimized />)}</div><figcaption>Every choice changes the character.</figcaption><div className="trait-actions"><button type="button" className="control-shuffle" onClick={randomise}><Shuffle size={17}/> Surprise me</button><button type="button" onClick={download} aria-label="Download Wobblehead"><Download size={18}/></button></div></figure><div className="trait-controls trait-controls-right">{layers.slice(4).map((layer, index) => <label key={layer} className="trait-select"><span>{String(index + 5).padStart(2, '0')} / {layer === 'Extra' ? 'Accessory' : layer}</span><select value={selection[layer]} onChange={(event) => setSelection({ ...selection, [layer]: Number(event.target.value) })} aria-label={`Choose ${layer.toLowerCase()} trait`}>{uniqueTraitOptions(layer).map((option) => <option value={traitOptions[layer].indexOf(option)} key={option.file}>{traitDisplayName(layer, option.id)}</option>)}</select></label>)}</div></div></section>
      <section id="story" className="landing-section story-landing"><div className="landing-kicker">01 / A WORLD FOR THE UNPOLISHED</div><div className="landing-story-grid"><div><h2>Different is the beginning of belonging.</h2><p>Wobbleheads started with a simple belief: the details we try to smooth away are often the details people remember. Each face is a tiny permission slip to show up curious, unfinished, and fully yourself.</p><p>After mint, this becomes more than a collection. It becomes a shared table for odd ideas, kind collaborations, and people who make room for one another. Your Wobblehead is your invitation to the table.</p></div><div className="story-pullquote"><span>KEEP THE<br/>ODD PARTS.</span><strong>We are building a community with room to wobble.</strong></div></div></section>
      <section id="collection-preview" className="landing-section collection-preview"><div className="landing-kicker">02 / A SMALL WINDOW</div><div className="collection-preview-head"><div><h2>Come closer.<br/><em>Not all the way.</em></h2><p>There are 3,333 Wobbleheads in the world, but you do not need to see everything to feel the pull. We will reveal a considered handful here: enough to discover the range, never enough to spoil the surprise.</p><p className="preview-note">The best one may be the one you have not met yet.</p></div></div><div className="preview-gallery"><div><NextImage src="/images/piece-0001-common.svg" alt="A common Wobblehead preview" width={260} height={260} unoptimized/></div><div><NextImage src="/images/piece-1240-legendary.svg" alt="A legendary Wobblehead preview" width={260} height={260} unoptimized/></div><div><NextImage src="/images/piece-3301-legendary.svg" alt="A legendary Wobblehead preview" width={260} height={260} unoptimized/></div></div></section>
      <section id="mint" className="landing-section mint-section"><div className="landing-kicker">03 / WHEN THE DOOR OPENS</div><div className="mint-grid"><div><h2>When it feels right,<br/><em>we open the door.</em></h2><p>Wobbleheads will mint on OpenSea when the collection, contract, and launch details are ready to be shared properly. No countdown theatre. No mystery links in the dark. Just one official destination and a project worth arriving for.</p><a className="button-primary" href="https://opensea.io" target="_blank" rel="noopener noreferrer">OpenSea, when ready <ArrowUpRight size={17}/></a></div><div className="mint-checklist"><div><span>01</span><strong>Follow the signal</strong><p>The official collection link will be published here before launch.</p></div><div><span>02</span><strong>Choose your character</strong><p>Browse the revealed collection, then find the Wobblehead that stays with you.</p></div><div><span>03</span><strong>Bring it into the world</strong><p>Minting is the beginning of the community story, not the end of it.</p></div></div></div></section>
      <section id="roadmap" className="landing-section roadmap-landing"><div className="landing-kicker">04 / THE ROAD AHEAD</div><div className="roadmap-heading"><h2>Mint is a milestone.<br/><em>The community is the story.</em></h2><p>Wobbleheads is designed to keep giving holders a reason to return, create, and bring someone else into the world.</p></div><div className="landing-roadmap"><div><span>01 / BEFORE MINT</span><h3>Find your wobble</h3><p>Explore the studio, meet the traits, and find the face that feels a little too familiar.</p></div><div><span>02 / AT MINT</span><h3>Open the door</h3><p>Collect a character, claim your place in the first chapter, and help shape what comes next.</p></div><div><span>03 / AFTER MINT</span><h3>A world that grows with you</h3><p>Holder-only prompts, community spotlights, collaborative drops, and new ways to use your Wobblehead as your identity in the story.</p></div></div><div className="roadmap-promise"><strong>Bring your oddness. Help decide what we build next.</strong><span>Follow along on X for launch details and the first community invitations.</span></div></section>
    </main>
    <footer className="landing-footer"><div><strong>WOBBLEHEADS<span className="brand-dot">.</span></strong><p>A little off. A lot alive.</p></div><div className="landing-footer-links"><a href="#mint">Mint details</a><a href="#story">Our story</a><a href="https://x.com/Wobbleheadds" target="_blank" rel="noopener noreferrer">Follow on X ↗</a><a href="https://opensea.io" target="_blank" rel="noopener noreferrer">OpenSea ↗</a></div><small>Official mint details will be posted here before launch.</small></footer>
  </div>;
}
