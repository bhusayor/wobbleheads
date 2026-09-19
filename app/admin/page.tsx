import { identity, isAdmin } from '@/lib/server';
import AdminPanel from './panel';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await identity();
  if (!user || !isAdmin(user.userId)) return <main className="private-page"><Link href="/">← Wobbleheads</Link><h1>Admin access required</h1><p>This area is available only to approved project admins.</p></main>;
  return <AdminPanel />;
}
