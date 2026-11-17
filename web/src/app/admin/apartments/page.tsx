import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { FilterableList } from "@/components/FilterableList";
import { ADDRESS_COLS, searchText } from "@/lib/apartments";
import { AddApartmentForm, ApartmentRow, type ApartmentData } from "./ApartmentForms";

export default async function ApartmentsPage() {
  const me = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();
  const { data } = await supabase.from("apartments").select(`id, name, ${ADDRESS_COLS}`).eq("org_id", me.org_id).order("name");
  const list = ((data ?? []) as ApartmentData[]).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.apartments}</h1>
      <AddApartmentForm />
      {list.length > 0 && (
        <FilterableList
          className="space-y-2"
          items={list.map((a) => ({ key: a.id, text: searchText(a), node: <ApartmentRow a={a} /> }))}
        />
      )}
    </div>
  );
}
