// Code de la salle d'une assemblée reçu par le QR code projeté (/dashboard?planId=…&tab=assemblee&code=1234) :
// gardé le temps que l'onglet Assemblée s'ouvre et pointe la personne (AssemblyTab, CheckInCard).
const KEY = 'evly_assembly_code';

export function rememberAssemblyCode(planId: string, code: string) {
  if (!/^\d{4}$/.test(code)) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ planId, code })); } catch { /* stockage indisponible */ }
}

export function takeAssemblyCode(planId: string): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (v?.planId !== planId) return null;
    sessionStorage.removeItem(KEY);
    return v.code;
  } catch { return null; }
}

export function assemblyCodeLink(planId: string, code: string, origin: string) {
  return `${origin}/dashboard?planId=${encodeURIComponent(planId)}&tab=assemblee&code=${code}`;
}
