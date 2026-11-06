package com.wetech.demo.web3j.controller;

import com.wetech.demo.web3j.service.EscrowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/escrow")
@RequiredArgsConstructor
public class EscrowController {

    private final EscrowService escrowService;

    /**
     * 1. 部署合约
     */
    @PostMapping("/deploy")
    public CompletableFuture<ResponseEntity<Map<String, String>>> deployContract() {
        return escrowService.deploy().thenApply(escrow -> {
            Map<String, String> response = new HashMap<>();
            response.put("contractAddress", escrowService.getContractAddress());
            response.put("deployBlock", escrowService.getDeployBlock().toString());
            // 从回执中获取 transactionHash
            String txHash = escrow.getTransactionReceipt().map(r -> r.getTransactionHash()).orElse("");
            response.put("transactionHash", txHash);
            return ResponseEntity.ok(response);
        });
    }

    /**
     * 2. 加载已有合约
     */
    @PostMapping("/load")
    public ResponseEntity<Map<String, String>> loadContract(
            @RequestParam String address, 
            @RequestParam(defaultValue = "0") BigInteger fromBlock) {
        
        escrowService.load(address, fromBlock);
        
        Map<String, String> response = new HashMap<>();
        response.put("contractAddress", address);
        return ResponseEntity.ok(response);
    }

    /**
     * 3. 获取当前合约地址和仲裁人
     */
    @GetMapping("/address")
    public CompletableFuture<ResponseEntity<Map<String, String>>> getAddress() {
        return escrowService.getArbiter().thenApply(arbiter -> {
            Map<String, String> response = new HashMap<>();
            response.put("contractAddress", escrowService.getContractAddress());
            response.put("arbiter", arbiter);
            return ResponseEntity.ok(response);
        });
    }

    /**
     * 4. 获取指定 ID 的订单详情
     */
    @GetMapping("/orders/{id}")
    public CompletableFuture<ResponseEntity<Map<String, String>>> getOrder(@PathVariable BigInteger id) {
        return escrowService.getOrder(id).thenApply(ResponseEntity::ok);
    }

    /**
     * 5. 获取订单列表（基于事件）
     * 注意：Service 中的 listOrders 是同步阻塞的，且可能抛出异常
     */
    @GetMapping("/orders")
    public ResponseEntity<List<Map<String, String>>> listOrders() throws Exception {
        return ResponseEntity.ok(escrowService.listOrders());
    }

    /**
     * 6. 仲裁解决争议
     */
 
/**
 * 6. 仲裁解决争议
 */
@PostMapping("/orders/{id}/resolve")
public CompletableFuture<ResponseEntity<Map<String, String>>> resolve(
        @PathVariable BigInteger id,
        @RequestParam boolean sellerWins) {

    return escrowService.resolve(id, sellerWins).thenApply(receipt -> {
        Map<String, String> response = new HashMap<>();
        response.put("transactionHash", receipt.getTransactionHash());
        response.put("blockNumber", receipt.getBlockNumber().toString());
        // receipt.isStatusOK() 为 true 表示交易执行成功
        response.put("status", receipt.isStatusOK() ? "Success" : "Failed");
        return ResponseEntity.ok(response);
    });
}

       @GetMapping("/orders/{id}/events")
    public List<Map<String, Object>> getOrderTimeline(@PathVariable BigInteger id) {
        try {
            return escrowService.getOrderEventTimeline(id);
        } catch (Exception e) {
            log.error("获取订单{}事件流水失败", id, e);
            // 统一返回空列表
            return List.of();
        }
    }

}