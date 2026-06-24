import { create } from "zustand";

import { invoke } from "@/shared/utils/invoke";

type Role = "admin" | "cashier" | "accountant";

type User = {
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

const TOKEN_STORAGE_KEY = "safqah.auth.token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable; the session simply won't survive a reload.
  }
}

type AuthState = {
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
    const token = readStoredToken();

    if (!token) {
      return;
    }

    try {
      const user = await invoke<User | null>(
        "get_current_user",
        { token },
        { toast: false },
      );

      if (user) {
        set({ user, token, isAuthenticated: true });
      } else {
        persistToken(null);
      }
    } catch {
      persistToken(null);
    }
  },
  async login(username, password) {
    const response = await invoke<AuthResponse>(
      "login",
      {
        username,
        password,
      },
      { toast: false },
    );

    persistToken(response.token);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });
  },
  logout() {
    const { token } = get();
    void invoke("logout", { token: token ?? "" }, { toast: false });
    persistToken(null);
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
