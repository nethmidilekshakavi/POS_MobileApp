import apiClient from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  user: {
    id: number;
    name: string;
    lname?: string;
    email: string;
    role?: string;
    hotel_id?: string;
    hotel_chain_id?: string;
    status?: string;
    hotel?: any;
    privilege?: any;
  };
}

export const loginUser = async (
  payload: LoginPayload
): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>("/api/login", payload);
  return response.data;
};