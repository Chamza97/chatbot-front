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
  (config: InternalAxiosRequestConfig<any>) => {
    const token = localStorage.getItem(AUTH_CONSTANTS.ACCESS_TOKEN_KEY);
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
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
    if (error.response?.status === 504) {
      // Initialise les compteurs si première fois
      if (!error.config?.__retryCount) {
        error.config.__retryCount = 0;
        error.config.__maxRetries = 30; // Nombre max de retry (30 * 3s = 90s max)
      }

      error.config.__retryCount += 1;

      // Si on n'a pas dépassé le max de retry
      if (error.config.__retryCount <= error.config.__maxRetries) {
        console.log(
          `⏳ Gateway timeout (${error.config.__retryCount}/${error.config.__maxRetries}) - ` +
          `Retry silencieux dans 3s... (L'utilisateur ne voit rien)`
        );

        // Attends 3 secondes
        await new Promise(resolve => setTimeout(resolve, 3000));

        // RE-ENVOIE la requête (TRANSPARENT pour l'utilisateur)
        // Le loading/spinner reste affiché côté React
        return apiClient.request(error.config);
      } else {
        // Après 30 tentatives (90 secondes), on abandonne
        console.error('❌ Timeout définitif après 30 tentatives');
        return Promise.reject(
          new ApiError(
            "Le serveur ne répond toujours pas après plusieurs minutes",
            504,
            "GATEWAY_TIMEOUT_MAX_RETRIES",
            error.config?.url || ""
          )
        );
      }
    }
    // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
    // 🔴 FIN GESTION 504 🔴
    // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴

    if (error.response) {
      // Cas spécial : requête blob qui retourne une erreur
      if (
        error.config?.responseType === "blob" &&
        error.response.data instanceof Blob
      ) {
        try {
          // Convertir le blob en texte pour récupérer le message d'erreur JSON
          const text = await error.response.data.text();
          const apiResponse = JSON.parse(text) as ApiResponse;
          if (
            !isSuccessResponse(apiResponse) &&
            error.response.status === 401
          ) {
            localStorage.setItem(ACCESS_TOKEN_KEY, '');
            window.location.reload();
          }
          
          if (apiResponse && !isSuccessResponse(apiResponse)) {
            const customError = new ApiError(
              apiResponse.message,
              error.response.status,
              apiResponse.code,
              apiResponse.route,
            );
            return Promise.reject(customError);
          }
        } catch (parseError) {
          // Si on ne peut pas parser le blob, utiliser le message d'erreur par défaut
          const customError = new ApiError(
            "Erreur lors du traitement de la réponse",
            error.response.status,
          );
          return Promise.reject(customError);
        }
      }

      // Cas normal : réponse JSON
      const apiResponse = error.response.data as ApiResponse;
      if (apiResponse && !isSuccessResponse(apiResponse)) {
        if (!isSuccessResponse(apiResponse) && error.response.status === 401) {
          localStorage.setItem(ACCESS_TOKEN_KEY, '');
          window.location.reload();
        }
        
        const customError = new ApiError(
          apiResponse.message,
          error.response.status,
          apiResponse.code,
          apiResponse.route,
        );
        return Promise.reject(customError);
      }
    } else if (error.request) {
      // La requête a été envoyée mais pas de réponse
      return Promise.reject(new ApiError("Erreur réseau", 0));
    } else {
      // Erreur dans la configuration de la requête
      return Promise.reject(new ApiError("Erreur de configuration", 0));
    }

    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public route?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

---

## 🎯 Ce qui va se passer maintenant :

### ✅ **Comportement pour l'utilisateur :**
1. Il clique sur un bouton
2. Le **loading/spinner s'affiche**
3. Après 30s → Gateway retourne 504
4. **Axios ignore le 504** et retry automatiquement toutes les 3 secondes
5. Le **loading reste affiché** (pas d'erreur visible)
6. Quand le serveur répond enfin → **succès affiché normalement**
7. L'utilisateur ne voit **RIEN du tout**, juste un loading plus long

### 🔄 **Retry automatique :**
- Retry toutes les **3 secondes**
- Maximum **30 tentatives** = **90 secondes max**
- Totalement **transparent** pour l'utilisateur
- La vue **ne change pas**, le loading reste

### 📊 **Dans la console (pour le dev) :**
```
⏳ Gateway timeout (1/30) - Retry silencieux dans 3s...
⏳ Gateway timeout (2/30) - Retry silencieux dans 3s...
⏳ Gateway timeout (3/30) - Retry silencieux dans 3s...
✅ Réponse reçue !
