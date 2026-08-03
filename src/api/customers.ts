import apiClient from "./client";
import { Customer } from "./types";

export const getCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get("/pos/customers");
  return response.data.customers;
};

export const getCustomerRooms = async (reservation_id: number) => {
  const response = await apiClient.post("/pos/customer_rooms", {
    reservation_id,
  });
  return response.data;
};