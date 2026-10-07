import { useEffect, useState } from 'react';

// Modifier / supprimer son propre message pendant 15 minutes (même règle côté serveur :
// server/src/lib/messageEdit.ts). Partagé par le chat des Plans et celui des sondages.
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function isEditable(createdAt: string, deletedAt?: string | null) {
  return !deletedAt && Date.now() - new Date(createdAt).getTime() < MESSAGE_EDIT_WINDOW_MS;
}

// Fait disparaître les actions à la fin des 15 minutes, sans attendre un autre rendu
export function useEditWindow(createdAt: string, deletedAt: string | null | undefined, mine: boolean) {
  const [editable, setEditable] = useState(() => mine && isEditable(createdAt, deletedAt));
  useEffect(() => {
    const ok = mine && isEditable(createdAt, deletedAt);
    setEditable(ok);
    if (!ok) return;
    const left = MESSAGE_EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime());
    const t = setTimeout(() => setEditable(false), left + 500);
    return () => clearTimeout(t);
  }, [createdAt, deletedAt, mine]);
  return editable;
}

export function MessageEditor({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const save = () => { const t = text.trim(); if (t && t !== initial) onSave(t); else onCancel(); };
  return (
    <div className="w-72 max-w-full bg-white border border-indigo-300 rounded-2xl p-2 shadow-sm">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === 'Escape') onCancel();
        }}
        rows={Math.min(6, Math.max(2, text.split('\n').length))}
        maxLength={2000}
        className="w-full resize-none text-sm text-slate-800 focus:outline-none"
      />
      <div className="flex justify-end gap-2 text-xs">
        <button type="button" onClick={onCancel} className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100">Annuler</button>
        <button type="button" onClick={save} className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Enregistrer</button>
      </div>
    </div>
  );
}

// « Modifier · Supprimer » sous son propre message (visibles sur mobile comme sur ordinateur)
export function OwnMessageActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Supprimer ce message ?</span>
        <button type="button" onClick={() => { setConfirm(false); onDelete(); }} className="font-semibold text-red-600 hover:underline">Oui</button>
        <button type="button" onClick={() => setConfirm(false)} className="text-slate-500 hover:underline">Non</button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs text-slate-400">
      {onEdit && <>
        <button type="button" onClick={onEdit} className="hover:text-indigo-600 hover:underline">Modifier</button>
        <span aria-hidden>·</span>
      </>}
      <button type="button" onClick={() => setConfirm(true)} className="hover:text-red-600 hover:underline">Supprimer</button>
    </span>
  );
}

export function DeletedBubble({ isMe }: { isMe: boolean }) {
  return (
    <div className={`px-4 py-2 rounded-2xl text-sm italic text-slate-400 border border-dashed border-slate-300 bg-white/60 ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
      Message supprimé
    </div>
  );
}
