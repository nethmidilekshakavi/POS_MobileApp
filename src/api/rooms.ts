import apiClient from "./client";

// Shape is flexible since the exact backend field names aren't confirmed —
// adjust `room_no`/`name` below to match Api\HotelController@get_customer_rooms
// once you've checked a real response.
export interface Room {
  id: number;
  room_no?: string;
  name?: string;
  [key: string]: any;
}

export const getCustomerRooms = async (
  customerId: number | string
): Promise<Room[]> => {
  const response = await apiClient.post("api/pos/customer_rooms", {
    customer_id: customerId,
  });
  // Handles a few common response shapes: { rooms: [...] }, { data: [...] },
  // or a bare array — keep whichever matches what your API actually returns
  // and drop the others.
  return response.data.rooms ?? response.data.data ?? response.data;
};