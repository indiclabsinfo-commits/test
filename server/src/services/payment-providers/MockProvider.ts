import * as crypto from 'crypto';

/**
 * Mock Payment Provider
 * Pluggable interface for payment APIs
 * Replace with real provider (Razorpay, Cashfree, etc.) when ready
 */

export interface PaymentProvider {
  createPayment(amount: number, orderId: string, metadata?: any): Promise<{
    paymentId: string;
    qrUrl?: string;
    redirectUrl?: string;
    status: string;
  }>;

  verifyWebhook(payload: any, signature: string): boolean;

  checkPaymentStatus(paymentId: string): Promise<{
    status: 'pending' | 'success' | 'failed' | 'expired';
    paymentId: string;
    amount?: number;
  }>;
}

export class MockProvider implements PaymentProvider {
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock-webhook-secret';
  }

  async createPayment(amount: number, orderId: string): Promise<{
    paymentId: string;
    qrUrl?: string;
    status: string;
  }> {
    const paymentId = `mock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // In real implementation, this would call the payment provider API
    return {
      paymentId,
      qrUrl: `upi://pay?mock=true&orderId=${orderId}`,
      status: 'pending',
    };
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // In real implementation, verify HMAC signature from provider
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  }

  async checkPaymentStatus(paymentId: string): Promise<{
    status: 'pending' | 'success' | 'failed' | 'expired';
    paymentId: string;
  }> {
    // Mock: always return pending (real impl would call provider API)
    return { status: 'pending', paymentId };
  }

  // Helper for testing: generate a valid webhook signature
  generateTestSignature(payload: any): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}

export const mockProvider = new MockProvider();
export default mockProvider;
