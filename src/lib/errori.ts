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
