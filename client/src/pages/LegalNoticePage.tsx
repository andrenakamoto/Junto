import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoIcon } from '../components/ui/Logo';
import { t } from '../i18n';

// Page publique « Mentions légales » (/mentions-legales, 2026-11-24) : identité et adresse de contact de l'éditeur
// (LCD art. 3 al. 1 let. s, nLPD art. 19), hébergeur. Liée depuis le pied du site, la page de connexion, le menu ☰
// et la politique de confidentialité.
export function LegalNoticePage() {
  const s = (title: string, body: React.ReactNode) => (
    <section className="space-y-1.5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p>{body}</p>
    </section>
  );
  const [before, after] = t('legal.notice.contact').split('{{email}}');
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={15} /> {t('common.back')}
          </Link>
          <LogoIcon size={32} light />
        </div>
        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <h1 className="text-2xl font-bold text-slate-900">{t('legal.notice.title')}</h1>
          {s(t('legal.notice.editorTitle'), t('legal.notice.editor'))}
          {s(t('legal.notice.contactTitle'), <>{before}<a href="mailto:info@evly.ch" className="font-semibold text-indigo-600 underline">info@evly.ch</a>{after}</>)}
          {s(t('legal.notice.hostingTitle'), t('legal.notice.hosting'))}
          {s(t('legal.notice.ipTitle'), t('legal.notice.ip'))}
          {s(t('legal.notice.dataTitle'), <>{t('legal.notice.data')} <Link to="/confidentialite" className="underline hover:text-slate-900">{t('legal.notice.privacy')}</Link>.</>)}
        </article>
      </div>
    </div>
  );
}
