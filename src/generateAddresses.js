const { ethers } = require('hardhat')
const defaultConfig = require('../config')

async function generate(config = defaultConfig) {
  const FactoryFactory = await ethers.getContractFactory('InstanceFactory')
  const deploymentBytecodeFactory =
    FactoryFactory.bytecode +
    FactoryFactory.interface
      .encodeDeploy([
        config.verifier,
        config.hasher,
        config.merkleTreeHeight,
        config.governance,
        config.instanceRegistry,
        config.TORN,
        config.creationFee,
      ])
      .slice(2)

  const factoryAddress = ethers.utils.getCreate2Address(
    config.singletonFactory,
    config.salt,
    ethers.utils.keccak256(deploymentBytecodeFactory),
  )

  const result = {
    factoryContract: {
      address: factoryAddress,
      bytecode: deploymentBytecodeFactory,
      isProxy: false,
    },
  }

  return result
}

async function generateWithLog() {
  const contracts = await generate()
  console.log('Instance factory contract: ', contracts.factoryContract.address)
  return contracts
}

module.exports = {
  generate,
  generateWithLog,
}
