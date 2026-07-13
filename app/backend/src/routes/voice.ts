import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

type BriefType = 'weather' | 'airport' | 'route' | 'notam';

const BASE_INSTRUCTION =
  'You are a certified flight dispatcher. Respond with a concise spoken briefing in plain English — ' +
  'no bullet points, no markdown, no raw METAR codes or aviation abbreviations unexplained to a student. ' +
  'Start directly with the content; do not say "Here is your briefing" or any preamble.';

function buildPrompt(type: BriefType, data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  switch (type) {
    case 'weather':
      return `${BASE_INSTRUCTION} Give a 4-to-6 sentence weather briefing covering: flight rules category, ceiling height, visibility, wind direction and speed, any significant weather phenomena, and a brief outlook from the forecast. Data:\n${json}`;
    case 'airport':
      return `${BASE_INSTRUCTION} Give a 4-to-6 sentence airport briefing covering: airport name and elevation, current flight conditions and visibility, the recommended runway given the reported wind, and density altitude if it is notably above field elevation. Data:\n${json}`;
    case 'route':
      return `${BASE_INSTRUCTION} Give a 5-to-8 sentence route briefing covering departure, destination, and alternate conditions, the overall flight rules picture for the route, and any weather concerns a pilot should factor into their go/no-go decision. Data:\n${json}`;
    case 'notam':
      return `${BASE_INSTRUCTION} Summarize the operationally significant NOTAMs in 3-to-6 sentences. Focus only on items that directly affect flight safety or operations: runway or taxiway closures, navaids out of service, airspace restrictions, or hazards to flight. Skip purely administrative or low-impact items. Data:\n${json}`;
  }
}

router.post('/brief', async (req, res, next) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    }

    const { type, data } = req.body as { type: BriefType; data: unknown };

    if (!type || !data) {
      return res.status(400).json({ error: 'type and data are required' });
    }
    if (!['weather', 'airport', 'route', 'notam'].includes(type)) {
      return res.status(400).json({ error: 'type must be weather, airport, route, or notam' });
    }

    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: buildPrompt(type, data) }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    res.json({ text });
  } catch (err) {
    next(err);
  }
});

export default router;
