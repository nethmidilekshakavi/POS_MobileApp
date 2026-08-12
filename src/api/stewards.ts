import apiClient from "./client";

export interface Steward {
  id: number;
  name: string;
  lname?: string;
  role?: string;
}

export const getStewards = async (): Promise<Steward[]> => {
  const response = await apiClient.get("api/pos/stewards");
  console.log("STEWARDS RAW RESPONSE:", JSON.stringify(response.data, null, 2));
  return response.data.stewards ?? response.data.data ?? response.data ?? [];
};