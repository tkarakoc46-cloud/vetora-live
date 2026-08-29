'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const STAFF_ROLES = ['VETERINER', 'TEKNISYEN', 'RESEPSIYON'];
const ADMIN_ROLES = ['ADMIN'];

export async function login(formData: FormData) {
  const type = String(formData.get('type')); // 'staff' | 'admin'
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    redirect(`/login/${type}?error=${encodeURIComponent('E-posta ve şifre gereklidir.')}`);
  }

  const supabase = createClient();

  // 1) Real Supabase Auth check — this is what actually verifies the password
  //    (hashed & checked server-side by Supabase, never touched by our code).
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    redirect(`/login/${type}?error=${encodeURIComponent('E-posta veya şifre hatalı.')}`);
  }

  // 2) Role check — a valid staff account must not be able to sign in
  //    through the admin form, and vice versa, even though the password
  //    was correct. This mirrors the access-separation requirement from
  //    the prototype, but now backed by a real `profiles` table instead
  //    of a hardcoded list.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', authData.user!.id)
    .single();

  const allowed = type === 'admin' ? ADMIN_ROLES : STAFF_ROLES;
  if (!profile || !allowed.includes(profile.role)) {
    await supabase.auth.signOut();
    redirect(`/login/${type}?error=${encodeURIComponent('Bu hesabın bu panele erişim yetkisi yok.')}`);
  }

  redirect(type === 'admin' ? '/admin' : '/dashboard');
}
