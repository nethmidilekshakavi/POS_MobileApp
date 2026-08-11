import apiClient from "./client";
import { MenuCategory, MenuItem } from "./types";

export const getMenuCategories = async (): Promise<MenuCategory[]> => {
  const response = await apiClient.get("api/pos/menu_categories");
  return response.data.categories;
};

/**
 * Simpler category list used to populate the "Select Category" dropdown in
 * the Edit Menu Item popup. Endpoint returns { id, name, status } per
 * category (note: "name", not "category_name" like /menu_categories).
 */
export const getMenuCategoryList = async (): Promise<MenuCategory[]> => {
  const response = await apiClient.get("api/pos/menu_category_list");
  return response.data.categories;
};

export const getMenusByCategory = async (
  category_id: number
): Promise<MenuItem[]> => {
  const response = await apiClient.get("api/pos/menus_by_category", {
    params: { category_id },
  });
  return response.data.menus;
};

export const searchMenus = async (search: string): Promise<MenuItem[]> => {
  const response = await apiClient.get("api/pos/search_menus", {
    params: { search },
  });
  return response.data.menus;
};

export const previewAddToCart = async (menu_id: number) => {
  const response = await apiClient.get("api/pos/menus/preview_add_to_cart", {
    params: { menu_id },
  });
  return response.data;
};

/**
 * Fetch the full detail of a single menu item, used to prefill the
 * Edit Menu Item popup.
 *
 * NOTE: api/pos/menu_item/{id} does NOT return category or restaurant
 * relations (confirmed via testing — it only returns id/price/name/image/
 * status/combo etc). api/v1/menus/{id} DOES return them
 * (recipe_category[] + restaurant[] with pivot data), so the edit popup
 * must use this endpoint instead.
 */
export const getMenuItemDetail = async (id: number) => {
  const response = await apiClient.get(`api/v1/menus/${id}`);
  return response.data?.menu ?? response.data;
};

/**
 * Save changes made in the Edit Menu Item popup.
 * `payload` can be a plain object or a FormData instance (FormData is used
 * whenever a new recipe image is attached, since the endpoint then needs a
 * multipart/form-data request).
 *
 * NOTE: this calls POST /api/pos/menu_item/{id}/update, matching the
 * "{id}/update" convention already used elsewhere in this API (bookings,
 * checklists, etc). That route does not exist yet in api.php — add it plus
 * a controller method before this will actually persist anything. See
 * route_snippet.txt / update_menu_item_controller_stub.php.
 */
export const updateMenuItem = async (
  id: number,
  payload: FormData | Record<string, any>
) => {
  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;

  const response = await apiClient.post(
    `api/pos/menu_item/${id}/update`,
    payload,
    isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
  );
  return response.data;
};