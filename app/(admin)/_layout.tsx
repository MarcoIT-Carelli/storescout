import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

/**
 * L'area di amministrazione è riservata al ruolo admin, anche lato interfaccia.
 *
 * Chi non è autenticato non viene rimandato da qui: se ne occupa la guardia del layout
 * radice. Due componenti che rimandano contemporaneamente si rincorrono, e la
 * navigazione entra in ciclo finché React non interrompe tutto.
 */
export default function AdminLayout() {
  const { profilo, caricamento } = useAuth();

  if (caricamento || !profilo) return null;
  if (profilo.ruolo !== 'admin') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
