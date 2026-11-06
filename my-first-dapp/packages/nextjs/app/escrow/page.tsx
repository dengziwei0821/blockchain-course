
"use client";

import { useState } from "react";
import { useAccount, useBlockNumber } from "wagmi";
import { isAddress, parseUnits } from "viem";

import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useScaffoldEventHistory,
} from "~~/hooks/scaffold-eth";

// ==================== 基本配置 ====================

const STATUS = [
  "Created",
  "Paid",
  "Completed",
  "Refunded",
  "Disputed",
  "Shipped",
];

const ESCROW_ADDRESS =
  "0x54b7fF332B140323C4BeC3C14bBFE326bDB0c28e";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

const ESCROW_START_BLOCK = 2788471n;

// ==================== 订单时间线组件 ====================

function OrderTimeline({
  orderId,
  createdEvents,
  paidEvents,
  votedEvents,
  shippedEvents,
  completedEvents,
  refundedEvents,
  disputedEvents,
  resolvedEvents,
}: {
  orderId: bigint;
  createdEvents: any[];
  paidEvents: any[];
  votedEvents: any[];
  shippedEvents: any[];
  completedEvents: any[];
  refundedEvents: any[];
  disputedEvents: any[];
  resolvedEvents: any[];
}) {
  const [expanded, setExpanded] = useState(false);

  // 将不同类型的事件整理成统一的时间线
  const timeline = [
    ...(createdEvents ?? [])
.filter(ev => ev?.args?.id === orderId)
      .map(ev => ({
        action: "订单创建",
        detail: "买家创建了托管订单",
        timestamp: ev.blockData?.timestamp,
        blockNumber: ev.blockNumber,
      })),

    ...(paidEvents ?? [])
.filter(ev => ev?.args?.id === orderId)
      .map(ev => ({
        action: "买家付款",
        detail: "买家已将代币存入托管合约",
        timestamp: ev.blockData?.timestamp,
        blockNumber: ev.blockNumber,
      })),

// 仲裁人投票事件
...(votedEvents ?? [])
  .filter(ev => ev?.args?.id === orderId)
  .map(ev => ({
    action: "仲裁人提交投票",
    detail: `${ev.args!.arbiter ?? "未知仲裁人"} 的意见：${
      ev.args!.sellerWins ? "判给卖家" : "退款给买家"
    }`,
    timestamp: ev.blockData?.timestamp,
    blockNumber: ev.blockNumber,
  })),

    ...(shippedEvents ?? [])
.filter(ev => ev?.args?.id === orderId)
  .map(ev => ({
    action: "卖家发货",
    detail: "卖家已确认发货",
    timestamp: ev.blockData?.timestamp,
    blockNumber: ev.blockNumber,
  })),

    ...(completedEvents ?? [])
.filter(ev => ev?.args?.id === orderId)
      .map(ev => ({
        action: "订单完成",
        detail: "订单资金已转给卖家",
        timestamp: ev.blockData?.timestamp,
        blockNumber: ev.blockNumber,
      })),

    ...(refundedEvents ?? [])
.filter(ev => ev?.args?.id === orderId)
      .map(ev => ({
        action: "订单退款",
        detail: "托管资金已退还给买家",
        timestamp: ev.blockData?.timestamp,
        blockNumber: ev.blockNumber,
      })),

    ...(disputedEvents ?? [])
   .filter(ev => ev?.args?.id === orderId)
      .map(ev => ({
        action: "发起争议",
        detail: `发起人：${ev.args.by ?? "未知"}`,
        timestamp: ev.blockData?.timestamp,
        blockNumber: ev.blockNumber,
      })),

    ...(resolvedEvents ?? [])
.filter(ev => ev?.args?.id === orderId)
      .map(ev => ({
        action: "仲裁完成",
        detail: ev.args.sellerWins
          ? "仲裁结果：判给卖家"
          : "仲裁结果：退款给买家",
        timestamp: ev.blockData?.timestamp,
        blockNumber: ev.blockNumber,
      })),
  ].sort((a, b) => {
    // 按区块高度排序，保证事件顺序
    return Number(a.blockNumber - b.blockNumber);
  });

  return (
    <div className="mt-4 border-t pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-blue-600 hover:underline font-medium"
      >
        {expanded ? "收起订单时间线 ▲" : "查看订单时间线 ▼"}
      </button>

      {expanded && (
        <div className="mt-4 ml-2 border-l-2 border-blue-300 pl-4">
          {timeline.length === 0 ? (
            <p className="text-gray-500">
              暂无订单事件
            </p>
          ) : (
            timeline.map((item, index) => (
              <div key={index} className="mb-4 relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500" />

                <p className="font-semibold">
                  {item.action}
                </p>

                <p className="text-sm text-gray-600">
                  {item.detail}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {item.timestamp !== undefined
                    ? new Date(
                        Number(item.timestamp) * 1000
                      ).toLocaleString()
                    : `区块高度：${item.blockNumber?.toString()}`}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 订单组件 ====================

function OrderRow({
  orderId,
  arbiter1,
  arbiter2,
  latestBlockNumber,
  createdEvents,
  paidEvents,
  votedEvents,
  shippedEvents,
  completedEvents,
  refundedEvents,
  disputedEvents,
  resolvedEvents,
}: {
  orderId: bigint;
  arbiter1: string | undefined;
  arbiter2: string | undefined;
  latestBlockNumber: bigint | undefined;
  createdEvents: any[];
  paidEvents: any[];
  votedEvents: any[];
  shippedEvents: any[];
  completedEvents: any[];
  refundedEvents: any[];
  disputedEvents: any[];
  resolvedEvents: any[];
}) {
  const { address } = useAccount();

  // 读取订单
  const {
    data: order,
    refetch: refetchOrder,
  } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [orderId],
  });

  // 使用命名字段读取订单，避免 order is not iterable
  const buyer = order?.buyer;
  const seller = order?.seller;
  const token = order?.token;
  const amount = order?.amount;
  const deadline = order?.deadline;
  const status = order?.status;

  // 订单还未加载时，使用零地址作为查询参数。
  const buyerAddress = buyer ?? ZERO_ADDRESS;
    // 查询仲裁人一是否已经投票
  const { data: arbiter1HasVoted } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "hasVoted",
    args: [orderId, arbiter1 ?? ZERO_ADDRESS],
  });

  // 查询仲裁人一的投票意见
  const { data: arbiter1Vote } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "votes",
    args: [orderId, arbiter1 ?? ZERO_ADDRESS],
  });

  // 查询仲裁人二是否已经投票
  const { data: arbiter2HasVoted } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "hasVoted",
    args: [orderId, arbiter2 ?? ZERO_ADDRESS],
  });

  // 查询仲裁人二的投票意见
  const { data: arbiter2Vote } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "votes",
    args: [orderId, arbiter2 ?? ZERO_ADDRESS],
  });

  // 查询 HZYToken 授权额度
  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useScaffoldReadContract({
    contractName: "HZYToken",
    functionName: "allowance",
    args: [buyerAddress, ESCROW_ADDRESS],
  });

  // 查询买家 HZYToken 余额
  const {
    data: tokenBalance,
  } = useScaffoldReadContract({
    contractName: "HZYToken",
    functionName: "balanceOf",
    args: [buyerAddress],
  });

  // 合约写入方法
  const {
    writeContractAsync: writeEscrow,
  } = useScaffoldWriteContract({
    contractName: "Escrow",
  });

  const {
    writeContractAsync: writeToken,
  } = useScaffoldWriteContract({
    contractName: "HZYToken",
  });

  // 所有 Hook 调用完成后，再进行条件返回
  if (
    !order ||
    !buyer ||
    !seller ||
    !token ||
    amount === undefined ||
    deadline === undefined ||
    status === undefined
  ) {
    return (
      <div className="border p-4 my-3 rounded-lg">
        加载订单 {orderId.toString()} 中...
      </div>
    );
  }

  // 订单状态
  const statusText =
    STATUS[Number(status)] ?? "未知状态";

  const isBuyer =
    !!address &&
    address.toLowerCase() === buyer.toLowerCase();

  const isSeller =
    !!address &&
    address.toLowerCase() === seller.toLowerCase();

  const isArbiter =
  !!address &&
  (
    address.toLowerCase() === arbiter1?.toLowerCase() ||
    address.toLowerCase() === arbiter2?.toLowerCase()
  );

  const currentRole = isArbiter
    ? "仲裁人"
    : isBuyer
      ? "买家"
      : isSeller
        ? "卖家"
        : "旁观者";

  // 是否已经超过订单截止时间
  const isExpired =
    BigInt(Math.floor(Date.now() / 1000)) > deadline;

  // 调试信息
  console.log("订单ID：", orderId.toString());
  console.log("订单状态：", statusText);
  console.log("订单Token地址：", token);
  console.log("订单所需金额：", amount.toString());
  console.log("当前授权额度：", allowance?.toString());
  console.log("买家代币余额：", tokenBalance?.toString());

  // ==================== 付款 ====================

  const handlePay = async () => {
    try {
      if (!address) {
        alert("请先连接钱包！");
        return;
      }

      if (!isBuyer) {
        alert("只有买家可以付款！");
        return;
      }

      if (statusText !== "Created") {
        alert("当前订单状态不允许付款！");
        return;
      }

      console.log("当前订单 Token：", token);

      if (
        tokenBalance === undefined ||
        tokenBalance < amount
      ) {
        alert("余额不足，或余额尚未加载！");
        return;
      }

      if (
        allowance !== undefined &&
        allowance < amount
      ) {
        console.log("当前授权额度不足，将重新授权。");
      }

      // 第一步：授权
      console.log("第一步：开始授权 Token...");

      await writeToken({
        functionName: "approve",
        args: [ESCROW_ADDRESS, amount],
      });

      console.log("approve 调用完成，准备执行 deposit...");

      // 第二步：存入托管合约
      await writeEscrow({
        functionName: "deposit",
        args: [orderId],
      });

      alert("付款成功！");

      await refetchOrder();
      await refetchAllowance();

    } catch (error) {
      console.error("付款失败：", error);
      alert("付款失败，请查看浏览器控制台和钱包提示。");
    }
  };

  // ==================== 卖家发货 ====================

