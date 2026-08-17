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

// ---------------------------------------------------------------------------
// Types matching the REAL response of
//   GET /api/v1/pos/sales  (Api\HotelController@SelcteddaterangePOsSale)
// confirmed via:
//   Invoke-RestMethod -Uri ".../api/v1/pos/sales?date=...&from_date=...&to_date=..."
// ---------------------------------------------------------------------------

interface SaleOrderItem {
  name: string;
  quantity: number;
  line_total: number;
}

interface SaleOrderCustomer {
  name?: string;
  email?: string;
  phone?: string;
  reservation_id?: string | number | null;
  room_id?: string | number | null;
  room_number?: string | number | null;
}

interface SaleOrderDetails {
  type?: string;
  status?: string;
  payment_method?: string;
  paid_amount?: number | string;
  grand_total?: number | string;
}

interface SaleOrder {
  order_id: number | string;
  invoice_id?: number | string;
  invoice_no?: string | null;
  customer?: SaleOrderCustomer;
  order: SaleOrderDetails;
  items: SaleOrderItem[];
}

interface PaymentMethodBreakdown {
  payment_method: string;
  orders_count: number;
  total: number | string;
}

interface SalesSummaryResponse {
  success?: boolean;
  orders?: SaleOrder[];
  overall_grand_total?: number | string;
  overall_paid_amount?: number | string;
  by_payment_method?: PaymentMethodBreakdown[];
}

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
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
  const s = (status || "").toLowerCase();
  if (s.includes("complete") || (s.includes("paid") && !s.includes("un")))
    return { color: COLORS.green, bg: COLORS.greenLight };
  if (s.includes("unpaid") || s.includes("pending") || s.includes("open"))
    return { color: COLORS.amber, bg: COLORS.amberLight };
  if (s.includes("cancel") || s.includes("void"))
    return { color: COLORS.red, bg: COLORS.redLight };
  return { color: COLORS.gray, bg: COLORS.grayPillBg };
}

// Fetches the /api/v1/pos/sales totals for an arbitrary date range.
// Used twice: once for "today" and once for "this month so far".
async function fetchRangeTotals(
  token: string | null,
  fromDate: string,
  toDate: string
): Promise<{ sale: number; income: number }> {
  const params = new URLSearchParams({
    from_date: fromDate,
    to_date: toDate,
  });
  const res = await fetch(`${API_BASE_URL}/api/v1/pos/sales?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const json: SalesSummaryResponse = await res.json();
  const toNum = (v: number | string | undefined) => {
    const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
    return Number.isFinite(n) ? (n as number) : 0;
  };
  return {
    sale: toNum(json.overall_grand_total),
    income: toNum(json.overall_paid_amount),
  };
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

  // --- Calendar picker state ---
  // On Android the native picker is a one-shot dialog (opens, pick, closes
  // automatically). On iOS it's an inline spinner/calendar that needs to
  // live inside our own Modal with a "Done" button, since there's no native
  // dismiss button for it.
  const [pickerVisible, setPickerVisible] = useState(false);
  const [tempPickerDate, setTempPickerDate] = useState<Date>(isoToDate(todayISO()));

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [orders, setOrders] = useState<SaleOrder[]>([]);

  const [todayStats, setTodayStats] = useState({ sale: 0, income: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ sale: 0, income: 0 });

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input (client-side filter — the API has no documented
  // `search` param, so we filter the already-fetched orders locally).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrdersForDate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const params = new URLSearchParams({
        date: selectedDate,
        from_date: selectedDate,
        to_date: selectedDate,
      });

      const res = await fetch(`${API_BASE_URL}/api/v1/pos/sales?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: SalesSummaryResponse = await res.json();

      setOrders(json.orders ?? []);
    } catch (err: any) {
      console.error("Failed to load restaurant orders:", err);
      setError(err?.message ?? "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Today / Monthly summary cards need two separate range requests, since
  // the endpoint only returns totals for whatever from_date/to_date you pass —
  // there's no separate "today" vs "monthly" field in a single response.
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const today = todayISO();
      const [todayTotals, monthlyTotals] = await Promise.all([
        fetchRangeTotals(token, today, today),
        fetchRangeTotals(token, firstOfMonthISO(), today),
      ]);
      setTodayStats(todayTotals);
      setMonthlyStats(monthlyTotals);
    } catch (err) {
      console.error("Failed to load sales stats:", err);
      // Leave previous values in place rather than zeroing them out on a
      // transient failure.
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdersForDate();
  }, [fetchOrdersForDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function goToday() {
    setSelectedDate(todayISO());
  }

  function shiftSelectedDate(days: number) {
    setSelectedDate((prev) => shiftDate(prev, days));
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
      setSelectedDate(dateToISO(date));
      return;
    }
    // iOS: just track the in-progress selection, applied on "Done".
    if (date) setTempPickerDate(date);
  }

  function confirmIosDate() {
    setSelectedDate(dateToISO(tempPickerDate));
    setPickerVisible(false);
  }

  // Client-side search across customer name, order id, invoice no, and item names.
  const filteredOrders = useMemo(() => {
    if (!debouncedSearch) return orders;
    return orders.filter((o) => {
      const haystack = [
        o.customer?.name,
        o.customer?.phone,
        String(o.order_id),
        o.invoice_no,
        ...(o.items ?? []).map((it) => it.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(debouncedSearch);
    });
  }, [orders, debouncedSearch]);

  const statCards = useMemo(
    () => [
      { label: "Today Total Sale", value: todayStats.sale },
      { label: "Today Total Income", value: todayStats.income },
      { label: "Monthly Total Sale", value: monthlyStats.sale },
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




        
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item, idx) => String(item.order_id ?? idx)}
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

              {/* Tapping anywhere on this box opens the calendar picker
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
                  {statsLoading ? (
                    <ActivityIndicator size="small" color={COLORS.teal} />
                  ) : (
                    <Text style={styles.statValue}>Rs.{money(s.value)}</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by customer, item, invoice..."
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

            <Text style={styles.itemsHeading}>Orders</Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const statusColors = paidStatusStyle(order.order?.status ?? "");
          return (
            <View style={styles.card}>
              <View style={styles.cardRowTop}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {order.customer?.name ?? `Order #${order.order_id}`}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
                  <Text style={[styles.statusText, { color: statusColors.color }]}>
                    {order.order?.status ?? "-"}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />

              {order.customer?.phone && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>Phone</Text>
                  <Text style={styles.value}>{order.customer.phone}</Text>
                </View>
              )}
              <View style={styles.cardRow}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>{order.order?.type ?? "-"}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Payment</Text>
                <Text style={styles.value}>{order.order?.payment_method ?? "-"}</Text>
              </View>

              <View style={styles.divider} />
              {(order.items ?? []).map((it, idx) => (
                <View key={idx} style={styles.cardRow}>
                  <Text style={styles.label}>
                    {it.name} × {it.quantity}
                  </Text>
                  <Text style={styles.value}>Rs. {money(it.line_total)}</Text>
                </View>
              ))}

              <View style={styles.divider} />
              <View style={styles.cardRow}>
                <Text style={styles.label}>Paid</Text>
                <Text style={styles.value}>Rs. {money(order.order?.paid_amount)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Grand Total</Text>
                <Text style={styles.amountValue}>Rs. {money(order.order?.grand_total)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyState}>No orders found for this date</Text>
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
    minHeight: 62,
    justifyContent: "center",
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
    marginVertical: 8,
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
    flexShrink: 1,
    marginRight: 8,
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
});