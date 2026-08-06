import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { getPosSales, PosSalesSummary, PosSaleItem } from "../api/sales";

interface RestaurantDashboardScreenProps {
  onBack: () => void;
}

function toDateInputString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function money(value: number | string | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number).toFixed(2) : "0.00";
}

export default function RestaurantDashboardScreen({
  onBack,
}: RestaurantDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<PosSalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const dateString = useMemo(() => toDateInputString(date), [date]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPosSales(dateString);
      setSummary(data);
    } catch (err: any) {
      console.error("Failed to load restaurant dashboard sales:", err);
      setError(err?.response?.data?.message ?? "Failed to load dashboard data");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [dateString]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  function shiftDate(days: number) {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  }

  function onChangeDate(event: DateTimePickerEvent, selected?: Date) {
    // Android eke "Cancel" click kalama selected undefined wenawa
    setShowPicker(Platform.OS === "ios"); // iOS - inline, Android - auto close
    if (selected) {
      setDate(selected);
    }
  }

  const items: PosSaleItem[] = summary?.items ?? [];
  const filteredItems = search.trim()
    ? items.filter((item) =>
        item.item_name?.toLowerCase().includes(search.trim().toLowerCase())
      )
    : items;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Dashboard</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateStepBtn}
                onPress={() => shiftDate(-1)}
              >
                <Text style={styles.dateStepText}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateText}>{dateString}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateStepBtn}
                onPress={() => shiftDate(1)}
              >
                <Text style={styles.dateStepText}>›</Text>
              </TouchableOpacity>
            </View>

            {showPicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onChangeDate}
                maximumDate={new Date()}
              />
            )}

            {/* Stats */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#f4695f"
                style={{ marginTop: 24 }}
              />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <View style={styles.statsGrid}>
                <StatCard label="Today Total Sale" value={summary?.today_total_sale} />
                <StatCard label="Today Total Cost" value={summary?.today_total_cost} />
                <StatCard label="Today Total Income" value={summary?.today_total_income} highlight />
                <StatCard label="Monthly Total Sale" value={summary?.monthly_total_sale} />
                <StatCard label="Monthly Total Cost" value={summary?.monthly_total_cost} />
                <StatCard label="Monthly Total Income" value={summary?.monthly_total_income} highlight />
              </View>
            )}

            {/* Search */}
            <TextInput
              style={styles.searchInput}
              placeholder="Type in to Search"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
            />

            {/* Table header */}
            {!loading && !error && (
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Item Name</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Price</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Qty</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Paid</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={2}>
              {item.item_name}
            </Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>Rs.{money(item.price)}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{item.quantity}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>Rs.{money(item.amount)}</Text>
            <Text
              style={[
                styles.tableCell,
                styles.paidStatusText,
                { flex: 1.2 },
                item.paid_status?.toLowerCase() === "paid"
                  ? styles.paidStatusPaid
                  : styles.paidStatusUnpaid,
              ]}
            >
              {item.paid_status}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.emptyState}>No data available in table</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string | undefined;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        Rs.{money(value)}
      </Text>
    </View>
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 18,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  dateStepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  dateStepText: {
    fontSize: 20,
    color: "#f4695f",
    fontWeight: "700",
  },
  dateBox: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fcfcfd",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  statValueHighlight: {
    color: "#22c55e",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  errorText: {
    color: "#f4695f",
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 10,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4b5563",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f6f6f6",
  },
  tableCell: {
    fontSize: 13,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  paidStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  paidStatusPaid: {
    color: "#22c55e",
  },
  paidStatusUnpaid: {
    color: "#f4695f",
  },
  emptyState: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 30,
  },
});