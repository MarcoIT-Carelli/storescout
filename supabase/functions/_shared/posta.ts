/**
 * Invio delle email attraverso l'API di Brevo.
 *
 * Prima si usava SMTP con `denomailer`, e non funzionava: stabilire una connessione
 * cifrata costa troppa CPU per una Edge Function, che viene uccisa con un
 * `CPU Time exceeded` a metà handshake — 3094 millisecondi consumati su circa 2000
 * disponibili. Il difetto non era il volume né il server di posta: era la crittografia
 * TLS eseguita in JavaScript.
 *
 * Una chiamata HTTPS costa una frazione di quel tempo, perché il lavoro crittografico lo
 * fa il runtime e non il nostro codice.
 *
 * Brevo e non un servizio americano: questi messaggi portano firme di persone fisiche e
 * nomi di dipendenti, e il progetto tiene i dati in Unione Europea — è il motivo per cui
 * il database sta a Francoforte.
 */

const CHIAVE_BREVO = Deno.env.get('BREVO_API_KEY') ?? '';

/** Indirizzo mittente. Riusa il secret già impostato per l'SMTP. */
const MITTENTE = Deno.env.get('SMTP_FROM') || Deno.env.get('SMTP_USER') || '';

/**
 * Tetto agli allegati di un messaggio.
 *
 * Brevo ne accetta 10 MB; si sta sotto con un margine, perché il conto lo facciamo sui
 * byte del file mentre la codifica base64 che viaggia davvero è più grande di un terzo.
 */
export const LIMITE_ALLEGATI_BYTE = 7 * 1024 * 1024;

export type Allegato = {
  /** Nome con cui il file arriva nella casella. */
  nome: string;
  /** Contenuto già codificato in base64. */
  base64: string;
};

export type Messaggio = {
  a: string[];
  cc?: string[];
  oggetto: string;
  testo: string;
  html?: string;
  allegati?: Allegato[];
};

export const postaConfigurata = () => CHIAVE_BREVO.length > 0 && MITTENTE.length > 0;

/**
 * Spedisce un messaggio. Solleva con un motivo leggibile se non riesce.
 *
 * Gli errori di Brevo arrivano come JSON con `code` e `message`: si riportano com'erano,
 * perché «Invio non riuscito» non aiuta nessuno a capire se è un indirizzo sbagliato o
 * una quota esaurita.
 */
export async function spedisci(messaggio: Messaggio): Promise<void> {
  if (!CHIAVE_BREVO) throw new Error('Manca il secret BREVO_API_KEY.');
  if (!MITTENTE) throw new Error('Manca l’indirizzo mittente (SMTP_FROM).');

  const corpo: Record<string, unknown> = {
    sender: { name: 'StoreScout', email: MITTENTE },
    to: messaggio.a.map((email) => ({ email })),
    subject: messaggio.oggetto,
    textContent: messaggio.testo,
  };

  if (messaggio.cc && messaggio.cc.length > 0) {
    corpo.cc = messaggio.cc.map((email) => ({ email }));
  }
  if (messaggio.html) corpo.htmlContent = messaggio.html;
  if (messaggio.allegati && messaggio.allegati.length > 0) {
    corpo.attachment = messaggio.allegati.map((a) => ({ name: a.nome, content: a.base64 }));
  }

  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': CHIAVE_BREVO,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(corpo),
  });

  if (!r.ok) {
    const grezzo = await r.text();
    let motivo = grezzo.slice(0, 300);
    try {
      const errore = JSON.parse(grezzo) as { code?: string; message?: string };
      if (errore.message) motivo = errore.code ? `${errore.message} (${errore.code})` : errore.message;
    } catch {
      // Risposta non JSON: resta il testo grezzo, già troncato.
    }
    throw new Error(`Brevo ha rifiutato il messaggio: ${motivo}`);
  }
}
