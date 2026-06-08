# On-chain integration (Solidity)

The Payment Generator is deployed on Ethereum mainnet. Your contract calls one create function, gets the payment address, and calls methods on it.

## Create

```solidity
contract MyPaymentIntegration {
    address constant PAYMENT_GENERATOR = 0x4D010539063822a4296c7aF393EA6fd19841dA00;

    /// Creates a payment, funds it, then reads state.
    function pay(
        address _payee,
        uint256 _amount,
        uint256 _settlementTime
    ) external payable returns (address payment) {
        (bool ok, bytes memory data) = PAYMENT_GENERATOR.call{value: msg.value}(
            abi.encodeWithSignature(
                "createPayment((bytes32,address,address,uint256,uint256,uint256))",
                [bytes32(uint256(keccak256(abi.encode(block.timestamp, msg.sender)))),
                 _payee, address(0), _amount, uint256(0), _settlementTime]
            )
        );
        require(ok);
        payment = abi.decode(data, (address));

        // Read state
        (ok, data) = payment.staticcall(abi.encodeWithSignature("state()"));
        uint8 state = abi.decode(data, (uint8));
    }
}
```

The Payment Generator address is the only thing you need. The rest is on the payment.

