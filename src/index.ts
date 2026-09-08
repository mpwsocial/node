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
  readonly account: AccountApi;
  readonly authentication: AuthenticationApi;
  readonly card: CardApi;
  readonly misc: MiscApi;
  readonly omnichain: OmnichainApi;
  readonly simulation: SimulationApi;
  readonly user: UserApi;
  readonly verification: VerificationApi;
  readonly wallet: WalletApi;

  constructor(
    private apiKey: string = "",
    private environment: Environment = "test",
    private timeoutMs = 30000
  ) {
    if (environment !== "test" && environment !== "live") {
      throw new Error("environment must be test or live");
    }
    this.apiKey = apiKey.trim();
    this.account = new AccountApi(this);
    this.authentication = new AuthenticationApi(this);
    this.card = new CardApi(this);
    this.misc = new MiscApi(this);
    this.omnichain = new OmnichainApi(this);
    this.simulation = new SimulationApi(this);
    this.user = new UserApi(this);
    this.verification = new VerificationApi(this);
    this.wallet = new WalletApi(this);
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
    if (auth) {
      if (!this.apiKey) throw new Error("apiKey is required");
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

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
}

export class AccountApi {
  readonly merchant: AccountMerchantApi;
  constructor(private client: Client) {
    this.merchant = new AccountMerchantApi(client);
  }


}

export class AccountMerchantApi {
  readonly product: AccountMerchantProductApi;
  readonly team: AccountMerchantTeamApi;
  constructor(private client: Client) {
    this.product = new AccountMerchantProductApi(client);
    this.team = new AccountMerchantTeamApi(client);
  }

  resendWebhook(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/resend-webhook', body, true);
  }

  updateNotification(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/update-notification', body, true);
  }
}

export class AccountMerchantProductApi {
  readonly subscription: AccountMerchantProductSubscriptionApi;
  constructor(private client: Client) {
    this.subscription = new AccountMerchantProductSubscriptionApi(client);
  }

  update(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/update', body, true);
  }

  view(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/view', body, true);
  }
}

export class AccountMerchantProductSubscriptionApi {
  constructor(private client: Client) {

  }

  class(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/subscription/class', body, true);
  }

  classProductType(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/subscription/class-product-type', body, true);
  }

  finalise(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/subscription/finalise', body, true);
  }

  history(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/subscription/history', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/product/subscription/initiate', body, true);
  }
}

export class AccountMerchantTeamApi {
  readonly permission: AccountMerchantTeamPermissionApi;
  constructor(private client: Client) {
    this.permission = new AccountMerchantTeamPermissionApi(client);
  }

  add(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/add', body, true);
  }

  logs(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/logs', body, true);
  }

  remove(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/remove', body, true);
  }

  update(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/update', body, true);
  }

  view(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/view', body, true);
  }
}

export class AccountMerchantTeamPermissionApi {
  constructor(private client: Client) {

  }

  add(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/permission/add', body, true);
  }

  remove(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/permission/remove', body, true);
  }

  update(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/permission/update', body, true);
  }

  view(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'account/merchant/team/permission/view', body, true);
  }
}

export class AuthenticationApi {
  constructor(private client: Client) {

  }

  connect(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'authentication/connect', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'authentication/initiate', body, false);
  }

  signOut(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'authentication/sign-out', body, true);
  }

  validate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'authentication/validate', body, true);
  }
}

export class CardApi {
  constructor(private client: Client) {

  }

  close(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/close', body, true);
  }

  create(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/create', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/details', body, true);
  }

  freeze(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/freeze', body, true);
  }

  fund(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/fund', body, true);
  }

  resubscribe(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/resubscribe', body, true);
  }

  supported(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/supported', body, true);
  }

  unfreeze(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/unfreeze', body, true);
  }

  updateSecuritySettings(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/update-security-settings', body, true);
  }

  withdraw(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'card/withdraw', body, true);
  }
}

export class MiscApi {
  constructor(private client: Client) {

  }

