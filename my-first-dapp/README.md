# 基于区块链的智能合约托管交易系统

## 1. 项目简介

本项目基于 Scaffold-ETH 2 开发，实现了一个基于 Ethereum 智能合约的去中心化托管交易系统（Escrow）。

系统使用 ERC20 代币 HZYToken 进行交易结算，通过智能合约实现订单创建、付款、发货、确认收货、超期退款和争议仲裁等功能。

项目还扩展实现了订单时间线、卖家发货状态和双仲裁人多签仲裁功能。

### 主要功能

- **订单创建**：买家填写卖家地址、代币地址、交易金额和订单期限。
- **代币托管**：买家通过 approve 授权，再通过 deposit 将代币存入托管合约。
- **卖家发货**：卖家确认发货后，订单状态变为 Shipped。
- **确认收货**：买家确认收货后，托管资金转给卖家。
- **超期退款**：满足订单期限条件后，买家可以申请退款。
- **争议处理**：买家或卖家可以对订单发起争议。
- **双仲裁人多签**：两位仲裁人分别投票，只有意见一致才能执行最终裁决。
- **订单时间线**：通过监听智能合约事件，展示订单完整操作记录。

## 2. 技术栈

| 模块 | 使用技术 |
|---|---|
| 智能合约 | Solidity |
| 合约开发环境 | Hardhat |
| 前端框架 | Next.js |
| 开发语言 | TypeScript |
| 钱包连接 | MetaMask、Wagmi |
| 区块链交互 | Viem、Ethers.js |
| 代币标准 | ERC20 |
| 部署网络 | Potos Testnet |

## 3. 项目目录

```text
my-first-dapp/
.
├── CONTRIBUTING.md
├── LICENCE
├── README.md
├── package.json
├── packages
│   ├── hardhat
│   │   ├── contracts
│   │   │   ├── Escrow.sol
│   │   │   ├── HZYToken.sol
│   │   │   └── YourContract.sol
│   │   ├── deploy
│   │   │   ├── 00_deploy_your_contract.ts
│   │   │   ├── 01_deploy_token.ts
│   │   │   ├── 02_deploy_escrow.ts
│   │   │   └── 99_generateTsAbis.ts
│   │   ├── deployments
│   │   │   ├── localhost
│   │   │   └── potos_testnet
│   │   ├── eslint.config.mjs
│   │   ├── hardhat.config.ts
│   │   ├── package.json
│   │   ├── scripts
│   │   │   ├── generateAccount.ts
│   │   │   ├── generateTsAbis.ts
│   │   │   ├── importAccount.ts
│   │   │   ├── listAccount.ts
│   │   │   ├── revealPK.ts
│   │   │   └── runHardhatDeployWithPK.ts
│   │   ├── test
│   │   │   ├── Escrow.ts
│   │   │   └── YourContract.ts
│   │   ├── tsconfig.json
│   │   └── typechain-types
│   │       ├── Escrow.sol
│   │       ├── HZYToken.ts
│   │       ├── YourContract.ts
│   │       ├── common.ts
│   │       ├── factories
│   │       ├── hardhat.d.ts
│   │       └── index.ts
│   └── nextjs
│       ├── app
│       │   ├── blockexplorer
│       │   ├── debug
│       │   ├── escrow
│       │   ├── layout.tsx
│       │   ├── not-found.tsx
│       │   └── page.tsx
│       ├── components
│       │   ├── Footer.tsx
│       │   ├── Header.tsx
│       │   ├── ScaffoldEthAppWithProviders.tsx
│       │   ├── SwitchTheme.tsx
│       │   ├── ThemeProvider.tsx
│       │   ├── assets
│       │   └── scaffold-eth
│       ├── contracts
│       │   ├── deployedContracts.ts
│       │   └── externalContracts.ts
│       ├── eslint.config.mjs
│       ├── hooks
│       │   └── scaffold-eth
│       ├── next-env.d.ts
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.js
│       ├── public
│       │   ├── favicon.png
│       │   ├── logo.svg
│       │   ├── manifest.json
│       │   └── thumbnail.jpg
│       ├── scaffold.config.ts
│       ├── services
│       │   ├── store
│       │   └── web3
│       ├── styles
│       │   └── globals.css
│       ├── tsconfig.json
│       ├── types
│       │   └── abitype
│       ├── utils
│       │   └── scaffold-eth
│       └── vercel.json
└── yarn.lock
```

