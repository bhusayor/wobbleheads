'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Search, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { deriveWobbleWLStats, FCFS_TOTAL, GTD_TOTAL, levelFor, XP } from '@/lib/site-config';
import XAuthButton from '@/components/x-auth-button';
import './experience.css';

type Participant = { id: string; email: string; display_name: string; x_username: string | null; wallet: string | null; public_leaderboard: number; xp: number; badge: string | null; wl_status: string; wl_category: string | null; suspicious: number };
type Event = { event_key: string; event_date: string; xp: number };
type Submission = { task_key: string; status: string; note: string | null };
type Challenge = { id: number; image: string; remaining: number };
type State = { participant: Participant | null; events: Event[]; submissions: Submission[]; saved: { id: string; name: string; traits: string }[]; leaderboard: { display_name: string; xp: number; badge: string | null; wl_status: string }[]; config: { xUrl: string; discordUrl: string; blockchain: string; wlThreshold: number; mintDate: string; mintPrice: string; contractAddress: string; rewards: Record<string, number>; available: Record<string, boolean> }; challenge: Challenge | null; attempts: number };
type Item = { id: number; rarity: string; file: string };
type ActionResult = { error?: string; badge?: boolean; found?: number; correct?: boolean; answer?: string; xp?: number; challenge?: Challenge | null; status?: string };
type LiveWobbleWLStats = ReturnType<typeof deriveWobbleWLStats>;
const fetchWLStats = async () => {
  const response = await fetch('/api/wl-stats', { cache: 'no-store' });
  if (!response.ok) throw new Error('WL stats unavailable');
  return response.json() as Promise<LiveWobbleWLStats>;
};
const choices = ['Common', 'Uncommon', 'Rare', 'Legendary'];
const quizQuestions = [
  { title: 'A surprise plan appears. You…', answers: ['Take a nap first', 'Say yes immediately', 'Ask what is really going on', 'Watch from the sidelines', 'Lead the charge'] },
  { title: 'Pick your kind of afternoon.', answers: ['Cloud watching', 'Making a glorious mess', 'Following a curious clue', 'A quiet corner', 'A little bit of everything'] },
  { title: 'Your friend drops their pencil. You…', answers: ['Wake up and hand it back', 'Offer five different pencils', 'Check where it came from', 'Smile and pick it up', 'Make it a legend'] },
];
const personalities = ['The Sleepy Wobble', 'The Chaotic Wobble', 'The Suspicious Wobble', 'The Quiet Wobble', 'The Legendary Wobble'];
function HiddenSymbol({ number, found, onFind }: { number: number; found: boolean; onFind: (number: number) => void }) {
  return <button type="button" onClick={() => onFind(number)} className={found ? 'hidden-symbol discovered' : 'hidden-symbol'} aria-label={`Discover hidden wobble symbol ${number}`} title="A hidden wobble!">✳</button>;
}
const quests = [
  { key: 'followX', title: 'Follow the scribbles', description: 'Follow Wobbleheads on X and share your profile link.', xp: XP.followX, difficulty: 'Easy', manual: true },
  { key: 'joinDiscord', title: 'Join the conversation', description: 'Join our Discord and send your username for review.', xp: XP.joinDiscord, difficulty: 'Easy', manual: true },
  { key: 'generate', title: 'Make a Wobblehead', description: 'Let the studio put together a new face.', xp: XP.generate, difficulty: 'Easy' },
  { key: 'name', title: 'Give it a name', description: 'A proper name makes the imperfect feel personal.', xp: XP.name, difficulty: 'Easy' },
  { key: 'rarity', title: 'Guess the rarity', description: 'Guess a rarity correctly in the daily game.', xp: XP.rarityCorrect, difficulty: 'Medium' },
  { key: 'symbolBadge', title: 'Find the seven', description: 'Spot every tiny symbol hidden across the site.', xp: XP.symbolBadge, difficulty: 'Medium' },
  { key: 'share', title: 'Share your creation', description: 'Post your Wobblehead and submit the post URL.', xp: XP.share, difficulty: 'Easy', manual: true },
  { key: 'fanArt', title: 'Make imperfect fan art', description: 'Submit an HTTPS link to your art for human review.', xp: XP.fanArt, difficulty: 'Medium', manual: true },
  { key: 'quiz', title: 'Meet your personality', description: 'Finish the Wobble personality quiz.', xp: XP.quiz, difficulty: 'Easy' },
  { key: 'referral', title: 'Bring a genuine friend', description: 'Invite a real participant with your referral code.', xp: XP.referral, difficulty: 'Medium', manual: true },
] as const;

