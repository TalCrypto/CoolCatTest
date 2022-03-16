import { ethers } from "hardhat";
import {
  Signer,
  utils,
  BigNumber,
  Contract,
  ContractTransaction,
  ContractReceipt,
  constants,
  Wallet,
} from "ethers";
import { expect, util, assert } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Milk,
  ItemFactory,
  IERC1155,
  IERC1155__factory,
  IERC165__factory,
  IAccessControl,
  IAccessControl__factory,
} from "../typechain-types";
import { Interface } from "../utils";

describe("Item factory", function () {
  let milk: Milk;
  let item: ItemFactory;
  let owner: SignerWithAddress;
  let player: SignerWithAddress;
  const DEFAULT_ADMIN_ROLE = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(0),
    32
  );
  const ADMIN_ROLE = utils.keccak256(utils.toUtf8Bytes("ADMIN_ROLE"));
  const CONTRACT_ROLE = utils.keccak256(utils.toUtf8Bytes("CONTRACT_ROLE"));
  const IERC1155Interface = IERC1155__factory.createInterface();
  const IERC165Interface = IERC165__factory.createInterface();
  const IAccessControlInterface = IAccessControl__factory.createInterface();
  const IERC1155InterfaceId = Interface.getInterfaceID(IERC1155Interface);
  const IERC165InterfaceId = Interface.getInterfaceID(IERC165Interface);
  const IAccessControlInterfaceId = Interface.getInterfaceID(
    IAccessControlInterface
  );

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    player = accounts[1];
    const Milk = await ethers.getContractFactory("Milk");
    milk = (await Milk.deploy("Milk", "Milk")) as Milk;
    await milk.deployed();
    const ItemFactory = await ethers.getContractFactory("ItemFactory");
    item = (await ItemFactory.deploy(
      "http://127.0.0.1/items/{id}.json",
      milk.address
    )) as ItemFactory;
    await item.deployed();
  });

  describe("Deployment", function () {
    it("it should return the right token uri", async function () {
      expect(await item.uri(utils.parseUnits("0"))).to.equal(
        "http://127.0.0.1/items/{id}.json"
      );
    });
    it("owner should have default admin role", async function () {
      expect(await item.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
    it("_milkContractAddress should be the same as the address of milk contrat", async function () {
      expect(await item._milkContractAddress()).to.equal(milk.address);
    });
  });

  describe("Admin functions", function () {
    it("should be reverted when calling setReward without granting ADMIN_ROLE", async function () {
      await expect(
        item.setReward(
          0,
          0,
          utils.defaultAbiCoder.encode(
            ["uint", "uint", "uint[]"],
            [utils.parseEther("18"), utils.parseEther("38"), [0, 2, 3]]
          )
        )
      ).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );
    });
    it("should be reverted when calling setReward with invalid reward data even though having ADMIN_ROLE", async function () {
      await item.grantRole(ADMIN_ROLE, owner.address);
      await expect(
        item.setReward(
          0,
          0,
          utils.defaultAbiCoder.encode(
            ["uint", "uint", "uint[]"],
            [utils.parseEther("38"), utils.parseEther("18"), []]
          )
        )
      ).to.be.revertedWith("ItemFactory: Invalid reward min/max data");
      await expect(
        item.setReward(
          1,
          0,
          utils.defaultAbiCoder.encode(
            ["uint", "uint", "uint[]"],
            [utils.parseEther("18"), utils.parseEther("38"), []]
          )
        )
      ).to.be.revertedWith("ItemFactory: invalid reward items data");
    });
    it("should be success when calling setReward with valid reward data and having ADMIN_ROLE", async function () {
      await item.grantRole(ADMIN_ROLE, owner.address);
      await item.setReward(
        0,
        0,
        utils.defaultAbiCoder.encode(
          ["uint", "uint", "uint[]"],
          [utils.parseEther("18"), utils.parseEther("38"), []]
        )
      );
      await item.setReward(
        1,
        0,
        utils.defaultAbiCoder.encode(["uint", "uint", "uint[]"], [1, 1, [0]])
      );
    });
    it("should be reverted when calling setRarityRolls without granting ADMIN_ROLE", async function () {
      await expect(item.setRarityRolls(0, 1, 2, 3, 4, 5)).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );
    });
    it("should be reverted when calling setRarityRolls with wrong params even though having ADMIN_ROLE", async function () {
      await item.grantRole(ADMIN_ROLE, owner.address);
      await expect(item.setRarityRolls(1, 0, 2, 3, 4, 5)).to.be.revertedWith(
        "ItemFactory: Common must be less rare than uncommon"
      );
      await expect(item.setRarityRolls(0, 2, 1, 3, 4, 5)).to.be.revertedWith(
        "ItemFactory: Uncommon must be less rare than rare"
      );
      await expect(item.setRarityRolls(0, 1, 3, 2, 4, 5)).to.be.revertedWith(
        "ItemFactory: Rare must be less rare than epic"
      );
      await expect(item.setRarityRolls(0, 1, 2, 4, 3, 5)).to.be.revertedWith(
        "ItemFactory: Epic must be less rare than legendary"
      );
      await expect(item.setRarityRolls(0, 1, 2, 3, 5, 4)).to.be.revertedWith(
        "ItemFactory: Legendary rarity level must be less than or equal to the max rarity roll"
      );
    });
    it("should be success when calling setRarityRolls with ADMIN_ROLE and the state vars should be same as the params of the function", async function () {
      await item.grantRole(ADMIN_ROLE, owner.address);
      await item.setRarityRolls(0, 1, 2, 3, 4, 5);
      expect(await item._commonRoll()).to.equal(0);
      expect(await item._uncommonRoll()).to.equal(1);
      expect(await item._rareRoll()).to.equal(2);
      expect(await item._epicRoll()).to.equal(3);
      expect(await item._legendaryRoll()).to.equal(4);
    });
  });
  describe("Transactions", function () {
    beforeEach(async () => {
      await milk.grantRole(CONTRACT_ROLE, item.address);
      await item.grantRole(ADMIN_ROLE, owner.address);
      await item.setReward(
        0,
        0,
        utils.defaultAbiCoder.encode(
          ["uint", "uint", "uint[]"],
          [utils.parseEther("18"), utils.parseEther("38"), []]
        )
      );
      await item.setReward(
        0,
        1,
        utils.defaultAbiCoder.encode(
          ["uint", "uint", "uint[]"],
          [utils.parseEther("27"), utils.parseEther("57"), []]
        )
      );
      await item.setReward(
        0,
        2,
        utils.defaultAbiCoder.encode(
          ["uint", "uint", "uint[]"],
          [utils.parseEther("54"), utils.parseEther("114"), []]
        )
      );
      await item.setReward(
        0,
        3,
        utils.defaultAbiCoder.encode(
          ["uint", "uint", "uint[]"],
          [utils.parseEther("126"), utils.parseEther("226"), []]
        )
      );
      //set for Common reward item
      await item.setReward(
        1,
        0,
        utils.defaultAbiCoder.encode(["uint", "uint", "uint[]"], [1, 1, [0]])
      );
      //set for Uncommon reward item
      await item.setReward(
        1,
        1,
        utils.defaultAbiCoder.encode(["uint", "uint", "uint[]"], [1, 1, [2]])
      );
      //set for Rare reward item
      await item.setReward(
        1,
        2,
        utils.defaultAbiCoder.encode(["uint", "uint", "uint[]"], [1, 1, [3]])
      );
      //set for Epic reward item
      await item.setReward(
        1,
        3,
        utils.defaultAbiCoder.encode(["uint", "uint", "uint[]"], [1, 1, [4]])
      );
    });

    it("should claim either milk or item", async function () {
      const entropy = Math.floor(Math.random() * 1000);
      console.log("         entropy", entropy);
      const tx: ContractTransaction = await item.claim(player.address, entropy);
      const receipt: ContractReceipt = await tx.wait(1);
      const claimEvent = receipt.events?.filter((x) => {
        return x.event == "LogDailyClaim";
      })[0];
      let rewardType, rewardRarity, rewardData;
      claimEvent?.args?.forEach((val, ind) => {
        if (ind == 1) {
          rewardType = BigNumber.from(val).toNumber();
        } else if (ind == 2) {
          rewardRarity = BigNumber.from(val).toNumber();
        } else if (ind == 3) {
          rewardData = val;
        }
      });
      console.log("         rewardType", rewardType);
      console.log("         rewardRarity", rewardRarity);
      if (rewardRarity == 4) {
        expect((await item.balanceOf(player.address, 1)).toNumber()).to.equal(
          1
        );
      } else if (rewardType == 0) {
        const rewardAmount = Number(
          utils.formatEther(await milk.balanceOf(player.address))
        );
        console.log("         milk reward", rewardAmount);
        if (rewardRarity == 0) {
          expect(rewardAmount).to.be.at.least(18);
          expect(rewardAmount).to.be.at.most(38);
        } else if (rewardRarity == 1) {
          expect(rewardAmount).to.be.at.least(27);
          expect(rewardAmount).to.be.at.most(57);
        } else if (rewardRarity == 2) {
          expect(rewardAmount).to.be.at.least(54);
          expect(rewardAmount).to.be.at.most(114);
        } else if (rewardRarity == 3) {
          expect(rewardAmount).to.be.at.least(126);
          expect(rewardAmount).to.be.at.most(226);
        }
      } else {
        let tokenId;
        if (rewardRarity == 0) {
          tokenId = 0;
        } else if (rewardRarity == 1) {
          tokenId = 2;
        } else if (rewardRarity == 2) {
          tokenId = 3;
        } else if (rewardRarity == 3) {
          tokenId = 4;
        } else {
          tokenId = 1;
        }
        console.log("         item id", tokenId);
        expect(
          (await item.balanceOf(player.address, tokenId)).toNumber()
        ).to.equal(1);
      }

      // await expect(item.claim(player.address, 0))
      // .to.emit(item, 'LogDailyClaim')
      // .withArgs(player.address, 1, 0, utils.defaultAbiCoder.encode(["uint", "uint"], [0, 1]));
    });

    it("should be reverted when an account claims more than twice within a day", async function () {
      const entropy1 = Math.floor(Math.random() * 1000);
      await item.claim(player.address, entropy1);
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 - 1]);
      const entropy2 = Math.floor(Math.random() * 1000);
      await expect(item.claim(player.address, entropy2)).to.be.revertedWith(
        "ItemFactory: You can claim once per day"
      );
    });

    it("should be success when an account claims in a day", async function () {
      const entropy1 = Math.floor(Math.random() * 1000);
      await item.claim(player.address, entropy1);
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      const entropy2 = Math.floor(Math.random() * 1000);
      const tx: ContractTransaction = await item.claim(
        player.address,
        entropy2
      );
      const receipt: ContractReceipt = await tx.wait(1);
      expect(receipt.status).to.equal(1);
    });

    it("should be reverted when claiming to zero address", async function () {
      const entropy = Math.floor(Math.random() * 1000);
      await expect(item.claim(constants.AddressZero, entropy)).to.be.reverted;
    });

    it("should support interface of IERC1155 ", async function () {
      expect(
        await item.supportsInterface(
          IERC1155InterfaceId.xor(IERC165InterfaceId)._hex
        )
      ).to.be.true;
    });

    it("should support interface of IAcccessControl ", async function () {
      expect(await item.supportsInterface(IAccessControlInterfaceId._hex)).to.be
        .true;
    });

    it("checking the distribution of claiming", async function () {
      let iteration = 0;
      let statisticsOfType: any = { MILK: 0, BOX: 0 };
      let statisticsOfRarity: any = {
        COMMON: 0,
        UNCOMMON: 0,
        RARE: 0,
        EPIC: 0,
        LEGENDARY: 0,
      };
      while (iteration < 100) {
        iteration++;
        const entropy = Math.floor(Math.random() * 1000);
        const wallet = Wallet.createRandom();
        const tx: ContractTransaction = await item.claim(
          wallet.address,
          entropy
        );
        const receipt: ContractReceipt = await tx.wait(1);
        const claimEvent = receipt.events?.filter((x) => {
          return x.event == "LogDailyClaim";
        })[0];
        let rewardType, rewardRarity;
        claimEvent?.args?.forEach((val, ind) => {
          if (ind == 1) {
            rewardType = BigNumber.from(val).toNumber();
          } else if (ind == 2) {
            rewardRarity = BigNumber.from(val).toNumber();
          }
        });
        if (rewardType == 0) {
          statisticsOfType.MILK++;
        } else {
          statisticsOfType.BOX++;
        }
        if (rewardRarity == 0) {
          statisticsOfRarity.COMMON++;
        } else if (rewardRarity == 1) {
          statisticsOfRarity.UNCOMMON++;
        } else if (rewardRarity == 2) {
          statisticsOfRarity.RARE++;
        } else if (rewardRarity == 3) {
          statisticsOfRarity.EPIC++;
        } else {
          statisticsOfRarity.LEGENDARY++;
        }
      };
      console.log("-----------Theoretical Distribution-------------");
      console.log("{ MILK: 50, BOX: 50 }");
      console.log("{ COMMON: 60, UNCOMMON: 20, RARE: 10, EPIC: 8, LEGENDARY: 2 }");
      console.log("-----------Practical Distribution-------------");
      console.log(statisticsOfType);
      console.log(statisticsOfRarity);
    });
  });
});
