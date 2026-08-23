import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Send, X } from 'lucide-react';

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
}

export function ChatInput({ onSend, members = [], replyTo, onCancelReply }: Props) {
  const [value, setValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionMatches = mentionQuery !== null
    ? members.filter(m => m.pseudo.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    setMentionQuery(null);
  }

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setMentionQuery(null);
  }

  return (
    <div className="px-6 py-4 border-t border-slate-200 bg-white relative">
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
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
            >
              @{m.pseudo}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Entrée pour envoyer, @ pour mentionner)"
          rows={1}
          className="flex-1 resize-none px-4 py-3 bg-slate-100 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
          style={{ minHeight: '44px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim()}
          className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