  actions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'actions', body, true);
  }

  codes(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'codes', body, true);
  }

  countries(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'countries', body, true);
  }

  fileUpload(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'file-upload', body, true);
  }

  paymentPurpose(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'payment-purpose', body, true);
  }

  products(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'products', body, true);
  }

  stateProvinceRegion(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'state-province-region', body, true);
  }

  supportedCurrencies(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'supported-currencies', body, true);
  }
}

export class OmnichainApi {
  readonly storage: OmnichainStorageApi;
  readonly tokenization: OmnichainTokenizationApi;
  readonly wallet: OmnichainWalletApi;
  constructor(private client: Client) {
    this.storage = new OmnichainStorageApi(client);
    this.tokenization = new OmnichainTokenizationApi(client);
    this.wallet = new OmnichainWalletApi(client);
  }


}

export class OmnichainStorageApi {
  constructor(private client: Client) {

  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/storage/details', body, true);
  }

  upload(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/storage/upload', body, true);
  }
}

export class OmnichainTokenizationApi {
  readonly erc1155: OmnichainTokenizationErc1155Api;
  readonly erc20: OmnichainTokenizationErc20Api;
  readonly erc721: OmnichainTokenizationErc721Api;
  readonly sep41: OmnichainTokenizationSep41Api;
  constructor(private client: Client) {
    this.erc1155 = new OmnichainTokenizationErc1155Api(client);
    this.erc20 = new OmnichainTokenizationErc20Api(client);
    this.erc721 = new OmnichainTokenizationErc721Api(client);
    this.sep41 = new OmnichainTokenizationSep41Api(client);
  }


}

export class OmnichainTokenizationErc1155Api {
  constructor(private client: Client) {

  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc1155/balance', body, true);
  }

  burn(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc1155/burn', body, true);
  }

  deploy(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc1155/deploy', body, true);
  }

  mint(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc1155/mint', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc1155/transactions', body, true);
  }

  transfer(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc1155/transfer', body, true);
  }
}

export class OmnichainTokenizationErc20Api {
  constructor(private client: Client) {

  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc20/balance', body, true);
  }

  burn(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc20/burn', body, true);
  }

  chains(body: Record<string, unknown> = {}) {
    return this.client.request('GET', 'omnichain/tokenization/erc20/chains', body, true);
  }

  deploy(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc20/deploy', body, true);
  }

  mint(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc20/mint', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc20/transactions', body, true);
  }

  transfer(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc20/transfer', body, true);
  }
}

export class OmnichainTokenizationErc721Api {
  constructor(private client: Client) {

  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc721/balance', body, true);
  }

  burn(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc721/burn', body, true);
  }

  deploy(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc721/deploy', body, true);
  }

  mint(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc721/mint', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc721/transactions', body, true);
  }

  transfer(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/erc721/transfer', body, true);
  }
}

export class OmnichainTokenizationSep41Api {
  constructor(private client: Client) {

  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/sep41/balance', body, true);
  }

  burn(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/sep41/burn', body, true);
  }

  deploy(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/sep41/deploy', body, true);
  }

  mint(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/sep41/mint', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/sep41/transactions', body, true);
  }

  transfer(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/tokenization/sep41/transfer', body, true);
  }
}

export class OmnichainWalletApi {
  readonly evm: OmnichainWalletEvmApi;
  readonly stellar: OmnichainWalletStellarApi;
  constructor(private client: Client) {
    this.evm = new OmnichainWalletEvmApi(client);
    this.stellar = new OmnichainWalletStellarApi(client);
  }


}

export class OmnichainWalletEvmApi {
  readonly eoa: OmnichainWalletEvmEoaApi;
  constructor(private client: Client) {
    this.eoa = new OmnichainWalletEvmEoaApi(client);
  }


}

export class OmnichainWalletEvmEoaApi {
  readonly operations: OmnichainWalletEvmEoaOperationsApi;
  readonly transfer: OmnichainWalletEvmEoaTransferApi;
  constructor(private client: Client) {
    this.operations = new OmnichainWalletEvmEoaOperationsApi(client);
    this.transfer = new OmnichainWalletEvmEoaTransferApi(client);
  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/balance', body, true);
  }

