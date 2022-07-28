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
  // sidechain factory contract -------------------------------------
  const SidechainFactory = await ethers.getContractFactory('SidechainInstanceFactory')
  const SidechainFactoryInitData = SidechainFactory.interface.encodeFunctionData('initialize', [
    config.verifier,
    config.hasher,
    config.merkleTreeHeight,
    config.admin,
  ])

  const sidechainFactory = await upgradableContract({
    contractName: 'SidechainInstanceFactory',
    implConstructorArgs: [],
    proxyConstructorArgs: [config.admin, SidechainFactoryInitData],
    salt: config.salt,
  })

  // factory with registry contract ---------------------------------
  const Factory = await ethers.getContractFactory('InstanceFactory')
  const FactoryInitData = Factory.interface.encodeFunctionData('initialize', [
    config.verifier,
    config.hasher,
    config.merkleTreeHeight,
    config.governance,
  ])

  const factory = await upgradableContract({
    contractName: 'InstanceFactory',
    implConstructorArgs: [],
    proxyConstructorArgs: [config.governance, FactoryInitData],
    salt: config.salt,
  })

  const ProposalCreator = await ethers.getContractFactory('InstanceProposalCreator')
  const ProposalCreatorInitData = ProposalCreator.interface.encodeFunctionData('initialize', [
    config.TWAPSlotsMin,
    config.creationFee,
  ])

  const proposalCreator = await upgradableContract({
    contractName: 'InstanceProposalCreator',
    implConstructorArgs: [
      config.governance,
      factory.proxy.address,
      config.instanceRegistry,
      config.TORN,
      config.UniswapV3Factory,
      config.WETH,
    ],
    proxyConstructorArgs: [config.governance, ProposalCreatorInitData],
    salt: config.salt,
  })

  const result = {
    sidechainFactory,
    factory,
    proposalCreator,
  }

  return result
}

async function generateWithLog() {
  const contracts = await generate()
  console.log('SidechainInstanceFactory contract: ', contracts.sidechainFactory.implementation.address)
  console.log('SidechainInstanceFactory proxy contract: ', contracts.sidechainFactory.proxy.address)
  console.log('Instance factory contract: ', contracts.factory.implementation.address)
  console.log('Instance factory proxy contract: ', contracts.factory.proxy.address)
  console.log('Proposal creator contract: ', contracts.proposalCreator.implementation.address)
  console.log('Proposal creator proxy contract: ', contracts.proposalCreator.proxy.address)
  return contracts
}

module.exports = {
  generate,
  generateWithLog,
}
