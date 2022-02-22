const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')
const { rbigint, createDeposit, toHex, generateProof, initialize } = require('tornado-cli')
const config = require('../config')
const { getSignerFromAddress, minewait } = require('./utils')

describe('Instance Factory Tests', () => {
  const ProposalState = {
    Pending: 0,
    Active: 1,
    Defeated: 2,
    Timelocked: 3,
    AwaitingExecution: 4,
    Executed: 5,
    Expired: 6,
  }

  async function fixture() {
    const [sender, deployer, multisig] = await ethers.getSigners()

    const tornWhale = await getSignerFromAddress(config.tornWhale)
    const compWhale = await getSignerFromAddress(config.compWhale)

    let gov = await ethers.getContractAt('Governance', config.governance)

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

    const router = await ethers.getContractAt(
      'tornado-relayer-registry/contracts/tornado-proxy/TornadoRouter.sol:TornadoRouter',
      config.router,
    )

    // deploy instance factory
    const InstanceFactory = await ethers.getContractFactory('InstanceFactory')
    const instanceFactory = await InstanceFactory.connect(deployer).deploy(
      config.verifier,
      config.hasher,
      config.merkleTreeHeight,
      config.governance,
      config.instanceRegistry,
      config.TORN,
      config.creationFee,
    )
    await instanceFactory.deployed()

    // deploy proposal
    await tornToken.connect(tornWhale).transfer(sender.address, config.creationFee)
    await tornToken.approve(instanceFactory.address, config.creationFee)

    await instanceFactory
      .connect(sender)
      .createProposalApprove(config.COMP, 3000, [ethers.utils.parseEther('100')], [30])

    let logs = await instanceFactory.queryFilter('NewGovernanceProposalCreated')
    const proposal = await ethers.getContractAt(
      'AddInstanceProposal',
      ethers.utils.getAddress('0x' + logs[0].topics[1].slice(-40)),
    )

    // propose proposal
    gov = await gov.connect(tornWhale)
    await tornToken.connect(tornWhale).approve(gov.address, ethers.utils.parseEther('26000'))
    await gov.lockWithApproval(ethers.utils.parseEther('26000'))
    await gov.propose(proposal.address, 'COMP token instance proposal')
    const id = await gov.latestProposalIds(tornWhale.address)

    // execute proposal
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

    logs = await instanceFactory.queryFilter('NewInstanceCloneCreated')
    const instance = await ethers.getContractAt(
      'ERC20TornadoCloneable',
      ethers.utils.getAddress('0x' + logs[0].topics[1].slice(-40)),
    )

    return {
      sender,
      deployer,
      multisig,
      tornWhale,
      compWhale,
      gov,
      tornToken,
      compToken,
      instanceRegistry,
      router,
      instanceFactory,
      instance,
    }
  }

  it('Should set correct params for factory', async function () {
    const { instance } = await loadFixture(fixture)

    expect(await instance.token()).to.be.equal(config.COMP)
    expect(await instance.verifier()).to.be.equal(config.verifier)
    expect(await instance.hasher()).to.be.equal(config.hasher)
    expect(await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect(await instance.denomination()).to.equal(ethers.utils.parseEther('100'))
  })

  it('Should deposit and withdraw into the new instance', async function () {
    const { sender, instance, compToken, compWhale, router } = await loadFixture(fixture)

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
