import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { getMenuCategoryList, updateMenuItem } from "../api/menu";
import { MenuCategory } from "../api/types";
import apiClient from "../api/client";

/* ---------------- Types ---------------- */
export interface IngredientRow {
  id: string;
  name: string;
  qty: string;
}

export interface EditableMenuItem {
  id: number;
  name?: string;
  item_name?: string;
  category_id?: number;
  category?: string;
  recipe_category?: { id?: number; category_id?: number; category_name?: string; name?: string }[];
  price?: number | string;
  cost?: number | string;
  code?: string;
  item_code?: string;
  note?: string;
  special_note?: string;
  is_hidden?: boolean | number;
  hide_pos?: boolean | number;
  image?: string;
  image_url?: string;
  image_path?: string;
  ingredients?: { id?: string | number; name: string; qty?: string | number }[];
  restaurants?: { id: number; name: string }[];
}

interface RestaurantOption {
  id: number;
  name: string;
  checked: boolean;
}

interface EditMenuItemModalProps {
  visible: boolean;
  item: EditableMenuItem | null;
  /** Full list of restaurants the item can be assigned to. Pass this in from
   *  wherever your app already loads restaurants (e.g. settings/auth context).
   *  If omitted, the "Available Restaurants" section is hidden. */
  allRestaurants?: { id: number; name: string }[];
  onClose: () => void;
  /** Called after a successful save with the server's (parsed) response. */
  onSaved: (updated: any) => void;
}

const COLORS = {
  primary: "#f4695f",
  dark: "#1a1a2e",
  gray: "#6b7280",
  grayLight: "#9ca3af",
  border: "#e5e7eb",
  bg: "#ffffff",
  cardBg: "#fcfcfd",
  grayPillBg: "#f3f4f6",
  red: "#ef4444",
  blue: "#3b82f6",
  gold: "#d4a017",
};

let uidCounter = 0;
function uid() {
  uidCounter += 1;
  return `row_${Date.now()}_${uidCounter}`;
}

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return false;
}

/**
 * The real GET /api/pos/menu_item/{id} response shape isn't known — these
 * helpers try a wide range of plausible key names so image / ingredients /
 * restaurants populate no matter what your controller actually calls them.
 * If a field still doesn't show up after this, log the raw item (see the
 * console.log below) and add the real key to the relevant list.
 */
function extractImagePath(raw: any): string | undefined {
  if (!raw) return undefined;
  const keys = [
    "image",
    "image_url",
    "image_path",
    "photo",
    "photo_url",
    "thumbnail",
    "thumbnail_url",
    "recipe_image",
    "picture",
  ];
  for (const k of keys) {
    if (raw[k]) return String(raw[k]);
  }
  return undefined;
}

function extractIngredients(raw: any): { id?: string | number; name: string; qty?: string | number }[] {
  if (!raw) return [];
  const keys = ["ingredients", "recipe_items", "recipe_ingredients", "items", "ingredient_list", "quantities"];
  let list: any = null;
  for (const k of keys) {
    if (Array.isArray(raw[k])) {
      list = raw[k];
      break;
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((ing: any) => {
      if (typeof ing === "string") return { name: ing, qty: 1 };
      const name = ing.name ?? ing.ingredient_name ?? ing.item_name ?? ing.title ?? "";
      const qty = ing.qty ?? ing.quantity ?? ing.amount ?? 1;
      const id = ing.id ?? ing.ingredient_id;
      return { id, name, qty };
    })
    .filter((r: any) => r.name);
}

/**
 * Category: the real API returns a many-to-many pivot shape —
 *   recipe_category: [{ id, category_name, pivot: { menu_id, recipe_category_id } }]
 * (see /api/v1/menus/{id} response). Falls back to a flat category_id/category
 * shape in case some endpoints return that instead.
 */
function extractCategory(raw: any): { id: number; name: string } | null {
  if (!raw) return null;

  const arr = raw.recipe_category ?? raw.recipe_categories ?? raw.categories;
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0];
    const id = first.id ?? first.category_id ?? first?.pivot?.recipe_category_id;
    const name = first.category_name ?? first.name;
    if (id !== undefined && name) return { id: Number(id), name: String(name) };
  }

  if (raw.category_id && raw.category) {
    return { id: Number(raw.category_id), name: String(raw.category) };
  }

  return null;
}

/**
 * Restaurants: tries a few plausible shapes —
 *  - raw.restaurants / raw.available_restaurants: [{id, name}] or [{id, name, checked}]
 *  - raw.restaurants: [id, id, ...] (just selected ids) alongside raw.all_restaurants: [{id,name}]
 */