export default function Experience() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [rarityAnswer, setRarityAnswer] = useState('');
  const [rarityResult, setRarityResult] = useState<{ correct: boolean; answer: string; xp: number; challenge?: Challenge | null } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState('');
  const [guestFound, setGuestFound] = useState<number[]>([]);
  const [submissionTask, setSubmissionTask] = useState('');
  const [submissionContent, setSubmissionContent] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({ displayName: '', xUsername: '', wallet: '', publicLeaderboard: false });
  const [collection, setCollection] = useState<Item[]>([]);
  const [galleryQuery, setGalleryQuery] = useState('');
  const [galleryRarity, setGalleryRarity] = useState('all');
  const [galleryCount, setGalleryCount] = useState(24);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [wlStats, setWlStats] = useState<LiveWobbleWLStats | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/experience', { cache: 'no-store' });
      const data = await response.json() as State & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Progress is unavailable.');
      setState(data);
      if (data.participant) setProfile({ displayName: data.participant.display_name, xUsername: data.participant.x_username || '', wallet: data.participant.wallet || '', publicLeaderboard: !!data.participant.public_leaderboard });
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load progress.'); }
    finally { setLoading(false); void fetchWLStats().then(setWlStats).catch(() => setWlStats(null)); }
  }, []);
  useEffect(() => { queueMicrotask(() => void refresh()); void fetch('/collection.json').then((response) => response.json() as Promise<Item[]>).then(setCollection).catch(() => {}); const listener = () => void refresh(); window.addEventListener('wobble:progress', listener); return () => window.removeEventListener('wobble:progress', listener); }, [refresh]);
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    try {
      const response = await fetch('/api/experience', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const data = await response.json() as ActionResult;
      if (!response.ok) throw new Error(data.error || 'Try again.');
      await refresh();
      return data;
    } catch (cause) { if (action === 'claim') void fetchWLStats().then(setWlStats).catch(() => setWlStats(null)); setMessage(cause instanceof Error ? cause.message : 'Try again.'); return null; }
  };
  const participant = state?.participant;
  const completed = new Set(state?.events.map((event) => event.event_key) || []);
  const submitted = new Map(state?.submissions.map((submission) => [submission.task_key, submission.status]) || []);
  const found = participant ? Array.from({ length: 7 }, (_, index) => index + 1).filter((number) => completed.has(`symbol:${number}`)) : guestFound;
  const find = async (number: number) => {
    if (found.includes(number)) return;
    if (participant) { const result = await act('find', { symbol: number }); if (result) setMessage(result.badge ? 'You found all seven! Your badge and WL eligibility are ready.' : `A little wobble found. ${result.found}/7`); }
    else { setGuestFound([...guestFound, number]); setMessage('Found one! Sign in to save discoveries and earn XP.'); }
  };
  const gallery = useMemo(() => collection.filter((item) => (galleryRarity === 'all' || item.rarity === galleryRarity) && (!galleryQuery || String(item.id).padStart(4, '0').includes(galleryQuery.replace(/\D/g, '')))).slice(0, galleryCount), [collection, galleryQuery, galleryRarity, galleryCount]);
  const quizComplete = async (answer: number) => {
    const next = [...quizAnswers, answer]; setQuizAnswers(next);
    if (next.length === quizQuestions.length) {
      const score = next.reduce((sum, value) => sum + value, 0);
      const result = personalities[Math.round(score / next.length)];
      setQuizResult(result);
      if (participant) await act('quiz', { answers: next });
    }
  };
  const submitRarity = async () => {
    if (!rarityAnswer || !state?.challenge) return;
    const result = await act('rarity', { id: state.challenge.id, answer: rarityAnswer.toLowerCase() });
    if (result && typeof result.correct === 'boolean' && result.answer) { setRarityResult({ correct: result.correct, answer: result.answer, xp: result.xp || 0, challenge: result.challenge }); setRarityAnswer(''); }
  };
  const submitManual = async () => {
    const result = await act(submissionTask === 'referral' ? 'referral' : 'submit', submissionTask === 'referral' ? { referrer: submissionContent } : { task: submissionTask, content: submissionContent });
    if (result) { setMessage('Submitted for review. We will update your quest status after approval.'); setSubmissionTask(''); setSubmissionContent(''); }
  };
  const claimAllocation = async (category: 'gtd' | 'fcfs') => {
    const result = await act('claim', { category });
    if (result) setMessage(`${category.toUpperCase()} WL claim reserved for review.`);
  };
  const shareQuiz = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm ${quizResult}. Which Wobblehead are you?`)}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener,noreferrer');

  return <>
    <section id="story" className="world-section story-section"><div className="section-head"><span>01 / THE STORY</span><HiddenSymbol number={1} found={found.includes(1)} onFind={find}/></div><div className="story-grid"><div><h2>Not quite right.<br/><em>Exactly right.</em></h2><p>Wobbleheads began with a simple idea: the little quirks are the best parts. Every one of the 3,333 faces is hand-sketched in seven layers. Hair goes sideways. Eyes wander. Nobody has to match.</p><a className="underlined-link" href="#traits">Meet the traits <ArrowUpRight size={18}/></a></div><div className="story-art"><Image src="/images/piece-1240-legendary.svg" alt="A hand-sketched legendary Wobblehead" width={400} height={400} unoptimized/><span>beautifully<br/>unbalanced ↗</span></div></div></section>
    <section id="traits" className="world-section traits-section"><div className="section-head"><span>02 / SEVEN LITTLE LAYERS</span><HiddenSymbol number={2} found={found.includes(2)} onFind={find}/></div><h2>One face. A thousand moods.</h2><p>Background, skin, hair, eyes, nose, mouth, accessory. Change one in the studio and see the whole character shift.</p><div className="trait-cards">{['Background', 'Skin', 'Hair', 'Eyes', 'Nose', 'Mouth', 'Accessory'].map((name, index) => <a href="#studio" className="trait-card" key={name}><span>0{index + 1}</span><strong>{name}</strong><ArrowUpRight size={17}/></a>)}</div></section>
    <section id="games" className="world-section games-section"><div className="section-head"><span>03 / THE PLAYGROUND</span><HiddenSymbol number={3} found={found.includes(3)} onFind={find}/></div><div className="section-title-row"><h2>Come for the faces.<br/><em>Stay for the fun.</em></h2><p>Small games, curious discoveries, and a reason to look a little closer.</p></div><div className="game-grid"><div className="game-card rarity-card"><div className="game-label"><Star size={17}/> GAME 01 <span>+{XP.rarityCorrect} XP PER CORRECT GUESS</span></div><h3>Guess the rarity</h3><p>Study this sketch. How unusual do you think it is?</p>{state?.challenge ? <><Image className="rarity-image" src={state.challenge.image} alt="Mystery Wobblehead for the rarity game" width={300} height={300} unoptimized/><div className="rarity-choices">{choices.map((choice) => <button type="button" className={rarityAnswer === choice ? 'selected' : ''} onClick={() => setRarityAnswer(choice)} key={choice}>{choice}</button>)}</div><button className="dark-button" type="button" onClick={submitRarity} disabled={!rarityAnswer}>Check my guess <ArrowRight size={16}/></button><p className="game-footnote">{state.challenge.remaining} guesses left today · reset at midnight UTC</p></> : <p className="game-empty">{loading ? 'Loading today’s sketch…' : 'All three guesses are used. Come back tomorrow.'}</p>}{rarityResult && <output className="game-result"><strong>{rarityResult.correct ? 'You got it!' : 'Good guess.'}</strong> This one is {rarityResult.answer}. {rarityResult.xp ? `+${rarityResult.xp} XP` : ''}{rarityResult.challenge && <button type="button" onClick={() => { setState(state ? { ...state, challenge: rarityResult.challenge || null } : null); setRarityResult(null); }}>Next sketch →</button>}</output>}</div><div className="game-card quiz-card"><div className="game-label"><CircleHelp size={17}/> GAME 02 <span>+{XP.quiz} XP ONCE</span></div><h3>What&apos;s your Wobble?</h3>{quizResult ? <div className="quiz-result"><Image src="/images/piece-1031-legendary.svg" alt="A playful Wobblehead" width={200} height={200} unoptimized/><p>YOU ARE</p><h4>{quizResult}</h4><button className="underlined-link" onClick={shareQuiz} type="button">Share your result <ArrowUpRight size={17}/></button></div> : <><p>Three tiny choices. One very familiar face.</p><div className="quiz-question"><span>QUESTION {quizAnswers.length + 1} / 3</span><h4>{quizQuestions[quizAnswers.length]?.title}</h4>{quizQuestions[quizAnswers.length]?.answers.map((answer, index) => <button type="button" key={answer} onClick={() => quizComplete(index)}>{answer}<ArrowUpRight size={15}/></button>)}</div></>}</div></div></section>
    <section className="hunt-band"><div><span>THE HIDDEN WOBBLE HUNT</span><h2>Seven little symbols.<br/>One big discovery.</h2><p>Look for ✳ scattered across the world. Each find earns {XP.symbol} XP when signed in.</p></div><div className="hunt-progress"><strong>{found.length}<small>/ 7</small></strong><span>FOUND SO FAR</span><div className="hunt-dots">{Array.from({ length: 7 }, (_, index) => <i className={found.includes(index + 1) ? 'found' : ''} key={index}>✳</i>)}</div>{found.length === 7 && <b>Seven Found badge unlocked!</b>}</div></section>
    <section id="quests" className="world-section quests-section"><div className="section-head"><span>04 / WOBBLE QUESTS</span><HiddenSymbol number={4} found={found.includes(4)} onFind={find}/></div><div className="section-title-row"><div><h2>Little tasks.<br/><em>Big personality.</em></h2><p>Earn Wobble XP as you explore. Manual tasks are reviewed before points count.</p></div><div className="xp-ticket"><span>YOUR WOBBLE XP</span><strong>{participant?.xp ?? 0}</strong><p>{participant ? levelFor(participant.xp) : 'Sign in to save progress'}</p>{participant?.badge && <b>✳ {participant.badge}</b>}</div></div><div className="account-bar">{participant ? <><span>Playing as <strong>{participant.display_name}</strong><small className="referral-code"> Your referral code: {participant.id}</small></span><button type="button" onClick={() => setProfileOpen(!profileOpen)}>Edit profile <ArrowUpRight size={16}/></button><XAuthButton/></> : <><span>Play freely. Sign in when you want to keep your XP and apply for WL.</span><XAuthButton returnTo="/experience#quests"/></>}</div>{profileOpen && participant && <div className="profile-panel"><h3>Your profile</h3><p>Your email stays private. Opt in if you want your display name on the leaderboard.</p><div className="profile-fields"><label>Display name<input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}/></label><label>X username<input value={profile.xUsername} onChange={(event) => setProfile({ ...profile, xUsername: event.target.value })} placeholder="without @"/></label><label>{state?.config.blockchain === 'solana' ? 'Solana' : 'EVM'} wallet<input value={profile.wallet} onChange={(event) => setProfile({ ...profile, wallet: event.target.value })} placeholder="Wallet address"/></label></div><label className="check-label"><input type="checkbox" checked={profile.publicLeaderboard} onChange={(event) => setProfile({ ...profile, publicLeaderboard: event.target.checked })}/> Show my display name and XP on the public leaderboard</label><button className="dark-button" type="button" onClick={async () => { const result = await act('profile', profile); if (result) { setProfileOpen(false); setMessage('Profile saved.'); } }}>Save profile <Check size={16}/></button></div>}
      <div className="quest-grid">{quests.map((quest, index) => { const status = submitted.get(quest.key) || (completed.has(quest.key) || quest.key === 'rarity' && state?.events.some((event) => event.event_key.startsWith('rarity:') && event.xp > 0) || quest.key === 'symbolBadge' && participant?.badge ? 'complete' : 'open'); const unavailable = state?.config.available?.[quest.key] === false || quest.key === 'followX' && !state?.config.xUrl || quest.key === 'joinDiscord' && !state?.config.discordUrl; const manual = 'manual' in quest && quest.manual; return <div className="quest-card" key={quest.key}><div className="quest-top"><span>QUEST {String(index + 1).padStart(2, '0')}</span><b>+{state?.config.rewards?.[quest.key === 'rarity' ? 'rarityCorrect' : quest.key] ?? quest.xp} XP</b></div><h3>{quest.title}</h3><p>{quest.description}</p>{quest.key === "followX" && state?.config.xUrl && <a className="quest-official" href={state.config.xUrl} target="_blank" rel="noopener noreferrer">Open official X ↗</a>}{quest.key === "joinDiscord" && state?.config.discordUrl && <a className="quest-official" href={state.config.discordUrl} target="_blank" rel="noopener noreferrer">Open Discord ↗</a>}<div className="quest-bottom"><span>{quest.difficulty}</span><span className={`quest-status ${status}`}>{unavailable ? 'Coming soon' : status === 'open' ? 'Ready' : status === 'complete' || status === 'approved' ? 'Complete' : status}</span></div>{manual && status === 'open' && !unavailable && <button className="quest-action" type="button" onClick={() => { setSubmissionTask(quest.key); setSubmissionContent(''); }}>{quest.key === 'referral' ? 'Enter code' : 'Submit proof'} <ArrowUpRight size={15}/></button>}{!manual && <a className="quest-action" href={quest.key === 'generate' || quest.key === 'name' ? '#studio' : quest.key === 'quiz' || quest.key === 'rarity' ? '#games' : '#story'}>{status === 'open' ? 'Go to task' : 'View task'} <ArrowUpRight size={15}/></a>}</div>; })}</div>
      {submissionTask && <form className="submission-panel" onSubmit={(event) => { event.preventDefault(); void submitManual(); }}><label htmlFor="submission-content">{submissionTask === 'referral' ? 'Referral code' : submissionTask === 'fanArt' ? 'Link to your fan art' : 'Link or username for review'}</label><input id="submission-content" value={submissionContent} onChange={(event) => setSubmissionContent(event.target.value)} required/><div><button className="dark-button" type="submit">Send for review</button><button type="button" onClick={() => setSubmissionTask('')}>Cancel</button></div></form>}
      <div className="wl-panel"><div><span>WHITELIST ELIGIBILITY</span><h3>Your path to WL</h3><p>Reach {state?.config.wlThreshold ?? 150} XP or find all seven symbols, add a wallet and X username, then choose an available allocation. An admin reviews every winner.</p><small>Leaderboard rank does not guarantee WL. No mint value is promised.</small></div><div><p>STATUS: <strong>{participant?.wl_status || 'Not started'}</strong></p><div className="wl-claim-actions"><button className="button-primary" type="button" disabled={!wlStats || wlStats.gtdRemaining === 0 || participant?.wl_status === 'pending' || participant?.wl_status === 'approved'} onClick={() => void claimAllocation('gtd')}>{wlStats?.gtdRemaining === 0 ? 'GTD full' : `Claim GTD (${GTD_TOTAL})`} <ArrowUpRight size={17}/></button><button className="button-primary" type="button" disabled={!wlStats || wlStats.fcfsRemaining === 0 || participant?.wl_status === 'pending' || participant?.wl_status === 'approved'} onClick={() => void claimAllocation('fcfs')}>{wlStats?.fcfsRemaining === 0 ? 'FCFS full' : `Claim FCFS (${FCFS_TOTAL})`} <ArrowUpRight size={17}/></button></div>{wlStats?.totalRemaining === 0 && <p className="wl-full-note"><strong>WOBBLE LIST FULL</strong><br/>All 2,200 game WL spots have been claimed.</p>}</div></div>
    </section>
    <section id="gallery" className="world-section gallery-section"><div className="section-head"><span>05 / THE COLLECTION</span><HiddenSymbol number={5} found={found.includes(5)} onFind={find}/></div><div className="section-title-row"><h2>3,333 ways to<br/><em>be yourself.</em></h2><p>Every face has its own odd little logic. Find your favorite by number or rarity.</p></div><div className="gallery-controls"><label><Search size={18}/><input inputMode="numeric" placeholder="Search by number" value={galleryQuery} onChange={(event) => { setGalleryQuery(event.target.value); setGalleryCount(24); }} aria-label="Search by Wobblehead number"/></label><select value={galleryRarity} onChange={(event) => { setGalleryRarity(event.target.value); setGalleryCount(24); }} aria-label="Filter by rarity"><option value="all">All rarities</option>{choices.map((choice) => <option value={choice.toLowerCase()} key={choice}>{choice}</option>)}</select></div><div className="gallery-grid">{gallery.map((item) => <article className="gallery-item" key={item.id}><Image src={`/images/${item.file}`} alt={`Wobblehead number ${String(item.id).padStart(4, '0')}, ${item.rarity}`} width={160} height={160} unoptimized/><div><strong>#{String(item.id).padStart(4, '0')}</strong><span>{item.rarity}</span></div></article>)}</div>{gallery.length === 0 && <p>No Wobbleheads match that search.</p>}{gallery.length >= galleryCount && <button className="load-more" onClick={() => setGalleryCount(galleryCount + 24)} type="button">See more faces <ArrowRight size={17}/></button>}</section>
    <section id="leaderboard" className="world-section leaderboard-section"><div className="section-head"><span>06 / THE SCOREBOARD</span><HiddenSymbol number={6} found={found.includes(6)} onFind={find}/></div><h2>Good things add up.</h2><p>Only people who opt in appear here. Position alone does not guarantee WL.</p><button className="underlined-link" type="button" onClick={() => setLeaderboardVisible(!leaderboardVisible)}>{leaderboardVisible ? 'Hide' : 'Show'} leaderboard <ChevronDown size={17}/></button>{leaderboardVisible && <div className="leaderboard-table"><div><b>RANK</b><b>NAME</b><b>XP</b><b>LEVEL</b></div>{state?.leaderboard.length ? state.leaderboard.map((row, index) => <div key={`${row.display_name}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><span>{row.display_name} {row.badge && '✳'}</span><strong>{row.xp}</strong><span>{levelFor(row.xp)}</span></div>) : <p>No one has opted in yet. The first spot is waiting.</p>}</div>}</section>
    <section id="roadmap" className="world-section roadmap-section"><div className="section-head"><span>07 / THE ROAD AHEAD</span><HiddenSymbol number={7} found={found.includes(7)} onFind={find}/></div><h2>Build your Wobblehead.</h2><div className="roadmap-grid"><div><span>01 / HEADS</span><h3>Mint your identity</h3><p>3,333 one-of-one Heads arrive on Robinhood, each with its own face, traits, and personality.</p></div><div><span>02 / BODIES</span><h3>Complete the character</h3><p>Head holders enter the next collectible chapter and pair their face with a Wobblehead Body.</p></div><div><span>03 / GAME</span><h3>Step into the world</h3><p>Complete Wobbleheads become the cast of an upcoming game built for movement, play, and plenty of wobble.</p></div></div></section>
    <section id="faq" className="world-section faq-section"><div className="section-head"><span>08 / GOOD TO KNOW</span><span className="section-star">✳</span></div><h2>Questions, answered.</h2><div className="faq-list"><details><summary>What are Wobbleheads?</summary><p>A collection of 3,333 intentionally imperfect hand-sketched faces built from seven visual layers.</p></details><details><summary>How do I earn XP?</summary><p>Sign in, generate a Wobblehead, play the games, find symbols, and complete quests. Manual submissions receive XP only after review.</p></details><details><summary>Does XP guarantee WL?</summary><p>No. XP or the Seven Found badge makes you eligible to apply. Admin review determines WL approval and category.</p></details><details><summary>When is the mint?</summary><p>{state?.config.mintDate || state?.config.mintPrice || state?.config.contractAddress ? `Current project settings: ${state.config.mintDate ? `date ${state.config.mintDate}` : 'date unconfirmed'}, ${state.config.mintPrice ? `price ${state.config.mintPrice}` : 'price unconfirmed'}, chain ${state.config.blockchain}. Verify these details through official channels before acting.` : 'No date, price, chain, or contract has been confirmed here. Check official project channels for any announcement.'}</p></details><details><summary>How can I tell if I won?</summary><p>Approved winners appear on the <Link href="/results">WL results page</Link> once the team publishes it. Always verify official links; nobody should ask for your seed phrase.</p></details></div></section>
    <footer className="site-footer"><span>WOBBLEHEADS<span className="brand-dot">.</span></span><p>Made for the beautifully imperfect.</p><div><Link href="/results">WL results</Link><a href="#home">Back to top ↑</a></div></footer>
    {message && <output className="toast"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss message">×</button></output>}
  </>;
}
