# MoiPayWay Node SDK

```bash
npm install @moipayway/node
```

```js
import { Client } from '@moipayway/node';

const mpw = new Client(process.env.MOIPAYWAY_API_KEY, 'test');

const countries = await mpw.countries();
const wallet = await mpw.createWallet({
  code: 'NGN',
  meta: { name: 'Operations', user_id: 'user-uuid' },
});
const order = await mpw.initiateCollection({
  order_reference_code: 'ORD-1001',
  meta: {
    amount: '5000',
    narration: 'Invoice 1001',
    wallet_id: 'wallet-uuid',
    user_id: 'user-uuid',
  },
});
```

Any documented path:

```js
await mpw.request('POST', 'wallet/details', { wallet_id: '...' });
```

Webhook verification:

```js
import { verifyWebhook } from '@moipayway/node';

const ok = verifyWebhook(rawBody, signatureHeader, timestampHeader, process.env.MOIPAYWAY_API_KEY);
```

Requires Node 18+. Environment: `test` → `https://dev.moipayway.co`, `live` → `https://api.moipayway.co`.
