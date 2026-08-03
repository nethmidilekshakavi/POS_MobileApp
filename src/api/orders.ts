import apiClient from "./client";
import {
  Order,
  RunningOrder,
  CreateOrderPayload,
} from "./types";

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
}

export const getOrders = async (params?: GetOrdersParams) => {
  const response = await apiClient.get("api/pos/orders", { params });
  return response.data;
};

export const getOrder = async (id: number): Promise<Order> => {
  const response = await apiClient.get(`api/pos/orders/${id}`);
  return response.data;
};

export const createOrUpdateOrder = async (payload: CreateOrderPayload) => {
  const response = await apiClient.post("api/pos/orders", payload);
  return response.data;
};

export const finalizeOrder = async (payload: {
  order_id: number;
  payment_method: string;
  paid_amount: number;
  given_amount: number;
  change_amount: number;
  order_date: string;
}) => {
  const response = await apiClient.post("api/pos/orders/finalize", payload);
  return response.data;
};

export const cancelOrder = async (payload: {
  order_id: number;
  reason: string;
}) => {
  const response = await apiClient.post("api/pos/orders/cancel", payload);
  return response.data;
};

export const getRunningOrders = async (): Promise<RunningOrder[]> => {
  const response = await apiClient.get("api/pos/running_orders");
  return response.data.orders;
};

export const openOrder = async (order_id: number) => {
  const response = await apiClient.post("api/pos/open_order", { order_id });
  return response.data;
};

export const getOrderStatus = async (order_id: number) => {
  const response = await apiClient.post("api/pos/order_status", { order_id });
  return response.data;
};

export const syncOrder = async (order_id: number, order_data: string) => {
  const response = await apiClient.post("api/pos/sync_order", {
    order_id,
    order_data,
  });
  return response.data;
};

export const getOrderInvoice = async (order_id: number) => {
  const response = await apiClient.get(`api/pos/orders/${order_id}/invoice`);
  return response.data;
};

export const processSplitPayments = async (
  order_id: number,
  total_amount: number,
  service_charge: number,
  payers: string
) => {
  const response = await apiClient.post("api/pos/process_split_payments", {
    order_id,
    total_amount,
    service_charge,
    payers,
  });
  return response.data;
};