function extractRestaurants(raw: any): { id: number; name: string; checked?: boolean }[] {
  if (!raw) return [];
  const listKeys = ["restaurants", "available_restaurants", "outlets", "branches", "hotel_restaurants"];
  const allKeys = ["all_restaurants", "restaurant_options", "hotels"];

  let selected: any[] = [];
  for (const k of listKeys) {
    if (Array.isArray(raw[k])) {
      selected = raw[k];
      break;
    }
  }

  // Fallback: scan every key on the object and auto-pick the first array
  // whose name suggests restaurants/outlets and whose entries look like
  // {id, name}. Covers whatever the backend actually calls this field
  // without needing to guess the exact key up front.
  if (selected.length === 0) {
    const nameHints = ["restaurant", "outlet", "branch", "hotel"];
    for (const key of Object.keys(raw)) {
      const lower = key.toLowerCase();
      if (!nameHints.some((h) => lower.includes(h))) continue;
      const val = raw[key];
      if (
        Array.isArray(val) &&
        val.length > 0 &&
        typeof val[0] === "object" &&
        val[0].id !== undefined &&
        (val[0].name !== undefined || val[0].title !== undefined)
      ) {
        selected = val;
        break;
      }
    }
  }

  let all: any[] | null = null;
  for (const k of allKeys) {
    if (Array.isArray(raw[k])) {
      all = raw[k];
      break;
    }
  }

  if (all) {
    const selectedIds = new Set(
      selected.map((s: any) => (typeof s === "object" ? s.id : s))
    );
    return all.map((r: any) => ({ id: r.id, name: r.name ?? r.title, checked: selectedIds.has(r.id) }));
  }

  // No separate "all" list — treat whatever we found as both the options and
  // the current selection (checked = true for anything the item returned).
  return selected
    .map((r: any) => {
      if (typeof r === "object") {
        return { id: r.id, name: r.name ?? r.title, checked: r.checked !== undefined ? toBool(r.checked) : true };
      }
      return null;
    })
    .filter(Boolean) as { id: number; name: string; checked?: boolean }[];
}

function resolveImageUrl(path?: string): string | undefined {
  if (!path) return undefined;
  const s = path.trim();
  if (!s) return undefined;
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("//")) return s;

  const trimmedPath = s.replace(/^\/+/, "");
  const baseRaw = (apiClient as any)?.defaults?.baseURL ? String((apiClient as any).defaults.baseURL).trim() : "";
  const trimmedBase = baseRaw.replace(/\/+$/, "");
  if (!trimmedBase) return trimmedPath;

  // Most Laravel setups serve uploaded files from /storage/<path>
  const baseWithoutApi = trimmedBase.replace(/\/api(\/.*)?$/, "");
  return `${(baseWithoutApi || trimmedBase).replace(/\/$/, "")}/storage/${trimmedPath}`;
}

