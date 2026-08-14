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

export type Order = {
  id: number | string;
  order_id?: string | number;
  order_id_display?: string | number;
  order_number?: string;
  customer_name?: string | null;
  status?: string;
  total?: number;
  amount?: number;
  payment_type?: string;
  payment_method?: string;
  created_at?: string;
  items?: any[];
};

export type RunningOrder = {
  id: number;
  order_id: string;
  status: string;
  is_ready?: boolean;   // <-- add this
  customer_name?: string;
  created_at?: string;
};

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