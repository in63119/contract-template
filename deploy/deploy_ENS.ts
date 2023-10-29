const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
// @ts-ignore
import * as namehash from "eth-ens-namehash";

const privateKey = process.env.PRIVATE_KEY || "";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const tld = "test";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const signers = [new ethers.Wallet(privateKey)];
  const accounts = signers.map((s) => s.address);

  const ens = await deploy("ENSRegistry", {
    from: accounts[0],
    gasLimit: 4000000,
    args: [],
    log: true,
  });

  const resolver = await deploy("PublicResolver", {
    from: accounts[0],
    gasLimit: 4000000,
    args: [ens.address, ZERO_ADDRESS],
    log: true,
  });

  await deploy("FIFSRegistrar", {
    from: accounts[0],
    gasLimit: 4000000,
    args: [ens.address, namehash.hash(tld)],
    log: true,
  });

  await deploy("ReverseRegistrar", {
    from: accounts[0],
    gasLimit: 4000000,
    args: [ens.address, resolver.address],
    log: true,
  });
};

func.tags = ["ENSRegistry", "PublicResolver", "FIFSRegistrar", "ReverseRegistrar"];
export default func;
