/**
 * Palette unica dell'app. Nessun colore va scritto altrove.
 *
 * Regola vincolante: il giallo non è mai colore di testo su fondo chiaro.
 * È ammesso solo come riempimento con testo nero sopra, o come marchio su fondo nero.
 */

export type ColorName =
  | 'nero'
  | 'giallo'
  | 'gialloPremuto'
  | 'superficie'
  | 'superficieAlt'
  | 'bordo'
  | 'testo'
  | 'testoSecondario'
  | 'suGiallo'
  | 'successo'
  | 'attenzione'
  | 'errore'
  | 'successoSfondo'
  | 'attenzioneSfondo'
  | 'erroreSfondo'
  | 'disabilitato'
  | 'testoDisabilitato'
  | 'sfondo'
  | 'marchio';

export type Palette = Record<ColorName, string>;

export const chiara: Palette = {
  nero: '#111111',
  giallo: '#FFC72C',
  gialloPremuto: '#E5A800',
  superficie: '#FFFFFF',
  superficieAlt: '#F7F7F5',
  bordo: '#E3E3E0',
  testo: '#111111',
  testoSecondario: '#6B6B66',
  suGiallo: '#111111',
  successo: '#1D9E75',
  attenzione: '#BA7517',
  errore: '#C0392B',
  successoSfondo: '#E8F6F1',
  attenzioneSfondo: '#FBF1E3',
  erroreSfondo: '#FAEAE8',
  disabilitato: '#EFEFEC',
  testoDisabilitato: '#9A9A93',
  sfondo: '#F7F7F5',
  marchio: '#111111',
};

/**
 * Variante notturna. Mantiene gli stessi nomi di token, così ogni componente
 * legge un solo insieme di chiavi. I colori di stato sono schiariti: gli stessi
 * valori della palette chiara su fondo scuro scendono sotto il contrasto leggibile.
 */
export const scura: Palette = {
  nero: '#111111',
  giallo: '#FFC72C',
  gialloPremuto: '#E5A800',
  superficie: '#191918',
  superficieAlt: '#222220',
  bordo: '#35352F',
  testo: '#F5F5F0',
  testoSecondario: '#A3A399',
  suGiallo: '#111111',
  successo: '#3FC79B',
  attenzione: '#E0A33A',
  errore: '#E2685A',
  successoSfondo: '#14312A',
  attenzioneSfondo: '#33260F',
  erroreSfondo: '#3A1B18',
  disabilitato: '#232321',
  testoDisabilitato: '#68685F',
  sfondo: '#0F0F0E',
  marchio: '#F5F5F0',
};

/**
 * Fondo e tratto dell'animazione di apertura. Devono combaciare con i valori della
 * splash nativa dichiarata in app.json, altrimenti fra le due si vede uno scalino.
 */
export const APERTURA = {
  chiaro: { sfondo: '#FFFFFF', inchiostro: '#111111' },
  scuro: { sfondo: '#0F0F0E', inchiostro: '#F5F5F0' },
} as const;
