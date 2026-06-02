-- Fix: profiles tablosunda UPDATE policy eksikti.
-- RLS açık + UPDATE policy yok = tüm update'ler sessizce engelleniyordu
-- (savePushToken token'ı yazamıyordu).
-- Supabase SQL Editor'da çalıştır.

CREATE POLICY "update profiles" ON profiles
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
