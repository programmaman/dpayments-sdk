# Error decoding

The core SDK decodes raw revert bytes, not provider exception objects.

`AbiCodec.decodeError(data)` accepts an EVM revert payload and returns the error name and positional arguments when the selector is present in the generated protocol ABI:

```ts
interface DecodedError {
  name: string;
  args: readonly unknown[];
}
```

Unknown selectors, empty data, and malformed data return `undefined`.

Multicall uses this operation directly because Multicall3 returns raw failure bytes. Provider and wallet exceptions are different: ethers, viem, wagmi, and wallets wrap revert data in library-specific objects. Extracting bytes from those objects belongs to their integration packages, not this core package.

An integration helper should perform this sequence:

```text
provider-specific exception
          |
          v
extract raw revert bytes
          |
          v
codec.decodeError(bytes)
```

Applications using an ethers or viem integration should use that integration's error helper. The core package deliberately does not inspect arbitrary `error.data`, `cause`, `details`, or JSON-RPC response shapes.

For Ethers:

```ts
import { decodeEthersError } from '@rakelabs/ethers-adapter';

const decoded = decodeEthersError(error, codec);
```

For Viem:

```ts
import { decodeViemError } from '@rakelabs/viem-adapter';

const decoded = decodeViemError(error, codec);
```

Error arguments are positional. Interpret them after checking the error name:

```ts
const decoded = codec.decodeError(rawData);

if (decoded?.name === 'BadEthValue') {
  const [sent, expectedMinimum] = decoded.args;
  console.error({ sent, expectedMinimum });
}
```

The generated ABI covers Solidity built-ins and the explicitly supported protocol dependency errors. An arbitrary configured token or arbitrator may return an unknown selector; integration helpers should preserve the raw bytes in that case.
