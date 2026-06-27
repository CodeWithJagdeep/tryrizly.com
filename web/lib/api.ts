type ApiResponse<T> = { data: T };

class ApiClient {
  async get<T = unknown>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: "GET" });
  }

  async post<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data ?? {}),
    });
  }

  async put<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data ?? {}),
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`/api${url}`, {
      ...init,
      credentials: "include",
    });
    const data = (await response.json().catch(() => ({}))) as T & {
      message?: string;
    };

    if (!response.ok) {
      throw {
        response: {
          status: response.status,
          data,
        },
        message: data.message || `Request failed with status ${response.status}`,
      };
    }

    return { data };
  }
}

const api = new ApiClient();
export default api;
