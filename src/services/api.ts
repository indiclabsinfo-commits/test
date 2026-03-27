import axios, { type AxiosInstance } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class APIService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const storedRefresh = localStorage.getItem('refreshToken');
            const response = await axios.post(`${BASE_URL}/auth/refresh`, {
              refreshToken: storedRefresh || undefined,
            }, { withCredentials: true });
            const { accessToken, refreshToken: newRefresh } = response.data;

            localStorage.setItem('accessToken', accessToken);
            if (newRefresh) localStorage.setItem('refreshToken', newRefresh);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.api(originalRequest);
          } catch {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            // Don't hard-reload — let components handle auth errors gracefully
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: { username: string; password: string }) {
    const response = await this.api.post('/auth/register', data);
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
    }
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  }

  async login(data: { username: string; password: string }) {
    const response = await this.api.post('/auth/login', data);
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
    }
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    await this.api.post('/auth/logout', { refreshToken: refreshToken || undefined });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async getMe() {
    const response = await this.api.get('/auth/me');
    return response.data.user;
  }

  // Game history
  async getGameHistory(limit: number = 50) {
    const response = await this.api.get(`/game/history?limit=${limit}`);
    return response.data.games;
  }

  // Leaderboard
  async getLeaderboard(gameType?: string) {
    const response = await this.api.get(`/leaderboard?game=${gameType || ''}`);
    return response.data.leaders;
  }

  // ============================================
  // USER
  // ============================================

  async toggleDemoMode() {
    const response = await this.api.post('/user/toggle-demo');
    return response.data;
  }

  async getUserProfile() {
    const response = await this.api.get('/user/profile');
    return response.data.user;
  }

  async getTransactions(limit = 50) {
    const response = await this.api.get(`/user/transactions?limit=${limit}`);
    return response.data.transactions;
  }

  // ============================================
  // DEPOSITS
  // ============================================

  async createAgentDeposit(amount: number) {
    const response = await this.api.post('/deposit/agent/create', { amount });
    return response.data;
  }

  async markDepositPaid(orderId: string, utrNumber: string) {
    const response = await this.api.post(`/deposit/agent/${orderId}/paid`, { utrNumber });
    return response.data;
  }

  async getDepositStatus(orderId: string) {
    const response = await this.api.get(`/deposit/agent/${orderId}`);
    return response.data.order;
  }

  async createQRDeposit(amount: number) {
    const response = await this.api.post('/deposit/qr/create', { amount });
    return response.data;
  }

  async markQRDepositPaid(orderId: string, utrNumber?: string) {
    const response = await this.api.post(`/deposit/qr/${orderId}/paid`, { utrNumber });
    return response.data;
  }

  async getCryptoAddress(currency: string) {
    const response = await this.api.get(`/deposit/crypto/address?currency=${currency}`);
    return response.data;
  }

  async getDepositHistory() {
    const response = await this.api.get('/deposit/history');
    return response.data.deposits;
  }

  // ============================================
  // WITHDRAWALS
  // ============================================

  async requestWithdrawal(data: {
    amount: number; currency: string; method: string;
    destination: string; destinationDetails?: any;
  }) {
    const response = await this.api.post('/withdrawal/request', data);
    return response.data;
  }

  async getWithdrawalHistory() {
    const response = await this.api.get('/withdrawal/history');
    return response.data.withdrawals;
  }

  async getWithdrawalFees() {
    const response = await this.api.get('/withdrawal/fees');
    return response.data;
  }
}

export const apiService = new APIService();
export default apiService;