  chains(body: Record<string, unknown> = {}) {
    return this.client.request('GET', 'omnichain/wallet/evm/eoa/chains', body, true);
  }

  createWallet(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/create-wallet', body, true);
  }

  generateAddress(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/generate-address', body, true);
  }

  supportedStablecoin(body: Record<string, unknown> = {}) {
    return this.client.request('GET', 'omnichain/wallet/evm/eoa/supported-stablecoin', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/transactions', body, true);
  }
}

export class OmnichainWalletEvmEoaOperationsApi {
  constructor(private client: Client) {

  }

  broadcastTransaction(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/operations/broadcast-transaction', body, true);
  }

  estimateGas(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/operations/estimate-gas', body, true);
  }

  signTransaction(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/operations/sign-transaction', body, true);
  }
}

export class OmnichainWalletEvmEoaTransferApi {
  constructor(private client: Client) {

  }

  nativeToken(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/transfer/native-token', body, true);
  }

  stablecoin(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/evm/eoa/transfer/stablecoin', body, true);
  }
}

export class OmnichainWalletStellarApi {
  readonly eoa: OmnichainWalletStellarEoaApi;
  constructor(private client: Client) {
    this.eoa = new OmnichainWalletStellarEoaApi(client);
  }


}

export class OmnichainWalletStellarEoaApi {
  readonly operations: OmnichainWalletStellarEoaOperationsApi;
  readonly transfer: OmnichainWalletStellarEoaTransferApi;
  constructor(private client: Client) {
    this.operations = new OmnichainWalletStellarEoaOperationsApi(client);
    this.transfer = new OmnichainWalletStellarEoaTransferApi(client);
  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/balance', body, true);
  }

  createWallet(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/create-wallet', body, true);
  }

  generateAddress(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/generate-address', body, true);
  }

  supportedStablecoin(body: Record<string, unknown> = {}) {
    return this.client.request('GET', 'omnichain/wallet/stellar/eoa/supported-stablecoin', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/transactions', body, true);
  }
}

export class OmnichainWalletStellarEoaOperationsApi {
  constructor(private client: Client) {

  }

  createTrustline(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/operations/create-trustline', body, true);
  }

  estimateGas(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/operations/estimate-gas', body, true);
  }
}

export class OmnichainWalletStellarEoaTransferApi {
  constructor(private client: Client) {

  }

  nativeToken(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/transfer/native-token', body, true);
  }

  stablecoin(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'omnichain/wallet/stellar/eoa/transfer/stablecoin', body, true);
  }
}

export class SimulationApi {
  readonly card: SimulationCardApi;
  readonly collection: SimulationCollectionApi;
  readonly directDebit: SimulationDirectDebitApi;
  readonly transfer: SimulationTransferApi;
  constructor(private client: Client) {
    this.card = new SimulationCardApi(client);
    this.collection = new SimulationCollectionApi(client);
    this.directDebit = new SimulationDirectDebitApi(client);
    this.transfer = new SimulationTransferApi(client);
  }


}

export class SimulationCardApi {
  constructor(private client: Client) {

  }

  spend(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'simulation/card/spend', body, true);
  }
}

export class SimulationCollectionApi {
  constructor(private client: Client) {

  }

  initiatedOrder(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'simulation/collection/initiated-order', body, true);
  }

  staticVirtualAccount(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'simulation/collection/static-virtual-account', body, true);
  }

  staticWalletAddress(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'simulation/collection/static-wallet-address', body, true);
  }
}

export class SimulationDirectDebitApi {
  constructor(private client: Client) {

  }

  status(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'simulation/direct-debit/status', body, true);
  }
}

export class SimulationTransferApi {
  constructor(private client: Client) {

  }

  initiatedOrder(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'simulation/transfer/initiated-order', body, true);
  }
}

export class UserApi {
  readonly account: UserAccountApi;
  readonly misc: UserMiscApi;
  readonly subscription: UserSubscriptionApi;
  readonly verification: UserVerificationApi;
  constructor(private client: Client) {
    this.account = new UserAccountApi(client);
    this.misc = new UserMiscApi(client);
    this.subscription = new UserSubscriptionApi(client);
    this.verification = new UserVerificationApi(client);
  }


}

