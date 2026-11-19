import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GeminiHttpError,
  auditPresentationWithGemini,
  generatePresentationDeckWithGemini,
  generateSingleElementWithGemini,
  generateSlideAlternativesWithGemini,
  isGeminiConfigured,
  redesignSlideWithGemini,
  rewriteTextElementWithGemini,
} from './server/geminiSlides.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '16mb' }));

function sendGeminiError(res: express.Response, err: any) {
  const status = err instanceof GeminiHttpError ? err.status : 500;
  const message = err?.message || 'Gemini request failed.';
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
}

app.get('/api/gemini/health', (_req, res) => {
  res.json({
    ok: true,
    configured: isGeminiConfigured(),
    model: 'gemini-4-hydrogen',
  });
});

// SSE streaming endpoint for full presentation generation (Thinking + Google Search/URL Grounding + Structured JSON)
app.post('/api/gemini/slides/generate-deck', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await generatePresentationDeckWithGemini(req.body, (progress) => {
      sendEvent('progress', progress);
    });
    sendEvent('done', { rawJson: result.rawJson, sources: result.sources });
    res.end();
  } catch (err: any) {
    const status = err instanceof GeminiHttpError ? err.status : 500;
    sendEvent('error', { status, error: err?.message || 'Deck generation failed.' });
    res.end();
  }
});

app.post('/api/gemini/slides/redesign', async (req, res) => {
  try {
    const result = await redesignSlideWithGemini(req.body);
    res.json(result);
  } catch (err) {
    sendGeminiError(res, err);
  }
});

app.post('/api/gemini/slides/alternatives', async (req, res) => {
  try {
    const rawJson = await generateSlideAlternativesWithGemini(req.body);
    res.json({ rawJson });
  } catch (err) {
    sendGeminiError(res, err);
  }
});

app.post('/api/gemini/slides/rewrite', async (req, res) => {
  try {
    const rawJson = await rewriteTextElementWithGemini(req.body);
    res.json({ rawJson });
  } catch (err) {
    sendGeminiError(res, err);
  }
});

app.post('/api/gemini/slides/audit', async (req, res) => {
  try {
    const rawJson = await auditPresentationWithGemini(req.body);
    res.json({ rawJson });
  } catch (err) {
    sendGeminiError(res, err);
  }
});

app.post('/api/gemini/slides/generate-element', async (req, res) => {
  try {
    const rawJson = await generateSingleElementWithGemini(req.body);
    res.json({ rawJson });
  } catch (err) {
    sendGeminiError(res, err);
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tacstem server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
