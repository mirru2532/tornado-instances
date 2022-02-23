# Tornado Instances Factory

## About

This repository contains governance proposal factory for the addition of new Tornado ERC20 instances to the Tornado router.

Anyone can create governance proposal for the addition of a new ERC20 instance by calling `createProposalApprove/createProposalPermit` method of the factory with parameters (proposal creation fee in TORN is charged from sender):

1. `address token` - address of ERC20 token for a new instance
2. `uint24 uniswapPoolSwappingFee` - fee value of Uniswap instance which will be used for `TORN/token` price determination. `3000` means 0.3% fee Uniswap pool.
3. `uint256[] denominations` - list of denominations for each new instance (tokens can only be deposited in certain denominations into instances).
4. `uint32[] protocolFees` - list of protocol fees for each new instance (this fee is only charged from registrated relayer during withdrawal process). `100` means 1% of instance denomination fee for withdrawal throw registrated relayer.

## Factory parameters

1. `max number of new instances in one proposal` - the current version supports the addition of a maximum of 3 instances at once.
2. `proposal creation fee` - this fee is charged from creator of proposal during `createProposalApprove/createProposalPermit` factory method execution. It can be changed by governance. Default value is stored in `config.js`.

## Warnings

1. This version of the factory creates a proposal for **immutable** Tornado instance initialization.
2. Users should manually propose a proposal after its creation using the factory (in governance UI for example). As `propose()` method caller must have 1000 TORN locked in the governance. Moreover, the proposer can't propose more than one proposal simultaneously.

## Tests

Setting up the repository:

```bash
git clone https://github.com/mirru2532/tornado-instances.git
cd tornado-instances
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

1. `InstanceFactory` - `0x7a6e627DC6F66617b4A74Be097A8f56c622fa24c`

Check addresses with current config:

```shell
yarn compile
node -e 'require("./src/generateAddresses").generateWithLog()'
```

Deploy InstanceFactory:

```shell
npx hardhat run scripts/deployInstanceFactory.js --network mainnet
```
