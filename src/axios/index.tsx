import { Api } from "./Api";

const api = new Api({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080",
});

export default api;
