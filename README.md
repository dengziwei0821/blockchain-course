# Escrow Spring-Boot-Web3j（路线A）

> 华南理工大学《区块链技术与应用》大作业 · 路线A
> 后端持有仲裁人私钥，由 Spring Boot 服务代为签名发送仲裁 `resolve` 交易。
> ⭐ **加分功能：订单事件时间线** —— 扫描链上 Event 日志，重建订单完整生命周期。

本项目所有订单与事件数据**每次请求都实时从 POTOS 测试网 RPC 节点读取，后端不保存链上快照**。
合约定稿之后可长期复用同一个已部署合约，修改后端 Java 业务代码**不需要重新部署智能合约**。
Remix 使用 `At Address` 加载同一合约地址，即可继续发起新交易；后端重启不会丢失链上已有数据。

---

## 一、功能清单

| 编号 | 功能 | 接口 |
| --- | --- | --- |
| 1 | 部署全新 Escrow 托管合约 | `POST /api/escrow/deploy` |
| 2 | 加载已部署合约 | `POST /api/escrow/load` |
| 3 | 查询合约地址与仲裁人地址 | `GET /api/escrow/address` |
| 4 | 根据 id 查询单个订单详情 | `GET /api/escrow/orders/{id}` |
| 5 | 通过 `OrderCreated` 事件批量拉取订单列表 | `GET /api/escrow/orders` |
| 6 | 后端代签执行仲裁 resolve | `POST /api/escrow/orders/{id}/resolve` |
| 7 | ⭐【加分项】订单事件时间线 | `GET /api/escrow/orders/{id}/events` |

**加分项说明**：时间线接口扫描链上全部相关事件 —— `OrderCreated`、`OrderPaid`、`OrderCompleted`、`OrderRefunded`、`OrderDisputed`、`OrderResolved` —— 解析后按区块高度升序返回，还原订单从创建到结清/退款的完整操作流水。


---

## 二、前置环境

- JDK 17
- Gradle（项目自带 gradlew wrapper，**本机无需安装 Gradle**）
- 可访问 POTOS 测试网 RPC
- 后端仲裁账户私钥（**仅通过环境变量注入**，禁止硬编码进代码 / 配置文件 / README）

---

## 三、环境变量（运行前必须在终端 export WEB3J_PRIVATE_KEY）


| 环境变量 | 说明 |
| --- | --- |
| `WEB3J_CLIENT_ADDRESS` | POTOS 测试网 RPC 节点地址 |
| `WEB3J_PRIVATE_KEY` | 后端仲裁账户私钥（0x 开头，64 位十六进制） |
| `escrow.contract-address` | 已部署的 Escrow 托管合约地址 |
| `escrow.deploy-block` | Escrow 合约部署时的区块高度 |

终端设置示例（Linux / macOS / Git Bash；Windows 用 `set X=...` 或 IDE 运行配置里设）：

```bash
export WEB3J_PRIVATE_KEY="0x你的仲裁账户私钥"
```

### application.properties

```properties
# Server configuration
server.port=8080

# Web3j configuration
web3j.client-address=https://rpc-testnet.potos.hk
web3j.private-key=${WEB3J_PRIVATE_KEY}
web3j.gas-price=1000000
web3j.gas-limit=6721975

# Escrow 合约配置
escrow.contract-address=0x227FA3107921C2e1456941C5608248b1d8C12D70
escrow.deploy-block=2762712

# Logging configuration
logging.level.root=INFO
logging.level.com.wetech.demo.web3j=DEBUG
logging.level.org.web3j=INFO
```

---

## 四、路线 A 关键合约与账户地址

| 类型 | 地址 |
| --- | --- |
| Escrow 托管合约 | `0x227FA3107921C2e1456941C5608248b1d8C12D70` |
| DZHToken 代币合约 | `0x437fd10A55Bce665B50DdE7f92f9dDbA1b66209e` |
| 后端仲裁账户 | `0x76dB5f85438fDa3db0042F1A10d2CDcb5439483C` |

---

## 五、路线 A 实验交易记录表


