import type { APIRoute } from 'astro';
import { trackEvent } from '../../../lib/admin.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const eventType = body.eventType || 'view';
  const page = body.page || 'unknown';
  const details = JSON.stringify(body.details || {});

  await trackEvent(eventType, page, details);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
