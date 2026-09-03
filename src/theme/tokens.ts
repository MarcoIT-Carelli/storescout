/** Spaziature, raggi e tipografia. Valori pensati per un tablet tenuto in mano. */

export const spazio = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const raggio = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/** Altezza minima di ogni area toccabile: 48dp, come da linee guida del progetto. */
export const TOCCO_MIN = 48;

export const testo = {
  titolo: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  sezione: { fontSize: 19, fontWeight: '700' as const },
  corpo: { fontSize: 16, fontWeight: '400' as const },
  corpoForte: { fontSize: 16, fontWeight: '600' as const },
  piccolo: { fontSize: 15, fontWeight: '400' as const },
  etichetta: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2 },
  sigla: { fontSize: 22, fontWeight: '800' as const, letterSpacing: 0.5 },
} as const;

/** Larghezza oltre la quale il layout passa a due colonne. */
export const SOGLIA_LARGA = 900;
