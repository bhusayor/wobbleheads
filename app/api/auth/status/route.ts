import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  const metadata = user.user_metadata || {};
  return Response.json({ authenticated: true, handle: metadata.user_name || metadata.preferred_username || null, avatar: metadata.avatar_url || metadata.picture || metadata.profile_image_url || null }, { headers: { 'Cache-Control': 'no-store' } });
}
