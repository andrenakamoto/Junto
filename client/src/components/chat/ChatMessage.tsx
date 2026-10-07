import { Fragment, useEffect, useRef, useState } from 'react';
import { Flag, ImageOff, MessageCircle, X } from 'lucide-react';
import { mediaUrl } from '../../lib/media';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { DeletedBubble, MessageEditor, OwnMessageActions, useEditWindow } from './MessageEditing';
import { VoiceMessage } from './VoiceMessage';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  message: Message;
  isMe: boolean;
  myUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onReply?: (message: Message) => void;
  replyCount?: number;
  /** Modifier / supprimer son propre message (15 minutes après l'envoi) */
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  /** Signaler le message d'un autre membre (ReportMessageModal) */
  onReport?: (message: Message) => void;
  /** Jeton du Plan pour afficher les photos envoyées dans le chat */
  mediaToken?: string;
}

// Liens web (https://…, http://… ou www.…) cliquables ; la ponctuation finale reste du texte
const LINK_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING = /[.,;:!?)\]}»"']+$/;

function renderText(text: string, key: string) {
  return text.split(/(@\w+)/g).map((part, i) => (
    <Fragment key={`${key}-${i}`}>
      {/^@\w+$/.test(part) ? <span className="font-semibold text-indigo-300">{part}</span> : part}
    </Fragment>
  ));
}

export function renderContent(content: string, isMe: boolean) {
  return content.split(LINK_RE).map((part, i) => {
    if (i % 2 === 0) return renderText(part, String(i));
    const trail = part.match(TRAILING)?.[0] ?? '';
    const url = trail ? part.slice(0, -trail.length) : part;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return (
      <Fragment key={i}>
        {/* Dans les apps, Capacitor ouvre les liens externes dans le navigateur du téléphone */}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={`underline underline-offset-2 break-all ${isMe ? 'text-white' : 'text-indigo-600'}`}
        >
          {url}
        </a>
        {trail}
      </Fragment>
    );
  });
}

