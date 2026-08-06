


import apiClient from "./client";

// Field names are a best guess based on get_stewards' shape — check a real
// response from GET /api/pos/customers and adjust if needed.
export interface Customer {
  id: number | string;
  name: string;
  lname?: string;
  [key: string]: any;
}

export const getCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get("api/pos/customers");
  return response.data.customers ?? response.data.data ?? response.data;
};