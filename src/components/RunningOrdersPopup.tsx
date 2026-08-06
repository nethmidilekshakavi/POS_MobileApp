import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { RunningOrder } from "../api/types";

interface RunningOrdersPopupProps {
  visible: boolean;
  orders: RunningOrder[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onCancel: (order: RunningOrder) => void;
  onUpdate: (order: RunningOrder) => void;
  onFinalize: (order: RunningOrder) => void;
  onSplit: (order: RunningOrder) => void;
}

// Backend sometimes sends totals as strings ("1785.00"), under a different
// field name, or omits them entirely — this safely coerces whatever comes
// back into a number so .toFixed() never blows up.
function safeTotal(order: RunningOrder): number {
  const raw =
    (order as any).total ??
    (order as any).grand_total ??
    (order as any).amount ??
    0;
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(value) ? value : 0;
}

// created_at can also be missing/invalid in some responses — guard against
// "Invalid Date" being rendered.
function safeDateLabel(order: RunningOrder): string {
  const raw = (order as any).created_at;
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function RunningOrdersPopup({
  visible,
  orders,
  loading,
  onClose,
  onRefresh,
  onCancel,
  onUpdate,
  onFinalize,
  onSplit,
}: RunningOrdersPopupProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Running Orders</Text>
                <Text style={styles.subtitle}>{orders.length} active</Text>
              </View>
              <View style={styles.headerBtns}>
                <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                  <Text style={styles.refreshBtnText}>
                    {loading ? "..." : "↻ Refresh"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading && orders.length === 0 ? (
              <ActivityIndicator
                size="large"
                color="#f4695f"
                style={{ marginTop: 40, marginBottom: 40 }}
              />
            ) : orders.length === 0 ? (
              <Text style={styles.emptyText}>No running orders</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {orders.map((order) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderId}>#{order.id}</Text>
                      <Text style={styles.orderTotal}>
                        Rs. {safeTotal(order).toFixed(2)}
                      </Text>
                    </View>

                    <Text style={styles.orderDate}>{safeDateLabel(order)}</Text>
                    <Text style={styles.orderMeta}>
                      Customer: {order.customer_name || "Walk-in Customer"}
                    </Text>
                    {order.steward_name ? (
                      <Text style={styles.orderMeta}>
                        Steward: {order.steward_name}
                      </Text>
                    ) : null}

                    <View
                      style={[
                        styles.statusBadge,
                        order.is_ready
                          ? styles.statusReady
                          : styles.statusNotReady,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          order.is_ready
                            ? styles.statusTextReady
                            : styles.statusTextNotReady,
                        ]}
                      >
                        {order.is_ready ? "Ready" : "Not Ready"}
                      </Text>
                    </View>

                    <View style={styles.actionsGrid}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.cancelBtn]}
                        onPress={() => onCancel(order)}
                      >
                        <Text style={[styles.actionText, styles.cancelText]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.updateBtn]}
                        onPress={() => onUpdate(order)}
                      >
                        <Text style={[styles.actionText, styles.updateText]}>
                          Update
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.finalizeBtn]}
                        onPress={() => onFinalize(order)}
                      >
                        <Text style={[styles.actionText, styles.finalizeText]}>
                          Finalize
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.splitBtn]}
                        onPress={() => onSplit(order)}
                      >
                        <Text style={[styles.actionText, styles.splitText]}>
                          Split
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 17, 27, 0.45)",
    justifyContent: "flex-start",
  },
  cardWrap: { marginTop: 156, paddingHorizontal: 16, flex: 1 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    maxHeight: "78%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  subtitle: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 8 },
  refreshBtn: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  closeBtn: {
    backgroundColor: "#f4695f",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    paddingVertical: 40,
  },
  orderCard: {
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  orderId: { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  orderTotal: { fontSize: 16, fontWeight: "800", color: "#f4695f" },
  orderDate: { fontSize: 13, color: "#9ca3af", marginBottom: 8 },
  orderMeta: { fontSize: 14, color: "#4b5563", marginBottom: 2 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  statusReady: { backgroundColor: "#dcfce7" },
  statusNotReady: { backgroundColor: "#fef3c7" },
  statusText: { fontSize: 12, fontWeight: "700" },
  statusTextReady: { color: "#16a34a" },
  statusTextNotReady: { color: "#b45309" },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionBtn: {
    flexBasis: "47%",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  actionText: { fontWeight: "700", fontSize: 14 },
  cancelBtn: { backgroundColor: "#fdeceb", borderColor: "#fdeceb" },
  cancelText: { color: "#dc2626" },
  updateBtn: { backgroundColor: "#fef9e7", borderColor: "#fef9e7" },
  updateText: { color: "#b45309" },
  finalizeBtn: { backgroundColor: "#dcfce7", borderColor: "#dcfce7" },
  finalizeText: { color: "#16a34a" },
  splitBtn: { backgroundColor: "#e0e7ff", borderColor: "#e0e7ff" },
  splitText: { color: "#4338ca" },
});