'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const VALID_ROLES = ['ADMIN', 'VETERINER', 'TEKNISYEN', 'RESEPSIYON'];

// Admin-only. Staff accounts are real Supabase Auth users, so this can't be
// a plain table insert — it has to create the login (email+password) via
// the service-role admin API, then attach the profiles row (role,
// full_name) that the rest of the app and RLS keys off of. email_confirm:
// true skips Supabase's "confirm your email" step, since this clinic has
// no email sending set up — the admin hands the password to the staff
// member directly and they can sign in immediately.
export async function addStaff(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  if (myProfile?.role !== 'ADMIN') {
    redirect(`/admin?error=${encodeURIComponent('Personel eklemeyi sadece yönetici yapabilir.')}`);
  }

  const full_name = String(formData.get('full_name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || '');

  if (!full_name || !email || !password || !VALID_ROLES.includes(role)) {
    redirect(`/admin/staff/new?error=${encodeURIComponent('Tüm alanları doldurun.')}`);
  }
  if (password.length < 6) {
    redirect(`/admin/staff/new?error=${encodeURIComponent('Şifre en az 6 karakter olmalı.')}`);
  }

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    const message =
      createErr?.message?.includes('already been registered')
        ? 'Bu e-posta adresi zaten kayıtlı.'
        : createErr?.message ?? 'Personel oluşturulamadı.';
    redirect(`/admin/staff/new?error=${encodeURIComponent(message)}`);
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created!.user.id,
    full_name,
    role,
    email,
  });

  if (profileErr) {
    // Don't leave an orphaned login with no profile row behind.
    await admin.auth.admin.deleteUser(created!.user.id);
    redirect(`/admin/staff/new?error=${encodeURIComponent(profileErr.message)}`);
  }

  redirect('/admin?staffAdded=1');
}
