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
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMenuCategories, getMenusByCategory, searchMenus } from "../api/menu";
import {
  getRunningOrders,
  createOrUpdateOrder,
  cancelOrder,
  finalizeOrder,
} from "../api/orders";
import { MenuCategory, MenuItem, RunningOrder } from "../api/types";
import { API_BASE_URL } from "../api/client";
import SideDrawer from "../components/SideDrawer";
import AddToCartModal from "../components/AddToCartModal";
import CartPopup, { CartLine } from "../components/CartPopup";
import OrderDetailsPopup, {
  OrderDetailsForm,
} from "../components/OrderDetailsPopup";
import OrderPlacedModal from "../components/OrderPlacedModal";
import RunningOrdersPopup from "../components/RunningOrdersPopup";
import { getStewards, Steward } from "../api/stewards";
import { getCustomers, Customer } from "../api/customers";
import { CustomerOption, SelectOption } from "../components/OrderDetailsPopup";
import TableSelectPopup from "../components/TableSelectPopup";
import { getTables, Table } from "../api/tables";
import FinalizeBillPopup, { FinalizeBillForm } from "../components/FinalizeBillPopup";
import CancelOrderPopup from "../components/CancelOrderPopup";

const AUTH_TOKEN_KEY = "auth_token";

const DEFAULT_RESTAURANT_ID = 1;

// Kitchen status that blocks cancellation — once the kitchen has marked an
// order Ready, it's too far along to cancel from the POS.
const UNCANCELLABLE_STATUS = "Ready";

type NavPage = "dashboard" | "history" | "restaurant-dashboard" | "restaurant-orders";

interface DashboardScreenProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (page: NavPage) => void;
  // Which page this instance represents — App.tsx currently reuses
  // DashboardScreen for both "dashboard" and "history", so this lets the
  // drawer highlight the right one instead of always showing "Dashboard".
  activePage?: NavPage;
}

