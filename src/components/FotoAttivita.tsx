import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { FOTO_PER_ATTIVITA, pesoLeggibile, scattaFoto, type FotoLocale } from '@/lib/foto';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

import { ConfermaInLinea } from './ConfermaInLinea';

/**
 * Foto di un'attività rilevata.
 *
 * Il pulsante è un pieno giallo con il segno nero sopra, come ogni altra azione primaria
 * dell'app: in un magazzino poco illuminato, con il tablet in una mano, dev'essere la
 * cosa più visibile della riga.
 *
 * L'icona è disegnata qui con react-native-svg invece di arrivare da un font di icone:
 * la libreria c'è già per le firme, e una fotocamera sono tre forme.
 */

function IconaFotocamera({ colore, dimensione = 26 }: { colore: string; dimensione?: number }) {
  return (
    <Svg width={dimensione} height={dimensione} viewBox="0 0 24 24">
      <Path d="M9 6.6 L10.2 4.2 H13.8 L15 6.6 Z" fill={colore} />
      <Rect x="2.5" y="6.4" width="19" height="13.4" rx="2.6" fill={colore} />
      <Circle cx="12" cy="13.1" r="4.2" fill="#FFFFFF" />
      <Circle cx="12" cy="13.1" r="2.5" fill={colore} />
    </Svg>
  );
}

type Props = {
  foto: FotoLocale[];
  onChange: (foto: FotoLocale[]) => void;
  disabilitato?: boolean;
};

export function FotoAttivita({ foto, onChange, disabilitato = false }: Props) {
  const c = useColori();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);

  const piena = foto.length >= FOTO_PER_ATTIVITA;

  const scatta = async () => {
    setErrore(null);
    setInCorso(true);
    try {
      const scattata = await scattaFoto();
      if (scattata) onChange([...foto, scattata]);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non è stato possibile scattare la foto.');
    } finally {
      setInCorso(false);
    }
  };

  return (
    <View style={{ gap: spazio.sm }}>
      <View style={stili.intestazione}>
        <Text style={[testo.etichetta, { color: c.testoSecondario }]}>
          FOTO {foto.length > 0 ? `(${foto.length}/${FOTO_PER_ATTIVITA})` : ''}
        </Text>
        {foto.length > 0 ? (
          <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>
            {pesoLeggibile(foto.reduce((s, f) => s + f.byte, 0))}
          </Text>
        ) : null}
      </View>

      <View style={stili.striscia}>
        {foto.map((f, i) => (
          <View key={f.id} style={[stili.miniatura, { borderColor: c.bordo }]}>
            <Image source={{ uri: f.uri }} style={stili.immagine} resizeMode="cover" />
            <Pressable
              onPress={() => setDaEliminare(f.id)}
              disabled={disabilitato}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Elimina la foto ${i + 1}`}
              style={({ pressed }) => [
                stili.elimina,
                { backgroundColor: c.nero, opacity: pressed ? 0.6 : 0.85 },
              ]}
            >
              <Text style={stili.crocetta}>✕</Text>
            </Pressable>
          </View>
        ))}

        {piena ? null : (
          <Pressable
            onPress={scatta}
            disabled={disabilitato || inCorso}
            accessibilityRole="button"
            accessibilityLabel="Scatta una foto della rilevazione"
            style={({ pressed }) => [
              stili.scatto,
              {
                backgroundColor: disabilitato ? c.disabilitato : pressed ? c.gialloPremuto : c.giallo,
              },
            ]}
          >
            {inCorso ? (
              <ActivityIndicator color={c.suGiallo} />
            ) : (
              <IconaFotocamera colore={disabilitato ? c.testoDisabilitato : c.suGiallo} />
            )}
          </Pressable>
        )}
      </View>

      {daEliminare ? (
        <ConfermaInLinea
          messaggio="La foto verrà eliminata dalla scheda."
          onConferma={() => {
            onChange(foto.filter((f) => f.id !== daEliminare));
            setDaEliminare(null);
          }}
          onAnnulla={() => setDaEliminare(null)}
        />
      ) : null}

      {errore ? (
        <Text style={[testo.piccolo, { color: c.errore }]}>{errore}</Text>
      ) : piena ? (
        <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>
          Hai raggiunto le {FOTO_PER_ATTIVITA} foto per questa attività.
        </Text>
      ) : null}
    </View>
  );
}

const stili = StyleSheet.create({
  intestazione: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  striscia: { flexDirection: 'row', flexWrap: 'wrap', gap: spazio.sm, alignItems: 'center' },
  scatto: {
    width: TOCCO_MIN + 24,
    height: TOCCO_MIN + 24,
    borderRadius: raggio.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniatura: {
    width: TOCCO_MIN + 24,
    height: TOCCO_MIN + 24,
    borderRadius: raggio.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  immagine: { width: '100%', height: '100%' },
  elimina: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: raggio.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crocetta: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 16 },
});
