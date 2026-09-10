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

type RigaAttivita = {
  id: string;
  destinatari: { id: string; nome: string; email: string | null; richiede_verifica: boolean } | null;
};

/**
 * Tetto agli allegati del messaggio, PDF e foto insieme.
 *
 * Aruba accetta fino a 25 MB, ma la codifica base64 aggiunge circa un terzo: quindici
 * megabyte di file diventano una ventina di messaggio. L'app blocca già la conclusione
 * oltre questa soglia; qui il controllo si ripete perché una scheda vecchia rispedita a
 * mano non passa da quella validazione.
 */
const LIMITE_ALLEGATI_BYTE = 15 * 1024 * 1024;

type FotoArchiviata = { path: string; byte: number; ordine: number; attivita_id: string };

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
    .select('id, destinatari(id, nome, email, richiede_verifica)')
    .eq('ispezione_id', ispezioneId);

  /**
   * Gli uffici a cui spetta un estratto: quelli assegnatari di almeno un'attività, con
   * un indirizzo, e non marcati «da verificare».
   *
   * L'esclusione riguarda oggi CN, che è il capo negozio: la scheda completa gli arriva
   * già attraverso l'indirizzo del punto vendita, e mandargli anche un estratto sarebbe
   * la stessa visita raccontata due volte.
   */
  const uffici = new Map<string, { nome: string; email: string }>();
  // Una foto sta su una riga attività, non su un ufficio: questa mappa fa il ponte,
  // così ogni estratto porta con sé soltanto gli scatti delle proprie righe.
  const ufficioDellAttivita = new Map<string, string>();

  for (const riga of (attivita ?? []) as RigaAttivita[]) {
    const d = riga.destinatari;
    if (!d) continue;
    if (d.email && !d.richiede_verifica) uffici.set(d.id, { nome: d.nome, email: d.email });
    ufficioDellAttivita.set(riga.id, d.id);
  }

  // Destinatari: il punto vendita, gli indirizzi fissi, l'ispettore e gli uffici a cui
  // sono assegnate le attività. Deduplicati e senza rimbalzare sul mittente stesso.
  // In copia sulla scheda completa restano i destinatari che l'estratto non lo ricevono,
  // cioè quelli marcati «da verificare»: gli altri hanno la propria mail con la propria
  // copia, e lasciarli anche qui vanificherebbe la separazione.
  const emailAttivita = ((attivita ?? []) as RigaAttivita[])
    .filter((r) => r.destinatari?.richiede_verifica)
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

  // Le foto delle rilevazioni viaggiano con la scheda: sono la prova di quello che
  // la riga descrive a parole.
  const { data: fotoRighe } = await servizio
    .from('ispezione_foto')
    .select('path, byte, ordine, attivita_id')
    .eq('ispezione_id', ispezioneId)
    .order('ordine');

  const foto = (fotoRighe ?? []) as FotoArchiviata[];

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
    const bytesPdf = new Uint8Array(await pdf.arrayBuffer());
    const allegato = encodeBase64(bytesPdf);

    /**
     * Si allega finché si sta dentro il limite, e ciò che resta fuori viene detto nel
     * corpo del messaggio. Una scheda che non parte per il peso di una foto sarebbe il
     * modo peggiore di gestire il problema: il documento firmato deve arrivare comunque,
     * e chi lo riceve deve sapere che cosa manca.
     */
    let pesoAllegati = bytesPdf.byteLength;
    const allegatiFoto: {
      filename: string;
      content: string;
      encoding: 'base64';
      contentType: string;
      perUfficio: string | undefined;
    }[] = [];
    let omesse = 0;

    for (const [indice, f] of foto.entries()) {
      if (pesoAllegati + f.byte > LIMITE_ALLEGATI_BYTE) {
        omesse++;
        continue;
      }
      const { data: immagine, error: erroreFoto } = await servizio.storage
        .from('foto')
        .download(f.path);
      if (erroreFoto || !immagine) {
        omesse++;
        continue;
      }
      const bytesFoto = new Uint8Array(await immagine.arrayBuffer());
      pesoAllegati += bytesFoto.byteLength;
      allegatiFoto.push({
        filename: `Foto_${ispezione.numero}_${indice + 1}.jpg`,
        content: encodeBase64(bytesFoto),
        encoding: 'base64',
        contentType: 'image/jpeg',
        perUfficio: ufficioDellAttivita.get(f.attivita_id),
      });
    }

    // Stesso stile del corpo qui sopra: le righe si compongono e si uniscono, cosi'
    // un a capo resta visibile come tale anche a chi rileggera' fra sei mesi.
    const coda: string[] = [];
    if (omesse > 0) {
      coda.push(
        '',
        `Nota: ${omesse} ${omesse === 1 ? 'foto non è stata allegata' : 'foto non sono state allegate'} per non superare il limite di dimensione del messaggio.`,
      );
    } else if (allegatiFoto.length > 0) {
      coda.push(
        '',
        allegatiFoto.length === 1
          ? 'In allegato anche 1 foto della rilevazione.'
          : `In allegato anche ${allegatiFoto.length} foto delle rilevazioni.`,
      );
    }
    const corpoCompleto = [corpo, ...coda].join('\n');

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
      content: corpoCompleto,
      attachments: [
        {
          filename: `Scheda_${ispezione.numero}_${pdv.codice}_${ispezione.data_ispezione}.pdf`,
          content: allegato,
          encoding: 'base64' as const,
          contentType: 'application/pdf',
        },
        ...allegatiFoto.map(({ perUfficio: _, ...allegato }) => allegato),
      ],
    });
    /**
     * Poi un messaggio per ufficio, ciascuno con il suo estratto.
     *
     * Mail separate e non una sola con più allegati: finché il messaggio è uno, chi è
     * in copia apre anche gli allegati degli altri, e la separazione sarebbe solo
     * apparente.
     *
     * Il percorso dell'estratto si ricostruisce dal nome del PDF completo più l'id del
     * destinatario, la stessa regola che l'app usa per salvarlo.
     */
    const estrattiInviati: string[] = [];
    const estrattiFalliti: string[] = [];

    for (const [destinatarioId, ufficio] of uffici) {
      const percorso = ispezione.pdf_path.replace(/\.pdf$/, `_${destinatarioId}.pdf`);
      try {
        const { data: estratto, error: erroreEstratto } = await servizio.storage
          .from('schede')
          .download(percorso);
        if (erroreEstratto || !estratto) throw new Error(erroreEstratto?.message ?? 'estratto assente');

        const suoiAllegati = allegatiFoto
          .filter((a) => a.perUfficio === destinatarioId)
          .map(({ perUfficio: _, ...allegato }) => allegato);

        await client.send({
          from: `StoreScout <${SMTP_FROM}>`,
          to: [ufficio.email],
          subject: `${oggetto} — ${ufficio.nome}`,
          content: [
            `Scheda attività ispettore n. ${ispezione.numero} — estratto per ${ufficio.nome}`,
            '',
            `Punto vendita: ${pdv.codice} — ${pdv.citta}, ${pdv.indirizzo}`,
            `Data: ${dataBreve(dataIspezione)}`,
            `Ispettore: ${nomeIspettore}`,
            '',
            'In allegato le sole attività assegnate a questo ufficio.',
            '',
            '— Messaggio generato automaticamente da StoreScout.',
          ].join('
'),
          attachments: [
            {
              filename: `Scheda_${ispezione.numero}_${pdv.codice}_${ufficio.nome.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`,
              content: encodeBase64(new Uint8Array(await estratto.arrayBuffer())),
              encoding: 'base64' as const,
              contentType: 'application/pdf',
            },
            ...suoiAllegati,
          ],
        });
        estrattiInviati.push(ufficio.nome);
      } catch (e) {
        // Un estratto che non parte non deve annullare la scheda completa, che è già
        // arrivata: si registra il nome e lo si dice a chi ha concluso l'ispezione.
        estrattiFalliti.push(ufficio.nome);
        console.error(`Estratto per ${ufficio.nome} non inviato:`, e);
      }
    }

    await client.close();

    await registra('inviata', null);
    return risposta({
      esito: 'inviata',
      a: destinatariA,
      cc,
      oggetto,
      tentativi,
      foto: allegatiFoto.length,
      fotoOmesse: omesse,
      estratti: estrattiInviati,
      estrattiFalliti,
    });
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    await registra('errore', messaggio);
    // Deliberatamente 200: un invio fallito e' un esito previsto, non un errore di
    // trasporto. Con un codice non-2xx il client Supabase avvolge la risposta in un
    // errore generico e il messaggio vero non arriva mai a schermo.
    return risposta({ esito: 'errore', errore: messaggio, a: destinatariA, cc, tentativi });
  }
});
