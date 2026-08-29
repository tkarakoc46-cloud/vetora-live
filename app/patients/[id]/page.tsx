import { createClient } from '@/lib/supabase/server';
import { addVitalRecord, addSurgeryRecord, addNoteRecord, addPhotoRecord } from '@/lib/actions/records';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/TopBar';

const TYPE_LABEL: Record<string, string> = {
  vital: 'Vital Bulgu',
  surgery: 'Ameliyat',
  photo: 'Fotoğraf',
  note: 'Not',
  medication: 'Tedavi',
  feeding: 'Beslenme',
  excretion: 'Dışkılama',
  vomiting: 'Kusma',
  vetcheck: 'Veteriner Kontrolü',
  blood: 'Kan Tahlili',
  lab: 'Laboratuvar',
};

function summarizePayload(type: string, payload: any): string {
  switch (type) {
    case 'vital':
      return `Isı ${payload.temp_c ?? '—'}°C · Nabız ${payload.pulse_bpm ?? '—'}/dk · Solunum ${payload.resp_rpm ?? '—'}/dk`;
    case 'surgery':
      return `${payload.procedure} · ${payload.surgeon} · ${payload.outcome}`;
    case 'photo':
      return payload.caption || 'Fotoğraf eklendi';
    case 'note':
      return payload.text;
    default:
      return '';
  }
}

export default async function PatientDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: patient } = await supabase.from('patients').select('*').eq('id', params.id).single();
  if (!patient) notFound();

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false })
    .limit(30);

  // bind the patient id so the <form action={...}> below doesn't need a hidden input
  const addVital = addVitalRecord.bind(null, params.id);
  const addSurgery = addSurgeryRecord.bind(null, params.id);
  const addNote = addNoteRecord.bind(null, params.id);
  const addPhoto = addPhotoRecord.bind(null, params.id);

  return (
    <div>
      <TopBar />
    <div className="max-w-3xl mx-auto p-5">
      <div className="card p-4 mb-5">
        <h1 className="text-lg font-bold">{patient.name}</h1>
        <div className="text-xs text-text3">
          {patient.breed} · {patient.kennel_no} · Sahibi: {patient.owner_name}
        </div>
        <div className="text-xs text-text2 mt-1">
          Hasta sahibi bağlantısı:{' '}
          <span className="mono">{process.env.NEXT_PUBLIC_APP_URL}/p/{patient.access_token}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <form action={addVital} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Vital Bulgu Ekle</div>
          <input name="temp_c" type="number" step="0.1" placeholder="Isı °C" />
          <input name="pulse_bpm" type="number" placeholder="Nabız /dk" />
          <input name="resp_rpm" type="number" placeholder="Solunum /dk" />
          <textarea name="note" rows={2} placeholder="Not (opsiyonel)" />
          <button className="btn-primary w-full">Kaydet</button>
        </form>

        <form action={addSurgery} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Ameliyat Kaydı Ekle</div>
          <input name="procedure" placeholder="Prosedür" required />
          <input name="surgeon" placeholder="Cerrah" />
          <input name="anesthesia" placeholder="Anestezi" />
          <input name="duration_min" type="number" placeholder="Süre (dk)" />
          <input name="outcome" placeholder="Sonuç" />
          <textarea name="postop_note" rows={2} placeholder="Post-op not" />
          <button className="btn-primary w-full">Kaydet</button>
        </form>

        <form action={addPhoto} className="field card p-4 space-y-2" encType="multipart/form-data">
          <div className="font-bold text-sm mb-1">Fotoğraf Ekle</div>
          <input name="photo" type="file" accept="image/*" capture="environment" required />
          <input name="caption" placeholder="Açıklama (opsiyonel)" />
          <button className="btn-primary w-full">Kaydet</button>
        </form>

        <form action={addNote} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Not Ekle</div>
          <textarea name="text" rows={3} placeholder="Not…" required />
          <label className="flex items-center gap-2 text-xs text-text2">
            <input type="checkbox" name="visible_to_owner" /> Hasta sahibine göster
          </label>
          <button className="btn-primary w-full">Kaydet</button>
        </form>
      </div>

      <div className="text-xs font-bold text-text3 uppercase mb-2">Zaman Çizelgesi</div>
      <div className="card divide-y divide-border">
        {(records ?? []).map((r) => (
          <div key={r.id} className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{TYPE_LABEL[r.type] ?? r.type}</span>
              <span className="text-xs text-text3 mono">
                {new Date(r.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-xs text-text2 mt-1">{summarizePayload(r.type, r.payload)}</div>
            <div className="text-xs text-text3 mt-1">{r.created_by_name}</div>
          </div>
        ))}
        {(records ?? []).length === 0 && <div className="p-6 text-center text-sm text-text3">Henüz kayıt yok.</div>}
      </div>
    </div>
    </div>
  );
}
