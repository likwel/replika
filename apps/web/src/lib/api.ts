import axios, { AxiosError } from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const WORKSPACE_UNAVAILABLE = "suiteflow:workspace-unavailable";

export class ApiError extends Error {
  status: number;
  code?: string; // identifiant stable renvoyé par l'API (ex. NO_CATALOG)
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // envoie/reçoit le cookie httpOnly
  headers: { "Content-Type": "application/json" },
});

// Transforme les erreurs axios en ApiError exploitables
client.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; code?: string }>) => {
    const status = error.response?.status ?? 0;
    const message = error.response?.data?.message ?? "Une erreur est survenue";
    // Espace d'équipe devenu inaccessible (membre retiré ou suspendu) : l'application relit la session
    if (error.response?.data?.code === "WORKSPACE_UNAVAILABLE") window.dispatchEvent(new CustomEvent(WORKSPACE_UNAVAILABLE));
    return Promise.reject(new ApiError(message, status, error.response?.data?.code));
  }
);

export const api = {
  get: <T>(path: string) => client.get<T>(path).then((r) => r.data),
  post: <T>(path: string, body?: unknown) => client.post<T>(path, body).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => client.patch<T>(path, body).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => client.put<T>(path, body).then((r) => r.data),
  delete: <T>(path: string, body?: unknown) => client.delete<T>(path, { data: body }).then((r) => r.data),
};