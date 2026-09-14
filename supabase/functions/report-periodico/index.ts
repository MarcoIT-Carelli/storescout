import { spedisci } from '../_shared/posta.ts';

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
 *
 * **Legge con `fetch` e spedisce con `fetch`.** Per tre query in sola lettura un client
 * intero è sovrabbondante, e l'invio passa dall'API di Brevo: la versione SMTP di questa
 * funzione veniva uccisa dalla piattaforma con un `CPU Time exceeded` a metà handshake.
 */

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHIAVE_SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Chi riceve il riepilogo: indirizzi separati da virgola, impostati fra i secret. */
const DESTINATARI = (Deno.env.get('REPORT_DESTINATARI') ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

/** Segreto condiviso con chi schedula la chiamata. */
const CHIAVE_REPORT = Deno.env.get('REPORT_SECRET') ?? '';

/** Lettura da PostgREST con la chiave di servizio. `query` è già in forma di URL. */
async function leggi<T>(tabella: string, query: string): Promise<T[]> {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${tabella}?${query}`, {
    headers: {
      apikey: CHIAVE_SERVIZIO,
      Authorization: `Bearer ${CHIAVE_SERVIZIO}`,
      Accept: 'application/json',
    },
  });
  if (!r.ok) throw new Error(`${tabella}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T[];
}

/** Lettura da PostgREST con la chiave di servizio. `query` è già in forma di URL. */
async function leggi<T>(tabella: string, query: string): Promise<T[]> {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${tabella}?${query}`, {
    headers: {
      apikey: CHIAVE_SERVIZIO,
      Authorization: `Bearer ${CHIAVE_SERVIZIO}`,
      Accept: 'application/json',
    },
  });
  if (!r.ok) throw new Error(`${tabella}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T[];
}

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
  numero: number;
  voto: number | null;
  rotture_stock_promo: number | null;
  pdv: { codice: string; citta: string } | null;
  ispezione_attivita: { destinatari: { nome: string } | null; reparti: { nome: string } | null }[];
};

type ApertaLetta = {
  numero: number;
  data_ispezione: string;
  pdv: { codice: string; citta: string } | null;
  ispezione_attivita: {
    scadenza_data: string | null;
    scadenza_testo: string | null;
    destinatari: { nome: string; richiede_verifica: boolean } | null;
  }[];
};

type FermaLetta = { numero: number; pdv: { codice: string } | null };

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
  // Sonda diagnostica: risponde prima di toccare database e posta. Serve a distinguere
  // un problema di avvio del modulo da uno del lavoro che la funzione fa.
  if (new URL(req.url).searchParams.has('ping')) return risposta({ ok: true });

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

  let ispezioni: IspezioneLetta[];
  let aperte: ApertaLetta[];
  let ferme: FermaLetta[];

  try {
  // Solo le colonne che finiscono nel report: ogni campo in più è lavoro che la
  // funzione fa per niente, e qui il margine è stretto.
  ispezioni = await leggi<IspezioneLetta>(
    'ispezioni',
    [
      'select=numero,voto,rotture_stock_promo,pdv(codice,citta),ispezione_attivita(destinatari(nome),reparti(nome))',
      'stato=neq.bozza',
      `data_ispezione=gte.${dataISO(da)}`,
      `data_ispezione=lte.${dataISO(a)}`,
    ].join('&'),
  );

  /**
   * Le schede rimaste aperte si leggono senza limite di periodo.
   *
   * Una verifica ferma da tre settimane è proprio quella di cui c'è bisogno di sapere,
   * e restringendo agli ultimi sette giorni sparirebbe dal report esattamente quando
   * comincia a diventare un problema. Stessa cosa per le schede mai partite.
   */
  aperte = await leggi<ApertaLetta>(
    'ispezioni',
    [
      'select=numero,data_ispezione,pdv(codice,citta),ispezione_attivita(scadenza_data,scadenza_testo,destinatari(nome,richiede_verifica))',
      'in_verifica=is.true',
      'order=data_ispezione.asc',
    ].join('&'),
  );

  ferme = await leggi<FermaLetta>(
    'ispezioni',
    [
      'select=numero,pdv(codice)',
      'stato=in.(conclusa,errore_invio)',
      'order=data_ispezione.asc',
      'limit=20',
    ].join('&'),
  );
  } catch (e) {
    return risposta({ errore: e instanceof Error ? e.message : String(e) }, 500);
  }

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

  const giorni = Number(new URL(req.url).searchParams.get('giorni') ?? '7');
  const a = new Date();
  const da = new Date();
  da.setDate(da.getDate() - giorni + 1);

  let ispezioni: IspezioneLetta[];
  let aperte: ApertaLetta[];
  let ferme: FermaLetta[];

  try {
  // Solo le colonne che finiscono nel report: ogni campo in più è lavoro che la
  // funzione fa per niente, e qui il margine è stretto.
  ispezioni = await leggi<IspezioneLetta>(
    'ispezioni',
    [
      'select=numero,voto,rotture_stock_promo,pdv(codice,citta),ispezione_attivita(destinatari(nome),reparti(nome))',
      'stato=neq.bozza',
      `data_ispezione=gte.${dataISO(da)}`,
      `data_ispezione=lte.${dataISO(a)}`,
    ].join('&'),
  );

  /**
   * Le schede rimaste aperte si leggono senza limite di periodo.
   *
   * Una verifica ferma da tre settimane è proprio quella di cui c'è bisogno di sapere,
   * e restringendo agli ultimi sette giorni sparirebbe dal report esattamente quando
   * comincia a diventare un problema. Stessa cosa per le schede mai partite.
   */
  aperte = await leggi<ApertaLetta>(
    'ispezioni',
    [
      'select=numero,data_ispezione,pdv(codice,citta),ispezione_attivita(scadenza_data,scadenza_testo,destinatari(nome,richiede_verifica))',
      'in_verifica=is.true',
      'order=data_ispezione.asc',
    ].join('&'),
  );

  ferme = await leggi<FermaLetta>(
    'ispezioni',
    [
      'select=numero,pdv(codice)',
      'stato=in.(conclusa,errore_invio)',
      'order=data_ispezione.asc',
      'limit=20',
    ].join('&'),
  );
  } catch (e) {
    return risposta({ errore: e instanceof Error ? e.message : String(e) }, 500);
  }

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
    await spedisci({
      a: DESTINATARI,
      oggetto: `StoreScout — riepilogo ${periodo}`,
      // La parte testuale accanto all'HTML: chi legge in solo testo trova qualcosa
      // invece di una pagina di marcatori.
      testo: [
        `StoreScout — riepilogo ${periodo}`,
        '',
        `Ispezioni: ${ispezioni.length}`,
        `Attività: ${attivitaTotali}`,
        `Voto medio: ${votoMedio}`,
        `Rotture promo: ${rotture}`,
        `Schede da chiudere: ${aperte.length}`,
        '',
        'Il dettaglio è nella versione HTML di questo messaggio.',
      ].join('\n'),
      html,
    });

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
