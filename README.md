# MoiPayWay Node SDK

```bash
npm install @moipayway/node
```

Requires Node 18+.

```js
import { Client } from '@moipayway/node';

const mpw = new Client(process.env.MOIPAYWAY_API_KEY, 'test');

const wallet = await mpw.wallet.create({
  code: 'NGN',
  meta: { name: 'Operations', user_id: 'user-uuid' },
});
const order = await mpw.wallet.collection.initiate({
  order_reference_code: 'ORD-1001',
  meta: {
    amount: '5000',
    narration: 'Invoice 1001',
    wallet_id: 'wallet-uuid',
    user_id: 'user-uuid',
  },
});
const individual = await mpw.user.account.individual.create({ /* ... */ });
const jobTypes = await mpw.user.misc.jobTypes();
const lookup = await mpw.verification.lookup({ code: 'cac' });
```

Collection paths are methods on the client:

- `POST wallet/create` → `mpw.wallet.create(body)`
- `POST wallet/collection/initiate` → `mpw.wallet.collection.initiate(body)`
- `POST user/account/individual/create` → `mpw.user.account.individual.create(body)`
- `GET user/misc/job-types` → `mpw.user.misc.jobTypes()`
- `POST verification/lookup` → `mpw.verification.lookup(body)`
- `POST omnichain/wallet/evm/eoa/create-wallet` → `mpw.omnichain.wallet.evm.eoa.createWallet(body)`

`test` uses `https://dev.moipayway.co`. `live` uses `https://api.moipayway.co`.

```js
import { verifyWebhook } from '@moipayway/node';

const ok = verifyWebhook(rawBody, signatureHeader, timestampHeader, process.env.MOIPAYWAY_API_KEY);
```
