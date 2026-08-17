# Migrating from 0.1.x to 0.2.0

Version 0.2.0 makes the SDK core provider-agnostic. Ethers and Viem support is
provided by separate adapter packages, while signing and transaction
broadcasting remain application responsibilities.

## Installation

```bash
npm install @rakelabs/dpayments-sdk @rakelabs/ethers-adapter ethers
# or
npm install @rakelabs/dpayments-sdk @rakelabs/viem-adapter viem
```

## Initialization

Replace `DPayments.fromProvider(provider, walletAddress)` with
`DPayments.fromRpc(rpcClient, { codec, walletAddress })`. Create those two
dependencies with the Ethers or Viem adapter, or implement the `RpcClient` and
`AbiCodec` interfaces yourself.

## Sending transactions

SDK methods still return unsigned `PreparedTx` values. Continue to pass their
`to`, `data`, and `value` fields to the wallet library you already use.

## Error decoding

Use `codec.decodeError(rawData)` when you already have revert bytes. For
provider- or wallet-wrapped exceptions, use the selected adapter's
`decodeEthersError` or `decodeViemError` helper.

The 0.1.x documentation remains available in the corresponding Git tags.
