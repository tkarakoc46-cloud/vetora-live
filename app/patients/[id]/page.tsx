import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import {
  addVitalRecord,
  addSurgeryRecord,
  addNoteRecord,
  addPhotoRecord,
  addEventRecord,
} from '@/lib/actions/records';
import { updatePatientStatus, deletePatient, dischargePatient } from '@/lib/actions/patients';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { PrintButton } from '@/components/PrintButton';
import { DeletePatientForm } from '@/components/DeletePatientForm';
import { DischargeForm } from '@/components/DischargeForm';
import { SubmitButton } from '@/components/SubmitButton';
import { CopyButton } from '@/components/CopyButton';

const TYPE_LABEL: Record<string, string> = {
  vital: 'Vital Bulgu',
  surgery: 'Ameliyat',
  photo: 'Fotoğraf',
  note: 'Not',
  event: 'Olay',
  medication: 'Tedavi',
  feeding: 'Beslenme',
  excretion: 'Dışkılama',
  vomiting: 'Kusma',
  vetcheck: 'Veteriner Kontrolü',
  blood: 'Kan Tahlili',
  lab: 'Laboratuvar',
};

const STATUS_LABEL: Record<string, string> = {
  stable: 'Stabil',
  improving: 'İyiye Gidiyor',
  watch: 'Yakın Takip',
  critical: 'Kritik',
};
const STATUS_COLOR: Record<string, string> = {
  stable: 'bg-green-50 text-green',
  improving: 'bg-accentSoft text-accent',
  watch: 'bg-amber-50 text-amber',
  critical: 'bg-red-50 text-red',
};

