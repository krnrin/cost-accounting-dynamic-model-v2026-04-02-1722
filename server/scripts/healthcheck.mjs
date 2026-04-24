const target = process.env.HEALTHCHECK_URL || 'http://127.0.0.1:3001/health';

try {
  const response = await fetch(target);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.status !== 'ok') {
    throw new Error(`Unexpected health payload: ${JSON.stringify(payload)}`);
  }

  console.log(`[healthcheck] ok: ${target}`);
} catch (error) {
  console.error('[healthcheck] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
