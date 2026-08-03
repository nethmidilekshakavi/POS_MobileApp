import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onNavigate: (page: "dashboard" | "history") => void;
  onLogout: () => void;
}

export default function SideDrawer({
  isOpen,
  onClose,
  userName,
  onNavigate,
  onLogout,
}: SideDrawerProps) {
  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} />

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

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  onNavigate("dashboard");
                  onClose();
                }}
              >
                <View style={styles.drawerItemIcon}>
                  <Text style={{ fontSize: 18 }}>🏠</Text>
                </View>
                <Text style={styles.drawerItemText}>Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  onNavigate("history");
                  onClose();
                }}
              >
                <View style={styles.drawerItemIcon}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <Text style={styles.drawerItemText}>History</Text>
              </TouchableOpacity>

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
  drawerItemIcon: {
    width: 38,
    height: 38,
    backgroundColor: "#fde3e0",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
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