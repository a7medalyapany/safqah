import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type Role = "admin" | "cashier" | "accountant";

export type User = {
  id: number;
  name: string;
  username: string;
  role: Role;
  is_active: number;
  created_at: string;
};

type AuthResponse = {
  user: User;
  token: string;
};

const featurePermissions: Record<string, Role[]> = {
  reports: ["admin", "accountant"],
  finance: ["admin", "accountant"],
  users: ["admin"],
  settings: ["admin"],
  purchases: ["admin", "accountant"],
  pos: ["admin", "cashier", "accountant"],
  items: ["admin", "cashier"],
  inventory: ["admin", "cashier"],
};

export type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  canAccess: (feature: string) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  async bootstrap() {
    const user = await invoke<User | null>("get_current_user");

    if (user) {
      set({ user, token: null, isAuthenticated: true });
    }
  },
  async login(username, password) {
    const response = await invoke<AuthResponse>("login", {
      username,
      password,
    });

    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });
  },
  logout() {
    void invoke("logout");
    set({ user: null, token: null, isAuthenticated: false });
  },
  hasRole(role) {
    return get().user?.role === role;
  },
  canAccess(feature) {
    const currentRole = get().user?.role;

    if (!currentRole) {
      return false;
    }

    const allowedRoles = featurePermissions[feature];
    if (!allowedRoles) {
      return true;
    }

    return allowedRoles.includes(currentRole);
  },
}));
