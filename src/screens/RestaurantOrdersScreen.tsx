import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Share,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = "auth_token";
const API_BASE_URL = "https://live.trackerstay.com";

interface RestaurantOrdersScreenProps {
  onBack: () => void;
}

interface OrderRow {
  id: number;
  order_id: string;
  customer_name: string | null;
  status: string;
  type: string;
  total?: number | string;
  amount?: number | string;
  payment_type?: string;
  payment_method?: string;
  created_at: string;
}

interface OrdersResponse {
  data: OrderRow[];
  current_page: number;
  last_page: number;
  total: number;
}

// --- Invoice popup types ---
// The POS API doc only confirms this endpoint returns { success, order, invoice_url }
// without documenting "order"'s exact shape, so parsing below is defensive —
// it tries several likely field/key names instead of assuming one structure.
//
// >>> If items/address/phone still show blank on a real order, open the RN
// debugger / Metro console right after tapping "View" — handleViewInvoice()
// below logs the raw JSON as "INVOICE RAW RESPONSE". Copy that JSON and use
// it to tighten pickInvoiceItems / pickAddressLines / pickPhone so they read
// the exact keys the backend actually sends for that order type.
interface InvoiceLineItem {
  itemId: string;
  description: string;
  price: number;
  qty: number;
  amount: number;
}

interface InvoiceView {
  invoiceId: string;
  createdAt: string;
  status: string;
  paymentType: string;
  brandName: string;
  issuerAddressLines: string[];
  issuerPhone: string | null;
  customerName: string;
  addressLines: string[];
  phone: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  serviceCharge: number;
  paidAmount: number;
  balanceDue: number;
  grandTotal: number;
}

// Shared palette — keep in sync with the rest of the app
const COLORS = {
  primary: "#f4695f",
  primaryLight: "#fdece9",
  primaryDark: "#d94a40",
  dark: "#1a1a2e",
  gray: "#6b7280",
  grayLight: "#9ca3af",
  border: "#e5e7eb",
  borderLight: "#f0f0f0",
  bg: "#ffffff",
  cardBg: "#fcfcfd",
  purple: "#6366f1",
  purpleLight: "#ede9fe",
  green: "#22c55e",
  greenLight: "#dcfce7",
  amber: "#f59e0b",
  amberLight: "#fef3c7",
  red: "#ef4444",
  redLight: "#fee2e2",
  grayPillBg: "#f3f4f6",
};

function money(value: number | string | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number).toFixed(0) : "0";
}

function toNumber(value: any): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? (n as number) : 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", " |");
}

function statusStyle(status: string): { color: string; bg: string } {
  const s = status.toLowerCase();
  if (s.includes("complete")) return { color: COLORS.green, bg: COLORS.greenLight };
  if (s.includes("processing")) return { color: COLORS.amber, bg: COLORS.amberLight };
  if (s.includes("cancel")) return { color: COLORS.red, bg: COLORS.redLight };
  return { color: COLORS.gray, bg: COLORS.grayPillBg };
}

