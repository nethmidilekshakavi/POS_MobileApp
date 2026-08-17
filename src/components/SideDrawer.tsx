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
//   | "restaurant-orders"
  | "menu-items";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
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
  const menuItems: {
    key:
      | NavPage
      | "kot"
      | "recipes"
      | "qr-orders"
      | "terminal-access";
    label: string;
    icon: string;
    page: NavPage;
  }[] = [
    {
      key: "restaurant-dashboard",
      label: "Home",
      icon: "🏠",
      page: "restaurant-dashboard",
    },
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "🧮",
      page: "dashboard",
    },

//     {
//       key: "restaurant-orders",
//       label: "Restaurant Orders",
//       icon: "🍽️",
//       page: "restaurant-orders",
//     },

//     {
//       key: "terminal-access",
//       label: "POS Terminal Access",
//       icon: "🔐",
//       page: "dashboard",
//     },
  ];

  function handlePress(page: NavPage) {
    onNavigate(page);
    onClose();
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* DRAWER */}

        <View style={styles.drawer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}

            <View style={styles.drawerHeader}>


              <Text style={styles.drawerTitle}>
                POS SYSTEM
              </Text>

              <View style={styles.drawerUser}>
                <Text style={{ fontSize: 16 }}>
                  👤
                </Text>

                <Text style={styles.drawerUserText}>
                  {userName}
                </Text>
              </View>
            </View>

            {/* BODY */}

            <View style={styles.drawerBody}>
              <Text style={styles.menuLabel}>
                MAIN MENU
              </Text>

              {menuItems.map((item) => {
                const isActive =
                  currentPage === item.page &&
                  [
                    "restaurant-dashboard",
                    "dashboard",
                    "history",
                    "restaurant-orders",
                    "menu-items",
                  ].includes(item.key);

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.drawerItem,
                      isActive &&
                        styles.drawerItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      handlePress(item.page)
                    }
                  >
                    <View
                      style={[
                        styles.drawerItemIcon,
                        isActive &&
                          styles.drawerItemIconActive,
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                        }}
                      >
                        {item.icon}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.drawerItemText,
                        isActive &&
                          styles.drawerItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* DIVIDER */}

              <View style={styles.divider} />

              {/* LOGOUT */}

              <TouchableOpacity
                style={styles.drawerItem}
                activeOpacity={0.7}
                onPress={onLogout}
              >
                <View style={styles.drawerItemIcon}>
                  <Text
                    style={{
                      fontSize: 18,
                    }}
                  >
                    ↪️
                  </Text>
                </View>

                <Text
                  style={[
                    styles.drawerItemText,
                    styles.logoutText,
                  ]}
                >
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* BACKDROP */}

        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
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
    backgroundColor:
      "rgba(255,255,255,0.2)",
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
    backgroundColor:
      "rgba(255,255,255,0.2)",
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
