import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import LoadingScreen from "./src/screens/LoadingScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";

type Page = "loading" | "login" | "dashboard" | "history";

const AUTH_TOKEN_KEY = "auth_token";
const USER_NAME_KEY = "user_name";

// Splash stays up at least this long so it doesn't just flash on a fast
// AsyncStorage read. Bumped up so it doesn't feel rushed.
const MIN_SPLASH_MS = 2500;

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("loading");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [token, savedName] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_NAME_KEY),
      ]);

      await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
      if (cancelled) return;

      if (token) {
        setUserName(savedName || "User");
        setCurrentPage("dashboard");
      } else {
        setCurrentPage("login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoginSuccess = async (token: string, name?: string) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    if (name) await AsyncStorage.setItem(USER_NAME_KEY, name);
    setUserName(name || "User");
    setCurrentPage("dashboard");
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_NAME_KEY]);
    setCurrentPage("login");
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {currentPage === "loading" && <LoadingScreen />}
      {currentPage === "login" && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      {(currentPage === "dashboard" || currentPage === "history") && (
        <DashboardScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) => setCurrentPage(page)}
        />
      )}
    </SafeAreaProvider>
  );
}