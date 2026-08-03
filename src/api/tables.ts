import apiClient from "./client";
import { Table, Steward } from "./types";

export const getTables = async (): Promise<Table[]> => {
  const response = await apiClient.get("/pos/tables");
  return response.data.tables;
};

export const getStewards = async (): Promise<Steward[]> => {
  const response = await apiClient.get("/pos/stewards");
  return response.data.stewards;
};