// Tries several likely locations/keys for the items array inside an
// invoice/order payload of unknown shape.
function pickInvoiceItems(order: any): InvoiceLineItem[] {
  const rawList: any[] =
    order?.items ??
    order?.order_items ??
    order?.orderItems ??
    order?.cart ??
    order?.cart_items ??
    order?.order_list_detail ??
    order?.details ??
    order?.order_details ??
    order?.products ??
    [];

  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  return rawList.map((raw, idx) => {
    // order_list_detail rows can nest the actual item under a few possible
    // shapes depending on backend version — check the common ones.
    const src =
      raw?.menu ?? raw?.recipe ?? raw?.item ?? raw?.product ?? raw?.menu_item ?? raw;
    // Matches the web invoice's "ITEM ID" column — that's the recipe/menu
    // item's own code (e.g. 24209), not the row/detail id.
    const itemId =
      src?.item_code ??
      src?.recipe_id ??
      src?.menu_id ??
      src?.menu_item_id ??
      src?.product_id ??
      src?.id ??
      raw?.menu_id ??
      raw?.id ??
      String(idx + 1);
    const description =
      raw?.recipe_name ??
      src?.recipe_name ??
      src?.item_name ??
      src?.name ??
      src?.title ??
      src?.product_name ??
      src?.menu_name ??
      raw?.item_name ??
      raw?.name ??
      raw?.title ??
      raw?.description ??
      "Item";
    const price = toNumber(
      src?.price ?? src?.unit_price ?? raw?.price ?? raw?.unit_price ?? raw?.rate
    );
    const qty = toNumber(raw?.qty ?? raw?.quantity ?? raw?.count ?? 1) || 1;
    const amount =
      toNumber(raw?.total ?? raw?.amount ?? raw?.sub_total ?? raw?.line_total) ||
      price * qty;
    return { itemId: String(itemId), description: String(description), price, qty, amount };
  });
}

// Resolves who goes in the "bill to" block. Prefers an explicit
// customer_name on the order, or the guest's own name/address/phone from a
// linked reservation. If neither exists (e.g. a true walk-in with no
// customer selected), it shows a plain "Walk-in Customer" — it does NOT
// fall back to showing the property's own name/address/phone here, since
// that's not the customer's info. (The hotel's name is still shown
// separately as the invoice's brand header — see brandName.)
function resolveBillTo(
  order: any,
  fallback: OrderRow
): { name: string; addressLines: string[]; phone: string | null } {
  const reservation = order?.reservation ?? order?.booking ?? {};
  const customer = order?.customer ?? order?.guest ?? order?.billing ?? {};

  const explicitName: string | null =
    order?.customer_name ??
    customer?.name ??
    customer?.full_name ??
    (reservation?.first_name || reservation?.last_name
      ? [reservation?.first_name, reservation?.last_name].filter(Boolean).join(" ")
      : null) ??
    null;

  if (explicitName) {
    const line1 =
      order?.address ??
      order?.customer_address ??
      customer?.address ??
      customer?.street ??
      reservation?.address ??
      null;
    const cityCountry = [
      order?.city ?? customer?.city,
      order?.country ?? customer?.country ?? reservation?.country,
    ]
      .filter(Boolean)
      .join(", ");
    const phone =
      order?.phone ??
      order?.contact_number ??
      customer?.phone ??
      customer?.mobile ??
      reservation?.phone ??
      null;
    return {
      name: explicitName,
      addressLines: [line1, cityCountry].filter(Boolean) as string[],
      phone,
    };
  }

  // No real customer on the order — plain walk-in, nothing more to show.
  return {
    name: fallback.customer_name || "Walk-in Customer",
    addressLines: [],
    phone: null,
  };
}

