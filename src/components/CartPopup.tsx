import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";

// Local cart line shape used by the dashboard. `id` is a client-side unique
// key (separate from `row_id`, which is the API's "new" / detail-id concept).
export interface CartLine {
  id: string;
  row_id: string;
  recipe_id: number;
  name: string;
  qty: number;
  price: number;
  total: number;
  discount: number;
  modifiers: { menu_id: number; name: string }[];
  note?: string;
}

interface CartPopupProps {
  visible: boolean;
  cart: CartLine[];
  onHide: () => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onChangeDiscount: (id: string, discount: number) => void;
  onClearCart: () => void;
  onPlaceOrder: () => void;
  placingOrder?: boolean;
}

export default function CartPopup({
  visible,
  cart,
  onHide,
  onIncrement,
  onDecrement,
  onRemove,
  onChangeDiscount,
  onClearCart,
  onPlaceOrder,
  placingOrder = false,
}: CartPopupProps) {
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + Math.max(line.total - line.discount, 0),
    0
  );
  const isEmpty = cart.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onHide}
    >
      {/* Dimmed backdrop — tapping it hides the popup, same as the Hide button */}
      <Pressable style={styles.backdrop} onPress={onHide}>
        {/* Stop taps inside the card from bubbling up and closing the popup */}
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.cartTitle}>Cart</Text>
                <Text style={styles.cartSubtitle}>
                  {itemCount} item{itemCount !== 1 ? "s" : ""} • Rs{" "}
                  {cartTotal.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity style={styles.hideBtn} onPress={onHide}>
                <Text style={styles.hideBtnText}>Hide</Text>
              </TouchableOpacity>
            </View>

            {isEmpty ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🛒</Text>
                <Text style={styles.emptyText}>Your cart is empty</Text>
                <Text style={styles.emptySubtext}>
                  Add items from the menu to get started
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.itemsScroll}
                showsVerticalScrollIndicator={false}
              >
                {cart.map((line) => {
                  const lineTotal = Math.max(line.total - line.discount, 0);
                  return (
                    <View key={line.id} style={styles.itemCard}>
                      <Text style={styles.itemName}>{line.name}</Text>
                      <Text style={styles.itemBasePrice}>
                        Rs {line.price.toFixed(2)}
                      </Text>

                      {line.modifiers.length > 0 && (
                        <View style={styles.modifierList}>
                          {line.modifiers.map((mod) => (
                            <Text
                              key={mod.menu_id}
                              style={styles.modifierText}
                            >
                              + {mod.name} • Rs 0.00
                            </Text>
                          ))}
                        </View>
                      )}

                      <View style={styles.qtyRow}>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => onDecrement(line.id)}
                            disabled={line.qty <= 1}
                          >
                            <Text
                              style={[
                                styles.stepperBtnText,
                                line.qty <= 1 && styles.stepperBtnTextDisabled,
                              ]}
                            >
                              −
                            </Text>
                          </TouchableOpacity>
                          <Text style={styles.stepperQty}>{line.qty}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => onIncrement(line.id)}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => onRemove(line.id)}>
                          <Text style={styles.removeText}>Remove</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.discountRow}>
                        <Text style={styles.discountLabel}>Discount:</Text>
                        <TextInput
                          style={styles.discountInput}
                          keyboardType="numeric"
                          value={line.discount ? String(line.discount) : "0"}
                          onChangeText={(text) => {
                            const cleaned = text.replace(/[^0-9.]/g, "");
                            const value = parseFloat(cleaned);
                            onChangeDiscount(
                              line.id,
                              Number.isFinite(value) ? value : 0
                            );
                          }}
                        />
                      </View>

                      <View style={styles.itemTotalRow}>
                        <Text style={styles.itemTotalLabel}>Item Total:</Text>
                        <Text style={styles.itemTotalValue}>
                          Rs {lineTotal.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.placeOrderBtn,
                  isEmpty && styles.placeOrderBtnDisabled,
                ]}
                onPress={onPlaceOrder}
                disabled={isEmpty || placingOrder}
              >
                <Text style={styles.placeOrderText}>
                  {placingOrder ? "Placing order..." : "Place Order"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.clearCartBtn,
                  isEmpty && styles.clearCartBtnDisabled,
                ]}
                onPress={onClearCart}
                disabled={isEmpty}
              >
                <Text
                  style={[
                    styles.clearCartText,
                    isEmpty && styles.clearCartTextDisabled,
                  ]}
                >
                  Clear Cart
                </Text>
              </TouchableOpacity>
            </View>
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
  cardWrap: {
    marginTop: 118,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 18,
    maxHeight: 640,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cartTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  cartSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "600",
  },
  hideBtn: {
    backgroundColor: "#fdeceb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  hideBtnText: {
    color: "#f4695f",
    fontWeight: "700",
    fontSize: 14,
  },
  itemsScroll: {
    maxHeight: 420,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#fcfcfd",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  itemBasePrice: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 10,
    fontWeight: "600",
  },
  modifierList: {
    marginBottom: 12,
    gap: 3,
  },
  modifierText: {
    fontSize: 13,
    color: "#8b8fa3",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#f4695f",
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    color: "#f4695f",
    fontSize: 18,
    fontWeight: "700",
  },
  stepperBtnTextDisabled: {
    color: "#f5c6c2",
  },
  stepperQty: {
    minWidth: 22,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  removeText: {
    color: "#f4695f",
    fontWeight: "700",
    fontSize: 14,
  },
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
  },
  discountInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: 90,
    fontSize: 14,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
  },
  itemTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 10,
  },
  itemTotalLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  itemTotalValue: {
    fontSize: 16,
    color: "#1a1a2e",
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  placeOrderBtn: {
    backgroundColor: "#f4695f",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#f4695f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  placeOrderBtnDisabled: {
    backgroundColor: "#f9c6c2",
    shadowOpacity: 0,
    elevation: 0,
  },
  placeOrderText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  clearCartBtn: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  clearCartBtnDisabled: {
    opacity: 0.5,
  },
  clearCartText: {
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "700",
  },
  clearCartTextDisabled: {
    color: "#9ca3af",
  },
});