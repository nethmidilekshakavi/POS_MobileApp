import apiClient from "./client";

// Matches the real response shape from GET /api/pos/customers:
// { success: true, customers: [{ id, first_name, last_name, check_in_date,
//   check_out_date, room_numbers: string[] }] }
export interface Customer {
  id: number | string;
  first_name: string;
  last_name?: string;
  check_in_date?: string;
  check_out_date?: string;
  room_numbers?: string[];
  [key: string]: any;
}

export const getCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get("api/pos/customers");
  return response.data.customers ?? response.data.data ?? response.data;
};