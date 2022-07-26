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
  await deploy({ ...contracts.factoryWithRegistryContract.implementation, singletonFactory })
  await deploy({ ...contracts.factoryWithRegistryContract.proxy, singletonFactory })
  console.log(
    `Instance factory with registry contract have been deployed on ${contracts.factoryWithRegistryContract.implementation.address} address`,
  )
  console.log(
    `Instance factory with registry proxy contract have been deployed on ${contracts.factoryWithRegistryContract.proxy.address} address`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
