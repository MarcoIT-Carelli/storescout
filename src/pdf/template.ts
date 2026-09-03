import { dataBreve, durata, ora } from '@/lib/format';

import { LOGO_AZIENDALE } from './logoAziendale';

/**
 * Template della scheda in PDF. Riproduce il modulo Excel sostituito dall'app.
 *
 * Nessun font né immagine viene scaricato: `expo-print` renderizza questo HTML sul
 * dispositivo, spesso senza rete. Logo e firme sono incorporati come data URI.
 */

export type RigaPdf = {
  destinatario: string;
  reparto: string;
  tipoIntervento: string;
  note: string;
  scadenza: string;
};

export type DatiScheda = {
  numero: number | null;
  pdvCodice: string;
  pdvCitta: string;
  pdvIndirizzo: string;
  pdvRagioneSociale: string;
  ispettore: string;
  dataIspezione: Date;
  oraIngresso: Date;
  oraUscita: Date | null;
  nienteDaRilevare: boolean;
  righe: RigaPdf[];
  svolte: string[];
  firmaIspettoreBase64: string | null;
  firmaResponsabileBase64: string | null;
  nomeResponsabile: string;
  motivoAssenzaFirma: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function htmlScheda(d: DatiScheda): string {
  const generato = new Date();

  const testata = `
    <div class="testata">
      <img class="marchio" src="${LOGO_AZIENDALE}" alt="">
      <div class="titoli">
        <h1>SCHEDA ATTIVITÀ ISPETTORE</h1>
        <p class="sottotitolo">Carelli Distribuzione — Area Vendite</p>
      </div>
      <div class="numero">${d.numero ? `N. ${d.numero}` : ''}</div>
    </div>`;

  const anagrafica = `
    <table class="anagrafica">
      <tr>
        <th>Punto vendita</th>
        <th>Data</th>
        <th>Ora ingresso</th>
        <th>Ora uscita</th>
        <th>Ispettore</th>
      </tr>
      <tr>
        <td>
          <strong>${esc(d.pdvCodice)}</strong> — ${esc(d.pdvCitta)}<br>
          <span class="minore">${esc(d.pdvIndirizzo)} · ${esc(d.pdvRagioneSociale)}</span>
        </td>
        <td>${dataBreve(d.dataIspezione)}</td>
        <td>${ora(d.oraIngresso)}</td>
        <td>${d.oraUscita ? ora(d.oraUscita) : '—'}</td>
        <td>${esc(d.ispettore)}</td>
      </tr>
    </table>
    ${d.oraUscita ? `<p class="durata">Durata della visita: ${durata(d.oraIngresso, d.oraUscita)}</p>` : ''}`;

  const attivita = d.nienteDaRilevare
    ? '<div class="niente">NIENTE DA RILEVARE</div>'
    : `
    <table class="attivita">
      <thead>
        <tr>
          <th style="width:15%">Destinatario</th>
          <th style="width:15%">Reparto</th>
          <th style="width:18%">Tipo intervento</th>
          <th style="width:34%">Note</th>
          <th style="width:18%">Scadenza</th>
        </tr>
      </thead>
      <tbody>
        ${d.righe
          .map(
            (r) => `<tr>
              <td>${esc(r.destinatario)}</td>
              <td>${esc(r.reparto)}</td>
              <td>${esc(r.tipoIntervento)}</td>
              <td class="note">${esc(r.note)}</td>
              <td>${esc(r.scadenza)}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

  const svolte =
    d.svolte.length > 0
      ? `<h2>Ho svolto le seguenti attività</h2>
         <ul class="svolte">${d.svolte.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
      : '';

  const firma = (titolo: string, base64: string | null, nome: string, assenza?: string) => `
    <div class="firma">
      <div class="riquadro">
        ${base64 ? `<img src="data:image/png;base64,${base64}" alt="">` : `<span class="assente">${esc(assenza ?? 'Firma non raccolta')}</span>`}
      </div>
      <div class="etichettaFirma">${titolo}</div>
      <div class="nomeFirma">${esc(nome) || '&nbsp;'}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111111; font-size: 10.5pt; margin: 0; -webkit-print-color-adjust: exact;
  }
  .testata { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #111111; padding-bottom: 10px; }
  .marchio { width: 150px; height: auto; flex: none; }
  .titoli { flex: 1; }
  h1 { font-size: 15pt; margin: 0; letter-spacing: 0.4px; }
  .sottotitolo { margin: 2px 0 0; font-size: 9pt; color: #6B6B66; }
  .numero { font-size: 11pt; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #C9C9C4; padding: 6px 7px; text-align: left; vertical-align: top; }
  th { background: #F2F2EF; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4px; }
  .anagrafica td { font-size: 10pt; }
  .minore { color: #6B6B66; font-size: 8.5pt; }
  .durata { margin: 6px 0 0; font-size: 9pt; color: #6B6B66; }

  h2 { font-size: 11pt; margin: 18px 0 0; }
  .attivita { margin-top: 6px; }
  .attivita tbody td { font-size: 9.5pt; }
  .note { white-space: pre-wrap; }
  tr { page-break-inside: avoid; }

  .niente {
    margin-top: 18px; border: 2px solid #111111; padding: 22px; text-align: center;
    font-size: 15pt; font-weight: 800; letter-spacing: 2px;
  }

  .svolte { margin: 6px 0 0; padding-left: 18px; }
  .svolte li { margin-bottom: 3px; }

  .firme { display: flex; gap: 24px; margin-top: 26px; page-break-inside: avoid; }
  .firma { flex: 1; }
  .riquadro {
    height: 90px; border: 1px solid #C9C9C4; display: flex; align-items: center;
    justify-content: center; overflow: hidden; background: #FFFFFF;
  }
  .riquadro img { max-height: 84px; max-width: 100%; }
  .assente { font-size: 9pt; color: #6B6B66; font-style: italic; padding: 0 8px; text-align: center; }
  .etichettaFirma { font-size: 8.5pt; text-transform: uppercase; color: #6B6B66; margin-top: 5px; letter-spacing: 0.4px; }
  .nomeFirma { font-size: 10pt; font-weight: 600; }

  .pie {
    margin-top: 26px; padding-top: 7px; border-top: 1px solid #C9C9C4;
    font-size: 8pt; color: #6B6B66; display: flex; justify-content: space-between;
  }
</style></head>
<body>
  ${testata}
  ${anagrafica}
  <h2>Attività rilevate</h2>
  ${attivita}
  ${svolte}
  <div class="firme">
    ${firma('Firma ispettore', d.firmaIspettoreBase64, d.ispettore)}
    ${firma(
      'Firma responsabile punto vendita',
      d.firmaResponsabileBase64,
      d.nomeResponsabile,
      d.motivoAssenzaFirma ? `Firma non raccolta: ${d.motivoAssenzaFirma}` : undefined,
    )}
  </div>
  <div class="pie">
    <span>${d.numero ? `Ispezione n. ${d.numero}` : 'Ispezione'} · ${esc(d.pdvCodice)} · ${dataBreve(d.dataIspezione)}</span>
    <span>Generato da StoreScout il ${dataBreve(generato)} alle ${ora(generato)}</span>
  </div>
</body></html>`;
}
