import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { MenuItem } from "../api/types";
import { API_BASE_URL } from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = "auth_token";

// Shape we expect a "modifier" to have. If your MenuItem type doesn't
// declare `modifiers` yet, add this to it:
//
//   modifiers?: {
//     id: number;
//     menu_id?: number;
//     name: string;
//     price?: number | string;
//     image?: string | null;
//   }[];
interface Modifier {
  id: number;
  menu_id?: number;
  name: string;
  price?: number | string;
  image?: string | null;
}

interface AddToCartModalProps {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  // Called with the item, the modifiers the user picked, and quantity (always 1
  // from this modal — bump qty later from the cart screen if you need to).
  onAddToCart: (item: MenuItem, selectedModifiers: Modifier[]) => void;
}

function formatModifierPrice(price?: number | string): string {
  const value = typeof price === "string" ? parseFloat(price) : price ?? 0;
  return Number.isFinite(value) ? (value as number).toFixed(2) : "0.00";
}

function numericItemPrice(item: MenuItem): number {
  const raw =
    (item as any).final_price ??
    (item as any).original_price ??
    (item as any).price ??
    0;
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(value) ? (value as number) : 0;
}

// Same image-url logic as DashboardScreen — handles both full URLs and
// relative "/uploads/x.jpg" paths from the backend.
const STORAGE_PREFIX = "/storage"; // set to "" if your backend doesn't need this
function getImageUrl(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  const path = image.startsWith("/") ? image : `/${image}`;
  return `${API_BASE_URL}${STORAGE_PREFIX}${path}`;
}

export default function AddToCartModal({
  visible,
  item,
  onClose,
  onAddToCart,
}: AddToCartModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPrice, setPreviewPrice] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const modifiers: Modifier[] = ((item as any)?.modifiers ?? []) as Modifier[];
  const itemImageUrl = getImageUrl((item as any)?.image);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_TOKEN_KEY)
      .then(setAuthToken)
      .catch((err) => console.error("Failed to load auth token:", err));
  }, []);

  // Reset + pre-select every modifier by default whenever a new item opens,
  // matching the "already highlighted" look in the design.
  useEffect(() => {
    if (visible && item) {
      setSelectedIds(new Set(modifiers.map((m) => m.id)));
      fetchPreview(item.id);
    } else {
      setSelectedIds(new Set());
      setPreviewPrice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);

  async function fetchPreview(menuId: number) {
    setPreviewLoading(true);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(
        `${API_BASE_URL}/api/pos/menus/preview_add_to_cart?menu_id=${menuId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Server returned HTML (a 404 / redirect page) instead of JSON —
        // wrong path or auth issue. Bail out quietly instead of crashing
        // JSON.parse, and log the raw body so it's easy to debug.
        const text = await res.text();
        console.error(
          "preview_add_to_cart did not return JSON. Status:",
          res.status,
          "Body (first 200 chars):",
          text.slice(0, 200)
        );
        return;
      }
      const json = await res.json();
      if (json?.success && json?.data?.menu) {
        const price =
          json.data.menu.final_price ?? json.data.menu.original_price;
        setPreviewPrice(formatModifierPrice(price));
      }
    } catch (err) {
      console.error("Failed to load add-to-cart preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function toggleModifier(id: number) {
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

  function handleAddToCart() {
    if (!item) return;
    const chosen = modifiers.filter((m) => selectedIds.has(m.id));
    onAddToCart(item, chosen);
    onClose();
  }

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Choose Options</Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Choice 1 is always the item itself — mandatory, shown with its
                real menu image, not toggleable (you can't add it without it). */}
            <View style={styles.choiceGroup}>
              <Text style={styles.choiceLabel}>Choice 1</Text>
              <View style={[styles.modifierRow, styles.modifierRowSelected]}>
                {itemImageUrl ? (
                  <Image
                    source={{
                      uri: itemImageUrl,
                      headers: authToken
                        ? { Authorization: `Bearer ${authToken}` }
                        : undefined,
                    }}
                    style={styles.modifierImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.modifierImage,
                      styles.modifierImagePlaceholder,
                    ]}
                  >
                    <Text style={styles.noImageText}>No image</Text>
                  </View>
                )}
                <View style={styles.modifierInfo}>
                  <Text style={styles.modifierName}>{item.name}</Text>
                  <Text style={styles.modifierPrice}>
                    Rs {formatModifierPrice(numericItemPrice(item))}
                  </Text>
                </View>
              </View>
            </View>

            {modifiers.map((mod, index) => {
              const selected = selectedIds.has(mod.id);
              return (
                <View key={mod.id} style={styles.choiceGroup}>
                  <Text style={styles.choiceLabel}>Choice {index + 2}</Text>
                  <TouchableOpacity
                    style={[
                      styles.modifierRow,
                      selected && styles.modifierRowSelected,
                    ]}
                    onPress={() => toggleModifier(mod.id)}
                    activeOpacity={0.7}
                  >
                    {mod.image ? (
                      <Image
                        source={{ uri: mod.image }}
                        style={styles.modifierImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.modifierImage,
                          styles.modifierImagePlaceholder,
                        ]}
                      >
                        <Text style={styles.noImageText}>No image</Text>
                      </View>
                    )}
                    <View style={styles.modifierInfo}>
                      <Text style={styles.modifierName}>{mod.name}</Text>
                      <Text style={styles.modifierPrice}>
                        Rs {formatModifierPrice(mod.price)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}

            {previewLoading && (
              <ActivityIndicator
                size="small"
                color="#f4695f"
                style={{ marginTop: 8 }}
              />
            )}
            {!previewLoading && previewPrice && (
              <Text style={styles.previewText}>
                Item price: Rs {previewPrice}
              </Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddToCart}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>Add to cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: "80%",
  },
  header: {
    backgroundColor: "#f4695f",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  headerText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  choiceGroup: {
    marginBottom: 16,
  },
  choiceLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  modifierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
  },
  modifierRowSelected: {
    borderColor: "#f4695f",
    backgroundColor: "#fff1f0",
  },
  modifierImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  modifierImagePlaceholder: {
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontSize: 10,
    color: "#9ca3af",
  },
  modifierInfo: {
    flex: 1,
  },
  modifierName: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1a1a2e",
    marginBottom: 2,
  },
  modifierPrice: {
    fontSize: 13,
    color: "#6b7280",
  },
  noModifiers: {
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
  },
  previewText: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#1a1a2e",
  },
  addBtn: {
    flex: 1.4,
    backgroundColor: "#f4695f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#ffffff",
  },
});