const handleShip = async () => {
  try {
    if (!address) {
      alert("请先连接钱包！");
      return;
    }

    if (!isSeller) {
      alert("只有卖家可以确认发货！");
      return;
    }

    if (statusText !== "Paid") {
      alert("当前订单状态不允许发货！");
      return;
    }

    await writeEscrow({
      functionName: "markShipped",
      args: [orderId],
    });

    alert("发货状态更新成功！");

    await refetchOrder();

  } catch (error) {
    console.error("标记发货失败：", error);
    alert("标记发货失败，请查看控制台。");
  }
};

  // ==================== 确认收货 ====================

  const handleConfirm = async () => {
    try {
      await writeEscrow({
        functionName: "confirm",
        args: [orderId],
      });

      alert("确认收货成功！");

      await refetchOrder();

    } catch (error) {
      console.error("确认收货失败：", error);
      alert("确认收货失败，请查看控制台。");
    }
  };


  // ==================== 发起争议 ====================

  const handleDispute = async () => {
    try {
      await writeEscrow({
        functionName: "dispute",
        args: [orderId],
      });

      alert("争议发起成功！");

      await refetchOrder();

    } catch (error) {
      console.error("发起争议失败：", error);
      alert("发起争议失败，请查看控制台。");
    }
  };


  // ==================== 买家超期退款 ====================

  const handleRefund = async () => {
    try {
      await writeEscrow({
        functionName: "refund",
        args: [orderId],
      });

      alert("退款成功！");

      await refetchOrder();

    } catch (error) {
      console.error("退款失败：", error);
      alert("退款失败，请确认订单是否已经到期。");
    }
  };


  // ==================== 仲裁：判给卖家 ====================

  const handleSellerWins = async () => {
  try {
    await writeEscrow({
      functionName: "resolve",
      args: [orderId, true],
    });

    await refetchOrder();

    alert("判给卖家的投票已提交！请查看两位仲裁人的投票结果。");

  } catch (error) {
    console.error("仲裁投票失败：", error);
    alert("仲裁投票失败，请查看控制台。");
  }
};


  // ==================== 仲裁：退款给买家 ====================

