import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class APIService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');

            const response = await axios.post(`${BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(data: { username: string; email?: string; phone?: string; password: string }) {
    const response = await this.api.post('/auth/register', data);
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  }

  async login(data: { identifier: string; password: string }) {
    const response = await this.api.post('/auth/login', data);
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    await this.api.post('/auth/logout', { refreshToken });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async getMe() {
    const response = await this.api.get('/auth/me');
    return response.data.user;
  }

  // User endpoints
  async getProfile() {
    const response = await this.api.get('/user/profile');
    return response.data;
  }

  async getStats() {
    const response = await this.api.get('/user/stats');
    return response.data;
  }

  // Wallet endpoints
  async getBalance() {
    const response = await this.api.get('/wallet/balance');
    return response.data;
  }

  async getTransactions(limit: number = 50) {
    const response = await this.api.get(`/wallet/transactions?limit=${limit}`);
    return response.data.transactions;
  }

  // Game endpoints
  async getGameHistory(limit: number = 50) {
    const response = await this.api.get(`/game/history?limit=${limit}`);
    return response.data.games;
  }

  // Leaderboard endpoints
  async getTopWinners() {
    const response = await this.api.get('/leaderboard/top-winners');
    return response.data.leaders;
  }

  async getTopWagered() {
    const response = await this.api.get('/leaderboard/top-wagered');
    return response.data.leaders;
  }
}

export const apiService = new APIService();
export default apiService;
