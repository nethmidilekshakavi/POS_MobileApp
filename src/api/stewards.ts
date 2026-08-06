import apiClient from "./client";

export interface Steward {
  id: number;
  name: string;
  lname?: string;
  role?: string;
}

export const getStewards = async (): Promise<Steward[]> => {
  const response = await apiClient.get("api/pos/stewards");
  return response.data.stewards;
};