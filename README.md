# Tornado Instances

[![build](https://img.shields.io/github/workflow/status/mirru2532/tornado-instances/build)](https://github.com/h-ivor/tornado-instances/actions) [![Coveralls](https://img.shields.io/coveralls/github/mirru2532/tornado-instances)](https://coveralls.io/github/mirru2532/tornado-instances)

## About

This repository serves as a general template repository for deploying proposals for governance for the addition of new tornado ERC20 instances to the tornado proxy.

The contracts offer a template for the addition of 4 new instances for an ERC20 token (the standard way to add new instances) and can also be slightly modified to add a custom amount. The scripts deploy the contracts.

The resources folder contains data necessary for the instances to be deployed and must be filled out. They are initially filled out with the RAI instance data.

### How-To:

Setting up the repository:

```bash
git clone https://github.com/mirru2532/tornado-instances.git
cd tornado-instances
yarn
cp .env.example .env
```

Please fill out .env according to the template provided in it. Please ensure that all of the example values are set to the correct addresses.

### Testing and running scripts:

To run test scripts:

```bash
yarn test
```

Test scripts cover instance factory deployment, proposal deployment and executing proposal (RAI instances).

Running **tasks:**

```bash
# a list of yarn scripts specifically for instance deployment
"deploy:proposal": "yarn hardhat --network mainnet deploy_proposal --factory-address",
"deploy:proposal:test": "yarn hardhat --network goerli deploy_proposal --factory-address",
"deploy:proposal:factory": "yarn hardhat --network mainnet deploy_factory_proposal",
"deploy:proposal:factory:test": "yarn hardhat --network goerli deploy_factory_proposal",
"propose": "yarn hardhat --network mainnet propose_proposal --proposal-address",

# as an example
yarn deploy:proposal:factory

# to call a specific task
yarn hardhat --network <network> <task> <args>
```

## Deploying a proposal for an instance update

Open `resources/instances.js`, a single object which generates an instance contains the following fields (RAI as an example):

```js
{
    tokenAddress: "0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919",
    denomination: "33333333333333333333",
    symbol: "RAI",
    decimals: 18
}
```

`denomination` - tokens can only be deposited in certain denominations into instances, the above considers this instance to have a 100$ denomination, assuming RAI at 3$.
Fill out each of these fields for your own token in the `instance.js` file. This repo supports the addition of a maximum of 6 instances at once. It will automatically detect how many instances are to use.

Now find the factory contract address:

```bash
yarn deploy:proposal <factory address>
```

If testing:

```bash
yarn deploy:proposal:test <factory address>
```

The last step, or first depending on if you are simply proposing the proposal, is taking the address of the deployed proposal and calling:

```bash
yarn propose <proposal address>
```

There is not test implementation for this.
