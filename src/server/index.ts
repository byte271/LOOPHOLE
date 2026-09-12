import { createApp } from './app';

try { process.loadEnvFile?.(); } catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
    console.error('Unable to load .env. Check its format and permissions.'); process.exit(1);
  }
}
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? '3001');
if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT must be an integer from 1 through 65535.'); process.exit(1); }
try {
  const app = createApp({ host, apiKey: process.env.OPENAI_API_KEY?.trim(), model: process.env.OPENAI_MODEL?.trim() || undefined,
    accessToken: process.env.LOOPHOLE_ACCESS_TOKEN?.trim(), production: process.env.NODE_ENV === 'production',
  });
  const server = app.listen(port, host, () => console.info(`LOOPHOLE server listening on port ${port}. AI ${process.env.OPENAI_API_KEY?.trim() ? 'configured' : 'unavailable'}.`));
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  server.on('error', () => { console.error('Unable to bind LOOPHOLE server. Check HOST, PORT and permissions.'); process.exit(1); });
} catch {
  console.error('Unable to start LOOPHOLE. Non-loopback HOST requires LOOPHOLE_ACCESS_TOKEN.'); process.exit(1);
}
