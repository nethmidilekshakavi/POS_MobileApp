import apiClient from "./client";
import { Table } from "./types";

export interface Table {
  id: number | string;
  table_no?: string | number;
  name?: string;
  number_of_chairs?: number;
  chairs?: number;
  has_order?: boolean;
  order_id?: number | string | null;
  order_status?: string | null;
  [key: string]: any;
}

export const getTables = async (): Promise<Table[]> => {
  const response = await apiClient.get("api/pos/tables");
  return response.data.tables ?? response.data.data ?? response.data;
};


