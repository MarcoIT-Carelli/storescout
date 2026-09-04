import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

/**
 * Invio della scheda compilata ai destinatari previsti (§8 della specifica).
 *
 * Vive qui e non nell'app per due motivi: le credenziali SMTP non possono stare in un APK
 * ispezionabile, e le scritture su `invii_email` e sullo stato dell'ispezione richiedono
 * la chiave di servizio, perché le policy vietano all'ispettore di toccare una scheda già
 * conclusa.
 *
 * Un invio fallito non è mai definitivo: l'ispezione resta come `errore_invio` e la
 * chiamata si può ripetere senza ricompilare nulla.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHIAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CHIAVE_SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? '';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER') ?? '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER;

/** Sempre in copia, da §8.1 della specifica. */
const COPIA_FISSA = ['contact2@carellidistribuzione.it', 'a.andriani@carellidistribuzione.it'];

const due = (n: number) => String(n).padStart(2, '0');
const dataBreve = (d: Date) => `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`;
const ora = (d: Date) => `${due(d.getHours())}:${due(d.getMinutes())}`;

function durata(inizio: Date, fine: Date): string {
  const minuti = Math.max(0, Math.round((fine.getTime() - inizio.getTime()) / 60000));
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Da `YYYY-MM-DD` a `Date` locale, senza lo scivolamento di fuso di `new Date(stringa)`. */
function daDataISO(s: string): Date {
  const [a, m, g] = s.split('-').map(Number);
  return new Date(a, m - 1, g);
}

type RigaAttivita = { destinatari: { nome: string; email: string | null } | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non consentito.' }, 405);

  const autorizzazione = req.headers.get('Authorization');
  if (!autorizzazione) return risposta({ errore: 'Chiamata senza autenticazione.' }, 401);

  let ispezioneId: string;
  try {
    ({ ispezione_id: ispezioneId } = await req.json());
  } catch {
    return risposta({ errore: 'Richiesta non leggibile.' }, 400);
  }
  if (!ispezioneId) return risposta({ errore: 'Manca ispezione_id.' }, 400);

  // Il permesso si verifica con la sessione del chiamante: le policy di `ispezioni`
  // fanno già il lavoro, un ispettore vede solo le proprie.
  const comeChiamante = createClient(URL_SUPABASE, CHIAVE_ANON, {
    global: { headers: { Authorization: autorizzazione } },
  });

  const { data: sessione } = await comeChiamante.auth.getUser();
  if (!sessione.user) return risposta({ errore: 'Sessione non valida.' }, 401);

  const { data: visibile } = await comeChiamante
    .from('ispezioni')
    .select('id')
    .eq('id', ispezioneId)
    .maybeSingle();
  if (!visibile) return risposta({ errore: 'Ispezione non trovata o non tua.' }, 403);

  const servizio = createClient(URL_SUPABASE, CHIAVE_SERVIZIO, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: ispezione, error: erroreIspezione } = await servizio
    .from('ispezioni')
    .select('*, pdv(*), profili(nome, cognome, email)')
    .eq('id', ispezioneId)
    .single();

  if (erroreIspezione || !ispezione) {
    return risposta({ errore: `Ispezione non leggibile: ${erroreIspezione?.message ?? ''}` }, 404);
  }
  if (!ispezione.pdf_path) {
    return risposta({ errore: 'La scheda non ha ancora un PDF: concludi prima l’ispezione.' }, 400);
  }

  const pdv = ispezione.pdv as { codice: string; citta: string; indirizzo: string; email: string | null };
  const ispettore = ispezione.profili as { nome: string; cognome: string; email: string };

  const { data: attivita } = await servizio
    .from('ispezione_attivita')
    .select('destinatari(nome, email)')
    .eq('ispezione_id', ispezioneId);

  // Destinatari: il punto vendita, gli indirizzi fissi, l'ispettore e gli uffici a cui
  // sono assegnate le attività. Deduplicati e senza rimbalzare sul mittente stesso.
  const emailAttivita = ((attivita ?? []) as RigaAttivita[])
    .map((r) => r.destinatari?.email)
    .filter((e): e is string => Boolean(e));

  const a = pdv.email ? [pdv.email] : [];
  const cc = [...new Set([...COPIA_FISSA, ispettore.email, ...emailAttivita])]
    .filter((e) => e && !a.includes(e));

  // Senza indirizzo del punto vendita la mail resterebbe senza destinatario principale:
  // meglio spedirla comunque agli uffici che perderla.
  const destinatariA = a.length > 0 ? a : cc.splice(0, 1);
  if (destinatariA.length === 0) {
    return risposta({ errore: 'Nessun destinatario: manca sia l’email del punto vendita sia quelle in copia.' }, 400);
  }

  const dataIspezione = daDataISO(ispezione.data_ispezione);
  const ingresso = new Date(ispezione.ora_ingresso);
  const uscita = ispezione.ora_uscita ? new Date(ispezione.ora_uscita) : null;
  const nomeIspettore = `${ispettore.nome} ${ispettore.cognome}`.trim() || ispettore.email;
  const oggetto = `Scheda Attività Ispettore — ${pdv.codice} — ${dataBreve(dataIspezione)}`;

  const corpo = [
    `Scheda attività ispettore n. ${ispezione.numero}`,
    '',
    `Punto vendita: ${pdv.codice} — ${pdv.citta}, ${pdv.indirizzo}`,
    `Data: ${dataBreve(dataIspezione)}`,
    `Ispettore: ${nomeIspettore}`,
    uscita
      ? `Orari: ${ora(ingresso)} – ${ora(uscita)} (${durata(ingresso, uscita)})`
      : `Ingresso: ${ora(ingresso)}`,
    '',
    ispezione.niente_da_rilevare
      ? 'Esito: niente da rilevare.'
      : `Attività rilevate: ${(attivita ?? []).length}.`,
    '',
    'La scheda completa è nel PDF allegato.',
    '',
    '— Messaggio generato automaticamente da StoreScout.',
  ].join('\n');

  const tentativoPrecedente = await servizio
    .from('invii_email')
    .select('tentativi')
    .eq('ispezione_id', ispezioneId)
    .order('tentativi', { ascending: false })
    .limit(1)
    .maybeSingle();
  const tentativi = (tentativoPrecedente.data?.tentativi ?? 0) + 1;

  const registra = async (stato: 'inviata' | 'errore', errore: string | null) => {
    await servizio.from('invii_email').insert({
      ispezione_id: ispezioneId,
      destinatari: { to: destinatariA, cc },
      oggetto,
      stato,
      errore,
      tentativi,
      inviata_at: stato === 'inviata' ? new Date().toISOString() : null,
    });
    await servizio
      .from('ispezioni')
      .update({ stato: stato === 'inviata' ? 'inviata' : 'errore_invio' })
      .eq('id', ispezioneId);
  };

  try {
    const { data: pdf, error: errorePdf } = await servizio.storage
      .from('schede')
      .download(ispezione.pdf_path);
    if (errorePdf || !pdf) throw new Error(`PDF non scaricabile: ${errorePdf?.message ?? ''}`);

    // Codifica di libreria e non concatenazione carattere per carattere: su un PDF da
    // un centinaio di KB quest'ultima esaurisce le risorse della Edge Function.
    const allegato = encodeBase64(new Uint8Array(await pdf.arrayBuffer()));

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USER, password: SMTP_PASS },
      },
    });

    await client.send({
      from: `StoreScout <${SMTP_FROM}>`,
      to: destinatariA,
      cc,
      subject: oggetto,
      content: corpo,
      attachments: [
        {
          filename: `Scheda_${ispezione.numero}_${pdv.codice}_${ispezione.data_ispezione}.pdf`,
          content: allegato,
          encoding: 'base64',
          contentType: 'application/pdf',
        },
      ],
    });
    await client.close();

    await registra('inviata', null);
    return risposta({ esito: 'inviata', a: destinatariA, cc, oggetto, tentativi });
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    await registra('errore', messaggio);
    // Deliberatamente 200: un invio fallito e' un esito previsto, non un errore di
    // trasporto. Con un codice non-2xx il client Supabase avvolge la risposta in un
    // errore generico e il messaggio vero non arriva mai a schermo.
    return risposta({ esito: 'errore', errore: messaggio, a: destinatariA, cc, tentativi });
  }
});
