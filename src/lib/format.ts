const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

const due = (n: number) => String(n).padStart(2, '0');

export const dataBreve = (d: Date) => `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`;

export const dataEstesa = (d: Date) => `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;

export const ora = (d: Date) => `${due(d.getHours())}:${due(d.getMinutes())}`;

/** Da `Date` a `YYYY-MM-DD`, il formato della colonna `date` di Postgres. */
export const dataISO = (d: Date) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;

/** Da `YYYY-MM-DD` a `Date` locale, evitando lo scivolamento di fuso di `new Date(stringa)`. */
export function daDataISO(s: string): Date {
  const [a, m, g] = s.split('-').map(Number);
  return new Date(a, m - 1, g);
}

/** Durata fra due istanti, nella forma "1h 25min". */
export function durata(inizio: Date, fine: Date): string {
  const minuti = Math.max(0, Math.round((fine.getTime() - inizio.getTime()) / 60000));
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** "oggi", "ieri" o la data breve: in home l'ispettore legge quasi solo le ultime visite. */
export function dataRelativa(d: Date): string {
  const oggi = new Date();
  const soloData = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const giorni = Math.round((soloData(oggi) - soloData(d)) / 86400000);
  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  return dataBreve(d);
}

/** Iniziali per l'avatar dell'ispettore in testata. */
export const iniziali = (nome: string, cognome: string) =>
  `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase() || '?';