export class UserAccountApi {
  readonly business: UserAccountBusinessApi;
  readonly individual: UserAccountIndividualApi;
  constructor(private client: Client) {
    this.business = new UserAccountBusinessApi(client);
    this.individual = new UserAccountIndividualApi(client);
  }


}

export class UserAccountBusinessApi {
  constructor(private client: Client) {

  }

  create(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/account/business/create', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/account/business/details', body, true);
  }

  update(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/account/business/update', body, true);
  }
}

export class UserAccountIndividualApi {
  constructor(private client: Client) {

  }

  create(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/account/individual/create', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/account/individual/details', body, true);
  }

  update(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/account/individual/update', body, true);
  }
}

export class UserMiscApi {
  constructor(private client: Client) {

  }

  businessIndustryList(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/misc/business-industry-list', body, true);
  }

  businessProductServiceType(body: Record<string, unknown> = {}) {
    return this.client.request('GET', 'user/misc/business-product-service-type', body, false);
  }

  businessRegistrationType(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/misc/business-registration-type', body, true);
  }

  businessTradeType(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/misc/business-trade-type', body, true);
  }

  countries(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/misc/countries', body, true);
  }

  jobTypes(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/misc/job-types', body, true);
  }

  sourceOfFundsType(body: Record<string, unknown> = {}) {
    return this.client.request('GET', 'user/misc/source-of-funds-type', body, false);
  }
}

export class UserSubscriptionApi {
  constructor(private client: Client) {

  }

  class(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/subscription/class', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/subscription/initiate', body, true);
  }

  products(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/subscription/products', body, true);
  }

  requery(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/subscription/requery', body, true);
  }

  status(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/subscription/status', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/subscription/transactions', body, true);
  }
}

export class UserVerificationApi {
  constructor(private client: Client) {

  }

  bulkProcess(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/verification/bulk-process', body, true);
  }

  requirement(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/verification/requirement', body, true);
  }

  singleProcess(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'user/verification/single-process', body, true);
  }
}

export class VerificationApi {
  constructor(private client: Client) {

  }

  lookup(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'verification/lookup', body, true);
  }
}

export class WalletApi {
  readonly channel: WalletChannelApi;
  readonly collection: WalletCollectionApi;
  readonly exchange: WalletExchangeApi;
  readonly mpwt: WalletMpwtApi;
  readonly transfer: WalletTransferApi;
  constructor(private client: Client) {
    this.channel = new WalletChannelApi(client);
    this.collection = new WalletCollectionApi(client);
    this.exchange = new WalletExchangeApi(client);
    this.mpwt = new WalletMpwtApi(client);
    this.transfer = new WalletTransferApi(client);
  }

  create(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/create', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/details', body, true);
  }

  transactions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transactions', body, true);
  }

  update(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/update', body, true);
  }
}

export class WalletChannelApi {
  readonly transferRecipient: WalletChannelTransferRecipientApi;
  readonly virtualAccount: WalletChannelVirtualAccountApi;
  readonly walletAddress: WalletChannelWalletAddressApi;
  constructor(private client: Client) {
    this.transferRecipient = new WalletChannelTransferRecipientApi(client);
    this.virtualAccount = new WalletChannelVirtualAccountApi(client);
    this.walletAddress = new WalletChannelWalletAddressApi(client);
  }


}

export class WalletChannelTransferRecipientApi {
  readonly bank: WalletChannelTransferRecipientBankApi;
  readonly mobileMoney: WalletChannelTransferRecipientMobileMoneyApi;
  readonly walletAddress: WalletChannelTransferRecipientWalletAddressApi;
  constructor(private client: Client) {
    this.bank = new WalletChannelTransferRecipientBankApi(client);
    this.mobileMoney = new WalletChannelTransferRecipientMobileMoneyApi(client);
    this.walletAddress = new WalletChannelTransferRecipientWalletAddressApi(client);
  }


}

export class WalletChannelTransferRecipientBankApi {
  constructor(private client: Client) {

  }

  add(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/add', body, true);
  }

