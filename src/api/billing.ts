import { request } from './base';
import type {
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  CreditBalanceResponse,
  CreditPackListResponse,
  CreditPackView,
} from './generated/billing';

export type CreditPackKey = CreditPackView['key'];
export type CreditPack = CreditPackView;

export async function listCreditPacks(): Promise<CreditPackListResponse> {
  return request<CreditPackListResponse>('/billing/packs', { method: 'GET' });
}

export async function getCreditBalance(): Promise<CreditBalanceResponse> {
  return request<CreditBalanceResponse>('/billing/balance', { method: 'GET' });
}

export async function createCheckout(packKey: CreditPackKey): Promise<CreateCheckoutResponse> {
  const body: CreateCheckoutRequest = { pack_key: packKey };
  return request<CreateCheckoutResponse>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
