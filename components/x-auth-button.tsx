'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, LogOut } from 'lucide-react';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export default function XAuthButton({ returnTo = '/' }: { returnTo?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAvatarFailed(false);
      setBusy(false);
    });
    const closeMenu = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => { active = false; data.subscription.unsubscribe(); document.removeEventListener('pointerdown', closeMenu); };
  }, [supabase]);

  const signIn = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', returnTo);
    const { error: signInError } = await supabase.auth.signInWithOAuth({ provider: 'x', options: { redirectTo: callback.toString() } });
    if (signInError) { setError(signInError.message); setBusy(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else window.location.assign('/');
    setBusy(false);
  };

  const handle = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;
  const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || user?.user_metadata?.profile_image_url;
  const configured = Boolean(supabase);
  return <div className="x-auth" ref={wrapperRef}>
    <button className="header-link x-auth-button" type="button" onClick={user ? () => setMenuOpen((open) => !open) : signIn} disabled={busy || !configured} title={error || (!configured ? 'Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local' : undefined)} aria-label={user ? `Open account menu${handle ? ` for @${handle}` : ''}` : 'Sign in with X'} aria-expanded={user ? menuOpen : undefined}>
      {user && avatar && !avatarFailed && <Image className="x-auth-avatar" src={avatar} alt="" width={25} height={25} unoptimized loader={({ src }) => src} referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)}/>}
      {user ? (handle ? `@${handle}` : 'My profile') : configured ? 'Sign in with X' : 'Sign in unavailable'} {user ? <ChevronDown size={15}/> : <ArrowUpRight size={15}/>}
    </button>
    {user && menuOpen && <div className="x-auth-menu" role="menu">
      <div className="x-auth-menu-profile"><strong>{user.user_metadata?.name || user.user_metadata?.full_name || (handle ? `@${handle}` : 'Wobblehead')}</strong>{handle && <span>@{handle}</span>}</div>
      <button type="button" role="menuitem" onClick={signOut} disabled={busy}><LogOut size={15}/> {busy ? 'Signing out…' : 'Sign out'}</button>
    </div>}
  </div>;
}
