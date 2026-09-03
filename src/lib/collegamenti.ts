/**
 * Deep link dell'app.
 *
 * Lo schema è dichiarato in `app.json` (`expo.scheme`) e deve combaciare con la lista
 * Redirect URLs della dashboard Supabase, altrimenti il link della mail viene rifiutato
 * prima ancora di aprire l'app.
 *
 * Il valore è scritto a mano invece di ricavarlo da `Linking.createURL`: in alcune
 * modalità di sviluppo quella funzione restituisce varianti come `exp+storescout://`,
 * che non sono nella lista dei redirect autorizzati e fanno fallire il reset con un
 * errore poco comprensibile.
 */

export const SCHEMA_APP = 'storescout';

export const URL_REIMPOSTA_PASSWORD = `${SCHEMA_APP}://reimposta-password`;

/**
 * Estrae i parametri da un deep link, unendo query e frammento.
 *
 * Con il flusso implicit Supabase restituisce i token dopo `#`; con PKCE restituisce
 * `?code=`; gli errori possono arrivare in entrambe le posizioni a seconda del punto
 * in cui il link si interrompe. Leggerli tutti e due evita di dover indovinare.
 */
export function parametriDaUrl(url: string): Record<string, string> {
  const [parteBase, frammento = ''] = url.split('#');
  const query = parteBase.includes('?') ? parteBase.slice(parteBase.indexOf('?') + 1) : '';

  const parametri: Record<string, string> = {};
  for (const pezzo of [query, frammento]) {
    if (!pezzo) continue;
    for (const coppia of pezzo.split('&')) {
      if (!coppia) continue;
      const [chiave, valore = ''] = coppia.split('=');
      if (chiave) parametri[decodeURIComponent(chiave)] = decodeURIComponent(valore.replace(/\+/g, ' '));
    }
  }
  return parametri;
}
