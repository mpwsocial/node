import { createHmac, timingSafeEqual } from "node:crypto";

export type Environment = "test" | "live";

const BASES: Record<Environment, string> = {
  test: "https://dev.moipayway.co",
  live: "https://api.moipayway.co",
};

export class ApiError extends Error {
  constructor(
    message: string,
    public httpStatus = 0,
    public payload: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function verifyWebhook(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  apiKey: string,
  toleranceSeconds = 300
): boolean {
  if (!rawBody || !signatureHeader || !timestampHeader || !apiKey) return false;
  if (!/^\d+$/.test(timestampHeader)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestampHeader));
  if (toleranceSeconds > 0 && age > toleranceSeconds) return false;
  const provided = signatureHeader.toLowerCase().startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  const expected = createHmac("sha256", apiKey)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class Client {
  constructor(
    private apiKey: string,
    private environment: Environment = "test",
    private timeoutMs = 30000
  ) {
    if (environment !== "test" && environment !== "live") {
      throw new Error("environment must be test or live");
    }
    if (!apiKey.trim()) throw new Error("apiKey is required");
    this.apiKey = apiKey.trim();
  }

  baseUrl(): string {
    return BASES[this.environment];
  }

  async request(
    method: string,
    path: string,
    body: Record<string, unknown> = {},
    auth = true
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (auth) headers.Authorization = `Bearer ${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD" ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError("Unable to reach MoiPayWay");
    } finally {
      clearTimeout(timer);
    }

    const decoded = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!decoded) throw new ApiError("Invalid JSON response", res.status);
    const status = String(decoded.status || "").toLowerCase();
    if (status === "failed" || status === "error") {
      throw new ApiError(String(decoded.message || "Request failed"), res.status, decoded);
    }
    return decoded;
  }

  post(path: string, body: Record<string, unknown> = {}) {
    return this.request("POST", path, body, true);
  }

  get(path: string, auth = true) {
    return this.request("GET", path, {}, auth);
  }

  createWallet(body: Record<string, unknown>) {
    return this.post("wallet/create", body);
  }

  walletDetails(body: Record<string, unknown>) {
    return this.post("wallet/details", body);
  }

  walletTransactions(body: Record<string, unknown>) {
    return this.post("wallet/transactions", body);
  }

  initiateCollection(body: Record<string, unknown>) {
    return this.post("wallet/collection/initiate", body);
  }

  collectionInfo(orderReferenceCode: string) {
    return this.post("wallet/collection/info", { order_reference_code: orderReferenceCode });
  }

  createCollectionMethod(body: Record<string, unknown>) {
    return this.post("wallet/collection/method/create", body);
  }

  directTransfer(body: Record<string, unknown>) {
    return this.post("wallet/transfer/direct/single", body);
  }

  createIndividual(body: Record<string, unknown>) {
    return this.post("user/account/individual/create", body);
  }

  individualDetails(body: Record<string, unknown>) {
    return this.post("user/account/individual/details", body);
  }

  createBusiness(body: Record<string, unknown>) {
    return this.post("user/account/business/create", body);
  }

  countries() {
    return this.get("user/misc/countries", false);
  }

  jobTypes() {
    return this.get("user/misc/job-types", false);
  }

  businessIndustries() {
    return this.get("user/misc/business-industry-list", false);
  }

  businessRegistrationTypes() {
    return this.get("user/misc/business-registration-type", false);
  }

  businessTradeTypes() {
    return this.get("user/misc/business-trade-type", false);
  }

  businessProductServiceTypes() {
    return this.get("user/misc/business-product-service-type", false);
  }

  sourceOfFundsTypes() {
    return this.get("user/misc/source-of-funds-type", false);
  }
}

export { Client as MoiPayWay };
