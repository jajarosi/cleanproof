import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { AddApartmentForm, ApartmentRow } from "./ApartmentForms";

export default async function ApartmentsPage() {
  const me = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();
  const { data } = await supabase.from("apartments").select("id, name").eq("org_id", me.org_id).order("name");
  const list = (data ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.apartments}</h1>
      <AddApartmentForm />
      <ul className="card divide-y divide-slate-100">
        {list.map((a) => <ApartmentRow key={a.id} id={a.id} name={a.name} />)}
      </ul>
    </div>
  );
}
