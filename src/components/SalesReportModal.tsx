import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { getSalesReport, SalesRecord } from "../api/sales";

interface SalesReportModalProps {
  visible: boolean;
  onClose: () => void;
  hotelId: number;
}

type Mode = "range" | "single";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatMoney(v?: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number).toFixed(2) : "0.00";
}

export default function SalesReportModal({
  visible,
  onClose,
  hotelId,
}: SalesReportModalProps) {
  const [mode, setMode] = useState<Mode>("range");

  const today = useMemo(() => toISODate(new Date()), []);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [singleDate, setSingleDate] = useState(today);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<SalesRecord[]>([]);

  // Reset to "today" whenever the modal is (re)opened
  useEffect(() => {
    if (visible) {
      setFromDate(today);
      setToDate(today);
      setSingleDate(today);
      setError(null);
    }
  }, [visible, today]);

  const runQuery = useCallback(async () => {
    const from = mode === "single" ? singleDate : fromDate;
    const to = mode === "single" ? singleDate : toDate;

    if (!from || !to) {
      setError("Please enter valid date(s).");
      return;
    }
    if (from > to) {
      setError("From date can't be after end date.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getSalesReport({
        from_date: from,
        end_date: to,
        hotel_id: hotelId,
      });
      setRecords(result.data ?? []);
    } catch (err) {
      console.error("Failed to load sales report:", err);
      setError("Couldn't load the sales report. Please try again.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [mode, fromDate, toDate, singleDate, hotelId]);

  // Auto-run once whenever the modal opens (defaults to "today")
  useEffect(() => {
    if (visible) {
      runQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function applyPreset(preset: "today" | "yesterday" | "week" | "month") {
    const now = new Date();
    if (preset === "today") {
      setMode("single");
      setSingleDate(toISODate(now));
      return;
    }
    if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setMode("single");
      setSingleDate(toISODate(y));
      return;
    }
    if (preset === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setMode("range");
      setFromDate(toISODate(start));
      setToDate(toISODate(now));
      return;
    }
    if (preset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setMode("range");
      setFromDate(toISODate(start));
      setToDate(toISODate(now));
    }
  }

  const totalSales = records.reduce(
    (sum, r) => sum + (typeof r.total === "string" ? parseFloat(r.total) : r.total || 0),
    0
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sales Report</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Range vs single-date toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "range" && styles.toggleBtnActive]}
            onPress={() => setMode("range")}
          >
            <Text
              style={[
                styles.toggleBtnText,
                mode === "range" && styles.toggleBtnTextActive,
              ]}
            >
              Date Range
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "single" && styles.toggleBtnActive]}
            onPress={() => setMode("single")}
          >
            <Text
              style={[
                styles.toggleBtnText,
                mode === "single" && styles.toggleBtnTextActive,
              ]}
            >
              Single Date
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date inputs */}
        {mode === "range" ? (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>From</Text>
              <TextInput
                style={styles.dateInput}
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>To</Text>
              <TextInput
                style={styles.dateInput}
                value={toDate}
                onChangeText={setToDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        ) : (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>Date</Text>
              <TextInput
                style={styles.dateInput}
                value={singleDate}
                onChangeText={setSingleDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        )}

        {/* Quick presets */}
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset("today")}>
            <Text style={styles.presetChipText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset("yesterday")}>
            <Text style={styles.presetChipText}>Yesterday</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset("week")}>
            <Text style={styles.presetChipText}>Last 7 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset("month")}>
            <Text style={styles.presetChipText}>This Month</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.searchBtn} onPress={runQuery}>
          <Text style={styles.searchBtnText}>Show Sales</Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading ? (
          <ActivityIndicator size="large" color="#f4695f" style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>{records.length} orders</Text>
              <Text style={styles.summaryTotal}>Rs. {formatMoney(totalSales)}</Text>
            </View>

            <FlatList
              data={records}
              keyExtractor={(item, idx) => `${item.id ?? idx}`}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.emptyState}>No sales found for this period</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      Order {item.order_number ?? item.id}
                    </Text>
                    <Text style={styles.rowSub}>
                      {item.order_date}
                      {item.order_type ? ` • ${item.order_type}` : ""}
                      {item.payment_method ? ` • ${item.payment_method}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.rowTotal}>Rs. {formatMoney(item.total)}</Text>
                </View>
              )}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: "#1a1a2e" },
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#f6f6f6",
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#f4695f" },
  toggleBtnText: { fontWeight: "700", fontSize: 13, color: "#6b7280" },
  toggleBtnTextActive: { color: "#ffffff" },
  dateRow: { flexDirection: "row", gap: 12, marginHorizontal: 20, marginTop: 16 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: "600" },
  dateInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a1a2e",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: { fontSize: 12, fontWeight: "600", color: "#1a1a2e" },
  searchBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#f4695f",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  errorText: { color: "#ef4444", marginHorizontal: 20, marginTop: 10, fontSize: 13 },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  summaryText: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  summaryTotal: { fontSize: 18, fontWeight: "800", color: "#f4695f" },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f6f6f6",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  rowSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  rowTotal: { fontSize: 14, fontWeight: "800", color: "#1a1a2e" },
  emptyState: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
});