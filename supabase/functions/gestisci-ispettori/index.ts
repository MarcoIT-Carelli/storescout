import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Operazioni sugli ispettori che richiedono la chiave `service_role`.
 *
 * Creare un utente e reimpostarne la password sono operazioni di amministrazione
 * di Supabase Auth: la chiave che le autorizza non può stare nell'app, perché
 * l'APK è ispezionabile da chiunque lo riceva. Vivono quindi qui, dove la chiave
 * è fornita dall'ambiente e non transita mai per il dispositivo.
 *
 * Rinomina, cambio ruolo e attivazione non passano da qui: agiscono sulla tabella
 * `profili`, dove la policy di update per gli admin esiste già.
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

const LUNGHEZZA_MINIMA_PASSWORD = 8;

type Corpo =
  | { azione: 'crea'; email: string; nome: string; cognome: string; ruolo?: 'admin' | 'ispettore'; password: string }
  | { azione: 'reimposta_password'; id: string; password: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non consentito.' }, 405);

  const autorizzazione = req.headers.get('Authorization');
  if (!autorizzazione) return risposta({ errore: 'Chiamata senza autenticazione.' }, 401);

  // Il chiamante viene identificato con la sua stessa sessione, non con la chiave
  // di servizio: così le policy di `profili` valgono anche qui.
  const comeChiamante = createClient(URL_SUPABASE, CHIAVE_ANON, {
    global: { headers: { Authorization: autorizzazione } },
  });

  const { data: sessione, error: erroreSessione } = await comeChiamante.auth.getUser();
  if (erroreSessione || !sessione.user) return risposta({ errore: 'Sessione non valida.' }, 401);

  const { data: chiamante } = await comeChiamante
    .from('profili')
    .select('ruolo, attivo')
    .eq('id', sessione.user.id)
    .single();

  if (!chiamante || chiamante.ruolo !== 'admin' || !chiamante.attivo) {
    return risposta({ errore: 'Riservato agli amministratori.' }, 403);
  }

  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ errore: 'Richiesta non leggibile.' }, 400);
  }

  const servizio = createClient(URL_SUPABASE, CHIAVE_SERVIZIO, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (corpo.azione === 'crea') {
    const email = corpo.email?.trim().toLowerCase();
    const nome = corpo.nome?.trim();
    const cognome = corpo.cognome?.trim();

    if (!email || !nome || !cognome) return risposta({ errore: 'Nome, cognome ed email sono obbligatori.' }, 400);
    if (!corpo.password || corpo.password.length < LUNGHEZZA_MINIMA_PASSWORD) {
      return risposta({ errore: `La password iniziale deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.` }, 400);
    }

    // `email_confirm: true` evita di dipendere dal recapito della mail di conferma:
    // l'ispettore riceve le credenziali dall'amministratore e accede subito.
    const { data: creato, error: erroreCreazione } = await servizio.auth.admin.createUser({
      email,
      password: corpo.password,
      email_confirm: true,
      user_metadata: { nome, cognome },
    });

    if (erroreCreazione || !creato.user) {
      const messaggio = erroreCreazione?.message ?? '';
      if (/already been registered|already exists/i.test(messaggio)) {
        return risposta({ errore: 'Esiste già un utente con questo indirizzo email.' }, 409);
      }
      return risposta({ errore: messaggio || 'Creazione non riuscita.' }, 400);
    }

    // Il trigger `handle_new_user` ha già scritto la riga in `profili`: qui si
    // completano ruolo e obbligo di cambio password, che il trigger non conosce.
    const { data: profilo, error: erroreProfilo } = await servizio
      .from('profili')
      .update({
        nome,
        cognome,
        ruolo: corpo.ruolo === 'admin' ? 'admin' : 'ispettore',
        deve_cambiare_password: true,
      })
      .eq('id', creato.user.id)
      .select('*')
      .single();

    if (erroreProfilo) {
      // Senza profilo l'utente non potrebbe fare nulla: meglio non lasciarlo a metà.
      await servizio.auth.admin.deleteUser(creato.user.id);
      return risposta({ errore: `Profilo non creato: ${erroreProfilo.message}` }, 500);
    }

    return risposta({ profilo });
  }

  if (corpo.azione === 'reimposta_password') {
    if (!corpo.id) return risposta({ errore: 'Manca l’ispettore da aggiornare.' }, 400);
    if (!corpo.password || corpo.password.length < LUNGHEZZA_MINIMA_PASSWORD) {
      return risposta({ errore: `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.` }, 400);
    }

    const { error: errorePassword } = await servizio.auth.admin.updateUserById(corpo.id, {
      password: corpo.password,
    });
    if (errorePassword) return risposta({ errore: errorePassword.message }, 400);

    const { error: erroreFlag } = await servizio
      .from('profili')
      .update({ deve_cambiare_password: true })
      .eq('id', corpo.id);
    if (erroreFlag) return risposta({ errore: erroreFlag.message }, 500);

    return risposta({ esito: 'password reimpostata' });
  }

  return risposta({ errore: 'Azione sconosciuta.' }, 400);
});
