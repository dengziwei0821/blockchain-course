package com.wetech.demo.web3j.service;

import com.wetech.demo.web3j.contracts.escrow.Escrow;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.web3j.abi.EventEncoder;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.response.Log;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.gas.ContractGasProvider;
import org.springframework.beans.factory.annotation.Value;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;


import java.math.BigInteger;
import java.util.*;

@Slf4j
@Service
public class EscrowService {

    private static final String[] STATUS = {"Created", "Paid", "Completed", "Refunded", "Disputed"};

    private final Web3j web3j;
    private final Credentials credentials;
    private final ContractGasProvider gasProvider;

    private Escrow contract;

    @Getter
    private String contractAddress;
    @Getter
    private BigInteger deployBlock;


    public EscrowService(Web3j web3j,
                    Credentials credentials,
                    ContractGasProvider gasProvider,
                    @Value("${escrow.contract-address}") String escrowAddr,
                    @Value("${escrow.deploy-block:0}") BigInteger deployBlockNum) {
    this.web3j = web3j;
    this.credentials = credentials;
    this.gasProvider = gasProvider;

    if (escrowAddr != null && !escrowAddr.isBlank()) {
        this.contract = Escrow.load(escrowAddr, web3j, credentials, gasProvider);
        this.contractAddress = escrowAddr;
        this.deployBlock = deployBlockNum; 
        log.info("自动加载已有Escrow合约：{}，部署区块：{}", escrowAddr, deployBlockNum);
    }
}

    public CompletableFuture<Escrow> deploy() {
        // 仲裁人就是后端账户自己
        return Escrow.deploy(web3j, credentials, gasProvider, credentials.getAddress())
                .sendAsync()
                .thenApply(c -> {
                    this.contract = c;
                    this.contractAddress = c.getContractAddress();
                    this.deployBlock = c.getTransactionReceipt().map(TransactionReceipt::getBlockNumber).orElse(BigInteger.ZERO);
                    return c;
                });
    }

    public void load(String address, BigInteger fromBlock) {
        this.contract = Escrow.load(address, web3j, credentials, gasProvider);
        this.contractAddress = address;
        this.deployBlock = fromBlock;
    }

    public CompletableFuture<Map<String, String>> getOrder(BigInteger id) {
        requireContract();
        return contract.getOrder(id).sendAsync().thenApply(o -> Map.of(
                "buyer", o.buyer,
                "seller", o.seller,
                "token", o.token,
                "amount", o.amount.toString(),
                "deadline", o.deadline.toString(),
                "status", STATUS[o.status.intValue()],
                "description", o.description
        ));
    }

    /**
     * 从 OrderCreated 事件日志重建订单列表。
     * 注意：POTOS 测试网的 eth_getLogs 一次只允许 fromBlock 起的 10 个区块，超出部分静默丢弃，
     * 所以不能一次 deployBlock ~ LATEST 拉完，要按 10 个区块一段分批查再拼起来。
     */
    public List<Map<String, String>> listOrders() throws Exception {
    requireContract();
    BigInteger latest = web3j.ethBlockNumber().send().getBlockNumber();
    BigInteger step = BigInteger.TEN;
    List<Log> logs = new ArrayList<>();
    for (BigInteger from = deployBlock; from.compareTo(latest) <= 0; from = from.add(step)) {
        BigInteger to = from.add(step).subtract(BigInteger.ONE).min(latest);
        EthFilter filter = new EthFilter(
                DefaultBlockParameter.valueOf(from),
                DefaultBlockParameter.valueOf(to),
                contractAddress);
        filter.addSingleTopic(EventEncoder.encode(Escrow.ORDERCREATED_EVENT));
        web3j.ethGetLogs(filter).send().getLogs().forEach(r -> logs.add((Log) r.get()));
    }

    List<Map<String, String>> result = new ArrayList<>();
    for (Log l : logs) {
        // 通过交易hash拿到TransactionReceipt
        TransactionReceipt receipt = web3j.ethGetTransactionReceipt(l.getTransactionHash())
                .send()
                .getTransactionReceipt()
                .orElse(null);
        if (receipt == null) continue;

        
        List<Escrow.OrderCreatedEventResponse> events = Escrow.getOrderCreatedEvents(receipt);
        for (Escrow.OrderCreatedEventResponse e : events) {
            result.add(Map.of(
                    "id", e.id.toString(),
                    "buyer", e.buyer,
                    "seller", e.seller,
                    "amount", e.amount.toString(),
                    "blockNumber", l.getBlockNumber().toString(),
                    "transactionHash", l.getTransactionHash()
            ));
        }
    }
    return result;
}


