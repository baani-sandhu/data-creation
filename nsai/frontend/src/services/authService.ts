import api from "./axios.ts";

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenPayload {
    refreshToken: string,
}

export const authService = {
  register: (data: RegisterPayload) =>
    api.post("/admin/register-internal", data),

  login: (data: LoginPayload) =>
    api.post("/auth/login", data),

  logout: (refreshToken: string) =>
    api.post("/auth/logout", { refresh_token: refreshToken }),

  refreshToken: (refreshToken: string) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }),

  getCurrentUser: () =>
    api.get("/auth/me"),

  getMyTeam: async () => {
    return await api.get("/admin/my-team");
  }
};
