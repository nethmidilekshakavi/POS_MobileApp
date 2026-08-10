import apiClient from "./client";
import { Order, RunningOrder } from "./types";

export interface GetOrdersParams {
  search?: string;
  type?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  restaurant_id?: number;
  table_id?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  per_page?: number;
  page?: number;
}

export const getOrders = async (params?: GetOrdersParams) => {
  const res = await apiClient.get("api/pos/orders", { params });
  return res.data;
};

export const getOrder = async (id: number | string): Promise<Order> => {
  const res = await apiClient.get(`api/pos/orders/${id}`);
  return res.data;
};

export const createOrUpdateOrder = async (payload: any) => {
  const res = await apiClient.post("api/pos/orders", payload);
  return res.data;
};

export const finalizeOrder = async (payload: any) => {
  const res = await apiClient.post("api/pos/orders/finalize", payload);
  return res.data;
};

export const cancelOrder = async (payload: { order_id: number | string; reason: string }) => {
  const res = await apiClient.post("api/pos/orders/cancel", payload);
  return res.data;
};

export const getRunningOrders = async (): Promise<RunningOrder[]> => {
  const res = await apiClient.get("api/pos/running_orders");
  return res.data?.orders ?? res.data;
};

export const openOrder = async (order_id: number | string) => {
  const res = await apiClient.post("api/pos/open_order", { order_id });
  return res.data;
};

export const getOrderStatus = async (order_id: number | string) => {
  const res = await apiClient.post("api/pos/order_status", { order_id });
  return res.data;
};

export const syncOrder = async (order_id: number | string, order_data: any) => {
  const res = await apiClient.post("api/pos/sync_order", { order_id, order_data });
  return res.data;
};

export const getOrderInvoice = async (order_id: number | string) => {
  const res = await apiClient.get(`api/pos/orders/${order_id}/invoice`);
  return res.data;
};