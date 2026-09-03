import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ultimi punti vendita visitati. Un ispettore ruota su poche unità, quindi tenerne tre
 * in cima all'elenco elimina quasi sempre il passaggio dalla ricerca.
 */

const CHIAVE = 'storescout.pdvRecenti';
const QUANTI = 3;

export async function leggiRecenti(): Promise<string[]> {
  const grezzo = await AsyncStorage.getItem(CHIAVE);
  return grezzo ? (JSON.parse(grezzo) as string[]) : [];
}

export async function segnaVisitato(pdvId: string): Promise<void> {
  const attuali = await leggiRecenti();
  const nuovi = [pdvId, ...attuali.filter((id) => id !== pdvId)].slice(0, QUANTI);
  await AsyncStorage.setItem(CHIAVE, JSON.stringify(nuovi));
}
