import apiClient from "./client";

export const getHotelSettings = async () => {
  const response = await apiClient.get("/pos/hotel_settings");
  return response.data.settings;
};

export const getCashbooks = async () => {
  const response = await apiClient.get("/pos/cashbooks");
  return response.data.cashbooks;
};

export const authorizeAction = async (
  email: string,
  password: string,
  action_type: string,
  action_description: string,
  order_id?: number
) => {
  const response = await apiClient.post("/pos/authorize_action", {
    email,
    password,
    action_type,
    action_description,
    order_id,
  });
  return response.data;
};