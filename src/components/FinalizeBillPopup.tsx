import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";

export type PaymentMethod = "Cash" | "Card" | "Free" | "Pay later" | "Pre-paid";

const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "Card",
  "Free",
  "Pay later",
  "Pre-paid",
];

// 👉 Terminal names oyage backend eke thiyena ekvath match karanna.
// Meka API eken fetch karanna one nam methanata pass karala widget karanna puluvan.
const CARD_TERMINALS = ["Terminal 1", "Terminal 2", "Terminal 3"];

export interface FinalizeBillForm {
  orderId: number | string | null;
  givenAmount: number;
  changeAmount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  customerEmail: string;
  cardTerminal: string | null; // 👈 NEW
}

interface FinalizeBillPopupProps {
  visible: boolean;
  orderId: number | string | null;
  totalPayable: number;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (form: FinalizeBillForm) => void;
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function FinalizeBillPopup({
  visible,
  orderId,
  totalPayable,
  submitting = false,
  onClose,
  onSubmit,
}: FinalizeBillPopupProps) {
  const [givenAmountText, setGivenAmountText] = useState(String(totalPayable));
  const [date, setDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [customerEmail, setCustomerEmail] = useState("");
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);

  const [cardTerminal, setCardTerminal] = useState<string | null>(null); // 👈 NEW
  const [terminalPickerOpen, setTerminalPickerOpen] = useState(false); // 👈 NEW

  useEffect(() => {
    if (visible) {
      setGivenAmountText(String(totalPayable));
      setDate(todayIso());
      setPaymentMethod("Cash"); // 👈 fixed (was "")
      setCustomerEmail("");
      setCardTerminal(null); // 👈 NEW
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, orderId]);

  const givenAmount = useMemo(() => {
    const n = parseFloat(givenAmountText);
    return Number.isFinite(n) ? n : 0;
  }, [givenAmountText]);

  const changeAmount = useMemo(
    () => Math.max(givenAmount - totalPayable, 0),
    [givenAmount, totalPayable]
  );

  function handleSubmit() {
    // 👈 NEW: Card select karama terminal pick karanna force karanawa
    if (paymentMethod === "Card" && !cardTerminal) {
      Alert.alert("Card Terminal Required", "Please select a card terminal to continue.");
      setTerminalPickerOpen(true);
      return;
    }

    onSubmit({
      orderId,
      givenAmount,
      changeAmount,
      date,
      paymentMethod,
      customerEmail: customerEmail.trim(),
      cardTerminal: paymentMethod === "Card" ? cardTerminal : null, // 👈 NEW
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Finalize Bill</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total payable</Text>
                  <Text style={styles.summaryValue}>
                    Rs. {totalPayable.toFixed(2)}
                  </Text>
                </View>
                {orderId != null && (
                  <Text style={styles.orderIdText}>Order ID : #{orderId}</Text>
                )}
              </View>

              <Text style={styles.fieldLabel}>Given Amount</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={givenAmountText}
                onChangeText={setGivenAmountText}
                placeholder="0.00"
              />

              <Text style={styles.fieldLabel}>Change Amount</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>
                  {changeAmount.toFixed(2)}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.fieldLabel}>Payment method</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setMethodPickerOpen(true)}
              >
                <Text style={styles.selectValueText}>{paymentMethod}</Text>
                <Text style={styles.selectChevron}>▾</Text>
              </TouchableOpacity>

              {/* 👇 NEW: Card select unoth witharak penenawa */}
              {paymentMethod === "Card" && (
                <>
                  <Text style={styles.fieldLabel}>Card Terminal</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setTerminalPickerOpen(true)}
                  >
                    <Text
                      style={
                        cardTerminal
                          ? styles.selectValueText
                          : styles.selectPlaceholderText
                      }
                    >
                      {cardTerminal ?? "Select terminal"}
                    </Text>
                    <Text style={styles.selectChevron}>▾</Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.fieldLabel}>
                Customer Email Address{" "}
                <Text style={styles.optionalText}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </ScrollView>

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
          </View>
        </Pressable>
      </Pressable>

      {/* Payment method picker */}
      <Modal
        visible={methodPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMethodPickerOpen(false)}
      >
        <Pressable
          style={styles.selectBackdrop}
          onPress={() => setMethodPickerOpen(false)}
        >
          <Pressable style={styles.selectSheet} onPress={() => {}}>
            <Text style={styles.selectSheetTitle}>Payment method</Text>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method}
                style={styles.selectOptionRow}
                onPress={() => {
                  setPaymentMethod(method);
                  if (method !== "Card") setCardTerminal(null); // 👈 NEW
                  setMethodPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    method === paymentMethod && styles.selectOptionTextActive,
                  ]}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 👇 NEW: Card terminal picker */}
      <Modal
        visible={terminalPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTerminalPickerOpen(false)}
      >
        <Pressable
          style={styles.selectBackdrop}
          onPress={() => setTerminalPickerOpen(false)}
        >
          <Pressable style={styles.selectSheet} onPress={() => {}}>
            <Text style={styles.selectSheetTitle}>Card terminal</Text>
            {CARD_TERMINALS.map((terminal) => (
              <TouchableOpacity
                key={terminal}
                style={styles.selectOptionRow}
                onPress={() => {
                  setCardTerminal(terminal);
                  setTerminalPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    terminal === cardTerminal && styles.selectOptionTextActive,
                  ]}
                >
                  {terminal}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
    maxHeight: "88%",
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
    marginBottom: 16,
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
  scrollContent: { paddingBottom: 4 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#fff3f2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde3e1",
    padding: 14,
    marginBottom: 18,
  },
  summaryLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f4695f",
    marginTop: 2,
  },
  orderIdText: { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 6,
    marginTop: 4,
  },
  optionalText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  input: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1a1a2e",
    backgroundColor: "#fafafa",
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readonlyBox: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f3f4f6",
    marginBottom: 14,
  },
  readonlyText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  selectValueText: { fontSize: 14, color: "#1a1a2e", fontWeight: "600" },
  selectPlaceholderText: { fontSize: 14, color: "#9ca3af", fontWeight: "500" },
  selectChevron: { fontSize: 13, color: "#9ca3af" },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
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
    backgroundColor: "#4338ca",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  selectBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 17, 27, 0.45)",
    justifyContent: "flex-end",
  },
  selectSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  selectSheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 10,
  },
  selectOptionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  selectOptionText: { fontSize: 15, color: "#1a1a2e", fontWeight: "600" },
  selectOptionTextActive: { color: "#4338ca", fontWeight: "800" },
});