  countries(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/countries', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/details', body, true);
  }

  institutions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/institutions', body, true);
  }

  requirements(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/requirements', body, true);
  }

  resolve(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/resolve', body, true);
  }

  sampleAccount(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/sample-account', body, true);
  }

  supportedCurrencies(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/supported-currencies', body, true);
  }

  supportedRouteType(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/bank/supported-route-type', body, true);
  }
}

export class WalletChannelTransferRecipientMobileMoneyApi {
  constructor(private client: Client) {

  }

  add(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/mobile-money/add', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/mobile-money/details', body, true);
  }

  sampleAccount(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/mobile-money/sample-account', body, true);
  }

  supportedCountries(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/mobile-money/supported-countries', body, true);
  }

  supportedCurrencies(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/mobile-money/supported-currencies', body, true);
  }

  supportedNetworks(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/mobile-money/supported-networks', body, true);
  }
}

export class WalletChannelTransferRecipientWalletAddressApi {
  constructor(private client: Client) {

  }

  add(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/wallet-address/add', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/transfer-recipient/wallet-address/details', body, true);
  }
}

export class WalletChannelVirtualAccountApi {
  constructor(private client: Client) {

  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/virtual-account/details', body, true);
  }

  generate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/virtual-account/generate', body, true);
  }

  resubscribe(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/virtual-account/resubscribe', body, true);
  }

  supportedCurrencies(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/virtual-account/supported-currencies', body, true);
  }

  supportedInstitutions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/virtual-account/supported-institutions', body, true);
  }
}

export class WalletChannelWalletAddressApi {
  constructor(private client: Client) {

  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/wallet-address/details', body, true);
  }

  generate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/wallet-address/generate', body, true);
  }

  supportedTokens(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/channel/wallet-address/supported-tokens', body, true);
  }
}

export class WalletCollectionApi {
  readonly method: WalletCollectionMethodApi;
  constructor(private client: Client) {
    this.method = new WalletCollectionMethodApi(client);
  }

  calculator(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/calculator', body, true);
  }

  designOptions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/design-options', body, true);
  }

  info(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/info', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/initiate', body, true);
  }

  supportedMethods(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/supported-methods', body, true);
  }
}

export class WalletCollectionMethodApi {
  constructor(private client: Client) {

  }

  authorize3ds(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/authorize-3ds', body, true);
  }

  authorizeOtp(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/authorize-otp', body, true);
  }

  charge(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/charge', body, true);
  }

  confirmation(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/confirmation', body, true);
  }

  create(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/create', body, true);
  }

  details(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/details', body, true);
  }

  link(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/link', body, true);
  }

  resendOtp(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/resend-otp', body, true);
  }

  supportedCountries(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/supported-countries', body, true);
  }

  supportedCurrencies(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/supported-currencies', body, true);
  }

  supportedInstitutions(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/supported-institutions', body, true);
  }

  supportedNetworks(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/supported-networks', body, true);
  }

  terminate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/collection/method/terminate', body, true);
  }
}

export class WalletExchangeApi {
  readonly cryptotocrypto: WalletExchangeCryptotocryptoApi;
  readonly cryptotofiat: WalletExchangeCryptotofiatApi;
  readonly fiattocrypto: WalletExchangeFiattocryptoApi;
  readonly fiattofiat: WalletExchangeFiattofiatApi;
  constructor(private client: Client) {
    this.cryptotocrypto = new WalletExchangeCryptotocryptoApi(client);
    this.cryptotofiat = new WalletExchangeCryptotofiatApi(client);
    this.fiattocrypto = new WalletExchangeFiattocryptoApi(client);
    this.fiattofiat = new WalletExchangeFiattofiatApi(client);
  }


}

export class WalletExchangeCryptotocryptoApi {
  readonly external: WalletExchangeCryptotocryptoExternalApi;
  constructor(private client: Client) {
    this.external = new WalletExchangeCryptotocryptoExternalApi(client);
  }


}

export class WalletExchangeCryptotocryptoExternalApi {
  readonly bridge: WalletExchangeCryptotocryptoExternalBridgeApi;
  readonly swap: WalletExchangeCryptotocryptoExternalSwapApi;
  constructor(private client: Client) {
    this.bridge = new WalletExchangeCryptotocryptoExternalBridgeApi(client);
    this.swap = new WalletExchangeCryptotocryptoExternalSwapApi(client);
  }


}

