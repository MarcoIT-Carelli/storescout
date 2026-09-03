import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dataBreve, daDataISO, dataISO } from '@/lib/format';
import type { RigaAttivita } from '@/types/bozza';
import type { Destinatario, VoceLista } from '@/types/database';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

import { ConfermaInLinea } from './ConfermaInLinea';
import { Select } from './Select';
import { TextField } from './TextField';

type Props = {
  riga: RigaAttivita;
  indice: number;
  destinatari: Destinatario[];
  reparti: VoceLista[];
  tipiIntervento: VoceLista[];
  disabilitato?: boolean;
  stretto: boolean;
  onChange: (r: RigaAttivita) => void;
  onElimina: () => void;
};

export function SchedaAttivita({
  riga,
  indice,
  destinatari,
  reparti,
  tipiIntervento,
  disabilitato = false,
  stretto,
  onChange,
  onElimina,
}: Props) {
  const c = useColori();
  const [confermaElimina, setConfermaElimina] = useState(false);
  const [noteScadenzaAperte, setNoteScadenzaAperte] = useState(Boolean(riga.scadenza_note));

  const generica = riga.scadenza_data === null;

  const cambia = (parziale: Partial<RigaAttivita>) => onChange({ ...riga, ...parziale });

  const scegliData = () => {
    if (disabilitato) return;
    const iniziale = riga.scadenza_data ? daDataISO(riga.scadenza_data) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: iniziale,
        mode: 'date',
        onChange: (evento, scelta) => {
          if (evento.type === 'set' && scelta) {
            // Data e testo sono alternativi: sceglierne uno azzera l'altro.
            cambia({ scadenza_data: dataISO(scelta), scadenza_testo: '' });
          }
        },
      });
    }
  };

  return (
    <View style={[stili.scheda, { backgroundColor: c.superficie, borderColor: c.bordo }]}>
      <View style={stili.testata}>
        <Text style={[testo.etichetta, { color: c.testoSecondario }]}>ATTIVITÀ {indice + 1}</Text>
        <Pressable
          onPress={() => setConfermaElimina(true)}
          disabled={disabilitato}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Elimina attività ${indice + 1}`}
          style={({ pressed }) => [stili.elimina, pressed && { opacity: 0.5 }]}
        >
          <Text style={[testo.corpoForte, { color: disabilitato ? c.testoDisabilitato : c.errore }]}>
            Elimina
          </Text>
        </Pressable>
      </View>

      {confermaElimina ? (
        <ConfermaInLinea
          messaggio={`L’attività ${indice + 1} verrà eliminata dalla scheda.`}
          onConferma={() => {
            setConfermaElimina(false);
            onElimina();
          }}
          onAnnulla={() => setConfermaElimina(false)}
        />
      ) : null}

      <View style={[stili.tendine, stretto && stili.tendineImpilate]}>
        <Select
          etichetta="Destinatario"
          opzioni={destinatari}
          valore={riga.destinatario_id}
          onChange={(id) => cambia({ destinatario_id: id })}
          disabilitato={disabilitato}
        />
        <Select
          etichetta="Reparto"
          opzioni={reparti}
          valore={riga.reparto_id}
          onChange={(id) => cambia({ reparto_id: id })}
          disabilitato={disabilitato}
        />
        <Select
          etichetta="Tipo di intervento"
          opzioni={tipiIntervento}
          valore={riga.tipo_intervento_id}
          onChange={(id) => cambia({ tipo_intervento_id: id })}
          disabilitato={disabilitato}
        />
      </View>

      <TextField
        etichetta="Note"
        value={riga.note}
        onChangeText={(v) => cambia({ note: v })}
        righe={2}
        editable={!disabilitato}
        placeholder="Descrivi che cosa hai rilevato"
      />

      <View style={{ gap: spazio.sm }}>
        <View style={stili.rigaScadenza}>
          <Text style={[testo.etichetta, { color: c.testoSecondario }]}>SCADENZA</Text>
          <Pressable
            onPress={() => setNoteScadenzaAperte((v) => !v)}
            disabled={disabilitato}
            style={({ pressed }) => [
              stili.pulsanteNote,
              {
                borderColor: c.bordo,
                backgroundColor: noteScadenzaAperte ? c.superficieAlt : 'transparent',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={[testo.piccolo, { color: disabilitato ? c.testoDisabilitato : c.testo }]}>
              {noteScadenzaAperte ? 'Nascondi note' : 'Note'}
            </Text>
          </Pressable>
        </View>

        <View style={[stili.selettoreTipo, { borderColor: c.bordo }]}>
          <Pressable
            onPress={() => !disabilitato && cambia({ scadenza_data: dataISO(new Date()), scadenza_testo: '' })}
            disabled={disabilitato}
            style={[stili.mezzo, { backgroundColor: !generica ? c.giallo : 'transparent' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: !generica }}
          >
            <Text style={[testo.piccolo, { color: !generica ? c.suGiallo : c.testo, fontWeight: !generica ? '700' : '400' }]}>
              Data
            </Text>
          </Pressable>
          <Pressable
            onPress={() => !disabilitato && cambia({ scadenza_data: null })}
            disabled={disabilitato}
            style={[stili.mezzo, { backgroundColor: generica ? c.giallo : 'transparent' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: generica }}
          >
            <Text style={[testo.piccolo, { color: generica ? c.suGiallo : c.testo, fontWeight: generica ? '700' : '400' }]}>
              Scadenza generica
            </Text>
          </Pressable>
        </View>

        {generica ? (
          <TextField
            value={riga.scadenza_testo}
            onChangeText={(v) => cambia({ scadenza_testo: v, scadenza_data: null })}
            placeholder="es. prossimo ordine"
            editable={!disabilitato}
          />
        ) : (
          <Pressable
            onPress={scegliData}
            disabled={disabilitato}
            style={({ pressed }) => [
              stili.campoData,
              {
                borderColor: c.bordo,
                backgroundColor: disabilitato ? c.disabilitato : pressed ? c.superficieAlt : c.superficie,
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={[testo.corpo, { color: disabilitato ? c.testoDisabilitato : c.testo }]}>
              {riga.scadenza_data ? dataBreve(daDataISO(riga.scadenza_data)) : 'Scegli una data'}
            </Text>
          </Pressable>
        )}

        {noteScadenzaAperte ? (
          <TextField
            etichetta="Note sulla scadenza"
            value={riga.scadenza_note}
            onChangeText={(v) => cambia({ scadenza_note: v })}
            placeholder="es. entro apertura, urgente"
            editable={!disabilitato}
          />
        ) : null}
      </View>
    </View>
  );
}

const stili = StyleSheet.create({
  scheda: {
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.lg,
    gap: spazio.md,
  },
  testata: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  elimina: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm },
  tendine: { flexDirection: 'row', gap: spazio.md },
  tendineImpilate: { flexDirection: 'column' },
  rigaScadenza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pulsanteNote: {
    minHeight: TOCCO_MIN,
    paddingHorizontal: spazio.md,
    borderWidth: 1,
    borderRadius: raggio.md,
    justifyContent: 'center',
  },
  selettoreTipo: { flexDirection: 'row', borderWidth: 1, borderRadius: raggio.md, overflow: 'hidden' },
  mezzo: { flex: 1, minHeight: TOCCO_MIN, alignItems: 'center', justifyContent: 'center' },
  campoData: {
    minHeight: TOCCO_MIN,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    justifyContent: 'center',
  },
});