// Builds a normalized InvoiceView from whatever the invoice endpoint returns,
// falling back to the order row already loaded in the list for anything the
// invoice payload doesn't include.
function buildInvoiceView(json: any, fallback: OrderRow): InvoiceView {
  const order = json?.order ?? json?.data ?? json ?? {};

  const items = pickInvoiceItems(order);
  const subtotal =
    toNumber(order?.sub_total ?? order?.subtotal) ||
    items.reduce((sum, it) => sum + it.amount, 0) ||
    toNumber(fallback.total ?? fallback.amount);
  const serviceCharge = toNumber(order?.service_charge ?? order?.serviceCharge);
  const grandTotal =
    toNumber(order?.grand_total ?? order?.total) || subtotal + serviceCharge;
  // Web invoice shows "PAID (Rs.3300 - Rs.3300 = Rs.0)" i.e. grand total,
  // paid amount, and the balance due — mirror that exactly.
  const paidAmount = toNumber(order?.paid_amount ?? order?.paidAmount) || grandTotal;
  const balanceDue =
    order?.due_amount !== undefined
      ? toNumber(order?.due_amount)
      : Math.max(grandTotal - paidAmount, 0);

  // If nothing itemized came back, show one summary row so the popup never
  // renders an empty table.
  const finalItems: InvoiceLineItem[] =
    items.length > 0
      ? items
      : [
          {
            itemId: String(fallback.order_id ?? fallback.id),
            description: "Order Items",
            price: subtotal,
            qty: 1,
            amount: subtotal,
          },
        ];

  const billTo = resolveBillTo(order, fallback);

  // The hotel's own name/address/phone — always shown as the invoice
  // issuer, regardless of whether a customer is set on the order.
  const hotel = order?.hotel ?? {};
  const issuerCityCountry = [hotel?.city, hotel?.country].filter(Boolean).join(", ");
  const issuerAddressLines = [hotel?.address, issuerCityCountry].filter(Boolean) as string[];
  const issuerPhone = hotel?.number ?? hotel?.phone ?? null;

  return {
    invoiceId: String(order?.order_id ?? order?.id ?? fallback.order_id ?? fallback.id),
    createdAt: order?.created_at ?? fallback.created_at,
    status: order?.status ?? fallback.status,
    paymentType:
      order?.payment_type ??
      order?.payment_method ??
      fallback.payment_type ??
      fallback.payment_method ??
      "-",
    brandName: hotel?.hotel_name ?? "Trackerstay",
    issuerAddressLines,
    issuerPhone,
    customerName: billTo.name,
    addressLines: billTo.addressLines,
    phone: billTo.phone,
    items: finalItems,
    subtotal,
    serviceCharge,
    paidAmount,
    balanceDue,
    grandTotal,
  };
}