    // ================= TODO 补全部分 =================
    
    /**
     * 仲裁解决争议
     * @param id 订单ID
     * @param sellerWins 卖家是否胜诉
     * @return 交易回执
     */
    public CompletableFuture<TransactionReceipt> resolve(BigInteger id, boolean sellerWins) {
        requireContract();
        return contract.resolve(id, sellerWins).sendAsync();
    }

    /**
     * 获取仲裁人地址（供 Controller 的 /address 接口调用）
     */
    public CompletableFuture<String> getArbiter() {
        requireContract();
        return contract.arbiter().sendAsync();
    }
    // ================================================

    private void requireContract() {
        if (contract == null) {
            throw new IllegalStateException("Contract not deployed or loaded, call /deploy or /load first");
        }
    }
  public List<Map<String, Object>> getOrderEventTimeline(BigInteger orderId) throws Exception {
    requireContract();
    BigInteger latest = web3j.ethBlockNumber().send().getBlockNumber();
    BigInteger step = BigInteger.TEN;
    List<Log> allLogs = new ArrayList<>();

    for (BigInteger from = deployBlock; from.compareTo(latest) <= 0; from = from.add(step)) {
        BigInteger to = from.add(step).subtract(BigInteger.ONE).min(latest);
        EthFilter filter = new EthFilter(
                DefaultBlockParameter.valueOf(from),
                DefaultBlockParameter.valueOf(to),
                contractAddress
        );
        web3j.ethGetLogs(filter).send().getLogs().forEach(r -> allLogs.add((Log) r.get()));
    }

    List<Map<String, Object>> eventList = new ArrayList<>();
    for (Log rawLog : allLogs) {
        Optional<Map<String, Object>> eventOpt = parseEventLog(rawLog, orderId);
        eventOpt.ifPresent(eventList::add);
    }

    return eventList.stream()
            .sorted(Comparator.comparing(m -> (BigInteger) m.get("blockNumber")))
            .collect(Collectors.toList());
}


private Optional<Map<String, Object>> parseEventLog(Log rawLog, BigInteger targetOrderId) {
    try {
        List<String> topics = rawLog.getTopics();
        if (topics.isEmpty()) {
            return Optional.empty();
        }
        String topic0 = topics.get(0);
        TransactionReceipt receipt = web3j.ethGetTransactionReceipt(rawLog.getTransactionHash())
                .send()
                .getTransactionReceipt()
                .orElse(null);
        if (receipt == null) {
            return Optional.empty();
        }

        if (topic0.equals(EventEncoder.encode(Escrow.ORDERCREATED_EVENT))) {
            List<Escrow.OrderCreatedEventResponse> events = Escrow.getOrderCreatedEvents(receipt);
            for (Escrow.OrderCreatedEventResponse resp : events) {
                if (!resp.id.equals(targetOrderId)) continue;
                Map<String, Object> map = new HashMap<>();
                map.put("blockNumber", rawLog.getBlockNumber());
                map.put("txHash", rawLog.getTransactionHash());
                map.put("eventName", "OrderCreated");
                map.put("msg", "订单已创建");
                map.put("params", Map.of(
                        "orderId", resp.id,
                        "buyer", resp.buyer,
                        "seller", resp.seller,
                        "token", resp.token,
                        "amount", resp.amount,
                        "deadline", resp.deadline
                ));
                return Optional.of(map);
            }
        } else if (topic0.equals(EventEncoder.encode(Escrow.ORDERPAID_EVENT))) {
            List<Escrow.OrderPaidEventResponse> events = Escrow.getOrderPaidEvents(receipt);
            for (Escrow.OrderPaidEventResponse resp : events) {
                if (!resp.id.equals(targetOrderId)) continue;
                Map<String, Object> map = new HashMap<>();
                map.put("blockNumber", rawLog.getBlockNumber());
                map.put("txHash", rawLog.getTransactionHash());
                map.put("eventName", "OrderPaid");
                map.put("msg", "买家存款，订单进入Paid状态");
                map.put("params", Map.of("orderId", resp.id));
                return Optional.of(map);
            }
        } else if (topic0.equals(EventEncoder.encode(Escrow.ORDERCOMPLETED_EVENT))) {
            List<Escrow.OrderCompletedEventResponse> events = Escrow.getOrderCompletedEvents(receipt);
            for (Escrow.OrderCompletedEventResponse resp : events) {
                if (!resp.id.equals(targetOrderId)) continue;
                Map<String, Object> map = new HashMap<>();
                map.put("blockNumber", rawLog.getBlockNumber());
                map.put("txHash", rawLog.getTransactionHash());
                map.put("eventName", "OrderCompleted");
                map.put("msg", "买家确认收货，资金转给卖家，订单完成");
                map.put("params", Map.of("orderId", resp.id));
                return Optional.of(map);
            }
        } else if (topic0.equals(EventEncoder.encode(Escrow.ORDERREFUNDED_EVENT))) {
            List<Escrow.OrderRefundedEventResponse> events = Escrow.getOrderRefundedEvents(receipt);
            for (Escrow.OrderRefundedEventResponse resp : events) {
                if (!resp.id.equals(targetOrderId)) continue;
                Map<String, Object> map = new HashMap<>();
                map.put("blockNumber", rawLog.getBlockNumber());
                map.put("txHash", rawLog.getTransactionHash());
                map.put("eventName", "OrderRefunded");
                map.put("msg", "退款，资金退回买家");
                map.put("params", Map.of("orderId", resp.id));
                return Optional.of(map);
            }
        } else if (topic0.equals(EventEncoder.encode(Escrow.ORDERDISPUTED_EVENT))) {
            List<Escrow.OrderDisputedEventResponse> events = Escrow.getOrderDisputedEvents(receipt);
            for (Escrow.OrderDisputedEventResponse resp : events) {
                if (!resp.id.equals(targetOrderId)) continue;
                Map<String, Object> map = new HashMap<>();
                map.put("blockNumber", rawLog.getBlockNumber());
                map.put("txHash", rawLog.getTransactionHash());
                map.put("eventName", "OrderDisputed");
                map.put("msg", "发起争议，订单进入Disputed仲裁状态");
                map.put("params", Map.of(
                        "orderId", resp.id,
                        "by", resp.by
                ));
                return Optional.of(map);
            }
        } else if (topic0.equals(EventEncoder.encode(Escrow.ORDERRESOLVED_EVENT))) {
            List<Escrow.OrderResolvedEventResponse> events = Escrow.getOrderResolvedEvents(receipt);
            for (Escrow.OrderResolvedEventResponse resp : events) {
                if (!resp.id.equals(targetOrderId)) continue;
                Map<String, Object> map = new HashMap<>();
                map.put("blockNumber", rawLog.getBlockNumber());
                map.put("txHash", rawLog.getTransactionHash());
                map.put("eventName", "OrderResolved");
                map.put("msg", "仲裁结束");
                map.put("params", Map.of(
                        "orderId", resp.id,
                        "sellerWins", resp.sellerWins
                ));
                return Optional.of(map);
            }
        }
    } catch (Exception e) {
        log.error("事件解析失败", e);
    }
    return Optional.empty();
}



}