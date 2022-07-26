const { ethers } = require('hardhat')
const defaultConfig = require('../config')

async function upgradableContract({ contractName, implConstructorArgs, proxyConstructorArgs, salt }) {
  const Implementation = await ethers.getContractFactory(contractName)

  const implementationBytecode =
    Implementation.bytecode + Implementation.interface.encodeDeploy(implConstructorArgs).slice(2)

  const implementationAddress = ethers.utils.getCreate2Address(
    defaultConfig.singletonFactory,
    salt,
    ethers.utils.keccak256(implementationBytecode),
  )

  const AdminUpgradeableProxy = await ethers.getContractFactory('AdminUpgradeableProxy')
  const proxyConst = [implementationAddress, ...proxyConstructorArgs]
  const proxyBytecode =
    AdminUpgradeableProxy.bytecode + AdminUpgradeableProxy.interface.encodeDeploy(proxyConst).slice(2)

  const proxyAddress = ethers.utils.getCreate2Address(
    defaultConfig.singletonFactory,
    salt,
    ethers.utils.keccak256(proxyBytecode),
  )

  return {
    implementation: {
      address: implementationAddress,
      bytecode: implementationBytecode,
      args: implConstructorArgs,
    },
    proxy: { address: proxyAddress, bytecode: proxyBytecode, args: proxyConst },
    isProxy: true,
  }
}

async function generate(config = defaultConfig) {
  // factory contract -----------------------------------------------
  const FactoryFactory = await ethers.getContractFactory('MultipleInstanceFactory')
  const FactoryInitData = FactoryFactory.interface.encodeFunctionData('initialize', [
    config.verifier,
    config.hasher,
    config.merkleTreeHeight,
    config.admin,
  ])

  const factoryContract = await upgradableContract({
    contractName: 'MultipleInstanceFactory',
    implConstructorArgs: [],
    proxyConstructorArgs: [config.admin, FactoryInitData],
    salt: config.salt,
  })

  // factory with registry contract ---------------------------------
  const FactoryWithRegistryFactory = await ethers.getContractFactory('InstanceFactoryWithRegistry')
  const FactoryWithRegistryInitData = FactoryWithRegistryFactory.interface.encodeFunctionData(
    'initialize(address,address,uint32,address,uint16,uint256)',
    [
      config.verifier,
      config.hasher,
      config.merkleTreeHeight,
      config.governance,
      config.TWAPSlotsMin,
      config.creationFee,
    ],
  )

  const factoryWithRegistryContract = await upgradableContract({
    contractName: 'InstanceFactoryWithRegistry',
    implConstructorArgs: [
      config.governance,
      config.instanceRegistry,
      config.TORN,
      config.UniswapV3Factory,
      config.WETH,
    ],
    proxyConstructorArgs: [config.governance, FactoryWithRegistryInitData],
    salt: config.salt,
  })

  const result = {
    factoryContract,
    factoryWithRegistryContract,
  }

  return result
}

async function generateWithLog() {
  const contracts = await generate()
  console.log('MultipleInstanceFactory contract: ', contracts.factoryContract.implementation.address)
  console.log('MultipleInstanceFactory proxy contract: ', contracts.factoryContract.proxy.address)
  console.log(
    'Instance factory with registry contract: ',
    contracts.factoryWithRegistryContract.implementation.address,
  )
  console.log(
    'Instance factory with registry proxy contract: ',
    contracts.factoryWithRegistryContract.proxy.address,
  )
  return contracts
}

module.exports = {
  generate,
  generateWithLog,
}
