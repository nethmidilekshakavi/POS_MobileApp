import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMenuCategories, getMenusByCategory, searchMenus } from "../api/menu";
import { getRunningOrders } from "../api/orders";
import { MenuCategory, MenuItem } from "../api/types";
import { API_BASE_URL } from "../api/client";
import SideDrawer from "../components/SideDrawer";

// Must match the AsyncStorage key used in api/client.ts's request interceptor
const AUTH_TOKEN_KEY = "auth_token";

interface DashboardScreenProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (page: "dashboard" | "history") => void;
}

// API sometimes returns prices as strings ("850.00") instead of numbers.
// This safely coerces whatever we get into a formatted "0.00" string.
function formatPrice(item: MenuItem): string {
  const raw =
    item.final_price ?? item.original_price ?? (item as any).price ?? 0;
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

// Handles both full URLs ("https://...") and relative paths ("/uploads/x.jpg")
// returned by the backend. Relative paths get the API_BASE_URL prepended.
// 👇 If your backend serves images via a Laravel storage symlink, uncomment
// the STORAGE_PREFIX line below and test — this is the most common reason
// for a 404 on an otherwise-correct-looking image path.
const STORAGE_PREFIX = "/storage"; // set to "" if your backend doesn't need this

function getImageUrl(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  const path = image.startsWith("/") ? image : `/${image}`;
  return `${API_BASE_URL}${STORAGE_PREFIX}${path}`;
}

export default function DashboardScreen({
  userName,
  onLogout,
  onNavigate,
}: DashboardScreenProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">(
    "all"
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);
  const [runningCount, setRunningCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Load auth token once, so it can be attached to image requests below
  useEffect(() => {
    AsyncStorage.getItem(AUTH_TOKEN_KEY)
      .then(setAuthToken)
      .catch((err) => console.error("Failed to load auth token:", err));
  }, []);

  // Load categories once
  useEffect(() => {
    getMenuCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Poll running orders every 5s
  useEffect(() => {
    const fetchRunning = () => {
      getRunningOrders()
        .then((orders) => setRunningCount(orders.length))
        .catch((err) => console.error("Failed to load running orders:", err));
    };

    fetchRunning();
    const interval = setInterval(fetchRunning, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch items for the "All" chip by merging every category's items
  const loadAllItems = useCallback(async () => {
    if (categories.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        categories.map((cat) => getMenusByCategory(cat.id).catch(() => []))
      );
      const merged = results.flat();
      // de-dupe by id just in case an item appears in multiple categories
      const unique = Array.from(
        new Map(merged.map((item) => [item.id, item])).values()
      );
      setMenuItems(unique);
    } catch (err) {
      console.error("Failed to load all menu items:", err);
    } finally {
      setLoading(false);
    }
  }, [categories]);

  useEffect(() => {
    if (selectedCategory === "all") {
      loadAllItems();
      return;
    }
    setLoading(true);
    getMenusByCategory(selectedCategory)
      .then(setMenuItems)
      .catch((err) => console.error("Failed to load menu items:", err))
      .finally(() => setLoading(false));
  }, [selectedCategory, loadAllItems]);

  // Debounced server-side search via /pos/search_menus
  useEffect(() => {
    const query = search.trim();
    if (query.length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(() => {
      searchMenus(query)
        .then(setSearchResults)
        .catch((err) => console.error("Failed to search menus:", err))
        .finally(() => setSearching(false));
    }, 400);

    return () => clearTimeout(timeout);
  }, [search]);

  const isSearchActive = search.trim().length > 0;
  const displayedItems = isSearchActive ? searchResults : menuItems;
  const isLoadingList = isSearchActive ? searching : loading;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />
      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={userName}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.hamburgerBtn}
        >
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Trackerstay</Text>

        <TouchableOpacity>
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search + Running badge */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.runningBadge}>
          <Text style={styles.runningBadgeText}>Running</Text>
          <View style={styles.runningCountCircle}>
            <Text style={styles.runningCountText}>{runningCount}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Category chips (hidden while a search query is active) */}
      {!isSearchActive && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          <TouchableOpacity
            style={[
              styles.chip,
              selectedCategory === "all" && styles.chipActive,
            ]}
            onPress={() => setSelectedCategory("all")}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === "all" && styles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              All
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.chip,
                selectedCategory === cat.id && styles.chipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === cat.id && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {cat.category_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoadingList && (
        <ActivityIndicator
          size="large"
          color="#f4695f"
          style={{ marginTop: 40 }}
        />
      )}

      {!isLoadingList && displayedItems.length === 0 && (
        <Text style={styles.emptyState}>
          {isSearchActive ? "No items match your search" : "No items found"}
        </Text>
      )}

      {/* Menu item list */}
      <FlatList
        data={displayedItems}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 24 },
        ]}
        renderItem={({ item }) => {
          const imageUrl = getImageUrl(item.image as any);
          return (
            <View style={styles.menuCard}>
              <View style={styles.menuImageWrap}>
                {imageUrl ? (
                  <Image
                    source={{
                      uri: imageUrl,
                      headers: authToken
                        ? { Authorization: `Bearer ${authToken}` }
                        : undefined,
                    }}
                    style={styles.menuImage}
                    onError={(e) =>
                      console.warn(
                        "Image failed to load:",
                        imageUrl,
                        e.nativeEvent?.error
                      )
                    }
                  />
                ) : (
                  <View style={[styles.menuImage, styles.menuImagePlaceholder]}>
                    <Text style={{ fontSize: 26 }}>🍽️</Text>
                  </View>
                )}
                <View style={styles.availableDot} />
              </View>

              <View style={styles.menuInfo}>
                <Text style={styles.menuCardName}>{item.name}</Text>
                <Text style={styles.menuCardCode}>
                  {item.description
                    ? item.description
                    : item.item_code
                    ? `Item code • ${item.item_code}`
                    : `Item code • ${item.id}`}
                </Text>
                <Text style={styles.menuCardPrice}>
                  Rs. {formatPrice(item)}
                </Text>
              </View>

              <TouchableOpacity style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ ADD</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  hamburgerBtn: {
    width: 26,
    justifyContent: "center",
    gap: 5,
  },
  hamburgerBar: {
    height: 3,
    width: 26,
    borderRadius: 2,
    backgroundColor: "#f4695f",
  },
  bellIcon: {
    fontSize: 24,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
  },
  runningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f4695f",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  runningBadgeText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  runningCountCircle: {
    backgroundColor: "#ffffff",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  runningCountText: {
    color: "#f4695f",
    fontSize: 12,
    fontWeight: "700",
  },
  chipsRow: {
    marginTop: 16,
    flexGrow: 0,
    minHeight: 48,
  },
  chipsContent: {
    paddingHorizontal: 20,
    paddingRight: 40,
    alignItems: "center",
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginRight: 10,
    flexShrink: 0,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: "#f4695f",
    borderColor: "#f4695f",
  },
  chipText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1a1a2e",
    lineHeight: Platform.OS === "android" ? 20 : 18,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  menuImageWrap: {
    position: "relative",
  },
  menuImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  menuImagePlaceholder: {
    backgroundColor: "#f6f6f6",
    alignItems: "center",
    justifyContent: "center",
  },
  availableDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  menuInfo: {
    flex: 1,
    justifyContent: "center",
  },
  menuCardName: {
    fontWeight: "700",
    fontSize: 15,
    color: "#1a1a2e",
    marginBottom: 4,
  },
  menuCardCode: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 6,
  },
  menuCardPrice: {
    fontSize: 15,
    color: "#f4695f",
    fontWeight: "800",
  },
  addBtn: {
    borderWidth: 1.5,
    borderColor: "#f4695f",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: {
    color: "#f4695f",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyState: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 40,
  },
});