import apiClient from "./client";
import { MenuCategory, MenuItem } from "./types";

export const getMenuCategories = async (): Promise<MenuCategory[]> => {
  const response = await apiClient.get("/pos/menu_categories");
  return response.data.categories;
};

export const getMenusByCategory = async (
  category_id: number
): Promise<MenuItem[]> => {
  const response = await apiClient.get("/pos/menus_by_category", {
    params: { category_id },
  });
  return response.data.menus;
};

export const searchMenus = async (search: string): Promise<MenuItem[]> => {
  const response = await apiClient.get("/pos/search_menus", {
    params: { search },
  });
  return response.data.menus;
};

export const previewAddToCart = async (menu_id: number) => {
  const response = await apiClient.get("/pos/menus/preview_add_to_cart", {
    params: { menu_id },
  });
  return response.data;
};
