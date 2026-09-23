import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedNext = requestUrl.searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';
  const local = requestUrl.hostname === 'localhost';
  const origin = local ? requestUrl.origin : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || requestUrl.origin;
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'x', options: { redirectTo: callback.toString() } });
  if (error || !data.url) return NextResponse.redirect(new URL('/?auth_error=x', origin));
  return NextResponse.redirect(data.url);
}
