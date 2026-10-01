import { Fragment, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { DeletedBubble, MessageEditor, OwnMessageActions, useEditWindow } from './MessageEditing';

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
}

function renderContent(content: string) {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part.startsWith('@') ? <span className="font-semibold text-indigo-300">{part}</span> : part}
    </Fragment>
  ));
}

export function ChatMessage({ message, isMe, myUserId, onReact, onReply, replyCount, onEdit, onDelete }: Props) {
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))
    + (message.editedAt && !message.deletedAt ? ' (modifié)' : '');
  const deleted = !!message.deletedAt;
  const editable = useEditWindow(message.createdAt, message.deletedAt, isMe && !!onEdit && !!onDelete);
  const [editing, setEditing] = useState(false);

  const reactionGroups = (message.reactions ?? []).reduce<Record<string, { count: number; mine: boolean; names: string[] }>>((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { count: 0, mine: false, names: [] };
    acc[r.emoji].count += 1;
    if (r.userId === myUserId) acc[r.emoji].mine = true;
    else acc[r.emoji].names.push(`@${r.user?.pseudo ?? '?'}`);
    return acc;
  }, {});

  return (
    <div className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && <Avatar pseudo={message.author.pseudo} size="sm" />}
      <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">{message.author.pseudo}</span>
            <span className="text-xs text-slate-400">{time}</span>
          </div>
        )}

        <div className="relative">
          {deleted ? (
            <DeletedBubble isMe={isMe} />
          ) : editing ? (
            <MessageEditor
              initial={message.content}
              onCancel={() => setEditing(false)}
              onSave={text => { setEditing(false); onEdit?.(message.id, text); }}
            />
          ) : (
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isMe
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
            }`}>
              {renderContent(message.content)}
            </div>
          )}

          {/* Quick-react toolbar, visible on hover */}
          {!deleted && !editing && <div className={`hidden group-hover:flex absolute -top-3 ${isMe ? 'right-0' : 'left-0'} bg-white border border-slate-200 rounded-full shadow-md px-1 py-0.5 gap-0.5 z-10`}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="text-sm hover:scale-125 transition-transform px-0.5"
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

        {onReply && (
          <button
            onClick={() => onReply(message)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <MessageCircle size={11} />
            {replyCount ? `${replyCount} réponse${replyCount > 1 ? 's' : ''}` : 'Répondre'}
          </button>
        )}

        {isMe && (
          <span className="flex items-center gap-2">
            {editable && !editing && (
              <OwnMessageActions onEdit={() => setEditing(true)} onDelete={() => onDelete?.(message.id)} />
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
        className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors select-none ${
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
