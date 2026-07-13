import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

type BriefType = 'weather' | 'airport' | 'route' | 'notam';
type State = 'idle' | 'loading' | 'speaking' | 'error';

interface Props {
  type: BriefType;
  data: unknown;
  disabled?: boolean;
}

// Voice preference order — first match wins.
// Chrome ships Google neural voices; Safari ships Apple neural voices.
// Both sound dramatically better than the browser default.
const VOICE_PRIORITY = [
  (v: SpeechSynthesisVoice) => v.name === 'Google US English',
  (v: SpeechSynthesisVoice) => v.name.startsWith('Google') && v.lang.startsWith('en'),
  (v: SpeechSynthesisVoice) => v.name === 'Samantha' && v.lang.startsWith('en'),       // macOS Safari
  (v: SpeechSynthesisVoice) => /enhanced/i.test(v.name) && v.lang.startsWith('en'),    // macOS enhanced
  (v: SpeechSynthesisVoice) => /premium/i.test(v.name) && v.lang.startsWith('en'),     // macOS premium
  (v: SpeechSynthesisVoice) => v.lang === 'en-US',
  (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const test of VOICE_PRIORITY) {
    const match = voices.find(test);
    if (match) return match;
  }
  return voices[0] ?? null;
}

export default function VoiceButton({ type, data, disabled }: Props) {
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop any in-progress speech if the component unmounts (e.g. navigating away).
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  function stop() {
    window.speechSynthesis.cancel();
    utterRef.current = null;
    setState('idle');
  }

  async function handleClick() {
    if (state === 'speaking') { stop(); return; }
    if (state === 'loading') return;

    setState('loading');
    try {
      const { text } = await api.voice.brief(type, data);
      if (!text) { setState('idle'); return; }

      const utt = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) utt.voice = voice;
      utt.rate  = 0.95;   // slightly slower than default — clearer for aviation data
      utt.pitch = 1.0;
      utt.volume = 1.0;
      utterRef.current = utt;
      utt.onend = () => setState('idle');
      utt.onerror = () => setState('idle');
      setState('speaking');
      window.speechSynthesis.speak(utt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VoiceButton]', msg);
      setErrorMsg(msg);
      setState('error');
      setTimeout(() => { setState('idle'); setErrorMsg(''); }, 4000);
    }
  }

  const label =
    state === 'loading' ? 'Briefing…' :
    state === 'speaking' ? 'Stop' :
    state === 'error'    ? 'Error — retry?' :
    'Voice Brief';

  const className = [
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
    state === 'speaking'
      ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
      : state === 'error'
      ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600',
    (disabled || state === 'loading') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
  ].join(' ');

  return (
    <span className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'loading'}
        title={state === 'speaking' ? 'Stop voice briefing' : 'Hear an AI voice briefing'}
        className={className}
      >
        {state === 'loading' && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {state === 'speaking' && (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        )}
        {(state === 'idle' || state === 'error') && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.54 8.46a5 5 0 010 7.07" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        )}
        {label}
      </button>
      {state === 'error' && errorMsg && (
        <span className="text-xs text-red-600 dark:text-red-400 max-w-xs leading-tight">
          {errorMsg}
        </span>
      )}
    </span>
  );
}
