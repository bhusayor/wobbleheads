import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function destination(request: Request, next: string) {
  const requestOrigin = new URL(request.url).origin;
  const isLocal = new URL(request.url).hostname === 'localhost';
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const origin = isLocal ? requestOrigin : configuredOrigin || requestOrigin;
  return new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/', origin);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination(request, next));
  }
  const failed = destination(request, '/');
  failed.searchParams.set('auth_error', 'x');
  return NextResponse.redirect(failed);
}
