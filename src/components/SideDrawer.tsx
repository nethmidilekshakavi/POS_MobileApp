import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";

type NavPage =
  | "dashboard"
  | "history"
  | "restaurant-dashboard"
  | "restaurant-orders";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  // Which page is currently showing — used to highlight the matching item.
  // Optional so existing call sites that haven't been updated yet don't break.
  currentPage?: NavPage;
}

export default function SideDrawer({
  isOpen,
  onClose,
  userName,
  onNavigate,
  onLogout,
  currentPage,
}: SideDrawerProps) {
  // "Menu Items" etc below don't have their own screens yet — kept pointing
  // at "dashboard" until those pages exist, same as before.
  const menuItems: {
    key: NavPage | "kot" | "recipes" | "menu-items" | "qr-orders" | "terminal-access";
    label: string;
    icon: string;
    page: NavPage;
  }[] = [
    { key: "restaurant-dashboard", label: "Home", icon: "🏠", page: "restaurant-dashboard" },
    { key: "dashboard", label: "Dashboard", icon: "🧮", page: "dashboard" },
    { key: "history", label: "History", icon: "📋", page: "history" },
    { key: "restaurant-orders", label: "Restaurant Orders", icon: "🍽️", page: "restaurant-orders" },
    { key: "kot", label: "KOT", icon: "🧾", page: "dashboard" },
    { key: "recipes", label: "Recipes (BOM)", icon: "📖", page: "dashboard" },
    { key: "menu-items", label: "Menu Items", icon: "🍔", page: "dashboard" },
    { key: "qr-orders", label: "QR Table Orders", icon: "📱", page: "dashboard" },
    { key: "terminal-access", label: "POS Terminal Access", icon: "🔐", page: "dashboard" },
  ];

  function handlePress(page: NavPage) {
    onNavigate(page);
    onClose();
  }

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Drawer renders FIRST so it sits on the LEFT in a row layout */}
        <View style={styles.drawer}>
          <ScrollView>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerIcon}>
                <Text style={{ fontSize: 26 }}>🏢</Text>
              </View>
              <Text style={styles.drawerTitle}>POS SYSTEM</Text>
              <View style={styles.drawerUser}>
                <Text style={{ fontSize: 16 }}>👤</Text>
                <Text style={styles.drawerUserText}>{userName}</Text>
              </View>
            </View>

            <View style={styles.drawerBody}>
              <Text style={styles.menuLabel}>MAIN MENU</Text>

              {menuItems.map((item) => {
                // Only truly-unique-destination items (Home, Dashboard,
                // History, Restaurant Orders) get highlighted — the
                // placeholder items sharing "dashboard" as their target
                // would otherwise all light up together, which is confusing.
                const isActive =
                  currentPage === item.page &&
                  ["restaurant-dashboard", "dashboard", "history", "restaurant-orders"].includes(
                    item.key
                  );
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                    onPress={() => handlePress(item.page)}
                  >
                    <View
                      style={[
                        styles.drawerItemIcon,
                        isActive && styles.drawerItemIconActive,
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                    </View>
                    <Text
                      style={[
                        styles.drawerItemText,
                        isActive && styles.drawerItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.divider} />

              <TouchableOpacity style={styles.drawerItem} onPress={onLogout}>
                <View style={styles.drawerItemIcon}>
                  <Text style={{ fontSize: 18 }}>↪️</Text>
                </View>
                <Text style={[styles.drawerItemText, styles.logoutText]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Tappable backdrop renders AFTER, filling the remaining space to the right */}
        <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayTouchable: {
    flex: 1,
  },
  drawer: {
    width: 280,
    backgroundColor: "#ffffff",
    height: "100%",
  },
  drawerHeader: {
    backgroundColor: "#f4695f",
    padding: 24,
    paddingTop: 40,
  },
  drawerIcon: {
    width: 56,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  drawerUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  drawerUserText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  drawerBody: {
    padding: 20,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 8,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  drawerItemActive: {
    backgroundColor: "#fdece9",
  },
  drawerItemIcon: {
    width: 38,
    height: 38,
    backgroundColor: "#fde3e0",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItemIconActive: {
    backgroundColor: "#f4695f",
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  drawerItemTextActive: {
    color: "#f4695f",
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 12,
  },
  logoutText: {
    color: "#f4695f",
  },
});