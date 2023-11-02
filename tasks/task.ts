import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
// @ts-ignore
import * as namehash from "eth-ens-namehash";
import path from "path";
import shelljs from "shelljs";

// Hardhat 배포를 위한 이전파일 삭제경로
const directoryPath = path.join(__dirname, "../deployments/hardhat");

// contracts
import ENSRegistry from "../deployments/hardhat/ENSRegistry.json";
import FIFSRegistrar from "../deployments/hardhat/FIFSRegistrar.json";
import ReverseRegistrar from "../deployments/hardhat/ReverseRegistrar.json";
import PublicResolver from "../deployments/hardhat/PublicResolver.json";

// Setting value
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const tld = "test";
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

task("ens", "이것은 ENS 테스트를 위한 명령어입니다.").setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
  console.log("ENS 배포를 위해 프로젝트를 초기화합니다.");
  shelljs.rm("-rf", directoryPath);
  console.log("    ");

  const { ethers, run, deployments } = hre;
  const accounts = await ethers.getSigners();

  /* 
  - 필수 주체
      - Owner [#0]: 기반 컨트랙트 (Infra contracts; 주로 하나씩만 존재함)의 최고 권한자. 
                    중요한 설정을 변경하거나 Contributor를 관리할 수 있다. 재단 또는 GC거버넌스를 상정하고 있다.
      - Contributor [#1]: 기관 참여자. 모든 레코드를 변경할 수 있는 권한을 가진다. 
                          재단, Scope, Finder 등을 상정하고 있다.
  - 추가기능에 따라 필요할 수도 있음
      - CommMod [#2]: Community Moderator. 커뮤니티 관리자. 유저가 제출한 라벨을 승인 혹은 반려하는 권한을 가진다. 
                      재단, Scope, Finder 등을 상정하고 있다.
      - UserA [#3]: 일반 유저이자 라벨 제보자. 
                    “0xaa..aa” 주소에 “ServiceA”라는 이름의 컨트랙트가 있다는 것을 알고 공공 라벨링 데이터베이스에 이 사실을 제보한다.
      - DevB [#4]: “A” dApp의 개발자. 
                    “0xbb..bb” 주소에 “ServiceB” 라는 이름의 컨트랙트를 소유하고 있다.
  */
  const owner = accounts[0];

  // Compile
  console.log("ENS 컨트랙트를 컴파일합니다.");
  await run("compile");
  console.log("    ");

  // Deploy
  const ens = await deployments.deploy("ENSRegistry", {
    from: owner.address,
    gasLimit: 4000000,
    args: [],
    log: true,
  });
  console.log("ENSRegistry가 배포되었습니다 : ", ens.address);

  const resolver = await deployments.deploy("PublicResolver", {
    from: owner.address,
    gasLimit: 4000000,
    args: [ens.address, ZERO_ADDRESS],
    log: true,
  });
  console.log("PublicResolver가 배포되었습니다 : ", resolver.address);

  const registrar = await deployments.deploy("FIFSRegistrar", {
    from: owner.address,
    gasLimit: 4000000,
    args: [ens.address, namehash.hash(tld)],
    log: true,
  });
  console.log("FIFSRegistrar가 배포되었습니다 : ", registrar.address);

  const reverseRegistrar = await deployments.deploy("ReverseRegistrar", {
    from: owner.address,
    gasLimit: 4000000,
    args: [ens.address, resolver.address],
    log: true,
  });
  console.log("ReverseRegistrar가 배포되었습니다 : ", reverseRegistrar.address);

  console.log("    ");
  console.log("ENS Setting을 시작합니다.");
  shelljs.exec("npx hardhat setting");
});

task("setting", "이것은 ENS setting을 위한 명령어입니다.").setAction(
  async (args: any, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const accounts = await ethers.getSigners();
    const owner = accounts[0];
    const contributer = accounts[1];
    const labelhash = (label: any) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label));

    console.log("owner : ", owner.address);
    console.log("contributer : ", contributer.address);

    // Contracts
    const ensContract = new ethers.Contract(ENSRegistry.address, ENSRegistry.abi, owner);
    const resolverContract = new ethers.Contract(PublicResolver.address, PublicResolver.abi, owner);

    // Setting
    await setupResolver();
    console.log("Registry setup is complete.");

    await setupRegistrar();
    console.log("Registrar setup is complete.");

    await setupReverseRegistrar();
    console.log("ReverseRegistrar setup is complete.");

    async function setupResolver() {
      const resolverNode = await namehash.hash("resolver");
      const resolverLabel = labelhash("resolver");

      await ensContract.setSubnodeOwner(ZERO_HASH, resolverLabel, owner.address);
      await ensContract.setResolver(resolverNode, PublicResolver.address);
      await resolverContract.functions["setAddr(bytes32,address)"](resolverNode, PublicResolver.address);
    }

    async function setupRegistrar() {
      await ensContract.setSubnodeOwner(ZERO_HASH, labelhash(tld), FIFSRegistrar.address);
    }

    async function setupReverseRegistrar() {
      const gasLimit = 2000000;
      const tx1 = await ensContract.setSubnodeOwner(ZERO_HASH, labelhash("reverse"), owner.address, { gasLimit });
      await tx1.wait();
      const tx2 = await ensContract.setSubnodeOwner(
        namehash.hash("reverse"),
        labelhash("addr"),
        ReverseRegistrar.address,
        {
          gasLimit,
        },
      );
      await tx2.wait();
    }
  },
);

task("write", "이것은 기관에 의한 라벨 등록을 위한 명령어입니다.").setAction(
  async (args: any, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const accounts = await ethers.getSigners();
    const owner = accounts[0];
    const contributer = accounts[1];
    const labelhash = (label: any) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label));

    // Contract
    const registrarContract = new ethers.Contract(FIFSRegistrar.address, FIFSRegistrar.abi, owner);

    const register = async () => {
      const gasLimit = 2000000;
      const tx = await registrarContract.register(labelhash("inbrew"), contributer.address, { gasLimit });
      const receipt = await tx.wait();

      console.log(receipt);
    };

    await register();
  },
);
