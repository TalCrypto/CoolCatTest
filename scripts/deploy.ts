import { ethers, run } from "hardhat";
import { utils } from "ethers";

async function main() {

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Milk = await ethers.getContractFactory("Milk");
  const milk = await Milk.deploy("Milk", "MLK");
  await milk.deployed();
  console.log("Milk address:", milk.address);
  const ItemFactory = await ethers.getContractFactory("ItemFactory");
  const item = await ItemFactory.deploy("http://127.0.0.1/items/{id}.json", milk.address);
  await item.deployed();
  console.log("ItemFactory address:", item.address);

  const CONTRACT_ROLE = utils.keccak256(utils.toUtf8Bytes("CONTRACT_ROLE"));
  await milk.grantRole(CONTRACT_ROLE, item.address);

  await run("verify:verify", {
    address: milk.address,
    constructorArguments: ["Milk", "MLK"],
  });
  await run("verify:verify", {
    address: item.address,
    constructorArguments: ["http://127.0.0.1/items/{id}.json", milk.address],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });