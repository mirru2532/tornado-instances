const { ethers } = require('hardhat')
const defaultConfig = require('../config')

async function generate(config = defaultConfig) {
  const FactoryFactory = await ethers.getContractFactory('MultipleInstanceFactory')
  const deploymentBytecodeFactory =
    FactoryFactory.bytecode +
    FactoryFactory.interface
      .encodeDeploy([config.verifier, config.hasher, config.merkleTreeHeight, config.owner])
      .slice(2)

  const factoryAddress = ethers.utils.getCreate2Address(
    config.singletonFactory,
    config.salt,
    ethers.utils.keccak256(deploymentBytecodeFactory),
  )

  const FactoryWithRegistryFactory = await ethers.getContractFactory('InstanceFactoryWithRegistry')
  const deploymentBytecodeFactoryWithRegistry =
    FactoryWithRegistryFactory.bytecode +
    FactoryWithRegistryFactory.interface
      .encodeDeploy([
        config.verifier,
        config.hasher,
        config.merkleTreeHeight,
        config.governance,
        config.instanceRegistry,
        config.TORN,
        config.UniswapV3Factory,
        config.WETH,
        config.TWAPSlotsMin,
        config.creationFee,
      ])
      .slice(2)

  const factoryWithRegistryAddress = ethers.utils.getCreate2Address(
    config.singletonFactory,
    config.salt,
    ethers.utils.keccak256(deploymentBytecodeFactoryWithRegistry),
  )

  const result = {
    factoryContract: {
      address: factoryAddress,
      bytecode: deploymentBytecodeFactory,
      isProxy: false,
    },
    factoryWithRegistryContract: {
      address: factoryWithRegistryAddress,
      bytecode: deploymentBytecodeFactoryWithRegistry,
      isProxy: false,
    },
  }

  return result
}

async function generateWithLog() {
  const contracts = await generate()
  console.log('MultipleInstanceFactory contract: ', contracts.factoryContract.address)
  console.log('Instance factory with registry contract: ', contracts.factoryWithRegistryContract.address)
  return contracts
}

module.exports = {
  generate,
  generateWithLog,
}
