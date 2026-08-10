import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import SideDrawer from "../components/SideDrawer";
import apiClient from "../api/client";

/* ---------------- Types ---------------- */
type NavPage =
  | "dashboard"
  | "history"
  | "restaurant-dashboard"
  | "restaurant-orders"
  | "menu-items";

interface MenuManagementScreenProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (page: NavPage) => void;
}

interface MenuRow {
  id: number;
  code?: string;
  item_code?: string;
  name?: string;
  item_name?: string;
  image?: string;
  image_url?: string;
  image_path?: string;
  price?: number | string;
  cost?: number | string;
  type?: string;
  status?: string;
  today_availability?: boolean | number | string;
  is_available?: boolean | number | string;
}

interface MenuDetail {
  [k: string]: any;
}

/* ---------------- Constants ---------------- */
const COLORS = {
  primary: "#f4695f",
  dark: "#1a1a2e",
  gray: "#6b7280",
  grayLight: "#9ca3af",
  border: "#e5e7eb",
  bg: "#ffffff",
  cardBg: "#fcfcfd",
  grayPillBg: "#f3f4f6",
  teal: "#10b981",
  purple: "#7c3aed",
  red: "#ef4444",
};

const PER_PAGE = 10;

/* ---------------- Helpers ---------------- */
function pick(obj: any, keys: string[], fallback = "-"): string {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return String(obj[k]);
  }
  return fallback;
}

function formatMoney(value: number | string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  if (!Number.isFinite(n)) return null;
  return Number(n).toFixed(2).replace(/\.00$/, "");
}

function displayMoney(value: number | string | undefined | null): string {
  const f = formatMoney(value);
  return f ? `Rs. ${f}` : "-";
}

function toBool(raw: any): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") {
    const s = raw.toLowerCase();
    return s === "1" || s === "true" || s.includes("visible") || s.includes("available");
  }
  return false;
}

function notifyMissingEndpoint(action: string) {
  Alert.alert(
    "Not connected yet",
    `"${action}" needs a backend endpoint that isn't in the current API routes. Ask your backend dev to add it, then wire this button up.`
  );
}

function parseMenuListResponse(json: any): { rows: MenuRow[]; total: number; lastPage: number } {
  let rows: MenuRow[] = [];
  let total: number | undefined;
  let lastPage: number | undefined;

  if (Array.isArray(json?.menus)) {
    rows = json.menus;
  } else if (Array.isArray(json?.menu_items)) {
    rows = json.menu_items;
  } else if (Array.isArray(json?.data)) {
    rows = json.data;
  } else if (json?.data && typeof json.data === "object" && Array.isArray(json.data.data)) {
    rows = json.data.data;
    total = json.data.total;
    lastPage = json.data.last_page;
  } else if (Array.isArray(json?.items)) {
    rows = json.items;
  }

  total = total ?? json?.total ?? rows.length;
  lastPage = lastPage ?? json?.last_page ?? Math.max(1, Math.ceil(total / PER_PAGE));
  return { rows, total, lastPage };
}

/* ---------------- Image helpers & fallback ---------------- */
function buildImageCandidates(path?: string | null): string[] {
  if (!path) return [];
  const s = String(path).trim();
  if (!s) return [];

  const candidates = new Set<string>();
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("//")) {
    candidates.add(s);
    return Array.from(candidates);
  }

  const trimmedPath = s.replace(/^\/+/, "");
  const baseRaw = (apiClient as any)?.defaults?.baseURL ? String((apiClient as any).defaults.baseURL).trim() : "";
  const trimmedBase = baseRaw.replace(/\/+$/, "");

  if (trimmedBase) {
    candidates.add(`${trimmedBase}/${trimmedPath}`);
    const baseWithoutApi = trimmedBase.replace(/\/api(\/.*)?$/, "");
    if (baseWithoutApi && baseWithoutApi !== trimmedBase) {
      candidates.add(`${baseWithoutApi}/${trimmedPath}`);
      candidates.add(`${baseWithoutApi.replace(/\/$/, "")}/public/${trimmedPath}`);
      candidates.add(`${baseWithoutApi.replace(/\/$/, "")}/storage/${trimmedPath}`);
      candidates.add(`${baseWithoutApi.replace(/\/$/, "")}/uploads/${trimmedPath}`);
    }
    candidates.add(`${trimmedBase}/storage/${trimmedPath}`);
  }

  candidates.add(trimmedPath);
  return Array.from(candidates);
}

