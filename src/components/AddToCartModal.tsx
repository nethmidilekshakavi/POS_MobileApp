import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import { MenuItem } from "../api/types";
import { API_BASE_URL } from "../api/client";

// Mirrors DashboardScreen's getImageUrl — handles both full URLs and
// relative paths ("/uploads/x.jpg") returned by the backend.
const STORAGE_PREFIX = "/storage";
function getImageUrl(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  const path = image.startsWith("/") ? image : `/${image}`;
  return `${API_BASE_URL}${STORAGE_PREFIX}${path}`;
}

// A single selectable option shown under its own "Choice N" heading.
export interface ModifierChoice {
  id: number;
  name: string;
  price?: number | string;
  image?: string | null;
}

interface AddToCartModalProps {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    selectedModifiers: { id: number; name: string }[]
  ) => void;
}

// The POS API's MenuItem type (see api/types.ts) has no field carrying a
// list of swappable choices — the "Choose Options" list is a fixed local
// template for rice dishes: the dish itself, plus the two standard sides.
// If the backend later adds a real modifiers field to MenuItem, swap this
// function out for reading that field directly.
function getRiceModifierChoices(item: MenuItem): ModifierChoice[] {
  return [
    { id: item.id * 1000 + 1, name: item.name, price: 0, image: item.image },
    { id: item.id * 1000 + 2, name: "Vegetable Salad (for rice)", price: 0 },
    { id: item.id * 1000 + 3, name: "Chillie paste", price: 0 },
  ];
}

function formatModifierPrice(price?: number | string): string {
  if (price === undefined || price === null) return "0.00";
  const value = typeof price === "string" ? parseFloat(price) : price;
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

// Menu items whose name doesn't contain "rice" have nothing to configure —
// this modal is skipped entirely for them (see DashboardScreen's
// handleAddPress), so this list only ever renders for rice dishes.
export default function AddToCartModal({
  visible,
  item,
  onClose,
  onAddToCart,
}: AddToCartModalProps) {
  const modifiers: ModifierChoice[] = item ? getRiceModifierChoices(item) : [];

  // Nothing is pre-selected — the user has to actively tap a choice for it
  // to be included, and only checked choices get added to the cart.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Reset selection whenever a different item is opened
  useEffect(() => {
    setSelectedIds(new Set());
  }, [item?.id, visible]);

  if (!item) return null;

  function toggleChoice(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleAdd() {
    if (!item) return;
    const selected = modifiers
      .filter((m) => selectedIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }));
    onAddToCart(item, selected);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Choose Options</Text>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {modifiers.length === 0 ? (
                <Text style={styles.emptyText}>
                  No optional add-ons for this item.
                </Text>
              ) : (
                modifiers.map((choice, index) => {
                  const isSelected = selectedIds.has(choice.id);
                  const choiceImageUrl = getImageUrl(choice.image);
                  return (
                    <View key={choice.id} style={styles.choiceGroup}>
                      <Text style={styles.choiceLabel}>
                        Choice {index + 1}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => toggleChoice(choice.id)}
                        style={[
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                        ]}
                      >
                        {choiceImageUrl ? (
                          <Image
                            source={{ uri: choiceImageUrl }}
                            style={styles.optionImage}
                          />
                        ) : (
                          <View
                            style={[styles.optionImage, styles.optionImagePlaceholder]}
                          >
                            <Text style={styles.optionImagePlaceholderText}>
                              No image
                            </Text>
                          </View>
                        )}

                        <View style={styles.optionInfo}>
                          <Text style={styles.optionName}>{choice.name}</Text>
                          <Text style={styles.optionPrice}>
                            Rs {formatModifierPrice(choice.price)}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.checkCircle,
                            isSelected && styles.checkCircleSelected,
                          ]}
                        >
                          {isSelected && (
                            <Text style={styles.checkMark}>✓</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                <Text style={styles.addBtnText}>Add to cart</Text>
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
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    maxHeight: "86%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
  },
  header: {
    backgroundColor: "#f4695f",
    paddingVertical: 20,
    paddingHorizontal: 22,
  },
  headerText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  body: {
    paddingHorizontal: 22,
  },
  bodyContent: {
    paddingTop: 18,
    paddingBottom: 6,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  choiceGroup: {
    marginBottom: 18,
  },
  choiceLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#ffffff",
    gap: 12,
  },
  optionCardSelected: {
    borderColor: "#f4695f",
    backgroundColor: "#fff2f1",
  },
  optionImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  optionImagePlaceholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  optionImagePlaceholderText: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "600",
    textAlign: "center",
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  optionPrice: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleSelected: {
    backgroundColor: "#f4695f",
    borderColor: "#f4695f",
  },
  checkMark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
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
  addBtn: {
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
  addBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});