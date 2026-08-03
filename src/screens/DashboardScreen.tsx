import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { getMenuCategories, getMenusByCategory } from "../api/menu";
import { getRunningOrders } from "../api/orders";
import { MenuCategory, MenuItem } from "../api/types";
import SideDrawer from "../components/SideDrawer";

interface DashboardScreenProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (page: "dashboard" | "history") => void;
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
  const [runningCount, setRunningCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMenuCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

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

  useEffect(() => {
    if (selectedCategory === "all") {
      setMenuItems([]);
      return;
    }
    setLoading(true);
    getMenusByCategory(selectedCategory)
      .then(setMenuItems)
      .catch((err) => console.error("Failed to load menu items:", err))
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  return (
    <SafeAreaView style={styles.container}>
      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={userName}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Text style={styles.iconBtn}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trackerstay</Text>
        <TouchableOpacity>
          <Text style={styles.iconBtn}>🔔</Text>
        </TouchableOpacity>
      </View>

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCategory === "all" && styles.chipActive]}
          onPress={() => setSelectedCategory("all")}
        >
          <Text
            style={[
              styles.chipText,
              selectedCategory === "all" && styles.chipTextActive,
            ]}
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
            >
              {cat.category_name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#f4695f"
          style={{ marginTop: 40 }}
        />
      )}

      {!loading && selectedCategory !== "all" && menuItems.length === 0 && (
        <Text style={styles.emptyState}>No items in this category</Text>
      )}

      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <View style={styles.menuCard}>
            <Text style={styles.menuCardName}>{item.name}</Text>
            <Text style={styles.menuCardPrice}>
              Rs. {item.final_price ?? item.original_price}
            </Text>
          </View>
        )}
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
  iconBtn: {
    fontSize: 22,
    color: "#f4695f",
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
  },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
  },
  chipActive: {
    backgroundColor: "#f4695f",
    borderColor: "#f4695f",
  },
  chipText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1a1a2e",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  grid: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  menuCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 14,
    padding: 16,
  },
  menuCardName: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1a1a2e",
    marginBottom: 6,
  },
  menuCardPrice: {
    fontSize: 14,
    color: "#f4695f",
    fontWeight: "700",
  },
  emptyState: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 40,
  },
});