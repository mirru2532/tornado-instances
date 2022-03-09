const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')
const config = require('../config')
const { getSignerFromAddress, minewait } = require('./utils')
const { PermitSigner } = require('../src/permit.js')
const { generate } = require('../src/generateAddresses')
const { rbigint, createDeposit, toHex, generateProof, initialize } = require('tornado-cli')

describe('Instance Factory With Registry Tests', () => {
  const ProposalState = {
    Pending: 0,
    Active: 1,
    Defeated: 2,
    Timelocked: 3,
    AwaitingExecution: 4,
    Executed: 5,
    Expired: 6,
  }

  const addressZero = ethers.constants.AddressZero

  async function fixture() {
    const [sender, deployer, multisig] = await ethers.getSigners()

    const tornWhale = await getSignerFromAddress(config.tornWhale)

    const compWhale = await getSignerFromAddress(config.compWhale)

    const gov = await ethers.getContractAt('Governance', config.governance)

    const router = await ethers.getContractAt(
      'tornado-relayer-registry/contracts/tornado-proxy/TornadoRouter.sol:TornadoRouter',
      config.router,
    )

    const tornToken = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
      config.TORN,
    )

    const compToken = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      config.COMP,
    )

    const instanceRegistry = await ethers.getContractAt(
      'tornado-relayer-registry/contracts/tornado-proxy/InstanceRegistry.sol:InstanceRegistry',
      config.instanceRegistry,
    )

    // deploy InstanceFactoryWithRegistry with CREATE2
    const singletonFactory = await ethers.getContractAt(
      'SingletonFactory',
      config.singletonFactoryVerboseWrapper,
    )
    const contracts = await generate()
    if ((await ethers.provider.getCode(contracts.factoryWithRegistryContract.address)) == '0x') {
      await singletonFactory.deploy(contracts.factoryWithRegistryContract.bytecode, config.salt, {
        gasLimit: config.deployGasLimit,
      })
    }
    const instanceFactory = await ethers.getContractAt(
      'InstanceFactoryWithRegistry',
      contracts.factoryWithRegistryContract.address,
    )

    return {
      sender,
      deployer,
      multisig,
      tornWhale,
      compWhale,
      router,
      gov,
      tornToken,
      compToken,
      instanceRegistry,
      instanceFactory,
    }
  }

  it('Should have initialized all successfully', async function () {
    const { sender, gov, tornToken, instanceRegistry, instanceFactory } = await loadFixture(fixture)
    expect(sender.address).to.exist
    expect(gov.address).to.exist
    expect(tornToken.address).to.exist
    expect(instanceRegistry.address).to.exist
    expect(instanceFactory.address).to.exist
  })

  it('Should set correct params for factory', async function () {
    const { instanceFactory } = await loadFixture(fixture)

    expect(await instanceFactory.governance()).to.be.equal(config.governance)
    expect(await instanceFactory.verifier()).to.be.equal(config.verifier)
    expect(await instanceFactory.hasher()).to.be.equal(config.hasher)
    expect(await instanceFactory.merkleTreeHeight()).to.be.equal(config.merkleTreeHeight)
    expect(await instanceFactory.implementation()).to.exist
    expect(await instanceFactory.creationFee()).to.be.equal(config.creationFee)
    expect(await instanceFactory.torn()).to.be.equal(config.TORN)
  })

  it('Governance should be able to set factory params', async function () {
    let { instanceFactory, gov } = await loadFixture(fixture)

    await expect(instanceFactory.setVerifier(addressZero)).to.be.reverted

    const govSigner = await getSignerFromAddress(gov.address)
    instanceFactory = await instanceFactory.connect(govSigner)

    await instanceFactory.setVerifier(addressZero)
    await instanceFactory.setHasher(addressZero)
    await instanceFactory.setMerkleTreeHeight(1)
    await instanceFactory.setCreationFee(0)

    expect(await instanceFactory.verifier()).to.be.equal(addressZero)
    expect(await instanceFactory.hasher()).to.be.equal(addressZero)
    expect(await instanceFactory.merkleTreeHeight()).to.be.equal(1)
    expect(await instanceFactory.creationFee()).to.be.equal(0)

    await instanceFactory.setVerifier(config.verifier)
    await instanceFactory.setHasher(config.hasher)
    await instanceFactory.setMerkleTreeHeight(config.merkleTreeHeight)
    await instanceFactory.setCreationFee(config.creationFee)

    expect(await instanceFactory.verifier()).to.be.equal(config.verifier)
    expect(await instanceFactory.hasher()).to.be.equal(config.hasher)
    expect(await instanceFactory.merkleTreeHeight()).to.be.equal(config.merkleTreeHeight)
    expect(await instanceFactory.creationFee()).to.be.equal(config.creationFee)
  })

  it('Should successfully deploy/propose/execute proposal - add instance', async function () {
    let { sender, instanceFactory, gov, instanceRegistry, tornWhale, tornToken } = await loadFixture(fixture)

    // deploy proposal ----------------------------------------------
    await tornToken.connect(tornWhale).transfer(sender.address, config.creationFee)
    await tornToken.approve(instanceFactory.address, config.creationFee)

    await expect(() =>
      instanceFactory
        .connect(sender)
        .createProposalApprove(config.COMP, 3000, [ethers.utils.parseEther('100')], [30]),
    ).to.changeTokenBalances(
      tornToken,
      [sender, gov],
      [BigNumber.from(0).sub(config.creationFee), config.creationFee],
    )

    let logs = await instanceFactory.queryFilter('NewGovernanceProposalCreated')
    const proposal = await ethers.getContractAt(
      'AddInstanceProposal',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    expect(await proposal.instanceFactory()).to.be.equal(instanceFactory.address)
    expect(await proposal.instanceRegistry()).to.be.equal(instanceRegistry.address)
    expect(await proposal.token()).to.be.equal(config.COMP)
    expect(await proposal.uniswapPoolSwappingFee()).to.be.equal(3000)
    expect(await proposal.numInstances()).to.be.equal(1)
    expect(await proposal.protocolFeeByIndex(0)).to.be.equal(30)
    expect(await proposal.denominationByIndex(0)).to.be.equal(ethers.utils.parseEther('100'))

    // propose proposal ---------------------------------------------
    let response, id, state
    gov = await gov.connect(tornWhale)
    await tornToken.connect(tornWhale).approve(gov.address, ethers.utils.parseEther('26000'))
    await gov.lockWithApproval(ethers.utils.parseEther('26000'))

    response = await gov.propose(proposal.address, 'COMP token instance proposal')
    id = await gov.latestProposalIds(tornWhale.address)
    state = await gov.state(id)

    const { events } = await response.wait()
    const args = events.find(({ event }) => event == 'ProposalCreated').args
    expect(args.id).to.be.equal(id)
    expect(args.proposer).to.be.equal(tornWhale.address)
    expect(args.target).to.be.equal(proposal.address)
    expect(args.description).to.be.equal('COMP token instance proposal')
    expect(state).to.be.equal(ProposalState.Pending)

    // execute proposal ---------------------------------------------
    await minewait((await gov.VOTING_DELAY()).add(1).toNumber())
    await expect(gov.castVote(id, true)).to.not.be.reverted
    expect(await gov.state(id)).to.be.equal(ProposalState.Active)
    await minewait(
      (
        await gov.VOTING_PERIOD()
      )
        .add(await gov.EXECUTION_DELAY())
        .add(96400)
        .toNumber(),
    )
    expect(await gov.state(id)).to.be.equal(ProposalState.AwaitingExecution)

    let tx = await gov.execute(id)

    expect(await gov.state(id)).to.be.equal(ProposalState.Executed)

    // check instance initialization --------------------------------
    let receipt = await tx.wait()
    const instanceAddr = '0x' + receipt.events[0].topics[1].toString().slice(-40)
    const instance = await ethers.getContractAt('ERC20TornadoCloneable', instanceAddr)

    expect(await instance.token()).to.be.equal(config.COMP)
    expect(await instance.verifier()).to.be.equal(config.verifier)
    expect(await instance.hasher()).to.be.equal(config.hasher)
    expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect(await instance.denomination()).to.equal(ethers.utils.parseEther('100'))

    const instanceData = await instanceRegistry.instances(instance.address)
    expect(instanceData.isERC20).to.be.equal(true)
    expect(instanceData.token).to.be.equal(config.COMP)
    expect(instanceData.state).to.be.equal(1)
    expect(instanceData.uniswapPoolSwappingFee).to.be.equal(3000)
    expect(instanceData.protocolFeePercentage).to.be.equal(30)
  })

  it('Should successfully deploy/propose/execute proposal - add instances', async function () {
    let { sender, instanceFactory, gov, instanceRegistry, tornWhale, tornToken } = await loadFixture(fixture)

    // deploy proposal ----------------------------------------------
    await tornToken.connect(tornWhale).transfer(sender.address, config.creationFee)
    await tornToken.approve(instanceFactory.address, config.creationFee)

    await expect(() =>
      instanceFactory
        .connect(sender)
        .createProposalApprove(
          config.COMP,
          3000,
          [ethers.utils.parseEther('100'), ethers.utils.parseEther('1000')],
          [30, 30],
        ),
    ).to.changeTokenBalances(
      tornToken,
      [sender, gov],
      [BigNumber.from(0).sub(config.creationFee), config.creationFee],
    )

    let logs = await instanceFactory.queryFilter('NewGovernanceProposalCreated')
    const proposal = await ethers.getContractAt(
      'AddInstanceProposal',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    expect(await proposal.instanceFactory()).to.be.equal(instanceFactory.address)
    expect(await proposal.instanceRegistry()).to.be.equal(instanceRegistry.address)
    expect(await proposal.token()).to.be.equal(config.COMP)
    expect(await proposal.uniswapPoolSwappingFee()).to.be.equal(3000)
    expect(await proposal.numInstances()).to.be.equal(2)
    expect(await proposal.protocolFeeByIndex(0)).to.be.equal(30)
    expect(await proposal.protocolFeeByIndex(1)).to.be.equal(30)
    expect(await proposal.denominationByIndex(0)).to.be.equal(ethers.utils.parseEther('100'))
    expect(await proposal.denominationByIndex(1)).to.be.equal(ethers.utils.parseEther('1000'))

    // propose proposal ---------------------------------------------
    let response, id, state
    gov = await gov.connect(tornWhale)
    await tornToken.connect(tornWhale).approve(gov.address, ethers.utils.parseEther('26000'))
    await gov.lockWithApproval(ethers.utils.parseEther('26000'))

    response = await gov.propose(proposal.address, 'COMP token instances proposal')
    id = await gov.latestProposalIds(tornWhale.address)
    state = await gov.state(id)

    const { events } = await response.wait()
    const args = events.find(({ event }) => event == 'ProposalCreated').args
    expect(args.id).to.be.equal(id)
    expect(args.proposer).to.be.equal(tornWhale.address)
    expect(args.target).to.be.equal(proposal.address)
    expect(args.description).to.be.equal('COMP token instances proposal')
    expect(state).to.be.equal(ProposalState.Pending)

    // execute proposal ---------------------------------------------
    await minewait((await gov.VOTING_DELAY()).add(1).toNumber())
    await expect(gov.castVote(id, true)).to.not.be.reverted
    expect(await gov.state(id)).to.be.equal(ProposalState.Active)
    await minewait(
      (
        await gov.VOTING_PERIOD()
      )
        .add(await gov.EXECUTION_DELAY())
        .add(96400)
        .toNumber(),
    )
    expect(await gov.state(id)).to.be.equal(ProposalState.AwaitingExecution)

    await gov.execute(id)

    expect(await gov.state(id)).to.be.equal(ProposalState.Executed)

    // check instances initialization -------------------------------
    logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    let instanceAddr = '0x' + logs[logs.length - 2].topics[1].slice(-40)
    let instance = await ethers.getContractAt('ERC20TornadoCloneable', instanceAddr)

    expect(await instance.token()).to.be.equal(config.COMP)
    expect(await instance.verifier()).to.be.equal(config.verifier)
    expect(await instance.hasher()).to.be.equal(config.hasher)
    expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect(await instance.denomination()).to.equal(ethers.utils.parseEther('100'))

    let instanceData = await instanceRegistry.instances(instance.address)
    expect(instanceData.isERC20).to.be.equal(true)
    expect(instanceData.token).to.be.equal(config.COMP)
    expect(instanceData.state).to.be.equal(1)
    expect(instanceData.uniswapPoolSwappingFee).to.be.equal(3000)
    expect(instanceData.protocolFeePercentage).to.be.equal(30)

    instanceAddr = '0x' + logs[logs.length - 1].topics[1].slice(-40)
    instance = await ethers.getContractAt('ERC20TornadoCloneable', instanceAddr)

    expect(await instance.token()).to.be.equal(config.COMP)
    expect(await instance.verifier()).to.be.equal(config.verifier)
    expect(await instance.hasher()).to.be.equal(config.hasher)
    expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect(await instance.denomination()).to.equal(ethers.utils.parseEther('1000'))

    instanceData = await instanceRegistry.instances(instance.address)
    expect(instanceData.isERC20).to.be.equal(true)
    expect(instanceData.token).to.be.equal(config.COMP)
    expect(instanceData.state).to.be.equal(1)
    expect(instanceData.uniswapPoolSwappingFee).to.be.equal(3000)
    expect(instanceData.protocolFeePercentage).to.be.equal(30)
  })

  it('Should successfully deploy proposal with permit', async function () {
    let { instanceFactory, gov, instanceRegistry, tornWhale, tornToken } = await loadFixture(fixture)

    const privateKey = '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3'
    const publicKey = '0x' + ethers.utils.computeAddress(Buffer.from(privateKey.slice(2), 'hex'))
    const sender = await ethers.getSigner(publicKey.slice(2))

    await expect(() =>
      tornToken.connect(tornWhale).transfer(sender.address, config.creationFee),
    ).to.changeTokenBalances(
      tornToken,
      [tornWhale, sender],
      [BigNumber.from(0).sub(config.creationFee), config.creationFee],
    )

    // prepare permit data
    const domain = {
      name: await tornToken.name(),
      version: '1',
      chainId: 1,
      verifyingContract: tornToken.address,
    }

    const curTimestamp = Math.trunc(new Date().getTime() / 1000)
    const args = {
      owner: sender,
      spender: instanceFactory.address,
      value: config.creationFee,
      nonce: 0,
      deadline: curTimestamp + 1000,
    }

    const permitSigner = new PermitSigner(domain, args)
    const signature = await permitSigner.getSignature(privateKey)
    const signer = await permitSigner.getSignerAddress(args, signature.hex)
    expect(signer).to.equal(sender.address)

    await expect(() =>
      instanceFactory.createProposalPermit(
        config.COMP,
        3000,
        [ethers.utils.parseEther('100')],
        [30],
        sender.address,
        args.deadline.toString(),
        signature.v,
        signature.r,
        signature.s,
      ),
    ).to.changeTokenBalances(
      tornToken,
      [sender, gov],
      [BigNumber.from(0).sub(config.creationFee), config.creationFee],
    )

    let logs = await instanceFactory.queryFilter('NewGovernanceProposalCreated')
    const proposal = await ethers.getContractAt(
      'AddInstanceProposal',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    expect(await proposal.instanceFactory()).to.be.equal(instanceFactory.address)
    expect(await proposal.instanceRegistry()).to.be.equal(instanceRegistry.address)
    expect(await proposal.token()).to.be.equal(config.COMP)
    expect(await proposal.uniswapPoolSwappingFee()).to.be.equal(3000)
    expect(await proposal.numInstances()).to.be.equal(1)
    expect(await proposal.protocolFeeByIndex(0)).to.be.equal(30)
    expect(await proposal.denominationByIndex(0)).to.be.equal(ethers.utils.parseEther('100'))
  })

  it('Should deposit and withdraw into the new instance', async function () {
    let { sender, instanceFactory, gov, tornWhale, tornToken, router, compToken, compWhale } =
      await loadFixture(fixture)

    // deploy proposal ----------------------------------------------
    await tornToken.connect(tornWhale).transfer(sender.address, config.creationFee)
    await tornToken.approve(instanceFactory.address, config.creationFee)

    await expect(() =>
      instanceFactory
        .connect(sender)
        .createProposalApprove(config.COMP, 3000, [ethers.utils.parseEther('100')], [30]),
    ).to.changeTokenBalances(
      tornToken,
      [sender, gov],
      [BigNumber.from(0).sub(config.creationFee), config.creationFee],
    )

    let logs = await instanceFactory.queryFilter('NewGovernanceProposalCreated')
    const proposal = await ethers.getContractAt(
      'AddInstanceProposal',
      ethers.utils.getAddress('0x' + logs[logs.length - 1].topics[1].slice(-40)),
    )

    // propose proposal ---------------------------------------------
    let id
    gov = await gov.connect(tornWhale)
    await tornToken.connect(tornWhale).approve(gov.address, ethers.utils.parseEther('26000'))
    await gov.lockWithApproval(ethers.utils.parseEther('26000'))

    await gov.propose(proposal.address, 'COMP token instance proposal')
    id = await gov.latestProposalIds(tornWhale.address)

    // execute proposal ---------------------------------------------
    await minewait((await gov.VOTING_DELAY()).add(1).toNumber())
    await expect(gov.castVote(id, true)).to.not.be.reverted
    await minewait(
      (
        await gov.VOTING_PERIOD()
      )
        .add(await gov.EXECUTION_DELAY())
        .add(96400)
        .toNumber(),
    )

    let tx = await gov.execute(id)
    let receipt = await tx.wait()
    const instanceAddr = '0x' + receipt.events[0].topics[1].toString().slice(-40)
    const instance = await ethers.getContractAt('ERC20TornadoCloneable', instanceAddr)

    // check instance work ------------------------------------------
    const depo = createDeposit({
      nullifier: rbigint(31),
      secret: rbigint(31),
    })

    const value = ethers.utils.parseEther('100')

    await compToken.connect(compWhale).transfer(sender.address, value)
    await compToken.connect(sender).approve(router.address, value)

    await expect(() => router.deposit(instance.address, toHex(depo.commitment), [])).to.changeTokenBalances(
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

    await expect(() => router.withdraw(instance.address, proof, ...args)).to.changeTokenBalances(
      compToken,
      [instance, sender],
      [BigNumber.from(0).sub(value), value],
    )
  })
})
