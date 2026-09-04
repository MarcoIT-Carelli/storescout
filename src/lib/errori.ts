/**
 * Traduce gli errori di Supabase in messaggi comprensibili a chi usa l'app in negozio.
 * Il testo originale resta disponibile nei log, non finisce mai a schermo.
 */
export function messaggioErrore(e: unknown): string {
  const testo =
    typeof e === 'string' ? e : e instanceof Error ? e.message : (e as { message?: string })?.message ?? '';

  const t = testo.toLowerCase();

  if (t.includes('password attuale errata')) return 'La password attuale non è corretta.';
  if (t.includes('invalid login credentials')) return 'Email o password non corretti.';
  if (t.includes('different from the old password') || t.includes('same_password'))
    return 'La nuova password deve essere diversa da quella attuale.';
  if (t.includes('password should be at least') || t.includes('weak_password'))
    return 'Password troppo corta o troppo semplice: scegline una più lunga.';
  if (t.includes('email not confirmed')) return "L'indirizzo email non è ancora stato confermato.";
  if (t.includes('over_email_send_rate') || t.includes('rate limit'))
    return 'Troppi tentativi ravvicinati. Riprova fra qualche minuto.';
  if (t.includes('network request failed') || t.includes('fetch failed') || t.includes('timeout'))
    return 'Connessione assente. I dati inseriti restano salvati sul dispositivo.';
  if (t.includes('row-level security') || t.includes('violates row-level'))
    return 'Non hai i permessi per questa operazione.';
  if (t.includes('jwt') || t.includes('token'))
    return 'Sessione scaduta. Esci e rientra per continuare.';
  if (t.includes('new row violates') || t.includes('check constraint'))
    return 'I dati inseriti non sono validi.';

  return testo || 'Si è verificato un errore imprevisto.';
}

/**
 * Le Edge Function restituiscono il messaggio nel corpo della risposta, che
 * `functions.invoke` nasconde dentro il contesto dell'errore. Senza questo, all'utente
 * arriverebbe un generico "Edge Function returned a non-2xx status code".
 */
export async function messaggioDaFunzione(errore: unknown): Promise<string> {
  const contesto = (errore as { context?: Response })?.context;
  if (contesto && typeof contesto.text === 'function') {
    // Il client Supabase puo' aver gia' letto il corpo: si clona prima di riprovare,
    // e si legge come testo perche' non tutte le risposte d'errore sono JSON.
    for (const sorgente of [() => contesto.clone(), () => contesto]) {
      try {
        const grezzo = await sorgente().text();
        if (!grezzo) continue;
        try {
          const corpo = JSON.parse(grezzo) as { errore?: string; message?: string };
          if (corpo?.errore) return corpo.errore;
          if (corpo?.message) return corpo.message;
        } catch {
          return grezzo.slice(0, 200);
        }
      } catch {
        // sorgente non leggibile: si prova la successiva
      }
    }
  }
  return messaggioErrore(errore);
}