function ImageWithFallback({ path, style, accessibilityLabel }: { path?: string | null; style?: any; accessibilityLabel?: string }) {
  const candidates = useMemo(() => buildImageCandidates(path), [path]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [path]);

  useEffect(() => {
    if (__DEV__) console.log(`[ImageWithFallback] path=${path} candidates=`, candidates);
  }, [path, JSON.stringify(candidates)]);

  const current = candidates[idx];
  if (!current) {
    return (
      <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
        <Text style={{ fontSize: 18 }}>🍽️</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: current }}
      style={style}
      accessibilityLabel={accessibilityLabel}
      onError={() => setIdx((i) => i + 1)}
      fadeDuration={200}
    />
  );
}

/* ---------------- Detail parse ---------------- */
function parseDetailResponse(json: any): MenuDetail | null {
  if (!json) return null;
  if (json.data && typeof json.data === "object" && Object.keys(json.data).length > 0) {
    return json.data;
  }
  if (json.menu_item && typeof json.menu_item === "object") return json.menu_item;
  if (json.menu && typeof json.menu === "object") return json.menu;
  if (typeof json === "object" && (json.name || json.price || json.cost || json.id)) return json;
  return null;
}

/* ---------------- Update helper (PATCH with fallback) ---------------- */
async function updateMenuItemRequest(id: number, payload: Record<string, any>) {
  // Try PATCH first
  try {
    const res = await apiClient.patch(`api/pos/menu_item/${id}`, payload);
    return res;
  } catch (err: any) {
    // If PATCH not available, try POST to same path
    if (__DEV__) console.log("PATCH failed, trying POST for update:", err?.response?.status);
    try {
      const res2 = await apiClient.post(`api/pos/menu_item/${id}`, payload);
      return res2;
    } catch (err2: any) {
      if (__DEV__) console.log("POST update also failed:", err2?.response?.status);
      throw err2;
    }
  }
}

/* ---------------- Availability endpoint helper ---------------- */
async function updateAvailabilityRequest(id: number, isAvailable: boolean) {
  // Backend-provided endpoint:
  // POST /api/pos/menu_items/update_availability
  const payload = { id, is_available: isAvailable ? 1 : 0 };
  return apiClient.post("api/pos/menu_items/update_availability", payload);
}

