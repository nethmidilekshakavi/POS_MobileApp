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
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import SideDrawer from "../components/SideDrawer";

const AUTH_TOKEN_KEY = "auth_token";
const API_BASE_URL = "https://demo.trackerstay.com";

type NavPage = "dashboard" | "history" | "restaurant-dashboard" | "restaurant-orders";

interface RestaurantDashboardScreenProps {
  // This screen is the app's home/landing page, so — like DashboardScreen —
  // it opens the shared SideDrawer instead of having its own back arrow.
  userName: string;
  onLogout: () => void;
  onNavigate: (page: NavPage) => void;
  // Optional: wire this up to your mail/report flow later
  onSendMail?: () => void;
}

interface SaleItemRow {
  id?: number | string;
  item_name?: string;
  name?: string;
  price?: number | string;
  quantity?: number | string;
  qty?: number | string;
  amount?: number | string;
  total?: number | string;
  paid_status?: string;
  status?: string;
}

interface SalesSummaryResponse {
  // The POS API doc doesn't document this endpoint's exact shape, so this
  // type (and the pick* helpers below) are written defensively — they try
  // several likely field names instead of assuming one. Tighten this once
  // you confirm the real response from /api/v1/pos/sales.
  success?: boolean;
  today?: Record<string, any>;
  monthly?: Record<string, any>;
  today_total_sale?: number | string;
  today_total_cost?: number | string;
  today_total_income?: number | string;
  monthly_total_sale?: number | string;
  monthly_total_cost?: number | string;
  monthly_total_income?: number | string;
  items?: SaleItemRow[];
  data?: SaleItemRow[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

// Shared palette — kept in sync with RestaurantOrdersScreen.tsx
const COLORS = {
  primary: "#f4695f",
  primaryLight: "#fdece9",
  teal: "#10b981",
  tealLight: "#d1fae5",
  dark: "#1a1a2e",
  gray: "#6b7280",
  grayLight: "#9ca3af",
  border: "#e5e7eb",
  borderLight: "#f0f0f0",
  bg: "#ffffff",
  cardBg: "#fcfcfd",
  green: "#22c55e",
  greenLight: "#dcfce7",
  amber: "#f59e0b",
  amberLight: "#fef3c7",
  red: "#ef4444",
  redLight: "#fee2e2",
  grayPillBg: "#f3f4f6",
};

function money(value: number | string | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number).toFixed(0) : "0";
}

// Tries several possible key names for a stat, since the exact response
// shape from the sales endpoint isn't documented yet.
function pick(obj: Record<string, any> | undefined, keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      const v = obj[k];
      const n = typeof v === "string" ? parseFloat(v) : v;
      if (Number.isFinite(n)) return n as number;
    }
  }
  return 0;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return todayISO();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

