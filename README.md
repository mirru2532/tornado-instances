# Tornado Instances

[![build](https://img.shields.io/github/workflow/status/mirru2532/tornado-instances/build)](https://github.com/h-ivor/tornado-instances/actions) [![Coveralls](https://img.shields.io/coveralls/github/mirru2352/tornado-instances)](https://coveralls.io/github/mirru2352/tornado-instances)

## About

This repository serves as a general template for deploying a tornado instance factory, deploying a proposal for the addition of multiple ERC20 tornado instances and proposing the registration of these instances with the Tornado Proxy (0x722122dF12D4e14e13Ac3b6895a86e84145b6967) through governance vote.

The scripts should help users do this programmatically, quickly. There are three tasks (scripts). Note that non-task scripts have been deprecated but are still kept for more insight into the working process.

### How-To:

Setting up the repository:

```bash
git clone https://github.com/mirru2532/tornado-instances.git
cd tornado-instances
yarn
cp .env.example .env
```

Please fill out .env according to the template provided in it.

### Testing and running scripts:

To run test scripts:

```bash
yarn test
```

Test scripts cover instance factory deployment, proposal deployment and executing proposal (RAI instances).

Running **tasks:**

```bash
# a list of yarn scripts specifically for instance deployment
"deploy:factory": "yarn hardhat --network mainnet deploy_factory",
"deploy:proposal": "yarn hardhat --network mainnet deploy_proposal --factory-address",
"deploy:factory:test": "yarn hardhat --network goerli deploy_factory",
"deploy:proposal:test": "yarn hardhat --network goerli deploy_proposal --factory-address",
"propose": "yarn hardhat --network mainnet propose_proposal --proposal-address"

# as an example
yarn deploy:factory

# to call a specific task
yarn hardhat --network <network> <task> <args>
```

Running scripts (deprecated):

```bash
yarn hardhat --network <network> run scripts/<script to run>
```

### Deploying a proposal for an instance update

Open `resources/instances.js`, a single object which generates an instance contains the following fields (RAI as an example):

```js
{
    tokenAddress: "0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919",
    denomination: "33333333333333333333",
    domain: "rai-100.tornadocash.eth",
    symbol: "RAI",
    decimals: 18
}
```

`denomination` - tokens can only be deposited in certain denominations into instances, the above considers this instance to have a 100$ denomination, assuming RAI at 3$.
`domain` - resolves to the address of the instance.
Fill out each of these fields for your own token in the `instance.js` file. Please note that these contracts support deployments of exactly 4 denominations, as is the standard with which we have been deploying. If you would like to add more instances, contact me below or modify contracts independently.

Now find the factory contract address, or deploy one if one has not been deployed (unlikely):

**If factory not deployed:**

```bash
yarn deploy:factory
```

If testing:

```bash
yarn deploy:factory:test
```

**If factory is already deployed, continue here:**

And now take the contract address which you should see in the command line interface and add this to:

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
