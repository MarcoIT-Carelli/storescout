import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

/** L'area di amministrazione è riservata al ruolo admin, anche lato interfaccia. */
export default function AdminLayout() {
  const { profilo, caricamento } = useAuth();

  if (caricamento) return null;
  if (profilo?.ruolo !== 'admin') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
