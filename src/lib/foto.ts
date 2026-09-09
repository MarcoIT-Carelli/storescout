import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/**
 * Foto delle attività rilevate.
 *
 * Vanno via mail insieme al PDF, e una casella di posta non è un archivio: il vincolo
 * vero non è lo spazio su Storage ma il peso massimo di un messaggio. Per questo la foto
 * viene ridotta **sul dispositivo, prima ancora di essere salvata**: dodici megapixel
 * appena usciti dalla fotocamera sono tre megabyte l'uno, e cinque foto così basterebbero
 * a far rifiutare la mail dal server.
 *
 * Ridotta a 1600 px di lato lungo una foto pesa circa 400 KB e mostra comunque uno
 * scaffale, una scadenza sull'etichetta, un guasto. Il blocco resta come rete di
 * sicurezza, ma con questi numeri non dovrebbe scattare quasi mai.
 */

/** Lato lungo dopo il ridimensionamento. */
const LATO_LUNGO = 1600;

/** Compressione JPEG: sotto questo valore gli scaffali cominciano a sgranare. */
const QUALITA = 0.7;

/** Quante foto per singola attività rilevata. */
export const FOTO_PER_ATTIVITA = 3;

/**
 * Peso massimo degli allegati di una scheda, PDF compreso.
 *
 * Aruba accetta messaggi fino a 25 MB, ma la codifica base64 degli allegati aggiunge
 * circa un terzo: 15 MB di file diventano una ventina di megabyte di messaggio, e il
 * margine che resta serve a non far rimbalzare la mail per un pelo.
 */
export const LIMITE_ALLEGATI_BYTE = 15 * 1024 * 1024;

export type FotoLocale = {
  id: string;
  /** URI sul dispositivo, prima del caricamento su Storage. */
  uri: string;
  byte: number;
};

export const pesoLeggibile = (byte: number) =>
  byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.round(byte / 1024)} KB`;

/**
 * Apre la fotocamera e restituisce la foto già ridotta, oppure `null` se l'ispettore
 * ha annullato. Solleva se il permesso viene negato: chi ha toccato il pulsante deve
 * sapere perché non è successo niente.
 */
export async function scattaFoto(): Promise<FotoLocale | null> {
  const permesso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permesso.granted) {
    throw new Error(
      'Serve il permesso di usare la fotocamera. Puoi darlo dalle impostazioni di Android, alla voce StoreScout.',
    );
  }

  const esito = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    // Il ritaglio guidato di sistema, con il tablet in una mano sola, è un passaggio in
    // più fra lo scatto e il lavoro: la foto serve come prova, non come illustrazione.
    allowsEditing: false,
    exif: false,
  });

  if (esito.canceled || !esito.assets?.[0]) return null;

  const originale = esito.assets[0];
  const contesto = ImageManipulator.manipulate(originale.uri);
  contesto.resize({ width: LATO_LUNGO });

  const ridotta = await contesto.renderAsync();
  const salvata = await ridotta.saveAsync({ compress: QUALITA, format: SaveFormat.JPEG });

  const file = new File(salvata.uri);
  return { id: salvata.uri, uri: salvata.uri, byte: file.size ?? 0 };
}

/** Peso complessivo delle foto di una scheda. */
export const pesoFoto = (foto: FotoLocale[]) => foto.reduce((somma, f) => somma + f.byte, 0);

/**
 * Carica su Storage le foto di un'attività e registra le righe corrispondenti.
 *
 * Le righe vengono riscritte in blocco come le altre figlie della scheda: la scheda è
 * un documento unico, e riallineare foto già presenti sarebbe più fragile che rifarle.
 */
export async function caricaFoto(
  ispezioneId: string,
  perAttivita: { attivitaId: string; foto: FotoLocale[] }[],
): Promise<void> {
  const cancella = await supabase.from('ispezione_foto').delete().eq('ispezione_id', ispezioneId);
  if (cancella.error) throw cancella.error;

  const righe: { ispezione_id: string; attivita_id: string; ordine: number; path: string; byte: number }[] = [];

  for (const { attivitaId, foto } of perAttivita) {
    for (const [indice, f] of foto.entries()) {
      const percorso = `${ispezioneId}/${attivitaId}_${indice + 1}.jpg`;
      const bytes = await new File(f.uri).bytes();

      const { error } = await supabase.storage.from('foto').upload(percorso, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;

      righe.push({
        ispezione_id: ispezioneId,
        attivita_id: attivitaId,
        ordine: indice,
        path: percorso,
        byte: f.byte,
      });
    }
  }

  if (righe.length > 0) {
    const { error } = await supabase.from('ispezione_foto').insert(righe);
    if (error) throw error;
  }
}

/** Link temporaneo per riaprire una foto archiviata. */
export async function urlFoto(percorso: string): Promise<string> {
  const { data, error } = await supabase.storage.from('foto').createSignedUrl(percorso, 300);
  if (error) throw error;
  return data.signedUrl;
}
