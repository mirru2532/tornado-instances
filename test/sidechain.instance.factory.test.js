const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')
const config = require('../config')
const { getSignerFromAddress } = require('./utils')
const { generate } = require('../src/generateAddresses')
const { rbigint, createDeposit, toHex, generateProof, initialize } = require('tornado-cli')

describe('Sidechain Instance Factory Tests', () => {
  const addressZero = ethers.constants.AddressZero

  async function fixture() {
    const [sender, deployer] = await ethers.getSigners()

    const owner = await getSignerFromAddress(config.admin)

    await sender.sendTransaction({
      to: config.admin,
      value: ethers.utils.parseEther('1'),
    })

    const compWhale = await getSignerFromAddress(config.compWhale)

    const compToken = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      config.COMP,
    )

    // deploy InstanceFactory with CREATE2
    const singletonFactory = await ethers.getContractAt(
      'SingletonFactory',
      config.singletonFactoryVerboseWrapper,
    )
    const contracts = await generate()
    if ((await ethers.provider.getCode(contracts.sidechainFactory.implementation.address)) == '0x') {
      await singletonFactory.deploy(contracts.sidechainFactory.implementation.bytecode, config.salt, {
        gasLimit: config.deployGasLimit,
      })
    }
    if ((await ethers.provider.getCode(contracts.sidechainFactory.proxy.address)) == '0x') {
      await singletonFactory.deploy(contracts.sidechainFactory.proxy.bytecode, config.salt, {
        gasLimit: config.deployGasLimit,
      })
    }
    const instanceFactory = await ethers.getContractAt(
      'SidechainInstanceFactory',
      contracts.sidechainFactory.proxy.address,
    )

    return {
      sender,
      deployer,
      owner,
      compToken,
      compWhale,
      instanceFactory,
    }
  }

  it('Should have initialized all successfully', async function () {
    const { sender, compToken, instanceFactory } = await loadFixture(fixture)
    expect(sender.address).to.exist
    expect(compToken.address).to.exist
    expect(instanceFactory.address).to.exist
  })

  it('Should set correct params for factory', async function () {
    const { instanceFactory } = await loadFixture(fixture)

    expect(await instanceFactory.verifier()).to.be.equal(config.verifier)
    expect(await instanceFactory.hasher()).to.be.equal(config.hasher)
    expect(await instanceFactory.merkleTreeHeight()).to.be.equal(config.merkleTreeHeight)
    expect(await instanceFactory.ERC20Impl()).to.exist
    expect(await instanceFactory.nativeCurImpl()).to.exist
  })

  it('Admin should be able to set factory params', async function () {
    let { instanceFactory, owner } = await loadFixture(fixture)

    await expect(instanceFactory.setMerkleTreeHeight(1)).to.be.reverted

    instanceFactory = await instanceFactory.connect(owner)

    await instanceFactory.generateNewImplementation(addressZero, addressZero)
    await instanceFactory.setMerkleTreeHeight(1)

    expect(await instanceFactory.verifier()).to.be.equal(addressZero)
    expect(await instanceFactory.hasher()).to.be.equal(addressZero)
    expect(await instanceFactory.merkleTreeHeight()).to.be.equal(1)

    await instanceFactory.generateNewImplementation(config.verifier, config.hasher)
    await instanceFactory.setMerkleTreeHeight(config.merkleTreeHeight)

    expect(await instanceFactory.verifier()).to.be.equal(config.verifier)
    expect(await instanceFactory.hasher()).to.be.equal(config.hasher)
    expect(await instanceFactory.merkleTreeHeight()).to.be.equal(config.merkleTreeHeight)
  })

  it('Should successfully add instance', async function () {
    let { sender, instanceFactory } = await loadFixture(fixture)

    // deploy instance
    await instanceFactory.connect(sender).createInstanceClone(ethers.utils.parseEther('1000'), config.COMP)

    // check instance initialization
    let logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    const instance = await ethers.getContractAt(
      'ERC20TornadoCloneable',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    expect(await instance.token()).to.be.equal(config.COMP)
    expect(await instance.verifier()).to.be.equal(config.verifier)
    expect(await instance.hasher()).to.be.equal(config.hasher)
    expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect(await instance.denomination()).to.equal(ethers.utils.parseEther('1000'))

    // try to deploy the same instance again
    await instanceFactory.connect(sender).createInstanceClone(ethers.utils.parseEther('1000'), config.COMP)

    // check that instance has not been created - no new NewInstanceCloneCreated event
    let curLogs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    expect(curLogs.length).to.be.equal(logs.length)
  })

  it('Should successfully add instances', async function () {
    let { sender, instanceFactory } = await loadFixture(fixture)

    const denominations = [
      ethers.utils.parseEther('1'),
      ethers.utils.parseEther('10'),
      ethers.utils.parseEther('100'),
      ethers.utils.parseEther('1000'),
    ]
    const numInstances = denominations.length

    // deploy instances
    await instanceFactory.connect(sender).createInstanceClones(config.COMP, denominations)

    // check instance initialization
    let logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    for (let i = 0; i < numInstances; i++) {
      let instanceAddr = '0x' + logs[logs.length - numInstances + i].topics[1].slice(-40)
      let instance = await ethers.getContractAt('ERC20TornadoCloneable', instanceAddr)

      expect(await instance.token()).to.be.equal(config.COMP)
      expect(await instance.verifier()).to.be.equal(config.verifier)
      expect(await instance.hasher()).to.be.equal(config.hasher)
      expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
      expect(await instance.denomination()).to.equal(denominations[i])
    }
  })

  it('Should deposit and withdraw into the new instance', async function () {
    let { sender, instanceFactory, compToken, compWhale } = await loadFixture(fixture)

    // deploy instance
    await instanceFactory.connect(sender).createInstanceClone(ethers.utils.parseEther('100'), config.COMP)

    let logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    const instance = await ethers.getContractAt(
      'ERC20TornadoCloneable',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    // check instance work ------------------------------------------
    const depo = createDeposit({
      nullifier: rbigint(31),
      secret: rbigint(31),
    })

    const value = ethers.utils.parseEther('100')

    await compToken.connect(compWhale).transfer(sender.address, value)
    await compToken.connect(sender).approve(instance.address, value)

    await expect(() => instance.deposit(toHex(depo.commitment), [])).to.changeTokenBalances(
      compToken,
      [sender, instance],
      [BigNumber.from(0).sub(value), value],
    )

    let pevents = await instance.queryFilter('Deposit')
    await initialize({ merkleTreeHeight: 20 })

    const { proof, args } = await generateProof({
      deposit: depo,
      recipient: sender.address,
      events: pevents,
    })

    await expect(() => instance.withdraw(proof, ...args)).to.changeTokenBalances(
      compToken,
      [instance, sender],
      [BigNumber.from(0).sub(value), value],
    )
  })

  it('Should successfully add native currency instance', async function () {
    let { sender, instanceFactory } = await loadFixture(fixture)

    const denomination = ethers.utils.parseEther('1')

    // deploy instance
    await instanceFactory.connect(sender).createInstanceClone(denomination, addressZero)

    // check instance initialization
    let logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    const instance = await ethers.getContractAt(
      'ETHTornadoCloneable',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    expect(await instance.verifier()).to.be.equal(config.verifier)
    expect(await instance.hasher()).to.be.equal(config.hasher)
    expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect(await instance.denomination()).to.equal(denomination)

    // try to deploy the same instance again
    await instanceFactory.connect(sender).createInstanceClone(denomination, addressZero)

    // check that instance has not been created - no new NewInstanceCloneCreated event
    let curLogs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    expect(curLogs.length).to.be.equal(logs.length)
  })

  it('Should successfully add native currency instances', async function () {
    let { sender, instanceFactory } = await loadFixture(fixture)

    const denominations = [
      ethers.utils.parseEther('1'),
      ethers.utils.parseEther('10'),
      ethers.utils.parseEther('100'),
      ethers.utils.parseEther('1000'),
    ]
    const numInstances = denominations.length

    // deploy instances
    await instanceFactory.connect(sender).createInstanceClones(addressZero, denominations)

    // check instance initialization
    let logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    for (let i = 0; i < numInstances; i++) {
      let instanceAddr = '0x' + logs[logs.length - numInstances + i].topics[1].slice(-40)
      let instance = await ethers.getContractAt('ETHTornadoCloneable', instanceAddr)

      expect(await instance.verifier()).to.be.equal(config.verifier)
      expect(await instance.hasher()).to.be.equal(config.hasher)
      expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
      expect(await instance.denomination()).to.equal(denominations[i])
    }
  })

  it('Should deposit and withdraw into the new native currency instance', async function () {
    let { sender, instanceFactory } = await loadFixture(fixture)

    const denomination = ethers.utils.parseEther('1.5')

    // deploy instance
    await instanceFactory.connect(sender).createInstanceClone(denomination, addressZero)

    let logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    const instance = await ethers.getContractAt(
      'ETHTornadoCloneable',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    // check instance work ------------------------------------------
    const depo = createDeposit({
      nullifier: rbigint(31),
      secret: rbigint(31),
    })

    await expect(() =>
      instance.connect(sender).deposit(toHex(depo.commitment), {
        value: denomination,
      }),
    ).to.changeEtherBalances([sender, instance], [BigNumber.from(0).sub(denomination), denomination])

    let pevents = await instance.queryFilter('Deposit')
    await initialize({ merkleTreeHeight: 20 })

    const { proof, args } = await generateProof({
      deposit: depo,
      recipient: sender.address,
      events: pevents,
    })

    await expect(() => instance.withdraw(proof, ...args)).to.changeEtherBalances(
      [instance, sender],
      [BigNumber.from(0).sub(denomination), denomination],
    )
  })
})