const handleBuyerWins = async () => {
  try {
    await writeEscrow({
      functionName: "resolve",
      args: [orderId, false],
    });

    await refetchOrder();

    alert("退款给买家的投票已提交！请查看两位仲裁人的投票结果。");

  } catch (error) {
    console.error("仲裁投票失败：", error);
    alert("仲裁投票失败，请查看控制台。");
  }
};


  // ==================== 页面显示 ====================

  return (
    <div className="border p-4 my-3 rounded-lg shadow-sm">

      <h3 className="font-bold text-lg mb-3">
        订单ID：{orderId.toString()}
      </h3>

      <p className="mb-2">
        买家：{buyer}
      </p>

      <p className="mb-2">
        卖家：{seller}
      </p>

      <p className="mb-2">
        代币地址：{token}
      </p>

      <p className="mb-2">
        数量（最小单位）：{amount.toString()}
      </p>

      <p className="mb-2">
        截止时间：
        {new Date(Number(deadline) * 1000).toLocaleString()}
      </p>

      <p className="mb-2">
        状态：{statusText}
      </p>

{/* 双仲裁投票状态 */}
{(statusText === "Disputed" ||
  (arbiter1HasVoted && arbiter2HasVoted)) && (
  <div className="border rounded-lg p-3 my-3 bg-gray-50">
    <h4 className="font-bold mb-3">仲裁投票情况</h4>

    <p className="mb-2">
      仲裁人一：
      {!arbiter1HasVoted
        ? "尚未投票"
        : arbiter1Vote
          ? "判给卖家"
          : "退款给买家"}
    </p>

    <p className="mb-2">
      仲裁人二：
      {!arbiter2HasVoted
        ? "尚未投票"
        : arbiter2Vote
          ? "判给卖家"
          : "退款给买家"}
    </p>

    <p className="font-semibold">
      {!arbiter1HasVoted || !arbiter2HasVoted
        ? "等待两位仲裁人完成投票"
        : arbiter1Vote === arbiter2Vote
          ? "两人意见一致，裁决已达成"
          : "两人意见不一致，可以重新投票"}
    </p>
  </div>
)}

      <p className="font-bold my-3">
        当前身份：{currentRole}
      </p>

      <p className="mb-3">
        订单状态：{statusText}
      </p>

      {/* Created：买家付款 */}
      {statusText === "Created" && isBuyer && (
        <button
          onClick={handlePay}
          className="bg-green-500 text-white px-3 py-2 rounded"
        >
          付款（approve + deposit）
        </button>
      )}

{/* Paid：卖家发货 */}
{statusText === "Paid" && isSeller && (
  <button
    onClick={handleShip}
    className="bg-purple-500 text-white px-3 py-2 rounded mr-2"
  >
    确认发货
  </button>
)}

      {/* Shipped：买家确认收货 */}
{statusText === "Shipped" && isBuyer && (
  <button
    onClick={handleConfirm}
    className="bg-blue-500 text-white px-3 py-2 rounded mr-2"
  >
    确认收货
  </button>
)}

      {/* Paid：买家或卖家发起争议 */}
{(statusText === "Paid" || statusText === "Shipped") &&
  (isBuyer || isSeller) && (
        <button
          onClick={handleDispute}
          className="bg-amber-500 text-white px-3 py-2 rounded mr-2"
        >
          发起争议
        </button>
      )}

      {/* Paid：买家超期退款 */}
      {statusText === "Paid" && isBuyer && isExpired && (
        <button
          onClick={handleRefund}
          className="bg-red-500 text-white px-3 py-2 rounded mr-2"
        >
          超期退款
        </button>
      )}

     {/* Disputed：仲裁人提交或修改投票 */}
{/* Disputed：两位仲裁人提交或修改投票 */}
{statusText === "Disputed" && isArbiter && (
  <div className="my-3">
    <p className="mb-2 text-sm text-gray-600">
      请选择你的仲裁意见。两位仲裁人意见一致后，合约才会执行裁决。
    </p>

    <button
      onClick={handleSellerWins}
      className="bg-green-600 text-white px-3 py-2 rounded mr-2"
    >
      投票：判给卖家
    </button>

    <button
      onClick={handleBuyerWins}
      className="bg-red-500 text-white px-3 py-2 rounded"
    >
      投票：退款给买家
    </button>
  </div>
)}

      {/* 订单时间线 */}
<OrderTimeline
  orderId={orderId}
  createdEvents={createdEvents}
  paidEvents={paidEvents}
  votedEvents={votedEvents}
  shippedEvents={shippedEvents}
  completedEvents={completedEvents}
  refundedEvents={refundedEvents}
  disputedEvents={disputedEvents}
  resolvedEvents={resolvedEvents}
/>

    </div>
  );
}


