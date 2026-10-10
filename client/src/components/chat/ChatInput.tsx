import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Send, X, ImagePlus, Loader2, Camera, Images, Mic, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { isTouchDevice, sendsOnEnter } from '../../lib/keyboard';

interface ReplyTarget {
  id: string;
  authorPseudo: string;
  preview: string;
}

interface Props {
  onSend: (content: string) => void;
  members?: { pseudo: string }[];
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  /** Envoyer une photo (le texte saisi sert de légende) ; absent : pas de bouton photo */
  onSendPhoto?: (file: File, caption: string) => Promise<void>;
  /** Envoyer un message vocal ; absent : pas de bouton micro */
  onSendVoice?: (audio: Blob, seconds: number) => Promise<void>;
}

const VOICE_MAX_SECONDS = 120;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function ChatInput({ onSend, members = [], replyTo, onCancelReply, onSendPhoto, onSendVoice }: Props) {
  const [value, setValue] = useState('');
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Sur téléphone, le sélecteur Android n'ouvre que la galerie : on propose aussi l'appareil photo
  const [photoMenu, setPhotoMenu] = useState(false);
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onSendPhoto) return;
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError(t('chat.input.photoTooBig'));
      return;
    }
    setSendingPhoto(true);
    setPhotoError('');
    try {
      await onSendPhoto(file, value.trim());
      setValue('');
    } catch (err: any) {
      setPhotoError(err?.response?.data?.error || t('chat.input.photoFailed'));
    } finally {
      setSendingPhoto(false);
    }
  }
  // Message vocal : un appui démarre l'enregistrement, puis Envoyer ou la corbeille (2 min max)
  const [recSeconds, setRecSeconds] = useState<number | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const sendOnStopRef = useRef(false);

  function releaseMic() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  useEffect(() => () => { sendOnStopRef.current = false; recorderRef.current?.state === 'recording' && recorderRef.current.stop(); releaseMic(); }, []);

  async function startRecording() {
    if (!onSendVoice) return;
    setPhotoError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPhotoError(t('chat.input.noRecorder'));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhotoError(t('chat.input.allowMic'));
      return;
    }
    streamRef.current = stream;
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(mt => MediaRecorder.isTypeSupported?.(mt));
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      releaseMic();
      setRecSeconds(null);
      recorderRef.current = null;
      const seconds = (Date.now() - startedAt) / 1000;
      if (!sendOnStopRef.current || seconds < 1 || !chunks.length) return;
      const blob = new Blob(chunks, { type: (recorder.mimeType || type || 'audio/webm').split(';')[0] });
      setSendingVoice(true);
      try {
        await onSendVoice(blob, seconds);
      } catch (err: any) {
        setPhotoError(err?.response?.data?.error || t('chat.input.voiceFailed'));
      } finally {
        setSendingVoice(false);
      }
    };
    recorderRef.current = recorder;
    sendOnStopRef.current = false;
    recorder.start(250);
    setRecSeconds(0);
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setRecSeconds(s);
      if (s >= VOICE_MAX_SECONDS) stopRecording(true);
    }, 250);
  }

  function stopRecording(send: boolean) {
    sendOnStopRef.current = send;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else releaseMic();
  }

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touch = isTouchDevice();
  // La zone de saisie grandit avec le texte (jusqu'à 120 px, puis elle défile)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Vide : hauteur d'une ligne (le texte d'aide peut tenir sur deux)
    if (value) el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const mentionMatches = mentionQuery !== null
    ? members.filter(m => m.pseudo.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    setMentionQuery(null);
    // On reste dans le champ : le clavier du téléphone ne se ferme pas après l'envoi
    textareaRef.current?.focus();
  }

  // Toucher le bouton ne doit pas retirer le focus du champ (sinon le clavier se ferme)
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const caret = e.target.selectionStart ?? v.length;
    const uptoCaret = v.slice(0, caret);
    const match = uptoCaret.match(/(?:^|\s)@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMention(pseudo: string) {
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const uptoCaret = value.slice(0, caret);
    const replaced = uptoCaret.replace(/@(\w*)$/, `@${pseudo} `);
    const newValue = replaced + value.slice(caret);
    setValue(newValue);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (sendsOnEnter(e)) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setMentionQuery(null);
  }

  return (
    <div className="px-6 py-4 border-t border-slate-200 bg-white relative short:sticky short:bottom-0 short:z-10">
      {replyTo && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
          <p className="text-xs text-indigo-700 truncate">
            Réponse à <strong>{replyTo.authorPseudo}</strong> : {replyTo.preview}
          </p>
          <button onClick={onCancelReply} className="text-indigo-400 hover:text-indigo-700 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {mentionMatches.length > 0 && (
        <div className="absolute bottom-full left-6 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-48 z-10">
          {mentionMatches.map(m => (
            <button
              key={m.pseudo}
              onClick={() => insertMention(m.pseudo)}
              onMouseDown={keepFocus}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
            >
              @{m.pseudo}
            </button>
          ))}
        </div>
      )}

      {photoError && <p className="text-xs text-red-500 mb-2">{photoError}</p>}
      {recSeconds !== null ? (
        <div className="flex gap-3 items-center">
          <button type="button" onClick={() => stopRecording(false)} title={t('common.cancel')}
            className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0">
            <Trash2 size={16} />
          </button>
          <div className="flex-1 flex items-center gap-2.5 px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-medium" style={{ minHeight: '44px' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="whitespace-nowrap">{t('chat.input.recording', { time: fmt(recSeconds) })}</span>
            <span className="ml-auto text-xs font-normal text-red-400 whitespace-nowrap">{t('chat.input.max', { time: fmt(VOICE_MAX_SECONDS) })}</span>
          </div>
          <button type="button" onClick={() => stopRecording(true)} title={t('chat.input.sendVoice')}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex-shrink-0">
            <Send size={16} />
          </button>
        </div>
      ) : (
      <div className="flex gap-3 items-end">
        {onSendPhoto && (
          <>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            {photoMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPhotoMenu(false)} />
                <div className="absolute bottom-full left-6 mb-2 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-56">
                  <button type="button" onClick={() => { setPhotoMenu(false); cameraInputRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50">
                    <Camera size={18} className="text-indigo-600" /> {t('chat.input.takePhoto')}
                  </button>
                  <button type="button" onClick={() => { setPhotoMenu(false); photoInputRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 border-t border-slate-100">
                    <Images size={18} className="text-indigo-600" /> {t('chat.input.chooseGallery')}
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => (isTouch ? setPhotoMenu(m => !m) : photoInputRef.current?.click())}
              disabled={sendingPhoto}
              title={t('chat.input.sendPhoto')}
              className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 hover:text-indigo-600 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {sendingPhoto ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={touch ? t('chat.input.placeholderTouch') : t('chat.input.placeholder')}
          enterKeyHint={touch ? 'enter' : 'send'}
          rows={1}
          className="flex-1 resize-none px-4 py-3 bg-slate-100 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
          style={{ minHeight: '44px', maxHeight: '120px' }}
        />
        {onSendVoice && !value.trim() ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={sendingVoice}
            title={t('chat.input.recordVoice')}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {sendingVoice ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
          </button>
        ) : (
        <button
          onClick={handleSend}
          onMouseDown={keepFocus}
          onPointerDown={keepFocus}
          disabled={!value.trim()}
          className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send size={16} />
        </button>
        )}
      </div>
      )}
    </div>
  );
}
