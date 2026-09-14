import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

/**
 * Riepilogo periodico dell'attività di ispezione, spedito per email.
 *
 * Non è una dashboard: è una pagina che arriva il lunedì e si legge in trenta secondi,
 * perché chi la riceve non entrerà mai in Supabase a interrogare una vista.
 *
 * Conta le attività **assegnate**, non quelle risolte: nel modello non c'è nulla che
 * registri se un ufficio ha poi fatto l'intervento, e far finta di saperlo sarebbe
 * peggio che non dirlo.
 *
 * Viene chiamata da fuori — oggi da una GitHub Action schedulata — e si difende con un
 * segreto proprio: è l'unica funzione del progetto che nessun utente dell'app invoca.
 */

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHIAVE_SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? '';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER') ?? '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER;

/** Chi riceve il riepilogo: indirizzi separati da virgola, impostati fra i secret. */
const DESTINATARI = (Deno.env.get('REPORT_DESTINATARI') ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

/** Segreto condiviso con chi schedula la chiamata. */
const CHIAVE_REPORT = Deno.env.get('REPORT_SECRET') ?? '';

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { 'Content-Type': 'application/json' },
  });

const due = (n: number) => String(n).padStart(2, '0');
const dataBreve = (d: Date) => `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`;
const dataISO = (d: Date) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type IspezioneLetta = {
  id: string;
  numero: number;
  data_ispezione: string;
  stato: string;
  voto: number | null;
  rotture_stock_promo: number | null;
  in_verifica: boolean;
  niente_da_rilevare: boolean;
  pdv: { codice: string; citta: string } | null;
  profili: { nome: string; cognome: string } | null;
  ispezione_attivita: { destinatari: { nome: string } | null; reparti: { nome: string } | null }[];
};

/**
 * Stili scritti a mano su ogni elemento.
 *
 * Nelle email il foglio di stile nel `<head>` viene rimosso da parecchi client, e
 * `display: flex` non lo interpreta quasi nessuno — Outlook rende l'HTML con il motore
 * di Word. Qui si usa quello che funziona ovunque da vent'anni: tabelle e attributi.
 */
const CELLA = 'border:1px solid #C9C9C4;padding:5px 8px;text-align:left;font-size:14px;';
const CELLA_NUM = CELLA + 'text-align:right;width:88px;';
const INTESTAZIONE =
  CELLA +
  'background:#F2F2EF;font-size:11px;text-transform:uppercase;letter-spacing:.4px;font-weight:700;';
const INTESTAZIONE_NUM = INTESTAZIONE + 'text-align:right;width:88px;';
const VUOTO = 'color:#6B6B66;font-style:italic;font-size:13px;';
const TITOLO =
  'font-size:15px;margin:22px 0 6px;border-bottom:2px solid #111111;padding-bottom:3px;';

/** Tabella a due colonne, con la riga più alta in cima. */
function tabella(intestazioni: [string, string], righe: [string, string | number][]): string {
  if (righe.length === 0) {
    return `<p style="${VUOTO}">Nessun dato nel periodo.</p>`;
  }
  return `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:460px;">
    <tr>
      <th style="${INTESTAZIONE}">${esc(intestazioni[0])}</th>
      <th style="${INTESTAZIONE_NUM}">${esc(intestazioni[1])}</th>
    </tr>
    ${righe
      .map(
        ([voce, valore]) =>
          `<tr><td style="${CELLA}">${esc(voce)}</td><td style="${CELLA_NUM}">${esc(String(valore))}</td></tr>`,
      )
      .join('')}
  </table>`;
}

/**
 * La riga dei numeri grandi, come tabella a celle affiancate.
 *
 * Era un contenitore flex, e nei client di posta i riquadri finivano uno sopra
 * l'altro con le cifre addosso alle etichette.
 */
