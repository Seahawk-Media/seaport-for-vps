import { Hono } from 'hono';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { serveStatic } from '@hono/node-server/serve-static';
import { requireAuth } from '../middleware/auth';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MAX_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10); // 10MB

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const uploadsApp = new Hono();

// Serve uploaded files
uploadsApp.get('/uploads/*', serveStatic({ root: UPLOAD_DIR.replace('/uploads', '') }));

// Upload endpoint — requires authentication
uploadsApp.post('/api/uploads', requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF' }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: `File too large. Max ${MAX_SIZE / 1024 / 1024}MB` }, 413);
  }

  const ext = MIME_TO_EXT[file.type] || 'bin';
  const filename = `${randomUUID()}.${ext}`;

  // Ensure upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  const filepath = join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const url = `/uploads/${filename}`;
  return c.json({ url, filename });
});