function formatIstanbul(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizePayload(type: string, payload: any): string {
  switch (type) {
    case 'vital':
      return `Isı ${payload.temp_c ?? '—'}°C · Nabız ${payload.pulse_bpm ?? '—'}/dk · Solunum ${payload.resp_rpm ?? '—'}/dk${payload.note ? ' · ' + payload.note : ''}`;
    case 'surgery':
      return `${payload.procedure || '—'} · Cerrah: ${payload.surgeon || '—'} · Anestezi: ${payload.anesthesia || '—'}${payload.duration_min ? ` · ${payload.duration_min} dk` : ''} · Sonuç: ${payload.outcome || '—'}${payload.postop_note ? ' · ' + payload.postop_note : ''}`;
    case 'photo':
      return payload.caption || 'Fotoğraf eklendi';
    case 'note':
      return payload.text;
    case 'event':
      return payload.label + (payload.note ? ' · ' + payload.note : '');
    default:
      return '';
  }
}

export default async function PatientDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const isAdmin = myProfile?.role === 'ADMIN';

  const { data: patient } = await supabase.from('patients').select('*').eq('id', params.id).single();
  if (!patient) notFound();

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false })
    .limit(500);

  // bind the patient id so the <form action={...}> below doesn't need a hidden input
  const addVital = addVitalRecord.bind(null, params.id);
  const addSurgery = addSurgeryRecord.bind(null, params.id);
  const addNote = addNoteRecord.bind(null, params.id);
  const addPhoto = addPhotoRecord.bind(null, params.id);
  const addEvent = addEventRecord.bind(null, params.id);
  const updateStatus = updatePatientStatus.bind(null, params.id);
  const removePatient = deletePatient.bind(null, params.id);
  const dischargeThisPatient = dischargePatient.bind(null, params.id);

  const ownerLink = `${process.env.NEXT_PUBLIC_APP_URL}/p/${patient.access_token}`;
  // Generated server-side as a data: URI — no external QR service call, so
  // this works even if the clinic's photocopied handout has no internet
  // access; it's just an image once it's on the page or printed.
  const qrDataUrl = await QRCode.toDataURL(ownerLink, {
    width: 260,
    margin: 1,
    color: { dark: '#131C3B', light: '#FFFFFF' },
  });

  return (
    <div>
      <TopBar />
    <div className="max-w-3xl mx-auto p-5">
      {searchParams?.error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red font-semibold no-print">
          {searchParams.error}
        </div>
      )}

      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{patient.name}</h1>
          <div className="flex items-center gap-2">
            {patient.discharged_at && (
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-surface2 text-text3">Taburcu Edildi</span>
            )}
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLOR[patient.status]}`}>
              {STATUS_LABEL[patient.status]}
            </span>
          </div>
        </div>
        <div className="text-xs text-text3">
          {patient.breed} · {patient.kennel_no} · Sahibi: {patient.owner_name}
        </div>
        <div className="mt-3 no-print">
          <PrintButton />
        </div>
      </div>

      <div className="card p-4 mb-5 no-print">
        <div className="font-bold text-sm mb-2">Hasta Sahibi Bağlantısı</div>
        <div className="flex flex-col sm:flex-row gap-4">
          <img
            src={qrDataUrl}
            alt="Hasta sahibi bağlantısı QR kodu"
            className="w-40 h-40 rounded-lg border border-border self-start"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text2 mono break-all bg-surface2 rounded-lg px-3 py-2 mb-2">
              {ownerLink}
            </div>
            <CopyButton text={ownerLink} />
            <div className="text-[11px] text-text3 mt-2">
              Bu linki veya QR kodu hasta sahibine gönderin ya da yazdırıp verin — hastanızın canlı takip sayfasına doğrudan götürür, giriş yapmalarına gerek yok.
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-5 no-print">
        <div className="font-bold text-sm mb-2">Durum Güncelle</div>
        <form action={updateStatus} className="flex gap-2">
          <select name="status" defaultValue={patient.status} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <option value="stable">Stabil</option>
            <option value="improving">İyiye Gidiyor</option>
            <option value="watch">Yakın Takip</option>
            <option value="critical">Kritik</option>
          </select>
          <SubmitButton className="btn-primary" pendingText="Güncelleniyor…">Güncelle</SubmitButton>
        </form>
        <div className="text-[11px] text-text3 mt-2">
          Durum değiştiğinde hasta sahibinin gördüğü sayfa otomatik olarak güncellenir.
        </div>
      </div>

      <div className="card p-4 mb-5 no-print">
        <div className="font-bold text-sm mb-2">Hızlı Olay Ekle</div>
        <div className="grid grid-cols-2 gap-2">
          <form action={addEvent}>
            <input type="hidden" name="event" value="surgery_start" />
            <SubmitButton className="btn-outline w-full text-xs" pendingText="Ekleniyor…">🔪 Ameliyata Alındı</SubmitButton>
          </form>
          <form action={addEvent}>
            <input type="hidden" name="event" value="surgery_end" />
            <SubmitButton className="btn-outline w-full text-xs" pendingText="Ekleniyor…">✅ Ameliyattan Çıktı</SubmitButton>
          </form>
          <form action={addEvent}>
            <input type="hidden" name="event" value="anesthesia_start" />
            <SubmitButton className="btn-outline w-full text-xs" pendingText="Ekleniyor…">💤 Anestezi Verildi</SubmitButton>
          </form>
          <form action={addEvent}>
            <input type="hidden" name="event" value="anesthesia_end" />
            <SubmitButton className="btn-outline w-full text-xs" pendingText="Ekleniyor…">👁️ Anesteziden Uyandı</SubmitButton>
          </form>
        </div>
        <div className="text-[11px] text-text3 mt-2">
          Bu olaylar hasta sahibinin takip ekranında anında görünür.
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6 no-print">
        <form action={addVital} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Vital Bulgu Ekle</div>
          <input name="temp_c" type="number" step="0.1" placeholder="Isı °C" />
          <input name="pulse_bpm" type="number" placeholder="Nabız /dk" />
          <input name="resp_rpm" type="number" placeholder="Solunum /dk" />
          <textarea name="note" rows={2} placeholder="Not (opsiyonel)" />
          <SubmitButton>Kaydet</SubmitButton>
        </form>

        <form action={addSurgery} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Ameliyat Kaydı Ekle</div>
          <input name="procedure" placeholder="Prosedür" required />
          <input name="surgeon" placeholder="Cerrah" />
          <input name="anesthesia" placeholder="Anestezi" />
          <input name="duration_min" type="number" placeholder="Süre (dk)" />
          <input name="outcome" placeholder="Sonuç" />
          <textarea name="postop_note" rows={2} placeholder="Post-op not" />
          <SubmitButton>Kaydet</SubmitButton>
        </form>

        <form action={addPhoto} className="field card p-4 space-y-2" encType="multipart/form-data">
          <div className="font-bold text-sm mb-1">Fotoğraf Ekle</div>
          <input name="photo" type="file" accept="image/*" capture="environment" required />
          <input name="caption" placeholder="Açıklama (opsiyonel)" />
          <SubmitButton pendingText="Yükleniyor…">Kaydet</SubmitButton>
        </form>

        <form action={addNote} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Not Ekle</div>
          <textarea name="text" rows={3} placeholder="Not…" required />
          <label className="flex items-center gap-2 text-xs text-text2">
            <input type="checkbox" name="visible_to_owner" /> Hasta sahibine göster
          </label>
          <SubmitButton>Kaydet</SubmitButton>
        </form>
      </div>

      <div className="text-xs font-bold text-text3 uppercase mb-2">Zaman Çizelgesi</div>
      <div className="card divide-y divide-border mb-6">
        {(records ?? []).map((r) => (
          <div key={r.id} className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{TYPE_LABEL[r.type] ?? r.type}</span>
              <span className="text-xs text-text3 mono">{formatIstanbul(r.created_at)}</span>
            </div>
            <div className="text-xs text-text2 mt-1">{summarizePayload(r.type, r.payload)}</div>
            <div className="text-xs text-text3 mt-1">{r.created_by_name}{r.visible_to_owner === false ? ' · sadece personel' : ''}</div>
          </div>
        ))}
        {(records ?? []).length === 0 && <div className="p-6 text-center text-sm text-text3">Henüz kayıt yok.</div>}
      </div>

      {!patient.discharged_at && (
        <div className="card p-4 mb-6 no-print">
          <div className="font-bold text-sm mb-1">Hastayı Taburcu Et</div>
          <div className="text-xs text-text3 mb-3">
            Hasta "Tüm Hastalar" listesinde taburcu edilmiş olarak işaretlenir. Kayıtları, fotoğrafları ve hasta sahibi bağlantısı saklı kalır — sadece bilgi silinmez, hasta artık "yatılı" listede görünmez.
          </div>
          <DischargeForm action={dischargeThisPatient} patientName={patient.name} />
        </div>
      )}

      {isAdmin && (
        <div className="card p-4 mb-6 border-red-200 no-print">
          <div className="font-bold text-sm mb-1 text-red">Tehlikeli Bölge</div>
          <div className="text-xs text-text3 mb-3">
            Bu hastayı ve tüm kayıtlarını (zaman çizelgesi, fotoğraflar, mesajlar) kalıcı olarak siler. Geri alınamaz.
          </div>
          <DeletePatientForm action={removePatient} patientName={patient.name} />
        </div>
      )}
    </div>
    </div>
  );
}
