// Père Noël secret : la date du Plan est le jour de l'échange des cadeaux, et la fin du Plan doit
// venir après (la liste « qui a offert à qui » se révèle entre les deux). Rappel affiché dans la
// création et la modification du Plan dès que la fonction est cochée.
export function SantaDatesNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
      <span className="text-base leading-none">🎅</span>
      <span>
        <strong>Père Noël secret :</strong> la <strong>date de l’événement</strong> est le <strong>jour de l’échange des cadeaux</strong>
        {compact ? '. ' : ' (obligatoire). '}
        La <strong>date de fin du Plan</strong> doit venir <strong>après l’échange</strong> : c’est entre les deux que tu pourras
        révéler à tous qui a offert à qui, avant la suppression automatique du Plan.
      </span>
    </div>
  );
}
