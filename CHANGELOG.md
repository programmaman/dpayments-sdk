# Changelog

All notable public changes to `@rakelabs/dpayments-sdk` are documented here.

## Unreleased

## 0.2.1

### Changed

- Updated the direct `@noble/hashes` dependency to 2.3.0 and migrated Keccak imports to its v2 ESM subpath.

## 0.2.0

### Breaking

- Decoupled the SDK from Ethers and Viem runtime APIs and dependencies; integrations now supply provider-specific adapters.
- Replaced the generic RPC request boundary with explicit `call`, `getLogs`, `getChainId`, and `getBlock` operations.

### Changed

- Updated payment reads, event queries, and multicall flows to use the explicit RPC operations.
- Kept provider-specific transaction submission and revert handling in the integration adapters.

## 0.1.5

### Added

- Added `dPayment.consume()` for payees to mark a payment as consumed without settling funds or changing dispute authority.
- Added `dPayment.read.consumed()` and `reader.readPayment.consumed(address)`.
- Added `Consumed` event decoding, `PaymentTopics.CONSUMED`, and `ConsumedEvent` support.
- Added decoding for the `Unauthorized` and `AlreadyConsumed` contract errors.
- Added unit and end-to-end coverage for consumption, replay protection, reads, and event decoding.

### Changed

- Updated the DisputablePayment ABI and generated TypeChain bindings for the consume functionality.

## 0.1.4

### Added

- Added the ability to retrieve individual payment details, such as status, participants, settlement information, dispute information, and balances, when a complete payment record is unnecessary.
- Added convenient field-level reads for payment handles, such as checking a payment with `payment.read.state()`.

### Changed

- Payment information can now be fetched more efficiently for status checks, dashboards, and other workflows that only need selected details.
- Existing complete payment reads remain available, so current integrations continue to work unchanged.

### Maintenance

- Added automated release validation and npm provenance publishing.

## 0.1.3

- Initial public npm release of the Disputable Payments workflow SDK.
