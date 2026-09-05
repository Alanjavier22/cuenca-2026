import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'cuenca-2026' });
});

// Lazy client holder for Gemini SDK
let aiClient = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Gemini server-side proxy
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY not configured',
        fallback: true
      });
    }

    const targetModel = model || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        temperature: 1.0,
        topP: 0.95
      }
    });

    const text = response.text || '';
    return res.json({ text: text.trim() });
  } catch (err) {
    console.warn('[Gemini API] Call error:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Error generating AI content',
      fallback: true
    });
  }
});

// Cache control for Service Worker
app.get('/sw.js', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript');
  next();
});

// Explicit routes for PWA manifests
app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const file = req.path.endsWith('.webmanifest') ? 'manifest.webmanifest' : 'manifest.json';
  res.sendFile(path.join(__dirname, file));
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Direct route for cuenca-actividades-y-juegos.html
app.get('/cuenca-actividades-y-juegos.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'cuenca-actividades-y-juegos.html'));
});

// SPA / Default fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cuenca 2026 server running at http://0.0.0.0:${PORT}`);
});