## 4. 环境要求

运行项目需要准备：

- Node.js
- Yarn
- Git
- MetaMask 浏览器钱包
- Potos 测试网 RPC
- Alchemy API Key

## 5. 环境变量配置

在 `packages/hardhat/.env` 中配置本地环境变量。

需要的配置：

```env
ALCHEMY_API_KEY=你的Alchemy_API_Key
DEPLOYER_PRIVATE_KEY_ENCRYPTED=本地加密的钱包密钥文件内容
```

说明：

1. `ALCHEMY_API_KEY`：用于访问 Alchemy 提供的区块链 RPC 服务。
2. `DEPLOYER_PRIVATE_KEY_ENCRYPTED`：部署账户的加密密钥数据，按照项目现有的加密部署流程使用。



## 6. 安装依赖

在项目根目录执行：

```bash
yarn install
```

如果依赖已经安装，可以跳过此步骤。

## 7. 启动项目

### 7.1 启动前端

根据项目现有 Scaffold-ETH 2 配置，在项目根目录执行：

```bash
yarn start
```

默认前端地址：

```text
http://localhost:3000
```

如果需要让同一局域网中的其他设备访问，可以使用：

```bash
yarn start --hostname 0.0.0.0
```

具体以项目实际启动脚本为准。

### 7.2 访问系统

浏览器打开：

```text
http://localhost:3000/escrow
```

连接 MetaMask，并切换到 Potos 测试网。

## 8. 智能合约部署

进入 Hardhat 目录：

```bash
cd packages/hardhat
```

执行部署命令：

```bash
yarn deployWithPK --network potos_testnet --tags EscrowHZY202430550660
```

根据提示输入部署账户的解密密码。

部署成功后，终端会显示新合约地址，并自动更新：

```text
packages/nextjs/contracts/deployedContracts.ts
```

如果重新部署了 Escrow，还需要确认前端手动配置的合约地址与最新部署地址一致。

## 9. 合约部署信息与仲裁人配置

### 9.1 合约部署信息

| 项目 | 信息 |
|---|---|
| 网络名称 | Potos Testnet |
| Chain ID | 60600 |
| RPC 地址 | https://rpc-testnet.potos.hk |
| Escrow 合约地址 | 0x54b7fF332B140323C4BeC3C14bBFE326bDB0c28e |
| HZYToken 合约地址 | 0xd07C5c357C22A54cC0fc92Ce8A834499e20cF52f |

### 9.2 仲裁人地址配置

本项目采用双仲裁人机制，包含两名仲裁人：

- 仲裁人一：arbiter1
- 仲裁人二：arbiter2

仲裁人地址在智能合约部署时通过构造函数传入，并保存在合约中。目前合约没有提供直接修改仲裁人地址的函数，因此地址在部署后无法直接修改。

### 9.3 修改仲裁人地址的方法

如果需要更换仲裁人，需要重新部署 Escrow 合约：

**第一步：修改部署脚本**

打开：

`packages/hardhat/deploy/deploy_escrow.ts`

找到部署 Escrow 合约时传入的两个仲裁人地址，将其修改为新的地址。

**第二步：重新部署合约**

```bash
cd packages/hardhat
yarn deployWithPK --network potos_testnet --tags EscrowHZY202430550660
```

根据提示输入部署账户的解密密码。

**第三步：更新前端合约地址**

部署成功后，新的合约地址会自动更新到：

`packages/nextjs/contracts/deployedContracts.ts`

同时检查 `page.tsx` 等前端文件中是否存在手动配置的旧合约地址，并同步更新。

**第四步：重新启动前端**

重新启动 Next.js 服务，刷新页面，并连接 Potos 测试网。

**注意事项：**

1. 仅修改部署脚本或刷新页面，不会改变已经部署的旧合约中的仲裁人地址。
2. 重新部署会生成新的 Escrow 合约，旧合约及其订单仍然保留在原链上。
3. 新部署后应使用新合约地址进行后续交易。
4. 两位仲裁人必须分别使用自己的钱包提交投票，只有意见一致时才会执行最终裁决。

## 10. 系统使用流程

1. 买家连接 MetaMask。
2. 输入卖家地址、HZYToken 合约地址、交易金额和订单期限。
3. 创建订单，订单状态变为 Created。
4. 买家点击付款，分别完成 approve 和 deposit 两笔交易。
5. 订单状态变为 Paid。
6. 卖家确认发货，订单状态变为 Shipped。
7. 买家确认收货，订单状态变为 Completed，资金转给卖家。

