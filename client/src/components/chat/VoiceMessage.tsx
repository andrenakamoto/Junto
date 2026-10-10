import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { voiceUrl, voiceSeconds } from '../../lib/media';
import { t } from '../../i18n';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Lecteur d'un message vocal. Le fichier est chargé au premier appui (puis lu depuis la mémoire :
// Safari refuse de lire un son servi sans « Range », ce que fait notre proxy).
export function VoiceMessage({ attachment, mediaToken, isMe }: { attachment: { id: string; name: string }; mediaToken?: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(voiceSeconds(attachment.name) ?? 0);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (audio && state === 'playing') { audio.pause(); return; }
    if (audio && (state === 'paused' || state === 'idle')) { await audio.play().catch(() => setState('error')); return; }
    setState('loading');
    try {
      const res = await fetch(voiceUrl(attachment.id, mediaToken));
      if (!res.ok) throw new Error(String(res.status));
      const blob = new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' });
      urlRef.current = URL.createObjectURL(blob);
      const a = new Audio(urlRef.current);
      audioRef.current = a;
      a.onplay = () => setState('playing');
      a.onpause = () => setState('paused');
      a.onended = () => { setState('paused'); setCurrent(0); a.currentTime = 0; };
      a.ontimeupdate = () => setCurrent(a.currentTime);
      a.onloadedmetadata = () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
      await a.play();
    } catch {
      setState('error');
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(duration, Math.max(0, ((e.clientX - rect.left) / rect.width) * duration));
    setCurrent(a.currentTime);
  }

  const progress = duration ? Math.min(100, (current / duration) * 100) : 0;
  const shown = state === 'playing' || current > 0 ? current : duration;

  return (
    <div className={`flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl w-60 ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={state === 'playing' ? t('chat.voice.pause') : t('chat.voice.listen')}
        className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${isMe ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}
      >
        {state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : state === 'playing' ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div onClick={seek} className={`h-1.5 rounded-full cursor-pointer ${isMe ? 'bg-white/30' : 'bg-slate-200'}`}>
          <div className={`h-full rounded-full ${isMe ? 'bg-white' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
        </div>
        <p className={`text-[11px] mt-1 ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
          {state === 'error' ? t('chat.voice.error') : `🎤 ${shown ? fmt(shown) : t('chat.voice.label')}`}
        </p>
      </div>
    </div>
  );
}
