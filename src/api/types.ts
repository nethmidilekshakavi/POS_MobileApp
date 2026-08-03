export interface MenuCategory {
  id: number;
  category_name: string;
  hotel_id: number;
}

export interface MenuItem {
  id: number;
  name: string;
  original_price: number;
  final_price?: number;
  has_promotion?: boolean;
  promotion_percentage?: number;
  category_id?: number;
  image?: string;
}

export interface CartItemModifier {
  menu_id: number;
  name: string;
  qty?: number;
  quantity?: number;
}

export interface CartItem {
  recipe_id: number;
  name: string;
  qty: number;
  price: number;
  total: number;
  row_id?: string;
  modifiers?: CartItemModifier[];
  note?: string;
  discount?: number;
}

export interface CreateOrderPayload {
  order_id: string | number;
  order_type: string;
  customer?: string;
  room?: string;
  table_id?: number;
  steward_id?: number;
  restaurant_id: number;
  service_charge: number;
  cart: CartItem[];
}

export interface Order {
  id: number;
  order_id?: string;
  customer_name?: string;
  status: string;
  type?: string;
  total?: number;
  table_id?: number;
  restaurant_id?: number;
  hotel_id?: number;
  created_at: string;
  order_list_detail?: any[];
  kot_lists?: any[];
}

export interface RunningOrder {
  id: number;
  total: number;
  created_at: string;
  customer_name: string;
  room_number: string | null;
  table_id: number;
  steward_name: string;
  item_count: number;
  is_ready: boolean;
}

export interface Table {
  id: number;
  table_name: string;
  nu_of_chairs: number;
  order_count: number;
  orders?: Order[];
}

export interface Steward {
  id: number;
  name: string;
  lname: string;
  role: string;
}

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  check_in_date: string;
  check_out_date: string;
  room_numbers: string[];
}