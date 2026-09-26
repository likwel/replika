import axios, { AxiosError } from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status ?? 0;
    const message = error.response?.data?.message ?? "Une erreur est survenue";
    return Promise.reject(new ApiError(message, status));
  }
);

export const api = {
  get: <T>(path: string) => client.get<T>(path).then((r) => r.data),
  post: <T>(path: string, body?: unknown) => client.post<T>(path, body).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => client.patch<T>(path, body).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => client.put<T>(path, body).then((r) => r.data),
  delete: <T>(path: string, body?: unknown) => client.delete<T>(path, { data: body }).then((r) => r.data),
};