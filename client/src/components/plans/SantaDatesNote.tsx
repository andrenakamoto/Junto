import { Trans, useTranslation } from 'react-i18next';
// Père Noël secret : la date du Plan est le jour de l'échange des cadeaux, et la fin du Plan doit
// venir après (la liste « qui a offert à qui » se révèle entre les deux). Rappel affiché dans la
// création et la modification du Plan dès que la fonction est cochée.
export function SantaDatesNote({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
      <span className="text-base leading-none">🎅</span>
      <span>
        <Trans i18nKey="plan.santaNote" values={{ required: compact ? '.' : t('plan.santaNoteRequired') }} components={{ b: <strong /> }} />
      </span>
    </div>
  );
}
