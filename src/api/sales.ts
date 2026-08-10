import apiClient from "./client";

// Matches routes/api.php: Route::get('sales', 'Api\HotelController@SelcteddaterangePOsSale')
// under prefix v1/pos (optional.sanctum). Field names below are a best
// guess based on the web dashboard's columns — check a real response and
// adjust PosSaleItem / PosSalesSummary if they don't match.

export interface PosSaleItem {
  item_name: string;
  price: number | string;
  quantity: number | string;
  amount: number | string;
  paid_status: string;
  [key: string]: any;
}

export interface PosSalesSummary {
  today_total_sale: number | string;
  today_total_cost: number | string;
  today_total_income: number | string;
  monthly_total_sale: number | string;
  monthly_total_cost: number | string;
  monthly_total_income: number | string;
  items: PosSaleItem[];
  [key: string]: any;
}

export const getPosSales = async (date: string): Promise<PosSalesSummary> => {
  const response = await apiClient.get("v1/pos/sales", {
    params: { date },
  });
  // Adjust if the real payload is nested under response.data.data instead.
  return response.data;
};