/* ---------------- Component ---------------- */
export default function MenuManagementScreen({ userName, onLogout, onNavigate }: MenuManagementScreenProps) {
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<MenuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  // expanded rows state
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  // per-row detail cache and status
  const [detailsCache, setDetailsCache] = useState<Record<number, MenuDetail | null>>({});
  const [detailLoading, setDetailLoading] = useState<Record<number, boolean>>({});
  const [detailError, setDetailError] = useState<Record<number, string | null>>({});

  // per-row update loading (for availability / status updates)
  const [updateLoading, setUpdateLoading] = useState<Record<number, boolean>>({});

  // optimistic availability toggle
  const [localAvailability, setLocalAvailability] = useState<Record<number, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", code: "", price: "", cost: "", type: "Menu Item" });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("api/pos/menu_items", {
        params: {
          search: debouncedSearch || undefined,
          page,
          per_page: PER_PAGE,
        },
      });

      if (__DEV__) {
        console.log("[menu_items] raw response:", JSON.stringify(res.data)?.slice(0, 1000));
      }

      const { rows: list, total: t, lastPage: lp } = parseMenuListResponse(res.data);

      // Normalize incoming rows so UI always sees .price and .cost
      const normalized = list.map((r) => {
        const code = (r.item_code ?? r.code ?? "").toString();

        // Normalize price: try several possible backend field names
        const priceVal =
          r.price ??
          r.sale_price ??
          r.total_price ??
          r.amount ??
          r.unit_price ??
          r.price_amount ??
          null;

        const costVal =
          r.cost ??
          r.cost_price ??
          r.unit_cost ??
          r.purchase_cost ??
          r.cost_amount ??
          null;

        const today_availability = r.is_available ?? r.today_availability;
        const imageField = r.image ?? r.image_url ?? null;

        return {
          ...r,
          code,
          today_availability,
          image_path: imageField ? String(imageField) : undefined,
          // ensure the list rows always have price and cost keys used by the UI
          price: priceVal,
          cost: costVal,
        } as MenuRow;
      });

      if (__DEV__) {
        normalized.forEach((r) => {
          console.log(`[menu row] id=${r.id} price=`, r.price, "cost=", r.cost);
        });
      }

      setRows(normalized);
      setTotal(t);
      setLastPage(lp);
    } catch (err: any) {
      console.error("Failed to load menu items:", err);
      if (err?.response?.status === 401) {
        setError("Session expired — please log out and log back in.");
      } else {
        setError(err?.response?.data?.message ?? err?.message ?? "Failed to load menu");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  // Fetch detail for a menu item by id, cache result
  const fetchDetail = useCallback(
    async (id: number) => {
      if (detailsCache[id] !== undefined) return; // already attempted/fetched
      setDetailLoading((s) => ({ ...s, [id]: true }));
      setDetailError((s) => ({ ...s, [id]: null }));
      try {
        const res = await apiClient.get(`api/pos/menu_item/${id}`);
        if (__DEV__) {
          console.log(`[menu_item/${id}] raw detail:`, JSON.stringify(res.data)?.slice(0, 1000));
        }
        const parsed = parseDetailResponse(res.data);
        if (parsed) {
          setDetailsCache((s) => ({ ...s, [id]: parsed }));
        } else {
          setDetailsCache((s) => ({ ...s, [id]: res.data }));
        }
      } catch (err: any) {
        console.error(`Failed to load menu item ${id}:`, err);
        setDetailError((s) => ({ ...s, [id]: err?.response?.data?.message ?? err?.message ?? "Failed to load detail" }));
        setDetailsCache((s) => ({ ...s, [id]: null }));
      } finally {
        setDetailLoading((s) => ({ ...s, [id]: false }));
      }
    },
    [detailsCache]
  );

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = !prev[id];
      if (next && detailsCache[id] === undefined) {
        fetchDetail(id);
      }
      return { ...prev, [id]: next };
    });
  }

  function isAvailable(row: MenuRow): boolean {
    if (localAvailability[row.id] !== undefined) return localAvailability[row.id];
    return toBool(row.is_available ?? row.today_availability ?? row.available ?? row.status);
  }

  // Availability update flow (optimistic) using provided endpoint
  async function performAvailabilityUpdate(id: number, nextAvailable: boolean) {
    setUpdateLoading((s) => ({ ...s, [id]: true }));

    const oldRow = rows.find((r) => r.id === id);
    const oldDetail = detailsCache[id];

    // local immediate mapping
    setLocalAvailability((s) => ({ ...s, [id]: nextAvailable }));

    // optimistic apply to rows & details
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              today_availability: nextAvailable ? 1 : 0,
              is_available: nextAvailable ? 1 : 0,
            }
          : r
      )
    );
    // FIX: merge into existing cached detail instead of overwriting it,
    // so price/code/type/status aren't wiped out when toggling availability.
    setDetailsCache((s) => ({
      ...s,
      [id]: { ...(s[id] || {}), today_availability: nextAvailable ? 1 : 0, is_available: nextAvailable ? 1 : 0 },
    }));

    try {
      const res = await updateAvailabilityRequest(id, nextAvailable);
      const returned = res?.data;
      let merged: any = null;
      if (returned) {
        const parsed = parseDetailResponse(returned);
        merged = parsed ?? returned;
      }
      if (merged) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...(merged as any) } : r)));
        // FIX: merge server response into existing cache rather than replacing it wholesale.
        // Some backends only return { id, is_available } from this endpoint, and a full
        // replace would drop price/code/type/status that were already loaded.
        setDetailsCache((s) => ({ ...s, [id]: { ...(s[id] || {}), ...(merged as any) } }));
        const newAvail = merged.is_available ?? merged.today_availability;
        if (newAvail !== undefined) {
          setLocalAvailability((s) => ({ ...s, [id]: toBool(newAvail) }));
        }
      }
    } catch (err: any) {
      // revert
      setRows((prev) => prev.map((r) => (r.id === id ? (oldRow ?? r) : r)));
      setDetailsCache((s) => ({ ...s, [id]: oldDetail }));
      setLocalAvailability((s) => {
        const copy = { ...s };
        if (oldRow) copy[id] = toBool(oldRow.is_available ?? oldRow.today_availability);
        else delete copy[id];
        return copy;
      });
      Alert.alert("Update failed", err?.response?.data?.message ?? err?.message ?? "Failed to update availability");
    } finally {
      setUpdateLoading((s) => ({ ...s, [id]: false }));
    }
  }

  // Generic update helper (keeps older updateMenuItemRequest fallback logic)
  async function performUpdate(id: number, payload: Record<string, any>) {
    setUpdateLoading((s) => ({ ...s, [id]: true }));

    const oldRow = rows.find((r) => r.id === id);
    const oldDetail = detailsCache[id];

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    setDetailsCache((s) => ({ ...s, [id]: { ...(s[id] || {}), ...payload } }));

    try {
      const res = await updateMenuItemRequest(id, payload);
      const returned = res?.data;
      let merged: any = null;
      if (returned) {
        const parsed = parseDetailResponse(returned);
        merged = parsed ?? returned;
      }
      if (merged) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...(merged as any) } : r)));
        // FIX: merge instead of replace here too, for the same reason as above.
        setDetailsCache((s) => ({ ...s, [id]: { ...(s[id] || {}), ...(merged as any) } }));
      }
    } catch (err: any) {
      // FIX: previous revert logic (`{ ...oldRow, ...r }` where r is the current row) never
      // actually reverted anything, since spreading the current row after oldRow just keeps
      // the current (failed) values. Revert to the old row directly.
      setRows((prev) => prev.map((r) => (r.id === id ? (oldRow ?? r) : r)));
      setDetailsCache((s) => ({ ...s, [id]: oldDetail }));
      Alert.alert("Update failed", err?.response?.data?.message ?? err?.message ?? "Failed to update item");
    } finally {
      setUpdateLoading((s) => ({ ...s, [id]: false }));
    }
  }

  // handle toggle now uses the availability endpoint
  async function handleToggleAvailability(row: MenuRow) {
    const next = !isAvailable(row);
    await performAvailabilityUpdate(row.id, next);
  }

  async function handleToggleStatus(rowId: number) {
    const detail = detailsCache[rowId] ?? rows.find((r) => r.id === rowId);
    const currentStatus = String(pick(detail, ["status"], "Visible POS")).toLowerCase();
    const activeValues = ["visible pos", "visible", "active", "approved"];
    const nextIsActive = !activeValues.includes(currentStatus);
    const nextStatus = nextIsActive ? "Visible POS" : "Hidden";
    await performUpdate(rowId, { status: nextStatus });
  }

  function handleEdit(row: MenuRow) {
    notifyMissingEndpoint("Edit item");
  }

  function handleDisable(row: MenuRow) {
    Alert.alert("Disable item", `Disable "${pick(row, ["name", "item_name"])}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Disable", style: "destructive", onPress: () => performUpdate(row.id, { status: "Hidden" }) },
    ]);
  }

  function handleArchive(row: MenuRow) {
    Alert.alert("Archive item", `Archive "${pick(row, ["name", "item_name"])}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", onPress: () => performUpdate(row.id, { status: "Archived" }) },
    ]);
  }

  function handleMore(row: MenuRow) {
    notifyMissingEndpoint("More options");
  }

  function submitNewItem() {
    if (!newItem.name.trim()) {
      Alert.alert("Name required", "Please enter an item name.");
      return;
    }
    notifyMissingEndpoint("Add Item (save)");
    setAddModalVisible(false);
    setNewItem({ name: "", code: "", price: "", cost: "", type: "Menu Item" });
  }

  const pageList = useMemo(() => {
    if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);
    const pages = new Set<number>([1, 2, lastPage - 1, lastPage]);
    pages.add(page);
    pages.add(Math.max(1, page - 1));
    pages.add(Math.min(lastPage, page + 1));
    return Array.from(pages).filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b);
  }, [page, lastPage]);

  // Render detail but WITHOUT the "Other details" dump
  const renderDetail = (id: number) => {
    const loading = Boolean(detailLoading[id]);
    const err = detailError[id] ?? null;
    const detail = detailsCache[id];

    if (loading) return <ActivityIndicator style={{ margin: 12 }} color={COLORS.primary} />;

    if (err) {
      return (
        <View style={{ padding: 12 }}>
          <Text style={{ color: COLORS.red, fontWeight: "700" }}>Detail failed to load: {err}</Text>
        </View>
      );
    }

    if (!detail) {
      return (
        <View style={{ padding: 12 }}>
          <Text style={{ color: COLORS.gray }}>No additional details available.</Text>
        </View>
      );
    }

    // Known fields to display (no "other details")
    const knownRows: [string, any][] = [
      ["Name", pick(detail, ["name", "item_name"], "-")],
      ["Code / SKU", pick(detail, ["code", "item_code"], "-")],
      ["Price", displayMoney(detail.price ?? detail.sale_price ?? detail.total_price)],
      ["Cost", displayMoney(detail.cost ?? detail.cost_price)],
      ["Type", pick(detail, ["type"], "-")],
      ["Status", pick(detail, ["status"], "-")],
      ["Available today", String(toBool(detail.is_available ?? detail.today_availability ?? detail.available))],
    ];

    return (
      <View style={{ padding: 10 }}>
        {knownRows.map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}:</Text>
            <Text style={styles.detailValue}>{value}</Text>
          </View>
        ))}

        <View style={{ height: 8 }} />

        {/* Status toggle + per-row update spinner could go here */}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={userName}
        onNavigate={onNavigate}
        onLogout={onLogout}
        currentPage="menu-items"
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburgerBtn}>
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
          <Text style={styles.addBtnPlus}>＋</Text>
          <Text style={styles.addBtnText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.totalText}>You have total {total} Menus.</Text>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Type in to Search"
            placeholderTextColor={COLORS.grayLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 16 }} />}

        {/* Table */}
        <View style={{ marginTop: 12 }}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colImageHeader]}> </Text>
            <Text style={[styles.colNameHeader]}>Name</Text>
            <Text style={[styles.colPriceHeader]}>Price</Text>
            <Text style={[styles.colCostHeader]}>Cost</Text>
            <Text style={[styles.colAvailHeader]}>Avail</Text>
            <Text style={[styles.colExpandHeader]}> </Text>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const name = pick(item, ["name", "item_name"]);
              const priceDisplay = displayMoney(item.price);
              const costDisplay = displayMoney(item.cost);
              const imagePath = item.image_path ?? "";
              const expanded = Boolean(expandedIds[item.id]);
              const available = isAvailable(item);
              const updating = Boolean(updateLoading[item.id]);

              return (
                <View>
                  <TouchableOpacity style={styles.tableRow} activeOpacity={0.8} onPress={() => toggleExpand(item.id)}>
                    <View style={styles.colImage}>
                      <ImageWithFallback path={imagePath} style={styles.itemImage} accessibilityLabel={name} />
                    </View>

                    <View style={styles.colName}>
                      <Text style={styles.nameText} numberOfLines={1}>
                        {name}
                      </Text>
                    </View>

                    <View style={styles.colPrice}>
                      <Text style={styles.priceText}>{priceDisplay}</Text>
                    </View>

                    <View style={styles.colCost}>
                      <Text style={styles.costText}>{costDisplay}</Text>
                    </View>

                    <View style={styles.colAvail}>
                      <TouchableOpacity
                        onPress={() => handleToggleAvailability(item)}
                        style={[styles.toggleTrack, available ? styles.toggleTrackOn : styles.toggleTrackOff, updating && { opacity: 0.6 }]}
                        disabled={updating}
                      >
                        <View style={[styles.toggleThumb, available && styles.toggleThumbOn]} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.expanded}>
                      {renderDetail(item.id)}
                      <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
                          <Text style={styles.actionIcon}>✏️</Text>
                          <Text style={styles.actionLabel}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDisable(item)}>
                          <Text style={[styles.actionIcon, { color: COLORS.red }]}>⊗</Text>
                          <Text style={[styles.actionLabel, { color: COLORS.red }]}>Disable</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleArchive(item)}>
                          <Text style={styles.actionIcon}>🗄️</Text>
                          <Text style={styles.actionLabel}>Archive</Text>
                        </TouchableOpacity>
                        {/* FIX: "More" (☰) replaced with an arrow icon, per request */}
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleMore(item)}>
                          <Text style={styles.actionIcon}>➜</Text>
                          <Text style={styles.actionLabel}>More</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              !loading && !error ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>📋</Text>
                  <Text style={styles.emptyState}>No menu items found</Text>
                </View>
              ) : null
            }
            ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
            style={{ marginTop: 8 }}
          />

          {/* Pagination */}
          {!loading && rows.length > 0 && (
            <View style={styles.pagination}>
              <View style={styles.pageRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  {pageList.map((p) => (
                    <TouchableOpacity key={p} style={[styles.pageNumBtn, p === page && styles.pageNumBtnActive]} onPress={() => setPage(p)}>
                      <Text style={[styles.pageNumText, p === page && styles.pageNumTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.pageBtn, page >= lastPage && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.pageIndicator}>
                Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, total)} of {total} entries
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Add Item modal (UI shell) */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerHeaderTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Text style={styles.pickerHeaderBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <View>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput style={styles.formInput} value={newItem.name} onChangeText={(v) => setNewItem((s) => ({ ...s, name: v }))} placeholder="e.g. Chicken Fried Rice" placeholderTextColor={COLORS.grayLight} />
              </View>
              <View>
                <Text style={styles.formLabel}>Code</Text>
                <TextInput style={styles.formInput} value={newItem.code} onChangeText={(v) => setNewItem((s) => ({ ...s, code: v }))} placeholder="e.g. 045" placeholderTextColor={COLORS.grayLight} />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Price</Text>
                  <TextInput style={styles.formInput} value={newItem.price} onChangeText={(v) => setNewItem((s) => ({ ...s, price: v }))} placeholder="0" keyboardType="numeric" placeholderTextColor={COLORS.grayLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Cost</Text>
                  <TextInput style={styles.formInput} value={newItem.cost} onChangeText={(v) => setNewItem((s) => ({ ...s, cost: v }))} placeholder="0" keyboardType="numeric" placeholderTextColor={COLORS.grayLight} />
                </View>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={submitNewItem}>
                <Text style={styles.saveBtnText}>Save Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  hamburgerBtn: { width: 26, justifyContent: "center", gap: 5 },
  hamburgerBar: { height: 3, width: 26, borderRadius: 2, backgroundColor: COLORS.primary },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.dark },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.red,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnPlus: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
  addBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  totalText: { fontSize: 13, color: COLORS.gray, fontWeight: "600", marginTop: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardBg,
    marginTop: 10,
  },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: COLORS.dark },
  errorBox: { backgroundColor: "#fee2e2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  errorText: { color: COLORS.red, fontWeight: "600", fontSize: 13 },

  tableHeader: { flexDirection: "row", paddingVertical: 10, backgroundColor: COLORS.cardBg, borderRadius: 8, paddingHorizontal: 8 },
  colImageHeader: { width: 56 },
  colNameHeader: { flex: 1, fontWeight: "700", color: COLORS.gray },
  colPriceHeader: { width: 96, fontWeight: "700", color: COLORS.gray, textAlign: "right" } as any,
  colCostHeader: { width: 96, fontWeight: "700", color: COLORS.gray, textAlign: "right" } as any,
  colAvailHeader: { width: 64, textAlign: "center", fontWeight: "700", color: COLORS.gray },

  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, backgroundColor: "#fff" },
  colImage: { width: 56, marginRight: 8 },
  itemImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.grayPillBg },
  itemImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  colName: { flex: 1 },
  nameText: { fontSize: 14, fontWeight: "700", color: COLORS.dark },
  colPrice: { width: 96, alignItems: "flex-end" },
  priceText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  colCost: { width: 96, alignItems: "flex-end" },
  costText: { fontSize: 13, fontWeight: "700", color: COLORS.gray },
  colAvail: { width: 64, alignItems: "center" },

  toggleTrack: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: "center" },
  toggleTrackOn: { backgroundColor: COLORS.primary, alignItems: "flex-end" },
  toggleTrackOff: { backgroundColor: COLORS.grayPillBg, alignItems: "flex-start" },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#ffffff" },
  toggleThumbOn: {},

  rowSeparator: { height: 1, backgroundColor: "#f3f4f6" },

  expanded: { backgroundColor: "#fbfbfb", padding: 10, borderRadius: 8, marginVertical: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailLabel: { color: COLORS.gray, fontWeight: "700" },
  detailValue: { fontWeight: "700", color: COLORS.dark },

  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  actionBtn: { flex: 1, alignItems: "center" },
  actionIcon: { fontSize: 16 },
  actionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.gray },

  emptyWrap: { alignItems: "center", marginTop: 30 },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyState: { textAlign: "center", color: COLORS.grayLight, fontWeight: "600" },

  pagination: { marginTop: 16 },
  pageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.dark },
  pageNumBtn: { minWidth: 34, height: 34, marginHorizontal: 6, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.grayPillBg },
  pageNumBtnActive: { backgroundColor: COLORS.primary },
  pageNumText: { fontSize: 13, fontWeight: "700", color: COLORS.dark },
  pageNumTextActive: { color: "#fff" },
  pageIndicator: { fontSize: 12, color: COLORS.gray, fontWeight: "600", marginTop: 10, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerHeaderTitle: { fontSize: 15, fontWeight: "800", color: COLORS.dark },
  pickerHeaderBtn: { fontSize: 15, fontWeight: "700", color: COLORS.gray },
  formLabel: { fontSize: 12, fontWeight: "700", color: COLORS.gray, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.dark, backgroundColor: "#fff" },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});