function numeroni(voci: [string, string | number][]): string {
  return `<table cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 0 6px -8px;">
    <tr>
      ${voci
        .map(
          ([etichetta, valore]) => `<td style="border:1px solid #C9C9C4;padding:10px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:800;line-height:1.1;">${esc(String(valore))}</div>
            <div style="font-size:11px;text-transform:uppercase;color:#6B6B66;letter-spacing:.4px;margin-top:2px;">${esc(etichetta)}</div>
          </td>`,
        )
        .join('')}
    </tr>
  </table>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non consentito.' }, 405);

  // Nessun utente dell'app chiama questa funzione: il permesso è un segreto condiviso
  // con chi la schedula, non una sessione.
  if (!CHIAVE_REPORT || req.headers.get('x-report-secret') !== CHIAVE_REPORT) {
    return risposta({ errore: 'Non autorizzato.' }, 401);
  }
  if (DESTINATARI.length === 0) {
    return risposta({ errore: 'Nessun destinatario: imposta il secret REPORT_DESTINATARI.' }, 400);
  }

  const giorni = Number(new URL(req.url).searchParams.get('giorni') ?? '7');
  const a = new Date();
  const da = new Date();
  da.setDate(da.getDate() - giorni + 1);

  const servizio = createClient(URL_SUPABASE, CHIAVE_SERVIZIO, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await servizio
    .from('ispezioni')
    .select(
      'id, numero, data_ispezione, stato, voto, rotture_stock_promo, in_verifica, niente_da_rilevare, pdv(codice, citta), profili(nome, cognome), ispezione_attivita(destinatari(nome), reparti(nome))',
    )
    .neq('stato', 'bozza')
    .gte('data_ispezione', dataISO(da))
    .lte('data_ispezione', dataISO(a))
    .order('data_ispezione', { ascending: false });

  if (error) return risposta({ errore: `Lettura non riuscita: ${error.message}` }, 500);

  const ispezioni = (data ?? []) as unknown as IspezioneLetta[];

  /**
   * Le schede rimaste aperte si leggono senza limite di periodo.
   *
   * Una verifica ferma da tre settimane è proprio quella di cui c'è bisogno di sapere,
   * e restringendo agli ultimi sette giorni sparirebbe dal report esattamente quando
   * comincia a diventare un problema. Stessa cosa per le schede mai partite.
   */
  const { data: aperteGrezze } = await servizio
    .from('ispezioni')
    .select(
      'numero, data_ispezione, pdv(codice, citta), profili(nome, cognome), ispezione_attivita(scadenza_data, scadenza_testo, destinatari(nome, richiede_verifica))',
    )
    .eq('in_verifica', true)
    .order('data_ispezione', { ascending: true });

  const { data: fermeGrezze } = await servizio
    .from('ispezioni')
    .select('numero, data_ispezione, stato, pdv(codice)')
    .in('stato', ['conclusa', 'errore_invio'])
    .order('data_ispezione', { ascending: true })
    .limit(20);

  type ApertaLetta = {
    numero: number;
    data_ispezione: string;
    pdv: { codice: string; citta: string } | null;
    profili: { nome: string; cognome: string } | null;
    ispezione_attivita: {
      scadenza_data: string | null;
      scadenza_testo: string | null;
      destinatari: { nome: string; richiede_verifica: boolean } | null;
    }[];
  };

  const aperte = (aperteGrezze ?? []) as unknown as ApertaLetta[];
  const ferme = (fermeGrezze ?? []) as unknown as {
    numero: number;
    data_ispezione: string;
    stato: string;
    pdv: { codice: string } | null;
  }[];

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const giorniDa = (iso: string) => {
    const [aa, mm, gg] = iso.split('-').map(Number);
    return Math.round((oggi.getTime() - new Date(aa, mm - 1, gg).getTime()) / 86400000);
  };

  // --- Aggregazioni ---
  // In memoria e non in SQL: qualche centinaio di righe a settimana non giustifica una
  // vista da mantenere, e qui i conteggi restano accanto al testo che li spiega.
  const perDestinatario = new Map<string, number>();
  const perReparto = new Map<string, number>();
  let attivitaTotali = 0;

  for (const i of ispezioni) {
    for (const riga of i.ispezione_attivita ?? []) {
      attivitaTotali++;
      const d = riga.destinatari?.nome ?? '(senza destinatario)';
      const r = riga.reparti?.nome ?? '(senza reparto)';
      perDestinatario.set(d, (perDestinatario.get(d) ?? 0) + 1);
      perReparto.set(r, (perReparto.get(r) ?? 0) + 1);
    }
  }

  const conVoto = ispezioni.filter((i) => i.voto !== null);
  const votoMedio =
    conVoto.length > 0
      ? (conVoto.reduce((s, i) => s + (i.voto ?? 0), 0) / conVoto.length).toFixed(1)
      : '—';

  const perPdv = new Map<string, { citta: string; voti: number[]; visite: number }>();
  for (const i of ispezioni) {
    const codice = i.pdv?.codice ?? '??';
    const voce = perPdv.get(codice) ?? { citta: i.pdv?.citta ?? '', voti: [], visite: 0 };
    voce.visite++;
    if (i.voto !== null) voce.voti.push(i.voto);
    perPdv.set(codice, voce);
  }

  const bassi = [...perPdv.entries()]
    .filter(([, v]) => v.voti.length > 0)
    .map(([codice, v]) => ({
      codice,
      citta: v.citta,
      medio: v.voti.reduce((s, x) => s + x, 0) / v.voti.length,
    }))
    .sort((x, y) => x.medio - y.medio)
    .slice(0, 5);

  const rotture = ispezioni.reduce((s, i) => s + (i.rotture_stock_promo ?? 0), 0);

  const rotturePerPdv = new Map<string, number>();
  for (const i of ispezioni) {
    if (!i.rotture_stock_promo) continue;
    const voce = `${i.pdv?.codice ?? '??'} — ${i.pdv?.citta ?? ''}`;
    rotturePerPdv.set(voce, (rotturePerPdv.get(voce) ?? 0) + i.rotture_stock_promo);
  }

  const ordinate = (m: Map<string, number>) =>
    [...m.entries()].sort((x, y) => y[1] - x[1]) as [string, number][];

  const periodo = `${dataBreve(da)} – ${dataBreve(a)}`;

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
  <body style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;font-size:14px;margin:0;padding:18px;">
    <h1 style="font-size:19px;margin:0 0 2px;">StoreScout — riepilogo attività</h1>
    <p style="color:#6B6B66;margin:0 0 18px;">${periodo}</p>

    ${numeroni([
      ['Ispezioni', ispezioni.length],
      ['Attività', attivitaTotali],
      ['Voto medio', votoMedio],
      ['Rotture promo', rotture],
      ['Da chiudere', aperte.length],
    ])}

    <h2 style="${TITOLO}">Attività per destinatario</h2>
    ${tabella(['Destinatario', 'Attività'], ordinate(perDestinatario))}

    <h2 style="${TITOLO}">Attività per reparto</h2>
    ${tabella(['Reparto', 'Attività'], ordinate(perReparto))}

    <h2 style="${TITOLO}">Rotture di stock promo sala</h2>
    ${tabella(['Punto vendita', 'Rotture'], ordinate(rotturePerPdv))}

    <h2 style="${TITOLO}">Punti vendita con il voto più basso</h2>
    ${tabella(
      ['Punto vendita', 'Voto medio'],
      bassi.map((b) => [`${b.codice} — ${b.citta}`, b.medio.toFixed(1)] as [string, string]),
    )}

    <h2 style="${TITOLO}">Attività non ancora chiuse</h2>
    ${
      aperte.length === 0
        ? `<p style="${VUOTO}">Nessuna scheda in attesa di verifica.</p>`
        : `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:660px;">
            <tr>
              <th style="${INTESTAZIONE}">Scheda</th>
              <th style="${INTESTAZIONE}">Punto vendita</th>
              <th style="${INTESTAZIONE}">Da verificare</th>
              <th style="${INTESTAZIONE}">Scadenza</th>
              <th style="${INTESTAZIONE_NUM}">Giorni</th>
            </tr>
            ${aperte
              .map((v) => {
                const righe = (v.ispezione_attivita ?? []).filter(
                  (r) => r.destinatari?.richiede_verifica,
                );
                const scadenze = righe
                  .map((r) =>
                    r.scadenza_data
                      ? dataBreve(new Date(`${r.scadenza_data}T00:00:00`))
                      : (r.scadenza_testo ?? '—'),
                  )
                  .join(' · ');
                const eta = giorniDa(v.data_ispezione);
                // Una scadenza a data già passata va segnalata: è il momento in cui
                // quella riga smette di essere un promemoria e diventa un ritardo.
                const scaduta = righe.some((r) => r.scadenza_data && giorniDa(r.scadenza_data) > 0);
                const sfondo = scaduta ? 'background:#FBF1E3;' : '';
                return `<tr>
                  <td style="${CELLA}${sfondo}">n. ${v.numero}</td>
                  <td style="${CELLA}${sfondo}">${esc(`${v.pdv?.codice ?? '??'} — ${v.pdv?.citta ?? ''}`)}</td>
                  <td style="${CELLA}${sfondo}">${righe.length}</td>
                  <td style="${CELLA}${sfondo}">${esc(scadenze || '—')}${scaduta ? ' <strong>(scaduta)</strong>' : ''}</td>
                  <td style="${CELLA_NUM}${sfondo}">${eta}</td>
                </tr>`;
              })
              .join('')}
          </table>
          <p style="${VUOTO}">L’elenco non si ferma al periodo del riepilogo: una verifica ferma da settimane è proprio quella da vedere.</p>`
    }

    ${
      ferme.length > 0
        ? `<h2 style="${TITOLO}">Schede non partite</h2>
           <p>${ferme.length === 1 ? 'Una scheda non è mai stata spedita' : `${ferme.length} schede non sono mai state spedite`}: ${esc(
             ferme.map((f) => `n. ${f.numero} (${f.pdv?.codice ?? '??'})`).join(', '),
           )}. Si rispediscono dal pannello di amministrazione.</p>`
        : ''
    }

    <p style="color:#6B6B66;font-size:12px;margin-top:26px;border-top:1px solid #C9C9C4;padding-top:8px;">
      I conteggi riguardano le attività <strong>assegnate</strong> nel periodo, non quelle
      risolte: l’app registra le segnalazioni inviate agli uffici, non l’esito degli
      interventi.<br>
      Messaggio generato automaticamente da StoreScout.
    </p>
  </body></html>`;

  try {
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
      to: DESTINATARI,
      subject: `StoreScout — riepilogo ${periodo}`,
      html,
    });
    await client.close();

    return risposta({
      esito: 'inviato',
      a: DESTINATARI,
      periodo,
      ispezioni: ispezioni.length,
      attivita: attivitaTotali,
    });
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    // Non-2xx qui è corretto, al contrario dell'invio schede: qui non c'è nessuno a
    // leggere il messaggio a schermo, e chi schedula deve accorgersi del fallimento.
    return risposta({ errore: messaggio }, 502);
  }
});
