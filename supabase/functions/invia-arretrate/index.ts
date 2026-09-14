/**
 * Recupero automatico delle schede rimaste indietro.
 *
 * Fino a ieri l'invio aveva un solo tentativo: se il server di posta era irraggiungibile
 * in quel momento — per un blocco temporaneo, una rete lenta, un riavvio dall'altra parte
 * — la scheda restava ferma finché qualcuno non se ne accorgeva e premeva «Riprova
 * invio». Con sei ispettori in giro per la provincia, quel qualcuno non esiste.
 *
 * Questa funzione gira ogni venti minuti e ripesca ciò che non è partito. L'ispettore non
 * deve fare niente e non deve nemmeno saperlo: la scheda è già salvata e il PDF
 * archiviato dal momento in cui ha premuto «Concludi».
 *
 * Non riprova all'infinito. Dopo `MASSIMI_TENTATIVI` la scheda resta lì e compare nel
 * riepilogo settimanale: se dopo dieci tentativi in più di tre ore non è partita, il
 * problema non si risolve insistendo — è un indirizzo sbagliato, un allegato irrecuperabile,
 * una casella piena.
 */

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHIAVE_SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CHIAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CHIAVE_SISTEMA = Deno.env.get('SISTEMA_SECRET') ?? '';

/** Quante schede per esecuzione: il resto lo prende il giro dopo, venti minuti più tardi. */
const PER_GIRO = 5;

/** Oltre questi tentativi non si insiste: il problema non è passeggero. */
const MASSIMI_TENTATIVI = 10;

/** Fra una scheda e l'altra, per non ripresentarsi al server di posta a raffica. */
const PAUSA_MS = 2000;

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { 'Content-Type': 'application/json' },
  });

const attendi = (ms: number) => new Promise((esegui) => setTimeout(esegui, ms));

const intestazioniServizio = {
  apikey: CHIAVE_SERVIZIO,
  Authorization: `Bearer ${CHIAVE_SERVIZIO}`,
  Accept: 'application/json',
};

type Ferma = { id: string; numero: number; stato: string; pdv: { codice: string } | null };
type Tentativo = { ispezione_id: string; tentativi: number };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non consentito.' }, 405);
  if (!CHIAVE_SISTEMA || req.headers.get('x-sistema-secret') !== CHIAVE_SISTEMA) {
    return risposta({ errore: 'Non autorizzato.' }, 401);
  }

  try {
    // Le schede concluse ma non spedite, dalla più vecchia: chi aspetta da ieri passa
    // davanti a chi aspetta da un quarto d'ora.
    const r = await fetch(
      `${URL_SUPABASE}/rest/v1/ispezioni?` +
        [
          'select=id,numero,stato,pdv(codice)',
          'stato=in.(conclusa,errore_invio)',
          'pdf_path=not.is.null',
          'order=data_ispezione.asc',
          `limit=${PER_GIRO * 3}`,
        ].join('&'),
      { headers: intestazioniServizio },
    );
    if (!r.ok) throw new Error(`lettura ispezioni: ${r.status} ${await r.text()}`);
    const candidate = (await r.json()) as Ferma[];

    if (candidate.length === 0) {
      return risposta({ esito: 'niente da fare', esaminate: 0 });
    }

    // Quante volte si è già provato, per non insistere su ciò che non si risolve.
    const ids = candidate.map((i) => `"${i.id}"`).join(',');
    const rt = await fetch(
      `${URL_SUPABASE}/rest/v1/invii_email?select=ispezione_id,tentativi&ispezione_id=in.(${ids})`,
      { headers: intestazioniServizio },
    );
    if (!rt.ok) throw new Error(`lettura tentativi: ${rt.status} ${await rt.text()}`);

    const massimoPer = new Map<string, number>();
    for (const t of (await rt.json()) as Tentativo[]) {
      massimoPer.set(t.ispezione_id, Math.max(massimoPer.get(t.ispezione_id) ?? 0, t.tentativi));
    }

    const daRiprovare = candidate
      .filter((i) => (massimoPer.get(i.id) ?? 0) < MASSIMI_TENTATIVI)
      .slice(0, PER_GIRO);

    const riuscite: number[] = [];
    const fallite: { numero: number; motivo: string }[] = [];

    for (const [indice, ispezione] of daRiprovare.entries()) {
      if (indice > 0) await attendi(PAUSA_MS);
      try {
        const invio = await fetch(`${URL_SUPABASE}/functions/v1/invia-scheda`, {
          method: 'POST',
          headers: {
            // L'anon key soddisfa il controllo della piattaforma, il segreto di sistema
            // quello della funzione: senza sessione utente servono entrambi.
            Authorization: `Bearer ${CHIAVE_ANON}`,
            'x-sistema-secret': CHIAVE_SISTEMA,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ispezione_id: ispezione.id }),
        });

        const esito = (await invio.json()) as { esito?: string; errore?: string };
        if (esito?.esito === 'inviata') riuscite.push(ispezione.numero);
        else fallite.push({ numero: ispezione.numero, motivo: esito?.errore ?? `HTTP ${invio.status}` });
      } catch (e) {
        fallite.push({
          numero: ispezione.numero,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const arrese = candidate.filter((i) => (massimoPer.get(i.id) ?? 0) >= MASSIMI_TENTATIVI);

    return risposta({
      esito: 'giro completato',
      ferme: candidate.length,
      riprovate: daRiprovare.length,
      riuscite,
      fallite,
      // Queste non verranno più riprovate: vanno guardate a mano dal pannello.
      arrese: arrese.map((i) => i.numero),
    });
  } catch (e) {
    return risposta({ errore: e instanceof Error ? e.message : String(e) }, 500);
  }
});
