import apiClient from "./client";

// Shape is flexible since the exact backend field names aren't confirmed —
// adjust `room_no`/`name` below to match what your rooms endpoint actually
// returns once you've checked a real response.
export interface Room {
  id: number;
  room_no?: string;
  name?: string;
  [key: string]: any;
}

// NOTE: this endpoint wasn't in the route list you shared (only
// `customers`, `customer_rooms`, `customer_agency` were) — this is a guess
// following the same `api/pos/...` naming convention as the rest of the
// app. If your backend exposes rooms under a different path (e.g.
// `api/pos/all_rooms`, `api/rooms`, etc), just change the string below —
// nothing else in this file or the popup needs to change.
export const getRooms = async (): Promise<Room[]> => {
  const response = await apiClient.get("api/pos/rooms");
  return response.data.rooms ?? response.data.data ?? response.data;
};

// Kept in case per-customer room filtering is needed again later — not
// currently used by OrderDetailsPopup.
export const getCustomerRooms = async (
  customerId: number | string
): Promise<Room[]> => {
  const response = await apiClient.post("api/pos/customer_rooms", {
    customer_id: customerId,
  });
  return response.data.rooms ?? response.data.data ?? response.data;
};