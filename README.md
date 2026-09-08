# MoiPayWay Node SDK

Official Node.js SDK for the [MoiPayWay API](https://documenter.getpostman.com/view/11919136/2s93Joz7Bq).

Use this client to call every endpoint in that collection: wallets, collections, transfers, users, verification, cards, catalogs, omnichain, and the rest of the documented surface.

```bash
npm install @moipayway/node
```

Requires Node 18+.

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

## API docs

Paths, methods, and request bodies are in the public collection:

[MoiPayWay API (Postman)](https://documenter.getpostman.com/view/11919136/2s93Joz7Bq)

Call any of those endpoints with `request()`:

```js
await mpw.request('POST', 'wallet/details', { wallet_id: '...' });
await mpw.request('GET', 'user/misc/countries', {}, false);
```

- `test` → `https://dev.moipayway.co`
- `live` → `https://api.moipayway.co`
- Auth: `Authorization: Bearer <api_key>` (pass `auth: false` for documented catalog GETs)

## Webhooks

```js
import { verifyWebhook } from '@moipayway/node';

const ok = verifyWebhook(rawBody, signatureHeader, timestampHeader, process.env.MOIPAYWAY_API_KEY);
```
