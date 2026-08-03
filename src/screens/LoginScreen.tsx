import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loginUser } from "../api/auth";

interface LoginScreenProps {
  onLoginSuccess: (token: string, name?: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!email || !password) {
      setError("Email සහ Password දෙකම දාන්න ඕන");
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser({ email, password });

      if (result.token) {
        const displayName = result.user?.name || email.split("@")[0];
        onLoginSuccess(result.token, displayName);
      } else {
        setError("Login failed - token not received");
      }
    } catch (err: any) {
      console.log("LOGIN ERROR:", JSON.stringify(err.response?.data, null, 2));
      setError(
        err.response?.data?.message || "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#fca5a5"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#fca5a5"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.signinBtn, loading && styles.disabledBtn]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signinBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#fde3e0",
  },
  blobTop: {
    width: 400,
    height: 400,
    top: -150,
    right: -120,
  },
  blobBottom: {
    width: 300,
    height: 300,
    bottom: -100,
    left: -80,
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 5,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f5f5f7",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: "#1a1a2e",
  },
  passwordWrapper: {
    position: "relative",
    justifyContent: "center",
    zIndex: 1,
  },
  passwordInput: {
    backgroundColor: "#f5f5f7",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingRight: 50,
    fontSize: 15,
    color: "#1a1a2e",
  },
  eyeBtn: {
    position: "absolute",
    right: 10,
    zIndex: 2,
    padding: 10,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    marginTop: -8,
  },
  signinBtn: {
    backgroundColor: "#f4695f",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  signinBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});