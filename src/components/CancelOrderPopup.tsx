import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";

interface CancelOrderPopupProps {
  visible: boolean;
  orderId: number | string | null;
  // True when the kitchen has marked every item on this order Ready —
  // at that point it can no longer be cancelled from the POS.
  isReady?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}
export default function CancelOrderPopup({
  visible,
  orderId,
  isReady = false,
  submitting = false,
  onClose,
  onSubmit,
}: CancelOrderPopupProps) {
  const [reason, setReason] = useState("");

  // Reset the reason field every time the popup opens for a (possibly new) order
  useEffect(() => {
    if (visible) setReason("");
  }, [visible, orderId]);

  function handleSubmit() {
    onSubmit(reason.trim());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Cancel Order</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isReady ? (
              <>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Cannot cancel this order</Text>
                  {orderId != null && (
                    <Text style={styles.orderIdText}>Order ID : #{orderId}</Text>
                  )}
                </View>

                <Text style={styles.blockedMessage}>
                  This order is already marked as Ready, so it can no longer be
                  cancelled.
                </Text>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1 }]}
                    onPress={onClose}
                  >
                    <Text style={styles.submitBtnText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Are you sure?</Text>
                  {orderId != null && (
                    <Text style={styles.orderIdText}>Order ID : #{orderId}</Text>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Reason</Text>
                <TextInput
                  style={styles.input}
                  value={reason}
                  onChangeText={setReason}
                  placeholder=""
                  multiline
                />

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    disabled={submitting}
                  >
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    <Text style={styles.submitBtnText}>
                      {submitting ? "Submitting..." : "Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
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
    backgroundColor: "rgba(17, 17, 27, 0.5)",
    justifyContent: "center",
  },
  cardWrap: { marginHorizontal: 14 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: { fontSize: 21, fontWeight: "800", color: "#1a1a2e" },
  closeIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIconText: { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  confirmText: { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  orderIdText: { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 6,
  },
  blockedMessage: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1a1a2e",
    backgroundColor: "#fafafa",
    marginBottom: 18,
    minHeight: 48,
    textAlignVertical: "top",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#f0b429",
    backgroundColor: "#fef9e7",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeBtnText: { fontSize: 15, fontWeight: "700", color: "#b45309" },
  submitBtn: {
    flex: 1.4,
    backgroundColor: "#f4695f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
});