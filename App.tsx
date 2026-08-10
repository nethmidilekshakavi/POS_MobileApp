import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import LoadingScreen from "./src/screens/LoadingScreen";
import RestaurantDashboardScreen from "./src/screens/RestaurantDashboardScreen";
import RestaurantOrdersScreen from "./src/screens/RestaurantOrdersScreen";
// ⭐ FIX: this is the screen that actually mirrors the web "Menu" admin
// table (ID/Code/Price/Cost/Status/Availability/Actions + pagination).
// The old RestaurantMenuScreen import/usage below was swapped out because
// it expected an `onBack` prop that screen never accepted, and it hit
// different endpoints (category browsing) instead of `pos/menu_items`.
import MenuManagementScreen from "./src/screens/MenuManagementScreen";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";


// ======================================================
// PAGE TYPES
// ======================================================

type Page =
  | "loading"
  | "login"
  | "dashboard"
  | "history"
  | "restaurant-dashboard"
  | "restaurant-orders"
  | "menu-items";


// ======================================================
// STORAGE KEYS
// ======================================================

const AUTH_TOKEN_KEY = "auth_token";
const USER_NAME_KEY = "user_name";


// ======================================================
// SPLASH
// ======================================================

const MIN_SPLASH_MS = 1200;


// ======================================================
// HOME PAGE
// ======================================================

const HOME_PAGE: Page = "restaurant-dashboard";


// ======================================================
// APP
// ======================================================

export default function App() {
  const [currentPage, setCurrentPage] =
    useState<Page>("loading");

  const [userName, setUserName] = useState("");


  // ====================================================
  // CHECK LOGIN / RESTORE SESSION
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [token, savedName] =
          await Promise.all([
            AsyncStorage.getItem(
              AUTH_TOKEN_KEY
            ),
            AsyncStorage.getItem(
              USER_NAME_KEY
            ),
          ]);

        await new Promise((resolve) =>
          setTimeout(
            resolve,
            MIN_SPLASH_MS
          )
        );

        if (cancelled) return;

        if (token) {
          setUserName(
            savedName || "User"
          );

          setCurrentPage(
            HOME_PAGE
          );
        } else {
          setCurrentPage("login");
        }
      } catch (error) {
        console.error(
          "App bootstrap error:",
          error
        );

        if (!cancelled) {
          setCurrentPage("login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  // ====================================================
  // LOGIN
  // ====================================================

  const handleLoginSuccess = async (
    token: string,
    name?: string
  ) => {
    await AsyncStorage.setItem(
      AUTH_TOKEN_KEY,
      token
    );

    if (name) {
      await AsyncStorage.setItem(
        USER_NAME_KEY,
        name
      );
    }

    setUserName(
      name || "User"
    );

    setCurrentPage(
      HOME_PAGE
    );
  };


  // ====================================================
  // LOGOUT
  // ====================================================

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      AUTH_TOKEN_KEY,
      USER_NAME_KEY,
    ]);

    setUserName("");

    setCurrentPage("login");
  };


  // ====================================================
  // NAVIGATION
  // ====================================================

  const handleNavigate = (
    page: Page
  ) => {
    console.log(
      "NAVIGATE TO:",
      page
    );

    setCurrentPage(page);
  };


  // ====================================================
  // RENDER
  // ====================================================

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      {/* ================================================
          LOADING
      ================================================= */}

      {currentPage === "loading" && (
        <LoadingScreen />
      )}


      {/* ================================================
          LOGIN
      ================================================= */}

      {currentPage === "login" && (
        <LoginScreen
          onLoginSuccess={
            handleLoginSuccess
          }
        />
      )}


      {/* ================================================
          DASHBOARD
      ================================================= */}

      {currentPage === "dashboard" && (
        <DashboardScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) =>
            handleNavigate(
              page as Page
            )
          }
          activePage="dashboard"
        />
      )}


      {/* ================================================
          HISTORY
      ================================================= */}

      {currentPage === "history" && (
        <DashboardScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) =>
            handleNavigate(
              page as Page
            )
          }
          activePage="history"
        />
      )}


      {/* ================================================
          RESTAURANT HOME
      ================================================= */}

      {currentPage ===
        "restaurant-dashboard" && (
        <RestaurantDashboardScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) =>
            handleNavigate(
              page as Page
            )
          }
        />
      )}


      {/* ================================================
          ⭐ MENU ITEMS (admin table, matches the web page)
      ================================================= */}

      {currentPage === "menu-items" && (
        <MenuManagementScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) =>
            handleNavigate(
              page as Page
            )
          }
        />
      )}


      {/* ================================================
          RESTAURANT ORDERS
      ================================================= */}

      {currentPage ===
        "restaurant-orders" && (
        <RestaurantOrdersScreen
          onBack={() =>
            setCurrentPage(
              HOME_PAGE
            )
          }
        />
      )}
    </SafeAreaProvider>
  );
}