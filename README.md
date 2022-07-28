# Tornado Instances Factory

## About

This repository contains:

1. `InstanceFactory` - instance factory for the creation new Tornado ERC20/native pools
2. `InstanceProposalCreator` - governance proposal factory for the addition of new Tornado instances to the Tornado router

### InstanceFactory

Anyone can create a new instance by calling `createInstanceClone` method of the factory with parameters:

1. `address token` - address of ERC20 token for a new instance, zero address for the native instance
2. `uint256 denomination` - denomination for new instance (tokens can only be deposited in certain denominations into instances)

### InstanceProposalCreator

Anyone can create governance proposal for the addition of a new instance by calling `createProposalApprove/createProposalPermit` method of the factory with parameters (proposal creation fee in TORN is charged from sender):

1. `address token` - address of ERC20 token for a new instance, zero address for the native instance
2. `uint24 uniswapPoolSwappingFee` - fee value of Uniswap instance which will be used for `TORN/token` price determination. `3000` means 0.3% fee Uniswap pool. Zero value for the native instance.
3. `uint256[] denominations` - list of denominations for each new instance (tokens can only be deposited in certain denominations into instances).
4. `uint32[] protocolFees` - list of protocol fees for each new instance (this fee is only charged from registrated relayer during withdrawal process). `100` means 1% of instance denomination fee for withdrawal throw registrated relayer.

## Factory parameters

### InstanceProposalCreator

1. `max number of new instances in one proposal` - the current version supports the addition of a maximum of 4 instances at once.
2. `proposal creation fee` - this fee is charged from creator of proposal during `createProposalApprove/createProposalPermit` factory method execution. It can be changed by governance. Default value is stored in `config.js`.
3. `TWAPSlotsMin` - minimum number of TWAP slots for Uniswap pool that is chosen during `createProposalApprove/createProposalPermit` factory method call. It can be changed by governance. Default value is stored in `config.js`.

## Warnings

1. This version of the factory creates a proposal for **immutable** Tornado instance initialization.
2. For `InstanceProposalCreator` users should manually propose a proposal after its creation using the factory (in governance UI for example). As `propose()` method caller must have 1000 TORN locked in the governance. Moreover, the proposer can't propose more than one proposal simultaneously.

## Tests

Setting up the repository:

```bash
    yarn
    cp .env.example .env
```

Please fill out .env according to the template provided in it. Please ensure that all of the example values are set to the correct addresses.

To run test scripts:

```bash
    yarn test
```

Test scripts cover instance factory deployment, proposal deployment and executing proposal.

## Deploy

Check config.js for actual values.

With `salt` = `0x0000000000000000000000000000000000000000000000000000000047941987` address must be:

1. `SidechainInstanceFactory` - `0x0a0601c2E952aC53bb95b1A81764Fc730C9bBDd5`
2. `SidechainInstanceFactory proxy` - `0xb4838f15185E4A7E2ED8534c89b7AC92aC927C9b`
3. `InstanceFactory` - `0xa7610A8292850f516603bA0066A731109Dfe854E`
4. `InstanceFactory proxy` - `0x0f9B6646815f118d671084cd73Ea8713b18be354`
5. `InstanceProposalCreator` - `0x39F00b914f8DBD28082D1f1ae9b3210d7F7B404f`
6. `InstanceProposalCreator proxy` - `0xA2980DAfcdAf61C6d39FE63a6360907b69e840c8`

Check addresses with current config:

```shell
    yarn compile
    node -e 'require("./src/generateAddresses").generateWithLog()'
```

Deploy SidechainInstanceFactory:

```shell
    yarn hardhat run scripts/deploySidechainInstanceFactory.js --network mainnet
```

Deploy InstanceProposalCreator:

```shell
    yarn hardhat run scripts/deployInstanceProposalCreator.js --network mainnet
```

Verify on Etherscan:

```
    yarn hardhat verify --network <network-name> <contract-address> <constructor-arguments>
```
