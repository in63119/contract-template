import path from "path";
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

import { ethers } from "hardhat";
// @ts-ignore
import * as namehash from "eth-ens-namehash";

// contracts
import ENSRegistry from "../deployments/baobab/ENSRegistry.json";
import FIFSRegistrar from "../deployments/baobab/FIFSRegistrar.json";
import ReverseRegistrar from "../deployments/baobab/ReverseRegistrar.json";
import PublicResolver from "../deployments/baobab/PublicResolver.json";

const privateKey = process.env.PRIVATE_KEY || ""; // index[0] Owner Private Key
const provider = new ethers.providers.JsonRpcProvider(process.env.BAOBAB_URL);

const tld = "test";
const labelhash = (label: any) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label));
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
  const signer = new ethers.Wallet(privateKey, provider); // index[0] Owner

  // 노드에 대한 오너가 누구인지 확인
  await viewOwner(ENSRegistry.address, signer);

  // 기관에 의한 라벨 등록
  await registLabel(FIFSRegistrar.address, "어떤 라벨", {"여기 Contributor 주소가 있어야 함."},signer);
}

async function viewOwner(ens: any, signer: any) {
  const registryContract = new ethers.Contract(ens, ENSRegistry.abi, signer);
  const node = namehash.hash("resolver");
  const result = await registryContract.owner(node);

  console.log(`현재 [${node}]노드에 해당하는 owner는 "${result}"입니다.`);
}

async function registLabel(registrar: any, label: string, contributor: any, signer: any) {
  const registrarContract = new ethers.Contract(registrar, FIFSRegistrar.abi, signer);
  const result = await registrarContract.register(labelhash(label), contributor);
}

// async function setupResolver(ens: any, resolver: any, signer: any) {
//   const registryContract = new ethers.Contract(ens, ENSRegistry.abi, signer);
//   const resolverContract = new ethers.Contract(resolver, PublicResolver.abi, signer);
//   const resolverNode = namehash.hash("resolver");
//   const resolverLabel = labelhash("resolver");

//   await registryContract.setSubnodeOwner(ZERO_HASH, resolverLabel, signer.address);
//   await registryContract.setResolver(resolverNode, resolver);
//   await resolverContract.functions["setAddr(bytes32,address)"](resolverNode, resolver);
// }

// async function setupRegistrar(ens: any, registrar: any, signer: any) {
//   const registryContract = new ethers.Contract(ens, ENSRegistry.abi, signer);
//   await registryContract.setSubnodeOwner(ZERO_HASH, labelhash(tld), registrar);
// }

// async function setupReverseRegistrar(ens: any, reverseRegistrar: any, signer: any) {
//   const registryContract = new ethers.Contract(ens, ENSRegistry.abi, signer);
//   const gasLimit = 2000000;
//   const tx1 = await registryContract.setSubnodeOwner(ZERO_HASH, labelhash("reverse"), signer.address, { gasLimit });
//   await tx1.wait();
//   const tx2 = await registryContract.setSubnodeOwner(namehash.hash("reverse"), labelhash("addr"), reverseRegistrar, {
//     gasLimit,
//   });
//   await tx2.wait();
// }

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