// ==================== 主页面 ====================

export default function EscrowPage() {
  const { address, chainId } = useAccount();

console.log("当前钱包地址：", address);
console.log("当前钱包 Chain ID：", chainId);

  const [sellerInput, setSellerInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [hourInput, setHourInput] = useState("1");

  // 获取最新区块高度
  const {
    data: latestBlockNumber,
  } = useBlockNumber({
    watch: true,
  });

  // 读取仲裁人地址
  const {
  data: arbiter1,
  isLoading: arbiter1Loading,
  error: arbiter1Error,
} = useScaffoldReadContract({
  contractName: "Escrow",
  functionName: "arbiter1",
});

const {
  data: arbiter2,
  isLoading: arbiter2Loading,
  error: arbiter2Error,
} = useScaffoldReadContract({
  contractName: "Escrow",
  functionName: "arbiter2",
});

  // 读取 OrderCreated 事件
  const {
    data: createdEvents,
    isLoading,
    error,
    refetch: refetchEvents,
  } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取付款事件
const { data: paidEvents = [], refetch: refetchPaidEvents } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderPaid",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取仲裁人投票事件
const { data: votedEvents = [] } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "ArbiterVoted",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取卖家发货事件
const { data: shippedEvents = [], refetch: refetchShippedEvents } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderShipped",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取确认收货事件
const { data: completedEvents = [], refetch: refetchCompletedEvents } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCompleted",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取退款事件
const { data: refundedEvents = [], refetch: refetchRefundedEvents } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderRefunded",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取争议事件
const { data: disputedEvents = [], refetch: refetchDisputedEvents } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderDisputed",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

// 读取仲裁结果事件
const { data: resolvedEvents = [], refetch: refetchResolvedEvents } =
  useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderResolved",
    fromBlock: ESCROW_START_BLOCK,
    toBlock: latestBlockNumber ?? ESCROW_START_BLOCK,
    watch: true,
    blockData: true,
  });

  // Escrow 合约写入方法
  const {
    writeContractAsync: writeEscrow,
  } = useScaffoldWriteContract({
    contractName: "Escrow",
  });


  // ==================== 创建订单 ====================

  const handleCreateOrder = async () => {
    try {
      if (!address) {
        alert("请先连接钱包！");
        return;
      }

      if (!isAddress(sellerInput)) {
        alert("请输入正确的卖家地址！");
        return;
      }

      if (!isAddress(tokenInput)) {
        alert("请输入正确的 Token 合约地址！");
        return;
      }

      if (sellerInput.toLowerCase() === address.toLowerCase()) {
        alert("买家和卖家不能是同一个地址！");
        return;
      }

      if (!amountInput || Number(amountInput) <= 0) {
        alert("请输入大于 0 的代币数量！");
        return;
      }

      const hours = Number(hourInput);

      if (
        !Number.isFinite(hours) ||
        !Number.isInteger(hours) ||
        hours <= 0
      ) {
        alert("到期小时数必须是大于 0 的整数！");
        return;
      }

      // 页面输入的代币数量转换成 18 位精度
      const amount = parseUnits(amountInput, 18);

      // 当前时间戳 + 小时数
      const nowSec = BigInt(
        Math.floor(Date.now() / 1000)
      );

      const deadline =
        nowSec + BigInt(hours * 3600);

      console.log("创建订单参数：", {
        sellerInput,
        tokenInput,
        amount: amount.toString(),
        deadline: deadline.toString(),
      });

      await writeEscrow({
        functionName: "createOrder",
        args: [
          sellerInput,
          tokenInput,
          amount,
          deadline,
          "实验托管订单",
        ],
      });

      alert("交易已提交！等待交易确认和事件更新。");

      await refetchEvents();

    } catch (error) {
      console.error("创建订单失败：", error);
      alert("创建订单失败，请查看控制台。");
    }
  };


  // ==================== 页面显示 ====================

  return (
    <div className="p-8">

      <h2 className="text-2xl font-bold mb-4">
        托管 Escrow 页面
      </h2>

      <div className="border p-4 rounded-lg mb-6">
        <p className="mb-2">
          当前账户：{address ?? "未连接钱包"}
        </p>

       <p>
  仲裁人一：
  {arbiter1Loading
    ? "读取中..."
    : arbiter1Error
      ? `读取失败：${arbiter1Error.message}`
      : arbiter1 ?? "没有获取到地址"}
</p>

<p>
  仲裁人二：
  {arbiter2Loading
    ? "读取中..."
    : arbiter2Error
      ? `读取失败：${arbiter2Error.message}`
      : arbiter2 ?? "没有获取到地址"}
</p>
      </div>


      {/* ==================== 创建订单表单 ==================== */}

      <div className="border p-4 my-6 rounded-lg">

        <h3 className="font-semibold text-lg mb-3">
          新建订单
        </h3>

        <div className="flex flex-col gap-3">

          <input
            placeholder="卖家地址 seller"
            value={sellerInput}
            onChange={(e) => setSellerInput(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            placeholder="代币合约地址 token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            placeholder="代币数量（如 10）"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            type="number"
            min="1"
            step="1"
            placeholder="到期小时数"
            value={hourInput}
            onChange={(e) => setHourInput(e.target.value)}
            className="border p-2 rounded"
          />

          <button
            onClick={handleCreateOrder}
            className="bg-slate-700 text-white p-2 rounded"
          >
            创建订单
          </button>

        </div>
      </div>


      {/* ==================== 刷新订单列表 ==================== */}

      <div className="mb-4 flex gap-3 items-center">

        <button
          onClick={() => refetchEvents()}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          刷新订单列表
        </button>

        <span className="text-sm">
          当前区块：
          {latestBlockNumber?.toString() ?? "读取中..."}
        </span>

      </div>


      {/* ==================== 订单列表 ==================== */}

      <h3 className="font-semibold text-xl mb-2">
        订单列表
      </h3>

      {isLoading && (
        <p className="my-3">
          正在读取订单事件...
        </p>
      )}

      {error && (
        <p className="text-red-500 my-3">
          订单事件查询失败：{error.message}
        </p>
      )}

      {(!createdEvents || createdEvents.length === 0) && !isLoading && (
        <p className="my-3">
          暂无订单
        </p>
      )}

      {createdEvents?.map((ev) => {
  const orderId = ev.args.id;

  if (orderId === undefined) {
    return null;
  }

  return (
    <OrderRow
      key={`${ev.transactionHash}-${ev.logIndex}`}
      orderId={orderId}
      arbiter1={arbiter1}
      arbiter2={arbiter2}
      latestBlockNumber={latestBlockNumber}
      createdEvents={createdEvents ?? []}
      paidEvents={paidEvents ?? []}
      votedEvents={votedEvents ?? []}
      shippedEvents={shippedEvents ?? []}
      completedEvents={completedEvents ?? []}
      refundedEvents={refundedEvents ?? []}
      disputedEvents={disputedEvents ?? []}
      resolvedEvents={resolvedEvents ?? []}
    />
  );
})}

    </div>
  );
}
