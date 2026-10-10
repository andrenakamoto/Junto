import { ReactNode } from 'react';

// Briques communes de la politique de confidentialité (une version par langue : fr.tsx, de.tsx, it.tsx, en.tsx)
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export type Processor = { name: string; role: string; where: string; safeguard: string };
export function ProcessorTable({ rows, head }: { rows: Processor[]; head: [string, string, string, string] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{head.map(h => <th key={h} className="p-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.name} className="border-t border-slate-200 align-top">
              <td className="p-2 font-semibold">{p.name}</td>
              <td className="p-2">{p.role}</td>
              <td className="p-2">{p.where}</td>
              <td className="p-2">{p.safeguard}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type PrivacyText = { title: string; version: string; translationNote?: string; body: ReactNode };