| 操作 | 交易哈希 | 区块浏览器链接 | 发起账户 |
| ---- | ---- | ---- | ---- |
| 部署 Escrow | `0x​f5f1c081e5072c64b081ce53eb3f0d242e8c8d6ee81b49537f170bf5e5a16c90` | https://scan-testnet.potos.hk/tx/0xf5f1c081e5072c64b081ce53eb3f0d242e8c8d6ee81b49537f170bf5e5a16c90 | `0x76dB5f85438fDa3db0042F1A10d2CDcb5439483C` |
| createOrder 订单 0 | `0x​3de0016c97f8105a571c3b96b2f09102876b816cfde2fd86b531bc601716c2b9` | https://scan-testnet.potos.hk/tx/0x3de0016c97f8105a571c3b96b2f09102876b816cfde2fd86b531bc601716c2b9 | `0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c` |
| approve | `0x​4a36bf937de27c3fae299ede7f078d06989af0c2b57de2fcf1447a44a5d17d62` | https://scan-testnet.potos.hk/tx/0x4a36bf937de27c3fae299ede7f078d06989af0c2b57de2fcf1447a44a5d17d62 | `0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c` |
| deposit 订单 0 | `0x​56245f15e5e2ade8d8f11521657ccc0e11bea21d1b0412a5db1241cde454f420` | https://scan-testnet.potos.hk/tx/0x56245f15e5e2ade8d8f11521657ccc0e11bea21d1b0412a5db1241cde454f420 | `0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c` |
| dispute 订单 1 | `0x​a6a48b555b885deea1f01e62d64ea463ed4a19970088f37a1752e3ad16c82382` | https://scan-testnet.potos.hk/tx/0xa6a48b555b885deea1f01e62d64ea463ed4a19970088f37a1752e3ad16c82382 | `0x6Bd7170175F0264C82f0E6706AD2693d5e23403D` |
| resolve 订单 1（成功） | `0x​89d8e3e00e3165c91ef60cf81b805fcc4a8dcd8af9825812327c795bbe73a835` | https://scan-testnet.potos.hk/tx/0x89d8e3e00e3165c91ef60cf81b805fcc4a8dcd8af9825812327c795bbe73a835 | `0x76dB5f85438fDa3db0042F1A10d2CDcb5439483C` |
| confirm 订单 0 | `0x​33d0cb3e09a7bf6c3c70792d6f9f82fd1498e0ab15e65c6e31af20ae2cf6a4ba` | https://scan-testnet.potos.hk/tx/0x33d0cb3e09a7bf6c3c70792d6f9f82fd1498e0ab15e65c6e31af20ae2cf6a4ba | `0xC4A45eac6e12d73D5AbC43D90441b917fAaaA64c` |
| resolve 失败（路线 A） | `0x​8be5c39a0f8e95da83845ccab0bfc2db9d3bca08dff087d42d6a89b2eeb1d8d6` | https://scan-testnet.potos.hk/tx/0x8be5c39a0f8e95da83845ccab0bfc2db9d3bca08dff087d42d6a89b2eeb1d8d6 | `0x76dB5f85438fDa3db0042F1A10d2CDcb5439483C` |


---

## 六、如何运行

两种使用模式：

1. **模式一（本实验采用）**：配置文件写好已部署合约地址 + 部署区块，服务启动时自动 `load` 合约，复用链上已有订单数据；Remix `At Address` 加载同一合约可继续发起新交易。
2. **模式二**：调用 `/deploy` 全新部署合约；部署成功后内存切换到新合约实例，重启服务会恢复配置文件内的旧合约。

```bash
# 1. 克隆仓库
git clone <你的仓库地址>
cd spring-boot-web3j

# 2. 设置上面第三节的环境变量

# 3. 编译（可选，bootRun 会自动编译）
./gradlew clean compileJava

# 4. 启动服务
./gradlew bootRun
```

> 服务默认端口：`8080`

### 常见启动问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 启动报 `Could not resolve placeholder 'web3j.private-key'` | 没 export 私钥环境变量 | 终端 export 后重启 |
| 接口返回 500 | 后端抛异常（RPC 超时 / 空回执） | 看 `bootRun` 控制台红色堆栈定位具体行 |
| 订单列表为空 | `escrow.deploy-block` 填错，扫不到 `OrderCreated` 事件 | 核对部署区块高度 |

---

## 七、REST API 调用示例

```bash
# 获取合约地址、仲裁人地址
curl http://localhost:8080/api/escrow/address

# 获取全部订单列表
curl http://localhost:8080/api/escrow/orders

# 查询订单 id=0 详情
curl http://localhost:8080/api/escrow/orders/0

# ⭐ 加分接口：查询订单 id=1 完整事件时间线
curl http://localhost:8080/api/escrow/orders/1/events

# 全新部署合约（模式二）
curl -X POST http://localhost:8080/api/escrow/deploy

# 加载指定合约地址与部署区块
curl -X POST "http://localhost:8080/api/escrow/load?address=0x227FA3107921C2e1456941C5608248b1d8C12D70&fromBlock=2762712"

# 仲裁：订单 1，卖家胜诉
curl -X POST "http://localhost:8080/api/escrow/orders/1/resolve?sellerWins=true"
```

## 八、提交前自查说明
项目提交前使用给定脚本进行安全扫描，脚本检出的匹配内容全部为**链上公开交易哈希（TxHash）**，不属于钱包私钥。
合约地址、交易哈希均为区块链上对外公开的数据；本项目代码、配置文件中没有硬编码、提交任何账户私钥。
