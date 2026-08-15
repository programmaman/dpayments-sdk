// Canonical dPayments protocol ABI published by this package.

export const ABI = [
  {
    "type": "error",
    "name": "AlreadyConsumed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AppealWindowNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadEthValue",
    "inputs": [
      {
        "name": "sent",
        "type": "uint256"
      },
      {
        "name": "expectedMin",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "CannotRemoveDefaultImplementation",
    "inputs": [
      {
        "name": "implementation",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ClaimFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DisputeNotFound",
    "inputs": [
      {
        "name": "disputeId",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientAllowance",
    "inputs": [
      {
        "name": "spender",
        "type": "address"
      },
      {
        "name": "allowance",
        "type": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientBalance",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "balance",
        "type": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSpender",
    "inputs": [
      {
        "name": "spender",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "Error",
    "inputs": [
      {
        "name": "message",
        "type": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "FailedDeployment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeTooLow",
    "inputs": [
      {
        "name": "provided",
        "type": "uint256"
      },
      {
        "name": "minimum",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ImplementationAlreadyExists",
    "inputs": [
      {
        "name": "implementation",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ImplementationNotRegistered",
    "inputs": [
      {
        "name": "implementation",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientBalance",
    "inputs": [
      {
        "name": "balance",
        "type": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientFunding",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidContractAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidEvidence",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidImplementationIndex",
    "inputs": [
      {
        "name": "index",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidInitialization",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPaymentAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPaymentId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidRuling",
    "inputs": [
      {
        "name": "ruling",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidSettlementTime",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidState",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidToken",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotArbitrator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotFactory",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitializing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotParty",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPayer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToClaim",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Panic",
    "inputs": [
      {
        "name": "code",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "PaymentAlreadyExists",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "PendingOwnerOnly",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeCastOverflowedUintDowncast",
    "inputs": [
      {
        "name": "bits",
        "type": "uint8"
      },
      {
        "name": "value",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  },
  {
    "type": "event",
    "name": "ArbitratorSet",
    "inputs": [
      {
        "name": "oldValue",
        "type": "address",
        "indexed": true
      },
      {
        "name": "newValue",
        "type": "address",
        "indexed": true
      },
      {
        "name": "config",
        "type": "bytes",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Consumed",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DefaultPaymentImplementationSet",
    "inputs": [
      {
        "name": "oldDefault",
        "type": "address",
        "indexed": true
      },
      {
        "name": "newDefault",
        "type": "address",
        "indexed": true
      },
      {
        "name": "name",
        "type": "string",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Dispute",
    "inputs": [
      {
        "name": "_arbitrator",
        "type": "address",
        "indexed": true
      },
      {
        "name": "_disputeId",
        "type": "uint256",
        "indexed": true
      },
      {
        "name": "_metaEvidenceId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_evidenceGroupId",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DisputeRaised",
    "inputs": [
      {
        "name": "disputeId",
        "type": "uint256",
        "indexed": true
      },
      {
        "name": "raisedBy",
        "type": "address",
        "indexed": true
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Evidence",
    "inputs": [
      {
        "name": "_arbitrator",
        "type": "address",
        "indexed": true
      },
      {
        "name": "_evidenceGroupId",
        "type": "uint256",
        "indexed": true
      },
      {
        "name": "_party",
        "type": "address",
        "indexed": true
      },
      {
        "name": "_evidence",
        "type": "string",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeeConfigSet",
    "inputs": [
      {
        "name": "oldRecipient",
        "type": "address",
        "indexed": true
      },
      {
        "name": "newRecipient",
        "type": "address",
        "indexed": true
      },
      {
        "name": "oldBps",
        "type": "uint16",
        "indexed": false
      },
      {
        "name": "newBps",
        "type": "uint16",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MetaEvidence",
    "inputs": [
      {
        "name": "_metaEvidenceId",
        "type": "uint256",
        "indexed": true
      },
      {
        "name": "_evidence",
        "type": "string",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MetaEvidenceURISet",
    "inputs": [
      {
        "name": "oldValue",
        "type": "string",
        "indexed": false
      },
      {
        "name": "newValue",
        "type": "string",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferInitiated",
    "inputs": [
      {
        "name": "currentOwner",
        "type": "address",
        "indexed": true
      },
      {
        "name": "pendingOwner",
        "type": "address",
        "indexed": true
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentCreated",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "payment",
        "type": "address",
        "indexed": false
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true
      },
      {
        "name": "payee",
        "type": "address",
        "indexed": true
      },
      {
        "name": "token",
        "type": "address",
        "indexed": false
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "fee",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "settlementTime",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentImplementationAdded",
    "inputs": [
      {
        "name": "implementation",
        "type": "address",
        "indexed": true
      },
      {
        "name": "name",
        "type": "string",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentImplementationRemoved",
    "inputs": [
      {
        "name": "implementation",
        "type": "address",
        "indexed": true
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentSettled",
    "inputs": [
      {
        "name": "payee",
        "type": "address",
        "indexed": true
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RefundedToPayer",
    "inputs": [
      {
        "name": "payer",
        "type": "address",
        "indexed": true
      },
      {
        "name": "paid",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ResolvedToPayee",
    "inputs": [
      {
        "name": "payee",
        "type": "address",
        "indexed": true
      },
      {
        "name": "paid",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Ruling",
    "inputs": [
      {
        "name": "_arbitrator",
        "type": "address",
        "indexed": true
      },
      {
        "name": "_disputeId",
        "type": "uint256",
        "indexed": true
      },
      {
        "name": "_ruling",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "acceptOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addPaymentImplementation",
    "inputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "name",
        "type": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "aggregate3",
    "inputs": [
      {
        "name": "calls",
        "type": "tuple[]",
        "components": [
          {
            "name": "target",
            "type": "address"
          },
          {
            "name": "allowFailure",
            "type": "bool"
          },
          {
            "name": "callData",
            "type": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "returnData",
        "type": "tuple[]",
        "components": [
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "returnData",
            "type": "bytes"
          }
        ]
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "amount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "appeal",
    "inputs": [
      {
        "name": "_extraData",
        "type": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "appealCost",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "appealPeriod",
    "inputs": [],
    "outputs": [
      {
        "name": "start",
        "type": "uint256"
      },
      {
        "name": "end",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "spender",
        "type": "address"
      },
      {
        "name": "value",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "arbitrationCost",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "arbitrator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "arbitratorConfiguration",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "consume",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "consumed",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createPayment",
    "inputs": [
      {
        "name": "req",
        "type": "tuple",
        "components": [
          {
            "name": "id",
            "type": "bytes32"
          },
          {
            "name": "payee",
            "type": "address"
          },
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint256"
          },
          {
            "name": "settlementTime",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "createPayment",
    "inputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "req",
        "type": "tuple",
        "components": [
          {
            "name": "id",
            "type": "bytes32"
          },
          {
            "name": "payee",
            "type": "address"
          },
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint256"
          },
          {
            "name": "settlementTime",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "defaultPaymentImplementation",
    "inputs": [],
    "outputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "name",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dispute",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "disputeId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "disputeStartTime",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "feeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "feeRecipient",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "_payer",
        "type": "address"
      },
      {
        "name": "_payee",
        "type": "address"
      },
      {
        "name": "_token",
        "type": "address"
      },
      {
        "name": "_amount",
        "type": "uint256"
      },
      {
        "name": "_fee",
        "type": "uint256"
      },
      {
        "name": "_settlementTime",
        "type": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "isCreatePaymentRequestValid",
    "inputs": [
      {
        "name": "req",
        "type": "tuple",
        "components": [
          {
            "name": "id",
            "type": "bytes32"
          },
          {
            "name": "payee",
            "type": "address"
          },
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint256"
          },
          {
            "name": "settlementTime",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isCreatePaymentRequestValid",
    "inputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "req",
        "type": "tuple",
        "components": [
          {
            "name": "id",
            "type": "bytes32"
          },
          {
            "name": "payee",
            "type": "address"
          },
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint256"
          },
          {
            "name": "settlementTime",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "metaEvidenceURI",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paymentImplementationAt",
    "inputs": [
      {
        "name": "index",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "name",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paymentImplementationCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingWithdrawals",
    "inputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "predictPaymentAddress",
    "inputs": [
      {
        "name": "creator",
        "type": "address"
      },
      {
        "name": "req",
        "type": "tuple",
        "components": [
          {
            "name": "id",
            "type": "bytes32"
          },
          {
            "name": "payee",
            "type": "address"
          },
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint256"
          },
          {
            "name": "settlementTime",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "predictPaymentAddress",
    "inputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "creator",
        "type": "address"
      },
      {
        "name": "req",
        "type": "tuple",
        "components": [
          {
            "name": "id",
            "type": "bytes32"
          },
          {
            "name": "payee",
            "type": "address"
          },
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint256"
          },
          {
            "name": "settlementTime",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteGross",
    "inputs": [
      {
        "name": "net",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "gross",
        "type": "uint256"
      },
      {
        "name": "fee",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "removePaymentImplementation",
    "inputs": [
      {
        "name": "impl",
        "type": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rule",
    "inputs": [
      {
        "name": "_disputeId",
        "type": "uint256"
      },
      {
        "name": "_ruling",
        "type": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setArbitrator",
    "inputs": [
      {
        "name": "newArb",
        "type": "address"
      },
      {
        "name": "newCfg",
        "type": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDefaultImplementation",
    "inputs": [
      {
        "name": "impl",
        "type": "address"
      },
      {
        "name": "name",
        "type": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setFeeConfig",
    "inputs": [
      {
        "name": "newRecipient",
        "type": "address"
      },
      {
        "name": "newBps",
        "type": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMetaEvidenceURI",
    "inputs": [
      {
        "name": "newURI",
        "type": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settle",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settlementTime",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "state",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitEvidence",
    "inputs": [
      {
        "name": "_evidence",
        "type": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sweep",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "voluntaryRefund",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;

export const PAYMENT_EVENT_TOPICS = {
  "PAYMENT_CREATED": "0xcff9580c1507dfde97f84a1bb8c5dc13fc921587e6fabe0f71a9c6263b55a73e",
  "PAYMENT_SETTLED": "0x2d0beda258d8e23bb4d7c407b3bd723d9abeab28c7c0ee49b5842bf84e5ee6fc",
  "DISPUTE_RAISED": "0x84a477df8a28a4276ca6dee4458a06c3015f30c477d9c949ede4e13ff8a552b4",
  "RESOLVED_TO_PAYEE": "0x92eae629bfc95e3b61e0d3ab3b3604f596086348afada23edee34ee54f7c53f4",
  "REFUNDED_TO_PAYER": "0x2fee1d84c316542e2e2907db7b8927f2d3aa96a48bdf70c639a5f6000e100638",
  "CONSUMED": "0xe9fd184e6dbede73d44d634befbf409920f9726119307f5f238e752a7f79e404",
  "EVIDENCE": "0xdccf2f8b2cc26eafcd61905cba744cff4b81d14740725f6376390dc6298a6a3c"
} as const;
