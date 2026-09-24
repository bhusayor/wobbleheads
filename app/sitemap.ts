import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wobbleheads.xyz';
  const now = new Date();

  return [
    { url: new URL('/', base).toString(), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: new URL('/wobble', base).toString(), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: new URL('/collection', base).toString(), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: new URL('/tasks', base).toString(), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
  ];
}
