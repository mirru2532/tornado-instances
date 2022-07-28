const { ethers } = require('hardhat')
const config = require('../config')
const { generate } = require('../src/generateAddresses')

async function deploy({ address, bytecode, singletonFactory }) {
  const contractCode = await ethers.provider.getCode(address)
  if (contractCode !== '0x') {
    console.log(`Contract ${address} already deployed. Skipping...`)
    return
  }
  await singletonFactory.deploy(bytecode, config.salt, { gasLimit: config.deployGasLimit })
}

async function main() {
  const singletonFactory = await ethers.getContractAt('SingletonFactory', config.singletonFactory)
  const contracts = await generate()
  await deploy({ ...contracts.factory.implementation, singletonFactory })
  console.log(`Instance factory contract have been deployed on ${contracts.factory.implementation.address}`)
  await deploy({ ...contracts.factory.proxy, singletonFactory })
  console.log(`Instance factory proxy contract have been deployed on ${contracts.factory.proxy.address}`)
  await deploy({ ...contracts.proposalCreator.implementation, singletonFactory })
  console.log(`Proposal creator have been deployed on ${contracts.proposalCreator.implementation.address}`)
  await deploy({ ...contracts.proposalCreator.proxy, singletonFactory })
  console.log(`Proposal creator proxy have been deployed on ${contracts.proposalCreator.proxy.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
