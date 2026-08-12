import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Table } from "../api/tables";

interface TableSelectPopupProps {
  visible: boolean;
  tables: Table[];
  loading: boolean;
  selectedTableId: number | string | null;
  onClose: () => void;
  onSelect: (table: Table) => void;
}

function tableLabel(t: Table): string {
  return String(t.table_no ?? t.name ?? t.id);
}

function chairCount(t: Table): number {
  return t.number_of_chairs ?? t.chairs ?? 0;
}

function isOccupied(t: Table): boolean {
  return !!t.has_order || !!t.order_id;
}

export default function TableSelectPopup({
  visible,
  tables,
  loading,
  selectedTableId,
  onClose,
  onSelect,
}: TableSelectPopupProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Tables</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading && tables.length === 0 ? (
              <ActivityIndicator
                size="large"
                color="#f4695f"
                style={{ marginTop: 40, marginBottom: 40 }}
              />
            ) : tables.length === 0 ? (
              <Text style={styles.emptyText}>No tables found</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {tables.map((table) => {
                  const occupied = isOccupied(table);
                  const selected = selectedTableId === table.id;
                  return (
                    <TouchableOpacity
                      key={table.id}
                      style={[
                        styles.tableCard,
                        selected && styles.tableCardSelected,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => onSelect(table)}
                    >
                      <View style={styles.tableTopRow}>
                        <Text style={styles.tableNo}>{tableLabel(table)}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            occupied ? styles.statusOccupied : styles.statusEmpty,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              occupied
                                ? styles.statusTextOccupied
                                : styles.statusTextEmpty,
                            ]}
                          >
                            {occupied ? "Orders AVAILABLE" : "Orders EMPTY"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.chairsText}>
                        Number of Chairs : {chairCount(table)}
                      </Text>

                      <View style={styles.selectRow}>
                        <View
                          style={[
                            styles.radioOuter,
                            selected && styles.radioOuterSelected,
                          ]}
                        >
                          {selected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.selectText}>Select Table</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
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
  cardWrap: { marginTop: 100, paddingHorizontal: 16, flex: 1 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    paddingVertical: 40,
  },
  tableCard: {
    borderWidth: 1.5,
    borderColor: "#f0f0f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  tableCardSelected: {
    borderColor: "#f4695f",
    backgroundColor: "#fff8f7",
  },
  tableTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  tableNo: { fontSize: 18, fontWeight: "800", color: "#1a1a2e" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusOccupied: { backgroundColor: "#fee2e2" },
  statusEmpty: { backgroundColor: "#e0e7ff" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusTextOccupied: { color: "#dc2626" },
  statusTextEmpty: { color: "#4338ca" },
  chairsText: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#f4695f",
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#f4695f",
  },
  selectText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
});