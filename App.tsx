import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";


type Page = "login" | "dashboard" | "history";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [userName, setUserName] = useState("");

  const handleLoginSuccess = async (token: string, name?: string) => {
    await AsyncStorage.setItem("auth_token", token);
    setUserName(name || "User");
    setCurrentPage("dashboard");
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("auth_token");
    setCurrentPage("login");
  };

  return (
    <>
        <SafeAreaProvider>
      <StatusBar style="dark" />
      {currentPage === "login" && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      {currentPage === "dashboard" && (
        <DashboardScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) => setCurrentPage(page)}
        />
      )}
      {currentPage === "history" && (
        <DashboardScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigate={(page) => setCurrentPage(page)}
        />
      )}
      </SafeAreaProvider>
    </>
  );
}