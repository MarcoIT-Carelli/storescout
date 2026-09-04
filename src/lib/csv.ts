/**
 * Lettura di file CSV per l'importazione dell'anagrafica.
 *
 * Scritto a mano invece di aggiungere una libreria: serve gestire un solo caso non
 * banale, le virgolette attorno ai campi che contengono virgole — e nell'anagrafica
 * ce ne sono parecchi, perché gli indirizzi sono scritti come «via Napoli, 45».
 */

export type RigaCsv = Record<string, string>;

/** Separa una riga tenendo conto delle virgolette e delle virgolette raddoppiate. */
function separaCampi(riga: string, separatore: string): string[] {
  const campi: string[] = [];
  let corrente = '';
  let dentroVirgolette = false;

  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];

    if (dentroVirgolette) {
      if (c === '"') {
        // Due virgolette di fila valgono una virgoletta letterale.
        if (riga[i + 1] === '"') {
          corrente += '"';
          i++;
        } else {
          dentroVirgolette = false;
        }
      } else {
        corrente += c;
      }
      continue;
    }

    if (c === '"') dentroVirgolette = true;
    else if (c === separatore) {
      campi.push(corrente.trim());
      corrente = '';
    } else corrente += c;
  }

  campi.push(corrente.trim());
  return campi;
}

/**
 * Molti gestionali esportano con il punto e virgola. Si sceglie il separatore che
 * compare più volte nell'intestazione, invece di imporne uno e far fallire l'import
 * con un messaggio incomprensibile.
 */
function separatoreProbabile(intestazione: string): string {
  return (intestazione.match(/;/g) ?? []).length > (intestazione.match(/,/g) ?? []).length ? ';' : ',';
}

export function leggiCsv(contenuto: string): { intestazione: string[]; righe: RigaCsv[] } {
  // Il BOM lasciato da Excel finirebbe dentro il nome della prima colonna.
  const testo = contenuto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const linee = testo.split('\n').filter((l) => l.trim().length > 0);
  if (linee.length === 0) return { intestazione: [], righe: [] };

  const separatore = separatoreProbabile(linee[0]);
  const intestazione = separaCampi(linee[0], separatore).map((c) => c.toLowerCase());

  const righe = linee.slice(1).map((linea) => {
    const campi = separaCampi(linea, separatore);
    const riga: RigaCsv = {};
    intestazione.forEach((nome, i) => {
      riga[nome] = campi[i] ?? '';
    });
    return riga;
  });

  return { intestazione, righe };
}

/** Interpreta i modi in cui un foglio di calcolo può scrivere un sì o un no. */
export function booleano(valore: string | undefined, predefinito = true): boolean {
  const v = (valore ?? '').trim().toLowerCase();
  if (v === '') return predefinito;
  return ['true', 'vero', 'si', 'sì', 'y', 'yes', '1', 'x'].includes(v);
}