export default function RestaurantOrdersScreen({
  onBack,
}: RestaurantOrdersScreenProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);

  // --- Invoice popup state ---
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);

  // Debounce search input so we don't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const params = new URLSearchParams({
        per_page: "10",
        sort_by: "id",
        sort_order: "desc",
        page: String(page),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`${API_BASE_URL}/api/pos/orders?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: OrdersResponse = await res.json();
      setOrders(json.data ?? []);
      setTotal(json.total ?? 0);
      setLastPage(json.last_page ?? 1);
    } catch (err: any) {
      console.error("Failed to load restaurant orders:", err);
      setError(err?.message ?? "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function handleCancel(order: OrderRow) {
    setActionOrderId(order.id);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(`${API_BASE_URL}/api/pos/orders/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_id: order.id, reason: "Cancelled from mobile app" }),
      });
      if (!res.ok) throw new Error(`Cancel failed (${res.status})`);
      await fetchOrders();
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      setError(err?.message ?? "Failed to cancel order");
    } finally {
      setActionOrderId(null);
    }
  }

  // Opens the popup immediately with a loading state, then fills it in
  // once /orders/{id}/invoice responds — feels instant instead of waiting
  // on the network before anything shows.
  async function handleViewInvoice(order: OrderRow) {
    setInvoice(null);
    setInvoiceError(null);
    setInvoiceVisible(true);
    setInvoiceLoading(true);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(`${API_BASE_URL}/api/pos/orders/${order.id}/invoice`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      // TEMP DEBUG: check Metro / RN debugger console for this after tapping
      // "View" on an order — copy the printed JSON if fields are still
      // missing so pickInvoiceItems / pickAddressLines / pickPhone can be
      // tightened to the exact keys the backend sends. Safe to remove once
      // the shape is confirmed.
      console.log("INVOICE RAW RESPONSE", JSON.stringify(json, null, 2));
      setInvoice(buildInvoiceView(json, order));
    } catch (err: any) {
      console.error("Failed to load invoice:", err);
      setInvoiceError(err?.message ?? "Failed to load invoice");
      // Still show something useful from what we already had in the list.
      setInvoice(buildInvoiceView({}, order));
    } finally {
      setInvoiceLoading(false);
    }
  }

  function closeInvoice() {
    setInvoiceVisible(false);
    setInvoice(null);
    setInvoiceError(null);
  }

  async function handleShareInvoice() {
    if (!invoice) return;
    const brand = invoice.brandName;
    const lines = [
      `${brand} — Invoice #${invoice.invoiceId}`,
      ...invoice.issuerAddressLines,
      invoice.issuerPhone ? `Tel: ${invoice.issuerPhone}` : "",
      "",
      `Date: ${formatDate(invoice.createdAt)}`,
      `Status: ${invoice.status}   Payment: ${invoice.paymentType}`,
      `Customer: ${invoice.customerName}`,
      ...invoice.addressLines,
      invoice.phone ? `Phone: ${invoice.phone}` : "",
      "",
      ...invoice.items.map(
        (it) => `[${it.itemId}] ${it.description}  x${it.qty}  Rs.${money(it.amount)}`
      ),
      "",
      `Subtotal: Rs.${money(invoice.subtotal)}`,
      `Service Charge: Rs.${money(invoice.serviceCharge)}`,
      `Paid: (Rs.${money(invoice.grandTotal)} - Rs.${money(invoice.paidAmount)} = Rs.${money(invoice.balanceDue)})`,
      `Grand Total: Rs.${money(invoice.grandTotal)}`,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch (err) {
      console.error("Failed to share invoice:", err);
    }
  }

  const showPayButton = useMemo(
    () => (order: OrderRow) =>
      (order.payment_type ?? order.payment_method ?? "").toLowerCase().includes("pay later"),
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Orders</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.totalPill}>
              <View style={styles.totalDot} />
              <Text style={styles.totalText}>
                You have total <Text style={styles.totalTextBold}>{total}</Text> invoices
              </Text>
            </View>

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Type in to Search"
                placeholderTextColor={COLORS.grayLight}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {loading && (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 16 }} />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const status = statusStyle(item.status);
          return (
            <View style={styles.card}>
              <View style={styles.cardRowTop}>
                <Text style={styles.orderId}>#{item.order_id ?? item.id}</Text>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>

              <View style={styles.divider} />

              <View style={styles.cardRow}>
                <Text style={styles.label}>Customer</Text>
                <Text style={styles.value}>{item.customer_name ?? "Walk-in Customer"}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Amount</Text>
                <Text style={styles.amountValue}>Rs. {money(item.total ?? item.amount)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Payment</Text>
                <Text style={styles.value}>
                  {item.payment_type ?? item.payment_method ?? "-"}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
                  <Text style={styles.iconBtnText}>🖨️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewBtn}
                  activeOpacity={0.85}
                  onPress={() => handleViewInvoice(item)}
                >
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
                {showPayButton(item) && (
                  <TouchableOpacity style={styles.payBtn} activeOpacity={0.85}>
                    <Text style={styles.payBtnText}>Pay</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.cancelIconBtn}
                  onPress={() => handleCancel(item)}
                  disabled={actionOrderId === item.id}
                  activeOpacity={0.7}
                >
                  {actionOrderId === item.id ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.cancelIconBtnText}>✕</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyState}>No orders found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !loading && orders.length > 0 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text style={styles.pageBtnText}>‹ Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>
                Page {page} of {lastPage}
              </Text>
              <TouchableOpacity
                style={[styles.pageBtn, page >= lastPage && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
              >
                <Text style={styles.pageBtnText}>Next ›</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* --- Invoice popup --- */}
      <Modal
        visible={invoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={closeInvoice}
      >
        <View style={styles.invoiceOverlay}>
          <View style={[styles.invoiceSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.invoiceHeaderRow}>
              <TouchableOpacity onPress={closeInvoice} style={styles.invoiceCloseBtn} activeOpacity={0.7}>
                <Text style={styles.invoiceCloseBtnText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.invoiceHeaderTitle}>
                Invoice {invoice ? `#${invoice.invoiceId}` : ""}
              </Text>
              <TouchableOpacity
                onPress={handleShareInvoice}
                style={styles.invoiceShareBtn}
                activeOpacity={0.7}
                disabled={!invoice}
              >
                <Text style={{ fontSize: 15 }}>🖨️</Text>
              </TouchableOpacity>
            </View>

            {invoiceLoading && !invoice ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                {invoiceError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{invoiceError}</Text>
                  </View>
                )}

                {invoice && (
                  <>
                    <Text style={styles.invoiceBrand}>{invoice.brandName}</Text>
                    {(invoice.issuerAddressLines.length > 0 || invoice.issuerPhone) && (
                      <View style={styles.invoiceIssuerBlock}>
                        {invoice.issuerAddressLines.map((line, idx) => (
                          <Text key={idx} style={styles.invoiceIssuerText}>
                            {line}
                          </Text>
                        ))}
                        {!!invoice.issuerPhone && (
                          <Text style={styles.invoiceIssuerText}>{invoice.issuerPhone}</Text>
                        )}
                      </View>
                    )}

                    <View style={styles.invoiceMetaRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invoiceMetaLabel}>INVOICE</Text>
                        <Text style={styles.invoiceCustomerName}>{invoice.customerName}</Text>
                        {invoice.addressLines.map((line, idx) => (
                          <Text key={idx} style={styles.invoiceMetaValue}>
                            📍 {line}
                          </Text>
                        ))}
                        {!!invoice.phone && (
                          <Text style={styles.invoiceMetaValue}>📞 {invoice.phone}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.invoiceInfoBox}>
                      <View style={styles.invoiceInfoRow}>
                        <Text style={styles.invoiceInfoLabel}>Invoice ID</Text>
                        <Text style={styles.invoiceInfoValue}>{invoice.invoiceId}</Text>
                      </View>
                      <View style={styles.invoiceInfoRow}>
                        <Text style={styles.invoiceInfoLabel}>Date</Text>
                        <Text style={styles.invoiceInfoValue}>{formatDate(invoice.createdAt)}</Text>
                      </View>
                      <View style={styles.invoiceInfoRow}>
                        <Text style={styles.invoiceInfoLabel}>Status</Text>
                        <Text style={styles.invoiceInfoValue}>{invoice.status}</Text>
                      </View>
                      <View style={styles.invoiceInfoRow}>
                        <Text style={styles.invoiceInfoLabel}>Payment Type</Text>
                        <Text style={styles.invoiceInfoValue}>{invoice.paymentType}</Text>
                      </View>
                    </View>

                    {/* Item cards — same fields as the web table (Item ID,
                        Description, Price, Qty, Amount), stacked instead of
                        5 columns since a phone screen can't fit them side by
                        side without truncating. */}
                    {invoice.items.map((it, idx) => (
                      <View
                        key={`${it.itemId}_${idx}`}
                        style={[
                          styles.invoiceItemRow,
                          idx % 2 === 1 && { backgroundColor: COLORS.cardBg },
                        ]}
                      >
                        <View style={styles.invoiceItemTopRow}>
                          <Text style={styles.invoiceItemName} numberOfLines={2}>
                            {it.description}
                          </Text>
                          <Text style={styles.invoiceItemId}>ID {it.itemId}</Text>
                        </View>
                        <View style={styles.invoiceItemBottomRow}>
                          <Text style={styles.invoiceItemMeta}>
                            Rs. {money(it.price)} × {it.qty}
                          </Text>
                          <Text style={styles.invoiceItemAmount}>Rs. {money(it.amount)}</Text>
                        </View>
                      </View>
                    ))}

                    <View style={styles.invoiceTotalsBox}>
                      <View style={styles.invoiceTotalRow}>
                        <Text style={styles.invoiceTotalLabel}>Subtotal</Text>
                        <Text style={styles.invoiceTotalValue}>Rs. {money(invoice.subtotal)}</Text>
                      </View>
                      <View style={styles.invoiceTotalRow}>
                        <Text style={styles.invoiceTotalLabel}>Service Charge</Text>
                        <Text style={styles.invoiceTotalValue}>Rs. {money(invoice.serviceCharge)}</Text>
                      </View>
                      <View style={styles.invoiceTotalRow}>
                        <Text style={styles.invoiceTotalLabel}>PAID</Text>
                        <Text style={styles.invoiceTotalValue}>
                          (Rs.{money(invoice.grandTotal)} - Rs.{money(invoice.paidAmount)} = Rs.
                          {money(invoice.balanceDue)})
                        </Text>
                      </View>
                      <View style={styles.invoiceDivider} />
                      <View style={styles.invoiceTotalRow}>
                        <Text style={styles.invoiceGrandLabel}>Grand Total</Text>
                        <Text style={styles.invoiceGrandValue}>Rs. {money(invoice.grandTotal)}</Text>
                      </View>
                    </View>

                    <Text style={styles.invoiceFootnote}>
                      This invoice was generated electronically and does not require a
                      signature or seal. Payments made are non-refundable.
                    </Text>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.bg,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 28,
    color: COLORS.dark,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.dark,
    letterSpacing: 0.2,
  },
  totalPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 18,
    marginBottom: 16,
    gap: 7,
  },
  totalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  totalText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  totalTextBold: {
    color: COLORS.primary,
    fontWeight: "800",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBg,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.dark,
  },
  errorBox: {
    backgroundColor: COLORS.redLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  errorText: {
    color: COLORS.red,
    fontWeight: "600",
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    backgroundColor: COLORS.cardBg,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  cardRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.dark,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 12,
    color: COLORS.grayLight,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: "700",
  },
  amountValue: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.grayPillBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 15,
  },
  // View button — now the app's pink/primary color instead of purple, so it
  // reads as the main action on the card (matches the app's accent color).
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  payBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.dark,
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  cancelIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.redLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelIconBtnText: {
    fontSize: 15,
    color: COLORS.red,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyState: {
    textAlign: "center",
    color: COLORS.grayLight,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.dark,
  },
  pageIndicator: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },

  // --- Invoice popup styles ---
  invoiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(26,26,46,0.55)",
    justifyContent: "flex-end",
  },
  invoiceSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 20,
    maxHeight: "90%",
  },
  invoiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  invoiceCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.grayPillBg,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceCloseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.dark,
  },
  invoiceShareBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.dark,
  },
  invoiceBrand: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
    marginBottom: 4,
  },
  invoiceIssuerBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  invoiceIssuerText: {
    fontSize: 12,
    color: COLORS.grayLight,
    lineHeight: 17,
  },
  invoiceMetaRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  invoiceMetaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.grayLight,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  invoiceCustomerName: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.dark,
    marginBottom: 2,
  },
  invoiceMetaValue: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  invoiceInfoBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 18,
  },
  invoiceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  invoiceInfoLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  invoiceInfoValue: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: "700",
  },
  invoiceItemRow: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
  },
  invoiceItemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  invoiceItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.dark,
  },
  invoiceItemId: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  invoiceItemBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  invoiceItemMeta: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "600",
  },
  invoiceItemAmount: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: "800",
  },
  invoiceTotalsBox: {
    marginTop: 16,
    paddingTop: 4,
  },
  invoiceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  invoiceTotalLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  invoiceTotalValue: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: "700",
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  invoiceGrandLabel: {
    fontSize: 15,
    color: COLORS.dark,
    fontWeight: "800",
  },
  invoiceGrandValue: {
    fontSize: 17,
    color: COLORS.primary,
    fontWeight: "800",
  },
  invoiceFootnote: {
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 18,
    lineHeight: 16,
    fontStyle: "italic",
  },
});