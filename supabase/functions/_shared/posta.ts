/**
 * Invio delle email attraverso l'API di SendGrid.
 *
 * Prima si usava SMTP con `denomailer`, e non funzionava: stabilire una connessione
 * cifrata costa troppa CPU per una Edge Function, che viene uccisa con un
 * `CPU Time exceeded` a metà handshake — 3094 millisecondi consumati su circa 2000
 * disponibili. Il difetto non era il volume né il server di posta: era la crittografia
 * TLS eseguita in JavaScript.
 *
 * Una chiamata HTTPS costa una frazione di quel tempo, perché il lavoro crittografico lo
 * fa il runtime e non il nostro codice.
 */

const CHIAVE = Deno.env.get('SENDGRID_API_KEY') ?? '';

/** Indirizzo mittente. Riusa il secret già impostato ai tempi dell'SMTP. */
const MITTENTE = Deno.env.get('SMTP_FROM') || Deno.env.get('SMTP_USER') || '';

/**
 * Endpoint dell'API.
 *
 * SendGrid ne ha uno europeo per gli account con residenza dei dati in UE, che sul piano
 * Pro è disponibile: basta impostare il secret `SENDGRID_REGIONE=eu`. Vale la pena, perché
 * questi messaggi portano firme di persone fisiche e nomi di dipendenti, ed è lo stesso
 * motivo per cui il database sta a Francoforte.
 */
const BASE =
  (Deno.env.get('SENDGRID_REGIONE') ?? '').toLowerCase() === 'eu'
    ? 'https://api.eu.sendgrid.com'
    : 'https://api.sendgrid.com';

/**
 * Tetto agli allegati di un messaggio.
 *
 * SendGrid ne accetta 30 MB, ma il limite vero è a monte: l'app blocca la conclusione
 * oltre questa soglia mentre le foto sono ancora togliibili, e una scheda che pesa più di
 * così è comunque sgradevole da ricevere in una casella aziendale. Il conto si fa sui byte
 * del file, mentre in base64 viaggia un terzo più grande.
 */
export const LIMITE_ALLEGATI_BYTE = 15 * 1024 * 1024;

export type Allegato = {
  /** Nome con cui il file arriva nella casella. */
  nome: string;
  /** Contenuto già codificato in base64. */
  base64: string;
  /** Tipo MIME; se omesso si deduce dall'estensione. */
  tipo?: string;
};

export type Messaggio = {
  a: string[];
  cc?: string[];
  oggetto: string;
  testo: string;
  html?: string;
  allegati?: Allegato[];
};

const tipoDa = (nome: string) =>
  nome.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : nome.toLowerCase().endsWith('.jpg') || nome.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : 'application/octet-stream';

/**
 * Spedisce un messaggio. Solleva con un motivo leggibile se non riesce.
 *
 * Gli errori di SendGrid arrivano come JSON con un elenco `errors`: si riportano com'erano,
 * perché «Invio non riuscito» non aiuta nessuno a capire se è un indirizzo malformato, un
 * mittente non verificato o una quota esaurita.
 */
export async function spedisci(messaggio: Messaggio): Promise<void> {
  if (!CHIAVE) throw new Error('Manca il secret SENDGRID_API_KEY.');
  if (!MITTENTE) throw new Error('Manca l’indirizzo mittente (SMTP_FROM).');

  // Gli stessi indirizzi in `to` e in `cc` fanno rifiutare l'intera richiesta.
  const a = [...new Set(messaggio.a.map((e) => e.trim().toLowerCase()))];
  const cc = [...new Set((messaggio.cc ?? []).map((e) => e.trim().toLowerCase()))].filter(
    (e) => !a.includes(e),
  );

  const destinazione: Record<string, unknown> = { to: a.map((email) => ({ email })) };
  if (cc.length > 0) destinazione.cc = cc.map((email) => ({ email }));

  const contenuto: { type: string; value: string }[] = [
    { type: 'text/plain', value: messaggio.testo },
  ];
  // L'ordine conta: SendGrid vuole il testo prima dell'HTML, e i client mostrano
  // l'ultima parte che sanno rendere.
  if (messaggio.html) contenuto.push({ type: 'text/html', value: messaggio.html });

  const corpo: Record<string, unknown> = {
    personalizations: [destinazione],
    from: { email: MITTENTE, name: 'StoreScout' },
    subject: messaggio.oggetto,
    content: contenuto,
  };

  if (messaggio.allegati && messaggio.allegati.length > 0) {
    corpo.attachments = messaggio.allegati.map((allegato) => ({
      filename: allegato.nome,
      content: allegato.base64,
      type: allegato.tipo ?? tipoDa(allegato.nome),
      disposition: 'attachment',
    }));
  }

  const r = await fetch(`${BASE}/v3/mail/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CHIAVE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo),
  });

  // 202 è la risposta normale: SendGrid ha preso in carico il messaggio.
  if (r.status === 202) return;

  const grezzo = await r.text();
  let motivo = grezzo.slice(0, 300) || `HTTP ${r.status}`;
  try {
    const errore = JSON.parse(grezzo) as { errors?: { message?: string; field?: string }[] };
    if (errore.errors?.length) {
      motivo = errore.errors
        .map((e) => (e.field ? `${e.message} (${e.field})` : e.message))
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    // Risposta non JSON: resta il testo grezzo, già troncato.
  }
  throw new Error(`SendGrid ha rifiutato il messaggio: ${motivo}`);
}
