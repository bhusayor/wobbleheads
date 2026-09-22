'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export default function XAuthButton({ returnTo = '/' }: { returnTo?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user); setBusy(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAvatarFailed(false);
      setBusy(false);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
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
  return <button className="header-link x-auth-button" type="button" onClick={user ? signOut : signIn} disabled={busy || !configured} title={error || (!configured ? 'Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local' : undefined)} aria-label={user ? `Signed in${handle ? ` as @${handle}` : ''}. Sign out` : 'Sign in with X'}>
    {user && avatar && !avatarFailed && <Image className="x-auth-avatar" src={avatar} alt="" width={25} height={25} unoptimized loader={({ src }) => src} referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)}/>}
    {busy ? 'Checking…' : user ? (handle ? `@${handle}` : 'Sign out') : configured ? 'Sign in with X' : 'Sign in unavailable'} <ArrowUpRight size={15}/>
  </button>;
}