// Client-side unique id for a cart line — separate from `row_id`, which is
// the API's "new" / existing-detail-id concept used by POST /pos/orders.
function makeLineId(): string {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// API sometimes returns prices as strings ("850.00") instead of numbers.
// This safely coerces whatever we get into a formatted "0.00" string.
function formatPrice(item: MenuItem): string {
  const raw =
    item.final_price ?? item.original_price ?? (item as any).price ?? 0;
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function numericPrice(item: MenuItem): number {
  const raw =
    item.final_price ?? item.original_price ?? (item as any).price ?? 0;
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(value) ? (value as number) : 0;
}

// Handles both full URLs ("https://...") and relative paths ("/uploads/x.jpg")
// returned by the backend. Relative paths get the API_BASE_URL prepended.
const STORAGE_PREFIX = "/storage"; // set to "" if your backend doesn't need this

function getImageUrl(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  const path = image.startsWith("/") ? image : `/${image}`;
  return `${API_BASE_URL}${STORAGE_PREFIX}${path}`;
}

// Backend requires order_date in "Y-m-d H:i:s" format (Laravel validation),
// but FinalizeBillPopup's date field is date-only (YYYY-MM-DD) since that's
// all the user needs to see/edit. Append the current time here so the
// value sent to the API always matches what the backend expects.
function formatDateTimeForBackend(dateOnly: string): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${dateOnly} ${hh}:${mm}:${ss}`;
}

export default function DashboardScreen({
  userName,
  onLogout,
  onNavigate,
  activePage = "dashboard",
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

  // --- Add-to-cart popup state ---
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);

  // --- Cart popup state ---
  const [cartVisible, setCartVisible] = useState(false);

  // --- Order details popup state (opens from the cart's "Place Order" btn) ---
  const [orderDetailsVisible, setOrderDetailsVisible] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const [stewardOptions, setStewardOptions] = useState<SelectOption[]>([
    { id: "none", label: "None" },
  ]);

  // Customer options for the Order Details popup — each one carries
  // `roomNumbers` straight from GET /pos/customers, which is what drives
  // the "Room" dropdown inside OrderDetailsPopup (no separate rooms call).
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([
    { id: "walkin", label: "Walk-in Customer" },
  ]);

  // --- Order placed confirmation popup state ---
  const [orderPlacedVisible, setOrderPlacedVisible] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{
    orderId: number | string | null;
    orderNumber: number | string | null;
    cart: CartLine[];
    subtotal: number;
    serviceCharge: number;
    total: number;
  } | null>(null);

  // --- Finalize Bill popup state ---
  // `financeContext` tracks WHICH order we're finalizing and where the flow
  // should go afterwards, since this popup is triggered from two different
  // places: right after placing a new order (finalizeImmediately toggle),
  // and from the "Finalize" button on an existing running order.
  const [financeVisible, setFinanceVisible] = useState(false);
  const [financeSubmitting, setFinanceSubmitting] = useState(false);
  const [financeContext, setFinanceContext] = useState<{
    orderId: number | string;
    total: number;
    source: "new-order" | "running-order";
    // Only needed for the "new-order" path, to populate the "Order Placed"
    // confirmation popup afterwards.
    placedOrderInfo?: {
      orderNumber: number | string | null;
      cart: CartLine[];
      subtotal: number;
      serviceCharge: number;
    };
  } | null>(null);

  // --- Running orders popup state ---
  const [runningOrders, setRunningOrders] = useState<RunningOrder[]>([]);
  const [runningOrdersVisible, setRunningOrdersVisible] = useState(false);
  const [runningLoading, setRunningLoading] = useState(false);

  // --- Cancel Order (reason) popup state ---
  // Opened from handleCancelRunningOrder for any order whose status is NOT
  // the uncancellable one. Captures a cancellation reason before actually
  // calling the cancel API.
  const [cancelPopupVisible, setCancelPopupVisible] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<RunningOrder | null>(
    null
  );
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

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

  // Load stewards once, for the "Steward" dropdown in the Order Details popup
  useEffect(() => {
    getStewards()
      .then((stewards: Steward[]) => {
        const options: SelectOption[] = stewards.map((s) => ({
          id: s.id,
          label: s.lname ? `${s.name} ${s.lname}` : s.name,
        }));
        setStewardOptions(options);
      })
      .catch((err) => console.error("Failed to load stewards:", err));
  }, []);

  // Load customers once, for the "Customer" dropdown in the Order Details
  // popup. Keeps "Walk-in Customer" as the first option so nothing breaks
  // if the request fails or returns empty.
  useEffect(() => {
    getCustomers()
      .then((customers: Customer[]) => {
        const options: CustomerOption[] = [
          { id: "walkin", label: "Walk-in Customer" },
          ...customers.map((c) => ({
            id: c.id,
            label: c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name,
            roomNumbers: c.room_numbers ?? [],
          })),
        ];
        setCustomerOptions(options);
      })
      .catch((err) => console.error("Failed to load customers:", err));
  }, []);

  // Reusable fetch for running orders — used by the 5s poll, the popup's
  // Refresh button, and right after an order is placed/cancelled/finalized.
  const fetchRunningOrders = useCallback(async () => {
    setRunningLoading(true);
    try {
      const orders = await getRunningOrders();
      setRunningOrders(orders);
      setRunningCount(orders.length);
    } catch (err) {
      console.error("Failed to load running orders:", err);
    } finally {
      setRunningLoading(false);
    }
  }, []);
  const [tables, setTables] = useState<Table[]>([]);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  useEffect(() => {
    fetchRunningOrders();
    const interval = setInterval(fetchRunningOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchRunningOrders]);

  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const list = await getTables();
      setTables(list);
    } catch (err) {
      console.error("Failed to load tables:", err);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  function handleOpenTablePicker() {
    setOrderDetailsVisible(false);
    setTableModalVisible(true);
    fetchTables();
  }

  function handleSelectTable(table: Table) {
    setSelectedTable(table);
    setTableModalVisible(false);
    setOrderDetailsVisible(true);
  }

  function handleCloseTablePicker() {
    setTableModalVisible(false);
    setOrderDetailsVisible(true);
  }

  function tableLabelOf(t: Table | null): string | null {
    if (!t) return null;
    return String(t.table_no ?? t.name ?? t.id);
  }

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

  // --- Cart summary (drives the floating "View Cart" bar) ---
  const cartItemCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + Math.max(line.total - line.discount, 0),
    0
  );

  // "Choose Options" only makes sense for rice dishes (fried rice, steam
  // rice, etc.) which have swappable sides/add-ons. Everything else goes
  // straight into the cart with no modifiers and no popup in the way.
  function handleAddPress(item: MenuItem) {
    const isRiceItem = item.name.toLowerCase().includes("rice");
    if (isRiceItem) {
      setModalItem(item);
      setModalVisible(true);
    } else {
      handleConfirmAddToCart(item, []);
    }
  }

  function handleConfirmAddToCart(
    item: MenuItem,
    selectedModifiers: { id: number; name: string }[]
  ) {
    const price = numericPrice(item);
    setCart((prev) => {
      // If this exact item (same recipe_id, same modifiers) is already in
      // the cart, just bump the qty instead of adding a duplicate row.
      const modifierKey = selectedModifiers
        .map((m) => m.id)
        .sort((a, b) => a - b)
        .join(",");
      const existingIndex = prev.findIndex((line) => {
        const lineKey = line.modifiers
          .map((m) => m.menu_id)
          .sort((a, b) => a - b)
          .join(",");
        return line.recipe_id === item.id && lineKey === modifierKey;
      });

      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.qty + 1;
        updated[existingIndex] = {
          ...existing,
          qty: newQty,
          total: newQty * existing.price,
        };
        return updated;
      }

      const line: CartLine = {
        id: makeLineId(),
        row_id: "new",
        recipe_id: item.id,
        name: item.name,
        qty: 1,
        price,
        total: price,
        discount: 0,
        modifiers: selectedModifiers.map((m) => ({
          menu_id: m.id,
          name: m.name,
        })),
      };
      return [...prev, line];
    });
    // Jump straight into the cart popup so the user sees what they just added
    setCartVisible(true);
  }

  function handleViewCart() {
    setCartVisible(true);
  }

  function handleIncrementLine(id: string) {
    setCart((prev) =>
      prev.map((line) =>
        line.id === id
          ? { ...line, qty: line.qty + 1, total: (line.qty + 1) * line.price }
          : line
      )
    );
  }

  function handleDecrementLine(id: string) {
    setCart((prev) =>
      prev.map((line) =>
        line.id === id && line.qty > 1
          ? { ...line, qty: line.qty - 1, total: (line.qty - 1) * line.price }
          : line
      )
    );
  }

  function handleRemoveLine(id: string) {
    setCart((prev) => prev.filter((line) => line.id !== id));
  }

  function handleChangeDiscount(id: string, discount: number) {
    setCart((prev) =>
      prev.map((line) => (line.id === id ? { ...line, discount } : line))
    );
  }

  const handleChangeNote = (id: string, note: string) => {
    setCart((prev) =>
      prev.map((line) => (line.id === id ? { ...line, note } : line))
    );
  };

  function handleClearCart() {
    setCart([]);
  }

  // "Place Order" inside the cart popup just opens the Order Details popup —
  // the actual submission happens from there once order type / customer /
  // service charge etc. are confirmed.
  function handlePlaceOrder() {
    setOrderDetailsVisible(true);
  }

  function handleCancelOrderDetails() {
    setOrderDetailsVisible(false);
  }

  async function handleSubmitOrder(details: OrderDetailsForm) {
    setOrderSubmitting(true);
    try {
      // steward_id is required by the backend — "None" isn't a valid value
      // there, so fall back to the first real steward if nothing was picked.
      const fallbackStewardId = stewardOptions.find((s) => s.id !== "none")?.id;
      const stewardIdToSend =
        details.stewardId != null ? details.stewardId : fallbackStewardId;

      if (stewardIdToSend == null) {
        console.error("No steward available to assign to this order.");
        setOrderSubmitting(false);
        return;
      }

      const response = await createOrUpdateOrder({
        order_id: "new",
        order_type: details.orderType,
        customer: String(details.customerId),
        room: details.roomId != null ? String(details.roomId) : "",
        table_id: details.tableId != null ? details.tableId : null,
        steward_id: Number(stewardIdToSend),
        restaurant_id: DEFAULT_RESTAURANT_ID,
        service_charge: details.serviceChargeAmount,
        cart: cart.map((line) => ({
          recipe_id: line.recipe_id,
          name: line.name,
          qty: line.qty,
          price: line.price,
          total: line.total,
          row_id: line.row_id,
          modifiers: line.modifiers,
          note: line.note,
          discount: line.discount,
        })),
      });

      const newOrderId = response?.data?.order_id;

      // If "Finalize Immediately" was toggled on, open the Finalize Bill
      // popup instead of auto-finalizing — the user still needs to confirm
      // given amount / payment method / etc, same as the web app.
      if (details.finalizeImmediately && newOrderId) {
        setOrderDetailsVisible(false);
        setCart([]);
        setSelectedTable(null);
        setFinanceContext({
          orderId: newOrderId,
          total: details.total,
          source: "new-order",
          placedOrderInfo: {
            orderNumber: response?.data?.order_number ?? null,
            cart,
            subtotal: details.subtotal,
            serviceCharge: details.serviceChargeAmount,
          },
        });
        setFinanceVisible(true);
        setOrderSubmitting(false);
        fetchRunningOrders();
        return;
      }

      // Not finalizing immediately — order stays as a running order, show
      // the normal "Order Placed" confirmation.
      setPlacedOrder({
        orderId: newOrderId ?? null,
        orderNumber: response?.data?.order_number ?? null,
        cart,
        subtotal: details.subtotal,
        serviceCharge: details.serviceChargeAmount,
        total: details.total,
      });

      setOrderDetailsVisible(false);
      setCartVisible(false);
      setOrderPlacedVisible(true);
      setCart([]);
      setSelectedTable(null);
      fetchRunningOrders();
    } catch (err: any) {
      console.error(
        "Failed to place order - validation errors:",
        JSON.stringify(err.response?.data, null, 2)
      );
    } finally {
      setOrderSubmitting(false);
    }
  }

  function handleOrderPlacedDone() {
    setOrderPlacedVisible(false);
    setPlacedOrder(null);
  }

  // Kitchen has already marked an order Ready — too late to cancel from the
  // POS at that point, so block it here (before any cancel request ever
  // goes out) with a clear explanation instead of a silent failure or a
  // confusing backend error. Otherwise, open the reason-confirmation popup
  // instead of cancelling immediately.
 function handleCancelRunningOrder(order: RunningOrder) {
   setRunningOrdersVisible(false);
   setCancelTargetOrder(order);
   setCancelPopupVisible(true);
 }

  // Called from CancelOrderPopup's Submit button, once a reason has been
  // entered (or left blank, if the popup doesn't require one).
  async function handleSubmitCancelOrder(reason: string) {
    if (!cancelTargetOrder) return;
    setCancelSubmitting(true);
    try {
      await cancelOrder({ order_id: cancelTargetOrder.id, reason });
      setCancelPopupVisible(false);
      setCancelTargetOrder(null);
      fetchRunningOrders();
    } catch (err) {
      console.error("Failed to cancel order:", err);
    } finally {
      setCancelSubmitting(false);
    }
  }

  function handleCloseCancelPopup() {
    setCancelPopupVisible(false);
    setCancelTargetOrder(null);
  }

  function handleFinalizeRunningOrder(order: RunningOrder) {
    const raw = (order as any).total ?? (order as any).grand_total ?? 0;
    const total = typeof raw === "string" ? parseFloat(raw) : raw;
    const safeTotal = Number.isFinite(total) ? total : 0;

    setRunningOrdersVisible(false);
    setFinanceContext({
      orderId: order.id,
      total: safeTotal,
      source: "running-order",
    });
    setFinanceVisible(true);
  }

  async function handleSubmitFinalizeBill(form: FinalizeBillForm) {
    if (!financeContext) return;
    setFinanceSubmitting(true);
    try {
      // `card_terminal` is only required by the backend when payment_method
      // is "Card" — read it via `as any` since older FinalizeBillPopup
      // versions may not define `cardTerminal` on the form type yet.
      const cardTerminal = (form as any).cardTerminal as string | undefined;

      await finalizeOrder({
        order_id: financeContext.orderId,
        payment_method: form.paymentMethod,
        paid_amount: form.givenAmount,
        given_amount: form.givenAmount,
        change_amount: form.changeAmount,
        // FIX: backend requires "Y-m-d H:i:s" — form.date is date-only
        // (YYYY-MM-DD), so convert it before sending.
        order_date: formatDateTimeForBackend(form.date),
        customer_email: form.customerEmail || undefined,
        ...(form.paymentMethod === "Card" && cardTerminal
          ? { card_terminal: cardTerminal }
          : {}),
      });

      const wasNewOrder = financeContext.source === "new-order";
      const placedInfo = financeContext.placedOrderInfo;

      setFinanceVisible(false);
      setFinanceContext(null);

      if (wasNewOrder && placedInfo) {
        // Now show the normal "Order Placed" success popup for the order
        // that was just placed AND finalized.
        setPlacedOrder({
          orderId: financeContext.orderId,
          orderNumber: placedInfo.orderNumber,
          cart: placedInfo.cart,
          subtotal: placedInfo.subtotal,
          serviceCharge: placedInfo.serviceCharge,
          total: form.givenAmount - form.changeAmount, // = original total
        });
        setOrderPlacedVisible(true);
      }

      fetchRunningOrders();
    } catch (err: any) {
      console.error(
        "Failed to finalize order - validation errors:",
        JSON.stringify(err.response?.data, null, 2)
      );
    } finally {
      setFinanceSubmitting(false);
    }
  }

  function handleCloseFinalizeBill() {
    setFinanceVisible(false);
    setFinanceContext(null);
    fetchRunningOrders();
  }

  // TODO: hook these up to a dedicated screen/modal once that flow is built
  function handleUpdateRunningOrder(order: RunningOrder) {
    console.log("Update order", order.id);
  }
  function handleSplitRunningOrder(order: RunningOrder) {
    console.log("Split payment for order", order.id);
  }

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
        currentPage={activePage}
      />

      <AddToCartModal
        visible={modalVisible}
        item={modalItem}
        onClose={() => setModalVisible(false)}
        onAddToCart={handleConfirmAddToCart}
      />

      <CartPopup
        visible={cartVisible}
        cart={cart}
        onHide={() => setCartVisible(false)}
        onIncrement={handleIncrementLine}
        onDecrement={handleDecrementLine}
        onRemove={handleRemoveLine}
        onChangeDiscount={handleChangeDiscount}
        onChangeNote={handleChangeNote}
        onClearCart={handleClearCart}
        onPlaceOrder={handlePlaceOrder}
      />

      <OrderDetailsPopup
        visible={orderDetailsVisible}
        subtotal={cartTotal}
        onCancel={handleCancelOrderDetails}
        onSubmit={handleSubmitOrder}
        submitting={orderSubmitting}
        customers={customerOptions}
        stewards={stewardOptions}
        selectedTableId={selectedTable?.id ?? null}
        selectedTableLabel={tableLabelOf(selectedTable)}
        onOpenTablePicker={handleOpenTablePicker}
      />

      <OrderPlacedModal
        visible={orderPlacedVisible}
        orderId={placedOrder?.orderId ?? null}
        orderNumber={placedOrder?.orderNumber ?? null}
        cart={placedOrder?.cart ?? []}
        subtotal={placedOrder?.subtotal ?? 0}
        serviceCharge={placedOrder?.serviceCharge ?? 0}
        total={placedOrder?.total ?? 0}
        onDone={handleOrderPlacedDone}
      />

      <RunningOrdersPopup
        visible={runningOrdersVisible}
        orders={runningOrders}
        loading={runningLoading}
        onClose={() => setRunningOrdersVisible(false)}
        onRefresh={fetchRunningOrders}
        onCancel={handleCancelRunningOrder}
        onUpdate={handleUpdateRunningOrder}
        onFinalize={handleFinalizeRunningOrder}
        onSplit={handleSplitRunningOrder}
      />

      <FinalizeBillPopup
        visible={financeVisible}
        orderId={financeContext?.orderId ?? null}
        totalPayable={financeContext?.total ?? 0}
        submitting={financeSubmitting}
        onClose={handleCloseFinalizeBill}
        onSubmit={handleSubmitFinalizeBill}
      />

     <CancelOrderPopup
       visible={cancelPopupVisible}
       orderId={cancelTargetOrder?.id ?? null}
       isReady={cancelTargetOrder?.is_ready ?? false}
       submitting={cancelSubmitting}
       onClose={handleCloseCancelPopup}
       onSubmit={handleSubmitCancelOrder}
     />

      <TableSelectPopup
        visible={tableModalVisible}
        tables={tables}
        loading={tablesLoading}
        selectedTableId={selectedTable?.id ?? null}
        onClose={handleCloseTablePicker}
        onSelect={handleSelectTable}
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
        <TouchableOpacity
          style={styles.runningBadge}
          onPress={() => setRunningOrdersVisible(true)}
        >
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
          // Leave room at the bottom so the last card isn't hidden behind
          // the floating "View Cart" bar when the cart has items.
          {
            paddingBottom:
              insets.bottom + (cart.length > 0 ? 96 : 24),
          },
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

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => handleAddPress(item)}
              >
                <Text style={styles.addBtnText}>+ ADD</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Floating "View Cart" summary bar — shown only once something has
          been added to the cart. Mirrors the reference screenshot: item
          count + running total on the left, "View Cart" link on the right. */}
      {cart.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleViewCart}
          style={[
            styles.viewCartBar,
            { bottom: insets.bottom + 12 },
          ]}
        >
          <View>
            <Text style={styles.viewCartCount}>
              {cartItemCount} ITEM{cartItemCount !== 1 ? "S" : ""}
            </Text>
            <Text style={styles.viewCartTotal}>
              Rs. {cartTotal.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.viewCartLink}>View Cart</Text>
        </TouchableOpacity>
      )}
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
  // --- Floating "View Cart" bar ---
  viewCartBar: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#f4695f",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  viewCartCount: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.9,
    marginBottom: 2,
  },
  viewCartTotal: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  viewCartLink: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});