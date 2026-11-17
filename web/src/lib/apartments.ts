import { fmt, type Dict } from "@/lib/i18n/dictionaries";

export const ADDRESS_COLS = "street, building_number, floor, unit";

export type ApartmentAddress = {
  street: string | null;
  building_number: string | null;
  floor: string | null;
  unit: string | null;
};

/** « 12 rue de Rivoli · Ét. 3 · App. 7 » (vide si aucune info). */
export function formatAddress(a: ApartmentAddress, t: Dict): string {
  return [
    [a.building_number, a.street].filter(Boolean).join(" "),
    a.floor && fmt(t.admin.floorShort, { v: a.floor }),
    a.unit && fmt(t.admin.unitShort, { v: a.unit }),
  ].filter(Boolean).join(" · ");
}

/** Minuscules, sans accents : « Élysée » trouve « elysee ». */
export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function searchText(a: { name: string } & ApartmentAddress) {
  return normalize([a.name, a.building_number, a.street, a.floor, a.unit].filter(Boolean).join(" "));
}
