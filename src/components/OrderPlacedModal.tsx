import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { CartLine } from "./CartPopup";

interface OrderPlacedModalProps {
  visible: boolean;
  orderId: number | string | null;
  orderNumber: number | string | null;
  cart: CartLine[];
  subtotal: number;
  serviceCharge: number;
  total: number;
  onDone: () => void;
}

export default function OrderPlacedModal({
  visible,
  orderId,
  orderNumber,
  cart,
  subtotal,
  serviceCharge,
  total,
  onDone,
}: OrderPlacedModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <Text style={styles.title}>Order Placed</Text>

            <Text style={styles.row}>
              <Text style={styles.rowLabel}>Order ID: </Text>
              {orderId}
            </Text>
            <Text style={styles.row}>
              <Text style={styles.rowLabel}>Order Number: </Text>
              {orderNumber}
            </Text>

            <Text style={styles.itemsLabel}>Items:</Text>
            <ScrollView style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
              {cart.map((line) => {
                const lineTotal = Math.max(line.total - line.discount, 0);
                return (
                  <Text key={line.id} style={styles.itemRow}>
                    {line.qty}x {line.name} - Rs. {lineTotal.toFixed(2)}
                  </Text>
                );
              })}
            </ScrollView>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>Rs. {subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service Charge:</Text>
              <Text style={styles.summaryValue}>Rs. {serviceCharge.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>Rs. {total.toFixed(2)}</Text>
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 17, 27, 0.5)",
    justifyContent: "center",
  },
  cardWrap: { marginHorizontal: 20 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 16,
  },
  row: { fontSize: 15, color: "#1a1a2e", marginBottom: 6 },
  rowLabel: { fontWeight: "700" },
  itemsLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 10,
    marginBottom: 6,
  },
  itemsScroll: { maxHeight: 160 },
  itemRow: { fontSize: 14, color: "#4b5563", marginBottom: 4 },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  summaryValue: { fontSize: 14, color: "#1a1a2e", fontWeight: "700" },
  totalLabel: { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#f4695f" },
  doneBtn: {
    backgroundColor: "#f4695f",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  doneBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
});