export function ChatMessage({ message, isMe, myUserId, onReact, onReply, replyCount, onEdit, onDelete, onReport, mediaToken }: Props) {
  const [viewing, setViewing] = useState(false);
  const photo = !message.deletedAt && message.attachment?.mimeType.startsWith('image/') ? message.attachment : null;
  const voice = !message.deletedAt && message.attachment?.mimeType.startsWith('audio/') ? message.attachment : null;
  // Message photo dont la photo a été retirée depuis l'onglet Infos (plus de texte ni de photo)
  const photoRemoved = !message.deletedAt && !message.attachment && !message.content;
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))
    + (message.editedAt && !message.deletedAt ? ' (modifié)' : '');
  const deleted = !!message.deletedAt;
  const editable = useEditWindow(message.createdAt, message.deletedAt, isMe && !!onEdit && !!onDelete);
  const [editing, setEditing] = useState(false);
  // Réactions rapides sur écran tactile : un appui sur le message ouvre la barre, l'appui
  // suivant (n'importe où) la ferme. Sur ordinateur, elle s'affiche au survol.
  const [showReactions, setShowReactions] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Barre de réactions sous la bulle quand il n'y a pas la place au-dessus (premier message du
  // chat : sinon elle passe sous la barre des rubriques)
  const [reactionsBelow, setReactionsBelow] = useState(false);
  function placeReactions() {
    const el = bubbleRef.current;
    if (!el) return;
    const scroller = el.closest('.overflow-y-auto') as HTMLElement | null;
    const top = scroller ? scroller.getBoundingClientRect().top : 0;
    setReactionsBelow(el.getBoundingClientRect().top - top < 56);
  }
  useEffect(() => {
    if (!showReactions) return;
    function close(e: PointerEvent) {
      // Un appui sur ce message est géré par son propre clic (qui referme la barre)
      if (bubbleRef.current?.contains(e.target as Node)) return;
      setShowReactions(false);
    }
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [showReactions]);

  const reactionGroups = (message.reactions ?? []).reduce<Record<string, { count: number; mine: boolean; names: string[] }>>((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { count: 0, mine: false, names: [] };
    acc[r.emoji].count += 1;
    if (r.userId === myUserId) acc[r.emoji].mine = true;
    else acc[r.emoji].names.push(`@${r.user?.pseudo ?? '?'}`);
    return acc;
  }, {});

  return (
    <div className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`} onMouseEnter={placeReactions}>
      {!isMe && <Avatar pseudo={message.author.pseudo} size="sm" />}
      <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">{message.author.pseudo}</span>
            <span className="text-xs text-slate-400">{time}</span>
          </div>
        )}

        <div
          ref={bubbleRef}
          className="relative"
          onClick={() => { if (!deleted && !editing && !window.matchMedia('(hover: hover)').matches) { placeReactions(); setShowReactions(v => !v); } }}
        >
          {deleted ? (
            <DeletedBubble isMe={isMe} />
          ) : editing ? (
            <MessageEditor
              initial={message.content}
              onCancel={() => setEditing(false)}
              onSave={text => { setEditing(false); onEdit?.(message.id, text); }}
            />
          ) : (
            <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
              {photo && (
                <button type="button" onClick={e => { e.stopPropagation(); setViewing(true); }} className="block rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                  <img src={mediaUrl(photo.id, mediaToken, 600)} alt={photo.name} loading="lazy" className="block max-w-[240px] max-h-[320px] object-cover" />
                </button>
              )}
              {voice && <VoiceMessage attachment={voice} mediaToken={mediaToken} isMe={isMe} />}
              {photoRemoved && (
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm italic text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                  <ImageOff size={14} /> Photo retirée
                </div>
              )}
              {message.content && (
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  isMe
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
                }`}>
                  {renderContent(message.content, isMe)}
                </div>
              )}
            </div>
          )}
          {viewing && photo && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); setViewing(false); }}>
              <button type="button" aria-label="Fermer" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" style={{ marginTop: 'var(--sa-top)' }}>
                <X size={20} />
              </button>
              <img src={mediaUrl(photo.id, mediaToken, 1600)} alt={photo.name} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          )}

          {/* Réactions rapides (survol sur ordinateur, appui sur mobile) : grands emojis,
              posés juste au-dessus de la bulle pour ne pas la masquer (en dessous s'il n'y a pas la place) */}
          {!deleted && !editing && <div className={`${showReactions ? 'flex' : 'hidden'} [@media(hover:hover)]:group-hover:flex absolute ${reactionsBelow ? 'top-full mt-1' : 'bottom-full mb-1'} ${isMe ? 'right-0' : 'left-0'} bg-white border border-slate-200 rounded-full shadow-lg px-1.5 py-1 gap-0.5 z-10`}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={e => { e.stopPropagation(); onReact(message.id, emoji); setShowReactions(false); }}
                aria-label={`Réagir avec ${emoji}`}
                className="text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 hover:scale-110 active:scale-95 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>}
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(reactionGroups).map(([emoji, { count, mine, names }]) => (
              <ReactionChip
                key={emoji}
                emoji={emoji}
                count={count}
                mine={mine}
                who={[...(mine ? ['Toi'] : []), ...names]}
                alignRight={isMe}
                onToggle={() => onReact(message.id, emoji)}
              />
            ))}
          </div>
        )}

        {(onReply || (onReport && !isMe && !deleted)) && (
          <span className="flex items-center gap-3">
            {onReply && (
              <button
                onClick={() => onReply(message)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <MessageCircle size={11} />
                {replyCount ? `${replyCount} réponse${replyCount > 1 ? 's' : ''}` : 'Répondre'}
              </button>
            )}
            {onReport && !isMe && !deleted && (
              <button
                onClick={() => onReport(message)}
                title="Signaler ce message"
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-red-500 transition-colors"
              >
                <Flag size={11} />
                Signaler
              </button>
            )}
          </span>
        )}

        {isMe && (
          <span className="flex items-center gap-2">
            {editable && !editing && (
              <OwnMessageActions onEdit={voice ? undefined : () => setEditing(true)} onDelete={() => onDelete?.(message.id)} />
            )}
            <span className="text-xs text-slate-400">{time}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// « Tu as réagi », « @marc a réagi », « @marc et @léa ont réagi », « Toi et @marc avez réagi »
export function reactionLabel(who: string[], emoji: string) {
  const list = who.length > 1 ? `${who.slice(0, -1).join(', ')} et ${who[who.length - 1]}` : who[0] ?? '';
  const withMe = who[0] === 'Toi';
  const verb = who.length === 1 ? (withMe ? 'as' : 'a') : (withMe ? 'avez' : 'ont');
  return `${who.length === 1 && withMe ? 'Tu' : list} ${verb} réagi avec ${emoji}`;
}

// Pastille de réaction : un clic ajoute/retire la sienne ; survol (ordinateur) ou appui
// prolongé (mobile) affiche qui a réagi
function ReactionChip({ emoji, count, mine, who, alignRight, onToggle }: {
  emoji: string; count: number; mine: boolean; who: string[]; alignRight: boolean; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const label = reactionLabel(who, emoji);

  return (
    <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        onTouchStart={() => {
          longPressed.current = false;
          pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            setOpen(true);
            closeTimer.current = window.setTimeout(() => setOpen(false), 2500);
          }, 450);
        }}
        onTouchEnd={() => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }}
        onTouchMove={() => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }}
        onContextMenu={e => e.preventDefault()}
        onClick={e => {
          // Après un appui prolongé, on montre seulement les noms
          if (longPressed.current) { e.preventDefault(); longPressed.current = false; return; }
          onToggle();
        }}
        className={`text-sm px-2 py-0.5 rounded-full border transition-colors select-none ${
          mine ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
        }`}
      >
        {emoji} {count}
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-full mt-1.5 ${alignRight ? 'right-0' : 'left-0'} z-20 w-max max-w-[16rem] rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-lg`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
