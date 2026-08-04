import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  ScrollView,
} from "react-native";

export interface SelectOption {
  id: number | string;
  label: string;
}

export interface OrderDetailsForm {
  orderType: "Dine In" | "Take away";
  customerId: number | string;
  customerLabel: string;
  roomId: number | string | null;
  roomLabel: string | null;
  stewardId: number | string | null;
  stewardLabel: string | null;
  serviceChargeEnabled: boolean;
  serviceChargePercent: number;
  finalizeImmediately: boolean;
  subtotal: number;
  serviceChargeAmount: number;
  total: number;
}

interface OrderDetailsPopupProps {
  visible: boolean;
  subtotal: number;
  onCancel: () => void;
  onSubmit: (form: OrderDetailsForm) => void;
  submitting?: boolean;
  customers?: SelectOption[];
  rooms?: SelectOption[];
  stewards?: SelectOption[];
  serviceChargePercent?: number;
}

const DEFAULT_CUSTOMERS: SelectOption[] = [
  { id: "walkin", label: "Walk-in Customer" },
];
const DEFAULT_STEWARDS: SelectOption[] = [{ id: "none", label: "None" }];

// Small reusable "select" field — tap to open a compact option list in its
// own modal. Keeps this screen dependency-free (no @react-native-picker).
function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  options: SelectOption[];
  onChange: (option: SelectOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectBox, disabled && styles.selectBoxDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.selectValue,
            !value && styles.selectPlaceholder,
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.selectBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.selectSheet} onPress={() => {}}>
            <Text style={styles.selectSheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.selectOptionRow}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.selectOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function OrderDetailsPopup({
  visible,
  subtotal,
  onCancel,
  onSubmit,
  submitting = false,
  customers = DEFAULT_CUSTOMERS,
  rooms = [],
  stewards = DEFAULT_STEWARDS,
  serviceChargePercent = 10,
}: OrderDetailsPopupProps) {
  const [orderType, setOrderType] = useState<"Dine In" | "Take away">(
    "Dine In"
  );
  const [customer, setCustomer] = useState<SelectOption>(customers[0]);
  const [room, setRoom] = useState<SelectOption | null>(null);
  const [steward, setSteward] = useState<SelectOption>(stewards[0]);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(true);
  const [finalizeImmediately, setFinalizeImmediately] = useState(false);

  const isWalkIn = customer.id === "walkin" || customer.id === "none";

  const serviceChargeAmount = useMemo(
    () => (serviceChargeEnabled ? subtotal * (serviceChargePercent / 100) : 0),
    [serviceChargeEnabled, subtotal, serviceChargePercent]
  );
  const total = subtotal + serviceChargeAmount;

  function handleSubmit() {
    onSubmit({
      orderType,
      customerId: customer.id,
      customerLabel: customer.label,
      roomId: room?.id ?? null,
      roomLabel: room?.label ?? null,
      stewardId: steward.id === "none" ? null : steward.id,
      stewardLabel: steward.id === "none" ? null : steward.label,
      serviceChargeEnabled,
      serviceChargePercent,
      finalizeImmediately,
      subtotal,
      serviceChargeAmount,
      total,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.title}>Order Details</Text>

              {/* Order Type */}
              <Text style={styles.sectionLabel}>
                Order Type <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.segmented}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    orderType === "Dine In" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setOrderType("Dine In")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      orderType === "Dine In" && styles.segmentTextActive,
                    ]}
                  >
                    Dine In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    orderType === "Take away" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setOrderType("Take away")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      orderType === "Take away" && styles.segmentTextActive,
                    ]}
                  >
                    Take away
                  </Text>
                </TouchableOpacity>
              </View>

              <SelectField
                label="Customer"
                value={customer.label}
                placeholder="Select customer"
                options={customers}
                onChange={(opt) => {
                  setCustomer(opt);
                  setRoom(null);
                }}
              />

              <SelectField
                label="Room"
                value={room?.label ?? null}
                placeholder={
                  isWalkIn ? "Select customer first" : "Select room"
                }
                options={rooms}
                disabled={isWalkIn || rooms.length === 0}
                onChange={setRoom}
              />

              <SelectField
                label="Steward"
                value={steward.id === "none" ? null : steward.label}
                placeholder="None"
                options={stewards}
                onChange={setSteward}
              />

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>
                  Enable Service Charge ({serviceChargePercent}%)
                </Text>
                <Switch
                  value={serviceChargeEnabled}
                  onValueChange={setServiceChargeEnabled}
                  trackColor={{ false: "#e5e7eb", true: "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Finalize Immediately</Text>
                <Switch
                  value={finalizeImmediately}
                  onValueChange={setFinalizeImmediately}
                  trackColor={{ false: "#e5e7eb", true: "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Order Summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>
                    Rs. {subtotal.toFixed(2)}
                  </Text>
                </View>
                {serviceChargeEnabled && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Service Charge ({serviceChargePercent}%):
                    </Text>
                    <Text style={styles.summaryValue}>
                      Rs. {serviceChargeAmount.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Total:</Text>
                  <Text style={styles.summaryTotalValue}>
                    Rs. {total.toFixed(2)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  submitting && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitBtnText}>
                  {submitting ? "Submitting..." : "Submit Order"}
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
    backgroundColor: "rgba(17, 17, 27, 0.5)",
    justifyContent: "center",
  },
  cardWrap: {
    marginHorizontal: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 18,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  required: {
    color: "#f4695f",
  },
  segmented: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: "#f4695f",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  segmentBtnActive: {
    backgroundColor: "#f4695f",
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f4695f",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  selectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "#fafafa",
  },
  selectBoxDisabled: {
    opacity: 0.55,
  },
  selectValue: {
    fontSize: 15,
    color: "#1a1a2e",
    fontWeight: "600",
    flex: 1,
  },
  selectPlaceholder: {
    color: "#9ca3af",
    fontWeight: "500",
  },
  selectChevron: {
    color: "#9ca3af",
    fontSize: 14,
    marginLeft: 8,
  },
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
  selectOptionText: {
    fontSize: 15,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
    flex: 1,
    marginRight: 12,
  },
  summaryBox: {
    backgroundColor: "#fff3f2",
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#fde3e1",
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 14,
    color: "#1a1a2e",
    fontWeight: "700",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#f4695f",
    opacity: 0.25,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f4695f",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  submitBtn: {
    flex: 1.4,
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
  submitBtnDisabled: {
    backgroundColor: "#f9c6c2",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});