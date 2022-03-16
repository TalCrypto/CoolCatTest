import { ethers } from "hardhat";
import { Signer, utils, constants } from "ethers";
import { expect, util } from "chai";
import { Milk } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Milk token", function () {
  let milk: Milk;
  let owner: SignerWithAddress;
  let player: SignerWithAddress;
  let recipient: SignerWithAddress;
  const DEFAULT_ADMIN_ROLE=ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32);
  const CONTRACT_ROLE = utils.keccak256(utils.toUtf8Bytes("CONTRACT_ROLE"));
  const DEPOSITOR_ROLE = utils.keccak256(utils.toUtf8Bytes("DEPOSITOR_ROLE"));
  const MASTER_ROLE = utils.keccak256(utils.toUtf8Bytes("MASTER_ROLE"));

  beforeEach(async ()=>{
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    player = accounts[1];
    recipient = accounts[2];
    const Milk = await ethers.getContractFactory("Milk");
    milk = (await Milk.deploy("Milk", "Milk")) as Milk;
    await milk.deployed();
  })

  describe("Deployment", function() {
    it("it should return Milk as name and symbol", async function () {
      expect(await milk.name()).to.equal("Milk");
      expect(await milk.symbol()).to.equal("Milk");
    });
    it("owner should have default admin role", async function () {
      expect(await milk.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
    });
  })

  describe("Transactions", function() {
    it("it should be reverted when calling gameMint without granting CONTRACT_ROLE", async function () {
      await expect(milk.gameMint(owner.address, utils.parseEther("100")))
          .to.be.revertedWith(`AccessControl: account ${(owner.address).toLowerCase()} is missing role ${CONTRACT_ROLE}`);
    });
    it("After gameMint, the balance of a player should be the same as minited amount and the toltal supply is too", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await milk.gameMint(player.address, utils.parseEther("100"));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("100"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("100"));
    });
    it("it should be reverted when calling deposit with CONTRACT_ROLE", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.deposit(owner.address, utils.defaultAbiCoder.encode(["uint"], [utils.parseEther("100")])))
          .to.be.revertedWith(`AccessControl: account ${(owner.address).toLowerCase()} is missing role ${DEPOSITOR_ROLE}`);
    });
    it("After deposit, the balance of a player should be the same as deposited amount and the toltal supply is too", async function () {
      await milk.grantRole(DEPOSITOR_ROLE, owner.address);
      await milk.deposit(player.address, utils.defaultAbiCoder.encode(["uint"], [utils.parseEther("100")]));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("100"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("100"));
    });
    it("After withdraw without any role, the balance of a player should be decreased by the amount and the toltal supply is too", async function () {
      await milk.grantRole(DEPOSITOR_ROLE, owner.address);
      await milk.deposit(player.address, utils.defaultAbiCoder.encode(["uint"], [utils.parseEther("100")]));
      await milk.connect(player).withdraw(utils.parseEther("30"));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("70"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("70"));
    });
    it("After gameWithdraw with CONTRACT_ROLE, the balance of a player should be decreased by the amount and the toltal supply is too", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await milk.gameMint(player.address, utils.parseEther("100"));
      await milk.gameWithdraw(player.address, utils.parseEther("30"));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("70"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("70"));
    });
    it("After gameTransferFrom with CONTRACT_ROLE, the balance of a player should be decreased by the amount, the one of recipient increased and the toltal supply is not changed", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await milk.gameMint(player.address, utils.parseEther("100"));
      await milk.gameTransferFrom(player.address, recipient.address, utils.parseEther("30"));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("70"));
      expect(await milk.balanceOf(recipient.address)).to.equal(utils.parseEther("30"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("100"));
    });
    it("After gameBurn with CONTRACT_ROLE, the balance of a player should be decreased by the amount and the toltal supply is too", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await milk.gameMint(player.address, utils.parseEther("100"));
      await milk.gameBurn(player.address, utils.parseEther("30"));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("70"));
      expect(await milk.balanceOf(milk.address)).to.equal(utils.parseEther("0"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("70"));
    });
    it("Should be reverted when calling mint without MASTER_ROLE", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.mint(player.address, utils.parseEther("100")))
          .to.be.revertedWith(`AccessControl: account ${(owner.address).toLowerCase()} is missing role ${MASTER_ROLE}`);
    });
    it("After mint with MASTER_ROLE, the balance of a player should be the same as minited amount and the toltal supply is too", async function () {
      await milk.grantRole(MASTER_ROLE, owner.address);
      await milk.mint(player.address, utils.parseEther("100"));
      expect(await milk.balanceOf(player.address)).to.equal(utils.parseEther("100"));
      expect(await milk.totalSupply()).to.equal(utils.parseEther("100"));
    });
    it("Should be reverted when deposit to zero address", async function () {
      await milk.grantRole(DEPOSITOR_ROLE, owner.address);
      await expect(milk.deposit(constants.AddressZero, utils.defaultAbiCoder.encode(["uint"], [utils.parseEther("100")])))
          .to.be.revertedWith("ERC20: mint to the zero address");
    });
    it("Should be reverted when gameWithdraw from zero address", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.gameWithdraw(constants.AddressZero, utils.parseEther("30")))
          .to.be.revertedWith("ERC20: burn from the zero address");
    });
    it("Should be reverted when gameMint to zero address", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.gameMint(constants.AddressZero, utils.parseEther("100")))
      .to.be.revertedWith("ERC20: mint to the zero address");
    });
    it("should be reverted when gameTransferFrom from zero address", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.gameTransferFrom(constants.AddressZero, recipient.address, utils.parseEther("30")))
      .to.be.reverted;
    });
    it("should be reverted when gameTransferFrom to zero address", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.gameTransferFrom(player.address, constants.AddressZero, utils.parseEther("30")))
      .to.be.reverted;
    });
    it("should be reverted when gameburn from zero address", async function () {
      await milk.grantRole(CONTRACT_ROLE, owner.address);
      await expect(milk.gameBurn(constants.AddressZero, utils.parseEther("30")))
      .to.be.reverted;
    });
    it("should be reverted when mint to zero address", async function () {
      await milk.grantRole(MASTER_ROLE, owner.address);
      await expect(milk.mint(constants.AddressZero, utils.parseEther("100")))
      .to.be.reverted;
    });
  })
});