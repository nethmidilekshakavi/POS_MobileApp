import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Must match App.tsx's AUTH_TOKEN_KEY
const AUTH_TOKEN_KEY = "auth_token";
const API_BASE_URL = "https://demo.trackerstay.com";

interface RestaurantOrdersScreenProps {
  onBack: () => void;
}

interface OrderRow {
  id: number;
  order_id: string;
  customer_name: string | null;
  status: string;
  type: string;
  total?: number | string;
  amount?: number | string;
  payment_type?: string;
  payment_method?: string;
  created_at: string;
}

interface OrdersResponse {
  data: OrderRow[];
  current_page: number;
  last_page: number;
  total: number;
}

function money(value: number | string | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number).toFixed(0) : "0";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", " |");
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("complete")) return "#22c55e";
  if (s.includes("processing")) return "#f59e0b";
  if (s.includes("cancel")) return "#ef4444";
  return "#6b7280";
}

export default function RestaurantOrdersScreen({
  onBack,
}: RestaurantOrdersScreenProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);

  // Debounce search input so we don't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const params = new URLSearchParams({
        per_page: "10",
        sort_by: "id",
        sort_order: "desc",
        page: String(page),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`${API_BASE_URL}/api/pos/orders?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: OrdersResponse = await res.json();
      setOrders(json.data ?? []);
      setTotal(json.total ?? 0);
      setLastPage(json.last_page ?? 1);
    } catch (err: any) {
      console.error("Failed to load restaurant orders:", err);
      setError(err?.message ?? "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function handleCancel(order: OrderRow) {
    setActionOrderId(order.id);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(`${API_BASE_URL}/pos/orders/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_id: order.id, reason: "Cancelled from mobile app" }),
      });
      if (!res.ok) throw new Error(`Cancel failed (${res.status})`);
      await fetchOrders();
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      setError(err?.message ?? "Failed to cancel order");
    } finally {
      setActionOrderId(null);
    }
  }

  const showPayButton = useMemo(
    () => (order: OrderRow) =>
      (order.payment_type ?? order.payment_method ?? "").toLowerCase().includes("pay later"),
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Orders</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <View>
            <Text style={styles.totalText}>
              You have total {total} invoices.
            </Text>

            <TextInput
              style={styles.searchInput}
              placeholder="Type in to Search"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}
            {loading && (
              <ActivityIndicator size="large" color="#f4695f" style={{ marginTop: 12 }} />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRowTop}>
              <Text style={styles.orderId}>#{item.order_id ?? item.id}</Text>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>

            <View style={styles.cardRow}>
              <Text style={styles.label}>Customer</Text>
              <Text style={styles.value}>{item.customer_name ?? "Walk-in Customer"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.value}>Rs.{money(item.total ?? item.amount)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Payment</Text>
              <Text style={styles.value}>
                {item.payment_type ?? item.payment_method ?? "-"}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>🖨️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View</Text>
              </TouchableOpacity>
              {showPayButton(item) && (
                <TouchableOpacity style={styles.payBtn}>
                  <Text style={styles.payBtnText}>Pay</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => handleCancel(item)}
                disabled={actionOrderId === item.id}
              >
                {actionOrderId === item.id ? (
                  <ActivityIndicator size="small" color="#f4695f" />
                ) : (
                  <Text style={styles.iconBtnText}>✕</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.emptyState}>No orders found</Text>
          ) : null
        }
        ListFooterComponent={
          !loading && orders.length > 0 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text style={styles.pageBtnText}>‹ Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>
                Page {page} of {lastPage}
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
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 28,
    color: "#1a1a2e",
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  totalText: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 14,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 6,
  },
  errorText: {
    color: "#f4695f",
    fontWeight: "600",
    marginTop: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    backgroundColor: "#fcfcfd",
  },
  cardRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    color: "#1a1a2e",
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 15,
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#ede9fe",
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366f1",
  },
  payBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#f4695f",
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  emptyState: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 30,
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
    borderColor: "#e5e7eb",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  pageIndicator: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
});