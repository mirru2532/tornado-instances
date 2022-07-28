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
  await deploy({ ...contracts.sidechainFactory.implementation, singletonFactory })
  await deploy({ ...contracts.sidechainFactory.proxy, singletonFactory })
  console.log(
    `SidechainInstanceFactory contract have been deployed on ${contracts.sidechainFactory.implementation.address} address`,
  )
  console.log(
    `SidechainInstanceFactory proxy contract have been deployed on ${contracts.sidechainFactory.proxy.address} address`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