export class WalletExchangeCryptotocryptoExternalBridgeApi {
  readonly usdc: WalletExchangeCryptotocryptoExternalBridgeUsdcApi;
  constructor(private client: Client) {
    this.usdc = new WalletExchangeCryptotocryptoExternalBridgeUsdcApi(client);
  }


}

export class WalletExchangeCryptotocryptoExternalBridgeUsdcApi {
  constructor(private client: Client) {

  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/bridge/usdc/fees', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/bridge/usdc/initiate', body, true);
  }

  status(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/bridge/usdc/status', body, true);
  }

  supportedChains(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/bridge/usdc/supported-chains', body, true);
  }
}

export class WalletExchangeCryptotocryptoExternalSwapApi {
  constructor(private client: Client) {

  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/swap/fees', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/swap/initiate', body, true);
  }

  status(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/swap/status', body, true);
  }

  supportedPairs(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotocrypto/external/swap/supported-pairs', body, true);
  }
}

export class WalletExchangeCryptotofiatApi {
  readonly external: WalletExchangeCryptotofiatExternalApi;
  constructor(private client: Client) {
    this.external = new WalletExchangeCryptotofiatExternalApi(client);
  }


}

export class WalletExchangeCryptotofiatExternalApi {
  constructor(private client: Client) {

  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotofiat/external/fees', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotofiat/external/initiate', body, true);
  }

  supportedPairs(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/cryptotofiat/external/supported-pairs', body, true);
  }
}

export class WalletExchangeFiattocryptoApi {
  readonly wallet: WalletExchangeFiattocryptoWalletApi;
  constructor(private client: Client) {
    this.wallet = new WalletExchangeFiattocryptoWalletApi(client);
  }


}

export class WalletExchangeFiattocryptoWalletApi {
  constructor(private client: Client) {

  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/fiattocrypto/wallet/fees', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/fiattocrypto/wallet/initiate', body, true);
  }

  supportedPairs(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/fiattocrypto/wallet/supported-pairs', body, true);
  }
}

export class WalletExchangeFiattofiatApi {
  readonly wallet: WalletExchangeFiattofiatWalletApi;
  constructor(private client: Client) {
    this.wallet = new WalletExchangeFiattofiatWalletApi(client);
  }


}

export class WalletExchangeFiattofiatWalletApi {
  constructor(private client: Client) {

  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/fiattofiat/wallet/fees', body, true);
  }

  initiate(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/fiattofiat/wallet/initiate', body, true);
  }

  supportedPairs(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/exchange/fiattofiat/wallet/supported-pairs', body, true);
  }
}

export class WalletMpwtApi {
  constructor(private client: Client) {

  }

  balance(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/mpwt/balance', body, true);
  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/mpwt/fees', body, true);
  }

  fund(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/mpwt/fund', body, true);
  }
}

export class WalletTransferApi {
  readonly cross: WalletTransferCrossApi;
  readonly direct: WalletTransferDirectApi;
  constructor(private client: Client) {
    this.cross = new WalletTransferCrossApi(client);
    this.direct = new WalletTransferDirectApi(client);
  }


}

export class WalletTransferCrossApi {
  constructor(private client: Client) {

  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/cross/fees', body, true);
  }

  single(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/cross/single', body, true);
  }

  supportedRoutes(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/cross/supported-routes', body, true);
  }
}

export class WalletTransferDirectApi {
  constructor(private client: Client) {

  }

  bulk(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/direct/bulk', body, true);
  }

  fees(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/direct/fees', body, true);
  }

  queue(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/direct/queue', body, true);
  }

  single(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/direct/single', body, true);
  }

  supportedCurrencies(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/direct/supported-currencies', body, true);
  }

  supportedNetwork(body: Record<string, unknown> = {}) {
    return this.client.request('POST', 'wallet/transfer/direct/supported-network', body, true);
  }
}

export { Client as MoiPayWay };
