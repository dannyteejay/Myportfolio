import crypto from "node:crypto";

/**
 * Payment gateway helpers.
 *
 * Every provider degrades gracefully: if its secret key is not configured,
 * the gateway reports `configured: false` and the API returns a safe demo
 * response instead of failing — so the store always works in development.
 */

export const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

/* --------------------------------- Paystack -------------------------------- */
export const paystack = {
  get key() {
    return process.env.PAYSTACK_SECRET_KEY;
  },
  get configured() {
    return !!process.env.PAYSTACK_SECRET_KEY;
  },
  async initialize(args: {
    email: string;
    amount: number; // kobo
    currency: string;
    reference: string;
    metadata: Record<string, unknown>;
  }) {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.email,
        amount: args.amount,
        currency: args.currency,
        reference: args.reference,
        callback_url: `${APP_URL}/payment/callback?gateway=paystack`,
        metadata: args.metadata,
      }),
    });
    const json = (await res.json()) as any;
    if (!json.status) throw new Error(json.message || "Paystack error");
    return {
      url: json.data.authorization_url as string,
      providerRef: json.data.reference as string,
    };
  },
  async verify(reference: string) {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${this.key}` } }
    );
    const json = (await res.json()) as any;
    const status = json?.data?.status; // success | failed | abandoned
    return { paid: status === "success", raw: json?.data };
  },
  verifySignature(rawBody: Buffer, signature: string | undefined) {
    if (!this.key || !signature) return false;
    const hash = crypto
      .createHmac("sha512", this.key)
      .update(rawBody)
      .digest("hex");
    return hash === signature;
  },
};

/* ------------------------------- Flutterwave ------------------------------- */
export const flutterwave = {
  get key() {
    return process.env.FLUTTERWAVE_SECRET_KEY;
  },
  get configured() {
    return !!process.env.FLUTTERWAVE_SECRET_KEY;
  },
  async initialize(args: {
    email: string;
    amount: number; // kobo/cents (minor units)
    currency: string;
    reference: string;
    name?: string;
    metadata: Record<string, unknown>;
  }) {
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: args.reference,
        amount: args.amount / 100, // Flutterwave expects major units
        currency: args.currency,
        redirect_url: `${APP_URL}/payment/callback?gateway=flutterwave`,
        customer: { email: args.email, name: args.name },
        meta: args.metadata,
        customizations: { title: "Portfolio Store" },
      }),
    });
    const json = (await res.json()) as any;
    if (json.status !== "success")
      throw new Error(json.message || "Flutterwave error");
    return { url: json.data.link as string, providerRef: args.reference };
  },
  async verify(transactionId: string) {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${this.key}` } }
    );
    const json = (await res.json()) as any;
    return {
      paid: json?.data?.status === "successful",
      raw: json?.data,
      tx_ref: json?.data?.tx_ref as string | undefined,
    };
  },
  verifySignature(signature: string | undefined) {
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!secretHash || !signature) return false;
    return signature === secretHash;
  },
};

/* ---------------------------- Crypto (NOWPayments) -------------------------- */
export const crypto_gw = {
  get key() {
    return process.env.NOWPAYMENTS_API_KEY;
  },
  get configured() {
    return !!process.env.NOWPAYMENTS_API_KEY;
  },
  async initialize(args: {
    amount: number; // minor units
    currency: string;
    reference: string;
    email: string;
    title: string;
  }) {
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": this.key as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: args.amount / 100,
        price_currency: args.currency.toLowerCase(),
        order_id: args.reference,
        order_description: args.title,
        success_url: `${APP_URL}/payment/callback?gateway=crypto&status=success`,
        cancel_url: `${APP_URL}/payment/callback?gateway=crypto&status=cancel`,
      }),
    });
    const json = (await res.json()) as any;
    if (!json.invoice_url)
      throw new Error(json.message || "Crypto gateway error");
    return { url: json.invoice_url as string, providerRef: String(json.id) };
  },
  verifySignature(rawBody: Buffer, signature: string | undefined) {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    if (!ipnSecret || !signature) return false;
    try {
      const parsed = JSON.parse(rawBody.toString());
      const sorted = JSON.stringify(sortObject(parsed));
      const hash = crypto
        .createHmac("sha512", ipnSecret)
        .update(sorted)
        .digest("hex");
      return hash === signature;
    } catch {
      return false;
    }
  },
};

function sortObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = sortObject(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

export function genReference(prefix = "PF"): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}
