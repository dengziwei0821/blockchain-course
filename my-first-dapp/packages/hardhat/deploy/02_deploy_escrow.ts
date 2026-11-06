import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
const ARBITER1 = "0x92Bc26bDC1e41bd0BE85545d583e81b757bcF61A";
const ARBITER2 = "0x73C9327490B8e8627754acd1fB0fc10865d7d21f";
const deployEscrow: DeployFunction = async function (hre:
HardhatRuntimeEnvironment) {
const { deployer } = await hre.getNamedAccounts();
await hre.deployments.deploy("Escrow", { from: deployer, args: [ARBITER1, ARBITER2], log: true,
autoMine: true });
};
export default deployEscrow;
deployEscrow.tags = ["EscrowHZY202430550660"];