// --- ISO string <-> JS Date helpers for the native calendar picker ---
function isoToDate(iso: string): Date {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function paidStatusStyle(status: string): { color: string; bg: string } {
  const s = status.toLowerCase();
  if (s.includes("paid") && !s.includes("un")) return { color: COLORS.green, bg: COLORS.greenLight };
  if (s.includes("unpaid") || s.includes("pending")) return { color: COLORS.amber, bg: COLORS.amberLight };
  return { color: COLORS.gray, bg: COLORS.grayPillBg };
}

export default function RestaurantDashboardScreen({
  userName,
  onLogout,
  onNavigate,
  onSendMail,
}: RestaurantDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dateDraft, setDateDraft] = useState(todayISO());

  // --- Calendar picker state ---
  // On Android the native picker is a one-shot dialog (opens, pick, closes
  // automatically). On iOS it's an inline spinner/calendar that needs to
  // live inside our own Modal with a "Done" button, since there's no native
  // dismiss button for it.
  const [pickerVisible, setPickerVisible] = useState(false);
  const [tempPickerDate, setTempPickerDate] = useState<Date>(isoToDate(todayISO()));

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<SaleItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [todayStats, setTodayStats] = useState({ sale: 0, cost: 0, income: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ sale: 0, cost: 0, income: 0 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input so we don't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const params = new URLSearchParams({
        date: selectedDate,
        // Endpoint name (SelcteddaterangePOsSale) hints at a from/to range —
        // sending the same day for both covers that possibility too.
        from_date: selectedDate,
        to_date: selectedDate,
        per_page: "10",
        page: String(page),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`${API_BASE_URL}/api/v1/pos/sales?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: SalesSummaryResponse = await res.json();

      setTodayStats({
        sale: pick(json.today, ["total_sale", "sale"]) || pick(json, ["today_total_sale"]),
        cost: pick(json.today, ["total_cost", "cost"]) || pick(json, ["today_total_cost"]),
        income: pick(json.today, ["total_income", "income"]) || pick(json, ["today_total_income"]),
      });
      setMonthlyStats({
        sale: pick(json.monthly, ["total_sale", "sale"]) || pick(json, ["monthly_total_sale"]),
        cost: pick(json.monthly, ["total_cost", "cost"]) || pick(json, ["monthly_total_cost"]),
        income: pick(json.monthly, ["total_income", "income"]) || pick(json, ["monthly_total_income"]),
      });

      const list = json.items ?? json.data ?? [];
      setRows(list);
      setTotal(json.total ?? list.length);
      setLastPage(json.last_page ?? 1);
    } catch (err: any) {
      console.error("Failed to load restaurant dashboard:", err);
      setError(err?.message ?? "Failed to load dashboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, page, debouncedSearch]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  function applyDateDraft() {
    if (isValidISODate(dateDraft)) {
      setSelectedDate(dateDraft);
      setPage(1);
    } else {
      // fall back silently to the last valid date rather than crashing
      setDateDraft(selectedDate);
    }
  }

  function goToday() {
    const d = todayISO();
    setSelectedDate(d);
    setDateDraft(d);
    setPage(1);
  }

  function shiftSelectedDate(days: number) {
    const next = shiftDate(selectedDate, days);
    setSelectedDate(next);
    setDateDraft(next);
    setPage(1);
  }

  // --- Calendar picker handlers ---
  function openPicker() {
    setTempPickerDate(isoToDate(selectedDate));
    setPickerVisible(true);
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      // Android dialog closes itself after pick/cancel — mirror that here.
      setPickerVisible(false);
      if (event.type === "dismissed" || !date) return;
      const iso = dateToISO(date);
      setSelectedDate(iso);
      setDateDraft(iso);
      setPage(1);
      return;
    }
    // iOS: just track the in-progress selection, applied on "Done".
    if (date) setTempPickerDate(date);
  }

  function confirmIosDate() {
    const iso = dateToISO(tempPickerDate);
    setSelectedDate(iso);
    setDateDraft(iso);
    setPage(1);
    setPickerVisible(false);
  }

  const statCards = useMemo(
    () => [
      { label: "Today Total Sale", value: todayStats.sale },
      { label: "Today Total Cost", value: todayStats.cost },
      { label: "Today Total Income", value: todayStats.income },
      { label: "Monthly Total Sale", value: monthlyStats.sale },
      { label: "Monthly Total Cost", value: monthlyStats.cost },
      { label: "Monthly Total Income", value: monthlyStats.income },
    ],
    [todayStats, monthlyStats]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={userName}
        onNavigate={onNavigate}
        onLogout={onLogout}
        currentPage="restaurant-dashboard"
      />

      {/* Android: native dialog picker, no wrapper needed */}
      {pickerVisible && Platform.OS === "android" && (
        <DateTimePicker
          value={tempPickerDate}
          mode="date"
          display="calendar"
          onChange={onPickerChange}
        />
      )}

      {/* iOS: inline spinner/calendar inside our own modal, with Done/Cancel */}
      {Platform.OS === "ios" && (
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Text style={styles.pickerHeaderBtn}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerHeaderTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmIosDate}>
                  <Text style={[styles.pickerHeaderBtn, { color: COLORS.primary }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempPickerDate}
                mode="date"
                display="inline"
                onChange={onPickerChange}
                themeVariant="light"
                accentColor={COLORS.primary}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburgerBtn}>
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Dashboard</Text>
        <TouchableOpacity style={styles.mailBtn} onPress={onSendMail}>
          <Text style={styles.mailBtnText}>Mail</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <View>
            {/* Date selector */}
            <Text style={styles.sectionLabel}>Select Date</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateArrowBtn} onPress={() => shiftSelectedDate(-1)}>
                <Text style={styles.dateArrowText}>‹</Text>
              </TouchableOpacity>

              {/* Tapping anywhere on this box now opens the calendar picker
                  instead of relying on manual YYYY-MM-DD typing. */}
              <TouchableOpacity
                style={styles.dateInputWrap}
                activeOpacity={0.7}
                onPress={openPicker}
              >
                <Text style={styles.dateIcon}>📅</Text>
                <Text style={styles.dateInputText}>{selectedDate}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dateArrowBtn} onPress={() => shiftSelectedDate(1)}>
                <Text style={styles.dateArrowText}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            </View>

            {/* Stat cards */}
            <View style={styles.statsGrid}>
              {statCards.map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statValue}>Rs.{money(s.value)}</Text>
                </View>
              ))}
            </View>

            {/* Search */}
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
            {loading && (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 16 }} />
            )}

            <Text style={styles.itemsHeading}>Items</Text>
          </View>
        }
        renderItem={({ item }) => {
          const name = item.item_name ?? item.name ?? "-";
          const price = item.price ?? 0;
          const qty = item.quantity ?? item.qty ?? 0;
          const amount = item.amount ?? item.total ?? 0;
          const status = item.paid_status ?? item.status ?? "-";
          const statusColors = paidStatusStyle(String(status));
          return (
            <View style={styles.card}>
              <View style={styles.cardRowTop}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
                  <Text style={[styles.statusText, { color: statusColors.color }]}>
                    {status}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.cardRow}>
                <Text style={styles.label}>Price</Text>
                <Text style={styles.value}>Rs. {money(price)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Quantity</Text>
                <Text style={styles.value}>{qty}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Amount</Text>
                <Text style={styles.amountValue}>Rs. {money(amount)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyState}>No data available in table</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !loading && rows.length > 0 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text style={styles.pageBtnText}>‹ Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>
                Page {page} of {lastPage} · {total} total
              </Text>
              <TouchableOpacity
                style={[styles.pageBtn, page >= lastPage && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
              >
                <Text style={styles.pageBtnText}>Next ›</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.bg,
  },
  hamburgerBtn: {
    width: 26,
    justifyContent: "center",
    gap: 5,
  },
  hamburgerBar: {
    height: 3,
    width: 26,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.dark,
  },
  mailBtn: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mailBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.dark,
    marginTop: 18,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateArrowText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.dark,
  },
  dateInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
  },
  dateIcon: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.6,
  },
  dateInputText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: "600",
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  todayBtnText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  // --- iOS calendar modal ---
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  pickerHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.dark,
  },
  pickerHeaderBtn: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.gray,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 10,
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.cardBg,
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "600",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 17,
    color: COLORS.teal,
    fontWeight: "800",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBg,
    marginTop: 6,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.dark,
  },
  errorBox: {
    backgroundColor: COLORS.redLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  errorText: {
    color: COLORS.red,
    fontWeight: "600",
    fontSize: 13,
  },
  itemsHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.dark,
    marginTop: 18,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    backgroundColor: COLORS.cardBg,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.dark,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: "700",
  },
  amountValue: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: 50,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyState: {
    textAlign: "center",
    color: COLORS.grayLight,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.dark,
  },
  pageIndicator: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "600",
  },
});