如果交易过程中发生争议：

1. 买家或卖家发起争议。
2. 订单状态变为 Disputed。
3. 两位仲裁人分别提交裁决意见。
4. 两人意见一致后，智能合约执行资金划转。
5. 时间线记录相关仲裁事件。

## 11. 安全设计

- 用户私钥由 MetaMask 管理，不存储在前端代码中。
- 使用智能合约进行角色权限验证。
- 买家需要通过 approve 授权后才能付款。
- 托管资金由智能合约管理。
- 双仲裁人意见一致后才能执行最终裁决。
- 环境变量和加密钱包文件不应提交到公开仓库。

## 12. 项目特色

本项目在基础托管交易功能上进行了三个方面的扩展：

1. **订单时间线**：通过智能合约事件记录订单各阶段操作及时间。
2. **卖家发货状态**：增加 Shipped 状态，使交易流程更加完整。
3. **双仲裁人多签机制**：两位仲裁人意见一致后才执行裁决，提高争议处理的安全性。



## 13.本人交易记录表

|操作|交易哈希|区块浏览器链接|发起账户|
|-|-|-|-|
|部署 Escrow|0x2e4402d0b8af87f9f2e6be5f10df3d4a139420ce7c0fcd2370daf87639cdcb5c|https://scan-testnet.potos.hk/tx/0x2e4402d0b8af87f9f2e6be5f10df3d4a139420ce7c0fcd2370daf87639cdcb5c?tab=index|0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c|
|createOrder 订单 0|0xc9a086a80b46329676a324976705fed08c0d49fe7051ac3a9e0feb220a54f5a5|https://scan-testnet.potos.hk/tx/0xc9a086a80b46329676a324976705fed08c0d49fe7051ac3a9e0feb220a54f5a5?tab=index|0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c|
|approve|0xc5c6340d8a8063e20f06f037da85d53ba5da3e3b4eeb229ac2029879340d631b|https://scan-testnet.potos.hk/tx/0xc5c6340d8a8063e20f06f037da85d53ba5da3e3b4eeb229ac2029879340d631b?tab=index|0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c|
|deposit 订单 0|0x6da2b8550e82ed9eea649c09d88371b0927aea4deb9b0c96580d30ed54799e76|https://scan-testnet.potos.hk/tx/0x6da2b8550e82ed9eea649c09d88371b0927aea4deb9b0c96580d30ed54799e76?tab=index|0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c|
|dispute 订单 1|0x82b0c84a1eb2cd846e6ff46a68004ac7cdcb48423cb32a6a0b9e0fc7464e0a77|https://scan-testnet.potos.hk/tx/0x82b0c84a1eb2cd846e6ff46a68004ac7cdcb48423cb32a6a0b9e0fc7464e0a77?tab=index|0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c|
|resolve 订单 1|0xd61decfb13d37130744bb87686286344da2f12aadc7fad630ccf6f7aa990aebd|https://scan-testnet.potos.hk/tx/0xd61decfb13d37130744bb87686286344da2f12aadc7fad630ccf6f7aa990aebd?tab=index|0x6Bd7170175F0264C82f0E6706AD2693d5e23403D|
|confirm 订单 0|0xc93f31589bafc24eac6ea67de496599b622514f4bb9271a8f0d66d222cc935f9|https://scan-testnet.potos.hk/tx/0xc93f31589bafc24eac6ea67de496599b622514f4bb9271a8f0d66d222cc935f9|0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c|


项目提交前进行了敏感信息安全检查，使用 grep 命令和 Gitleaks 工具对项目文件及 Git 提交历史进行了扫描。
在检查过程中，grep 检测到部分符合十六进制格式的字符串，经检查主要包括交易哈希、合约地址及合约 Bytecode 等公开链上数据，并非钱包私钥。其中，README 中保留的交易哈希是课程实验要求提交的内容。
此外，项目使用 .gitignore 排除了本地 .env 环境变量文件、钱包备份文件等敏感文件，仅保留 .env.example 环境变量模板。
Gitleaks 对原始 Git 提交历史仍报告 5 条疑似凭证，需要进一步核实其来源，尤其是 Scaffold-ETH 2 配置中的默认 Alchemy API Key。项目上传前应确保不存在真实私钥及有效凭证泄露。
