import { Fragment } from 'react';
import { MessageCircle } from 'lucide-react';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  message: Message;
  isMe: boolean;
  myUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onReply?: (message: Message) => void;
  replyCount?: number;
}

function renderContent(content: string) {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part.startsWith('@') ? <span className="font-semibold text-indigo-300">{part}</span> : part}
    </Fragment>
  ));
}

export function ChatMessage({ message, isMe, myUserId, onReact, onReply, replyCount }: Props) {
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));

  const reactionGroups = (message.reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.userId === myUserId) acc[r.emoji].mine = true;
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
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMe
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
          }`}>
            {renderContent(message.content)}
          </div>

          {/* Quick-react toolbar, visible on hover */}
          <div className={`hidden group-hover:flex absolute -top-3 ${isMe ? 'right-0' : 'left-0'} bg-white border border-slate-200 rounded-full shadow-md px-1 py-0.5 gap-0.5 z-10`}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="text-sm hover:scale-125 transition-transform px-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                  mine ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {emoji} {count}
              </button>
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

        {isMe && <span className="text-xs text-slate-400">{time}</span>}
      </div>
    </div>
  );
}