/* ---------------- Component ---------------- */
export default function EditMenuItemModal({
  visible,
  item,
  allRestaurants,
  onClose,
  onSaved,
}: EditMenuItemModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [note, setNote] = useState("");
  const [hidden, setHidden] = useState(false);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string>("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);

  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  // Set this (uri / name / mimeType) from whatever image picker you wire in.
  const [newImageAsset, setNewImageAsset] = useState<{ uri: string; name?: string; mimeType?: string } | null>(
    null
  );

  const [saving, setSaving] = useState(false);

  // Reset form whenever a new item is opened
  useEffect(() => {
    if (!visible || !item) return;

    if (__DEV__) {
      // Inspect this in your Metro logs to see exactly what the backend
      // sends back — if image/ingredients/restaurants still don't populate,
      // check the actual key names here and add them to the extract*
      // helpers above.
      console.log("[EditMenuItemModal] raw item:", JSON.stringify(item)?.slice(0, 2000));
    }

    setName(item.name ?? item.item_name ?? "");
    setPrice(item.price !== undefined && item.price !== null ? String(item.price) : "");
    setItemCode(item.code ?? item.item_code ?? "");
    setNote(item.note ?? (item as any).special_note ?? "");
    setHidden(toBool(item.is_hidden ?? item.hide_pos));

    const cat = extractCategory(item);
    setCategoryId(cat?.id ?? null);
    setCategoryLabel(cat?.name ?? "");

    setImageUri(resolveImageUrl(extractImagePath(item)));
    setNewImageAsset(null);

    setIngredients(
      extractIngredients(item).map((ing) => ({
        id: String(ing.id ?? uid()),
        name: ing.name ?? "",
        qty: ing.qty !== undefined && ing.qty !== null ? String(ing.qty) : "1",
      }))
    );

    const extracted = extractRestaurants(item);
    if (extracted.length > 0) {
      setRestaurants(extracted.map((r) => ({ id: r.id, name: r.name, checked: r.checked ?? true })));
    } else if (allRestaurants && allRestaurants.length > 0) {
      setRestaurants(allRestaurants.map((r) => ({ id: r.id, name: r.name, checked: true })));
    } else {
      setRestaurants([]);
    }
  }, [visible, item, allRestaurants]);

  // Load categories once the modal opens
  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const cats = await getMenuCategoryList();
      setCategories(cats);

      if (__DEV__) {
        console.log("[EditMenuItemModal] categories:", JSON.stringify(cats)?.slice(0, 500));
      }

      if (!categoryLabel) {
        const cat = extractCategory(item);
        if (cat?.id !== undefined && cat?.id !== null) {
          const match = cats.find((c: any) => String(c.id) === String(cat.id));
          if (match) setCategoryLabel((match as any).name ?? cat.name);
        } else if (cat?.name) {
          // Item only gave us a category name (no usable id) — find the
          // matching id so category_id still gets sent on save.
          const match = cats.find(
            (c: any) => String((c as any).name ?? "").toLowerCase() === String(cat.name).toLowerCase()
          );
          if (match) {
            setCategoryId((match as any).id);
            setCategoryLabel((match as any).name ?? cat.name);
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load categories:", err);
    } finally {
      setCategoriesLoading(false);
    }
  }, [categoryLabel, item]);

  useEffect(() => {
    if (visible) loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function selectCategory(cat: MenuCategory) {
    setCategoryId((cat as any).id);
    setCategoryLabel((cat as any).name ?? "");
    setCategoryPickerOpen(false);
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, { id: uid(), name: "", qty: "1" }]);
  }

  function addIngredientGroup() {
    // A "group" is represented as a row whose name is prefixed, purely as a
    // visual separator; adjust to match your backend's grouping shape.
    setIngredients((prev) => [...prev, { id: uid(), name: "", qty: "" }]);
  }

  function updateIngredient(id: string, patch: Partial<IngredientRow>) {
    setIngredients((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleRestaurant(id: number) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  }

  function pickImage() {
    // No image picker package is wired in yet. Plug in your picker of choice
    // here (e.g. expo-image-picker or react-native-image-picker) and call
    // setNewImageAsset({ uri, name, mimeType }) + setImageUri(uri) with the
    // result — everything else (preview, upload on save) is already wired.
    Alert.alert(
      "Not connected yet",
      "\"Change image\" needs an image picker package installed in the project. Once you add one, wire its result into pickImage() here."
    );
  }

  function validate(): string | null {
    if (!name.trim()) return "Please enter a menu item name.";
    if (price.trim() && Number.isNaN(Number(price))) return "Price must be a number.";
    return null;
  }

  async function handleSave() {
    if (!item) return;
    const validationError = validate();
    if (validationError) {
      Alert.alert("Missing info", validationError);
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append("id", String(item.id));
      form.append("name", name.trim());
      if (price.trim()) form.append("price", price.trim());
      if (categoryId !== null) form.append("category_id", String(categoryId));
      if (itemCode.trim()) form.append("code", itemCode.trim());
      // Backend field is `special_note`, not `note` — see GET /menus/{id} response.
      form.append("special_note", note ?? "");
      form.append("is_hidden", hidden ? "1" : "0");

      form.append(
        "ingredients",
        JSON.stringify(
          ingredients
            .filter((r) => r.name.trim())
            .map((r) => ({ name: r.name.trim(), qty: r.qty }))
        )
      );

      const selectedRestaurantIds = restaurants.filter((r) => r.checked).map((r) => r.id);
      form.append("restaurant_ids", JSON.stringify(selectedRestaurantIds));

      if (newImageAsset) {
        const uriParts = newImageAsset.uri.split(".");
        const ext = uriParts.length > 1 ? uriParts[uriParts.length - 1] : "jpg";
        form.append("image", {
          uri: newImageAsset.uri,
          name: `recipe.${ext}`,
          type: newImageAsset.mimeType ?? `image/${ext}`,
        } as any);
      }

      const updated = await updateMenuItem(item.id, form);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      console.error("Failed to save menu item:", err);
      Alert.alert(
        "Save failed",
        err?.response?.data?.message ?? err?.message ?? "Couldn't save changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Menu Items</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Menu Item/combo Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken Fried Rice"
              placeholderTextColor={COLORS.grayLight}
            />

            <Text style={styles.label}>Select Category</Text>
            <TouchableOpacity style={styles.input} onPress={() => setCategoryPickerOpen(true)}>
              <Text style={{ color: categoryLabel ? COLORS.dark : COLORS.grayLight }}>
                {categoryLabel || "Select a category"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Item/Combo Price</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.grayLight}
            />

            <Text style={styles.label}>Ingredients / Quantities</Text>
            {ingredients.map((row) => (
              <View key={row.id} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.input, styles.ingredientNameInput]}
                  value={row.name}
                  onChangeText={(v) => updateIngredient(row.id, { name: v })}
                  placeholder="Ingredient"
                  placeholderTextColor={COLORS.grayLight}
                />
                <TextInput
                  style={[styles.input, styles.ingredientQtyInput]}
                  value={row.qty}
                  onChangeText={(v) => updateIngredient(row.id, { qty: v })}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={COLORS.grayLight}
                />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeIngredient(row.id)}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addRowWrap}>
              <TouchableOpacity style={styles.addGroupBtn} onPress={addIngredientGroup}>
                <Text style={styles.addGroupBtnText}>Add group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addRowBtn} onPress={addIngredientRow}>
                <Text style={styles.addRowBtnText}>Add row</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Recipe Image</Text>
            <View style={styles.imageWrap}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Text style={{ fontSize: 28 }}>🍽️</Text>
                </View>
              )}
              <TouchableOpacity style={styles.changeBtn} onPress={pickImage}>
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Item Code</Text>
            <TextInput
              style={styles.input}
              value={itemCode}
              onChangeText={setItemCode}
              placeholder="e.g. 045"
              placeholderTextColor={COLORS.grayLight}
            />

            <Text style={styles.label}>Note</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={COLORS.grayLight}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setHidden((h) => !h)}>
              <View style={[styles.checkbox, hidden && styles.checkboxChecked]}>
                {hidden && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                This alone cannot be purchased (Hide OPS/only Combo)
              </Text>
            </TouchableOpacity>

            {restaurants.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>Available Restaurants</Text>
                {restaurants.map((r) => (
                  <TouchableOpacity key={r.id} style={styles.checkboxRow} onPress={() => toggleRestaurant(r.id)}>
                    <View style={[styles.checkbox, r.checked && styles.checkboxChecked]}>
                      {r.checked && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{r.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Recipe</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Category picker — rendered as a plain absolute overlay INSIDE the
            same outer Modal, NOT as a second nested <Modal>. A Modal inside
            a Modal is what was causing the blank/white screen. */}
        {categoryPickerOpen && (
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setCategoryPickerOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.pickerSheet} onPress={() => {}}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerHeaderTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setCategoryPickerOpen(false)}>
                  <Text style={styles.pickerHeaderBtn}>Close</Text>
                </TouchableOpacity>
              </View>
              {categoriesLoading ? (
                <ActivityIndicator style={{ margin: 16 }} color={COLORS.primary} />
              ) : categories.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: COLORS.gray }}>No categories found.</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 320 }}>
                  {categories.map((cat: any) => (
                    <TouchableOpacity key={cat.id} style={styles.pickerRow} onPress={() => selectCategory(cat)}>
                      <Text style={styles.pickerRowText}>{cat.name}</Text>
                      {String(cat.id) === String(categoryId) && (
                        <Text style={{ color: COLORS.primary, fontWeight: "800" }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.dark },
  closeX: { fontSize: 18, color: COLORS.gray, fontWeight: "700" },

  label: { fontSize: 12, fontWeight: "700", color: COLORS.gray, marginTop: 14, marginBottom: 6 },
  sectionHeading: { fontSize: 15, fontWeight: "800", color: COLORS.dark, marginTop: 18, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.dark,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  noteInput: { minHeight: 80, paddingTop: 10 },

  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  ingredientNameInput: { flex: 2 },
  ingredientQtyInput: { flex: 1 },
  removeBtn: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  removeBtnText: { color: COLORS.red, fontSize: 12, fontWeight: "700" },

  addRowWrap: { flexDirection: "row", gap: 10, marginTop: 4 },
  addGroupBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  addGroupBtnText: { color: COLORS.blue, fontWeight: "700", fontSize: 12 },
  addRowBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  addRowBtnText: { color: COLORS.blue, fontWeight: "700", fontSize: 12 },

  imageWrap: { alignItems: "center", marginTop: 4 },
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: COLORS.grayPillBg },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  changeBtn: {
    marginTop: 10,
    backgroundColor: COLORS.dark,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    width: "100%",
    alignItems: "center",
  },
  changeBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  checkboxRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  checkboxTick: { color: "#fff", fontSize: 12, fontWeight: "800" },
  checkboxLabel: { fontSize: 13, color: COLORS.dark, flex: 1 },

  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: COLORS.gold,
  },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: COLORS.blue,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    zIndex: 999,
    elevation: 999,
  },
  pickerSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerHeaderTitle: { fontSize: 15, fontWeight: "800", color: COLORS.dark },
  pickerHeaderBtn: { fontSize: 14, fontWeight: "700", color: COLORS.gray },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerRowText: { fontSize: 14, color: COLORS.dark, fontWeight: "600" },
});