import axios, { type AxiosError, type AxiosResponse } from "axios";
import { AUTH_CONSTANTS } from "@/constants/auth.constants";
import { type ApiResponse, isSuccessResponse } from "@/types/api-response.type";
import { API_URL } from "../config";
import { ACCESS_TOKEN_KEY } from "@constants/shared-constants";

// 🔴🔴🔴 AJOUTE CETTE DÉCLARATION 🔴🔴🔴
declare module 'axios' {
  export interface AxiosRequestConfig {
    __retryCount?: number;
    __maxRetries?: number;
  }
}
// 🔴🔴🔴 FIN AJOUT 🔴🔴🔴

export const apiClient = axios.create({
  baseURL: API_URL || "",
  timeout: 0, // 🔴🔴🔴 MODIFIÉ : 0 = pas de timeout 🔴🔴🔴
  headers: {
    "Content-Type": "application/json",
    Authorization: localStorage.getItem(AUTH_CONSTANTS.ACCESS_TOKEN_KEY),
  },
});

// Intercepteur pour les requêtes (ajouter token par exemple)
apiClient.interceptors.request.use(
  (config) => { // 🔴 RETIRÉ le type 'any' 🔴
    const token = localStorage.getItem(AUTH_CONSTANTS.ACCESS_TOKEN_KEY);
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => { // 🔴 AJOUTÉ le type AxiosError 🔴
    console.log(error);
    return Promise.reject(error);
  }
);

// Intercepteur
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // Pour les réponses blob en succès, on retourne directement
    if (response.config.responseType === "blob") {
      return response;
    }

    if (isSuccessResponse(response.data)) {
      return {
        ...response,
        data: response.data.data,
      };
    } else {
      const error = new ApiError(
        response.data.message,
        response.status,
        response.data.code,
        response.data.route,
      );
      return Promise.reject(error);
    }
  },
  async (error: AxiosError) => {
    // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
    // 🔴 DÉBUT GESTION SILENCIEUSE DU 504 (RETRY TRANSPARENT) 🔴
    // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
    
    // 🔴 AJOUTÉ : Vérification que config existe 🔴
    if (error.response?.status === 504 && error.config) {
      // Initialise les compteurs si première fois
      if (!error.config.__retryCount) {
        error.config.__retryCount = 0;
        error.config.__maxRetries = 30; // Nombre max de retry (30 * 3s = 90s max)
      }

      error.config.__retryCount += 1;

      // Si on n'a pas dépassé le max de retry
      if (error.config.__retryCount <= error.config.__maxRetries) {
        console.log(
          `⏳ Gateway timeout (${error.config.__retryCount}/${error.config.__maxRetries}) - ` +
          `Retry silencieux dans 3s... (L'util
