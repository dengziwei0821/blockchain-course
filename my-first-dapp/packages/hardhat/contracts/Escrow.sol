// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
// 只声明我们要用的三个函数。Escrow 通过这个接口去调用任何 ERC20 合约。
interface IERC20 {
function transfer(address to, uint256 value) external returns (bool);
function transferFrom(address from, address to, uint256 value) external returns (bool);
function balanceOf(address account) external view returns (uint256);
}

contract Escrow {
// ---------- 状态机 ----------
enum Status {
    Created,
    Paid,
    Completed,
    Refunded,
    Disputed,
    Shipped
}
struct Order {
address buyer;
address seller;
address token; // 用哪种 ERC20 结算
uint256 amount; // 最小单位
uint256 deadline; // unix 时间戳，秒
Status status;
string description;
}
// ---------- 存储 ----------
address public arbiter1;
address public arbiter2;
uint256 public orderCount;
mapping(uint256 => Order) private _orders;
// 每个订单、每位仲裁人的投票结果
mapping(uint256 => mapping(address => bool)) public votes;

// 记录仲裁人是否已经投过票
mapping(uint256 => mapping(address => bool)) public hasVoted;
// ---------- 事件 ----------
event OrderCreated(uint256 indexed id, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 deadline);
event OrderPaid(uint256 indexed id);
event OrderCompleted(uint256 indexed id);
event OrderRefunded(uint256 indexed id);
event ArbiterVoted(uint256 indexed id,address indexed arbiter,bool sellerWins);
event OrderDisputed(uint256 indexed id, address by);
event OrderResolved(uint256 indexed id, bool sellerWins);
event OrderShipped(uint256 indexed id);
// ---------- 修饰器 ----------
modifier onlyArbiter() {
    require(
        msg.sender == arbiter1 || msg.sender == arbiter2,
        "Escrow: caller is not an arbiter"
    );
    _;
}
modifier onlyBuyer(uint256 id) {
require(msg.sender == _orders[id].buyer, "Escrow: caller is not the buyer");
_;
}
modifier inStatus(uint256 id, Status s) {
require(_orders[id].status == s, "Escrow: wrong status");
_;
}
constructor(address _arbiter1, address _arbiter2) {
    require(_arbiter1 != address(0), "Escrow: arbiter1 is the zero address");
    require(_arbiter2 != address(0), "Escrow: arbiter2 is the zero address");
    require(_arbiter1 != _arbiter2, "Escrow: arbiters must be different");

    arbiter1 = _arbiter1;
    arbiter2 = _arbiter2;
}
function getOrder(uint256 id) public view returns (Order memory) {
require(id < orderCount, "Escrow: order does not exist");
return _orders[id];
}

// ---------- TODO 1：创建订单 ----------
// 要求：seller 不能是零地址、不能是自己；amount 大于 0；deadline 必须在未来；
// 订单 id 为当前 orderCount，写入 _orders，orderCount 加一；
// buyer 是 msg.sender，状态 Created；发出 OrderCreated；返回 id。
function createOrder(address seller, address token, uint256 amount, uint256 deadline, string memory description) public returns (uint256) {
    // 校验条件
    require(seller != address(0), "Escrow: seller is zero address");
    require(seller != msg.sender, "Escrow: buyer cannot be seller");
    require(amount > 0, "Escrow: amount must > 0");
    require(deadline > block.timestamp, "Escrow: deadline must be future");

    uint256 newId = orderCount; // 订单ID = 当前orderCount
    _orders[newId] = Order({
        buyer: msg.sender,
        seller: seller,
        token: token,
        amount: amount,
        deadline: deadline,
        status: Status.Created,
        description: description
    });
    orderCount += 1; // 订单计数+1

    emit OrderCreated(newId, msg.sender, seller, token, amount, deadline);
    return newId;
}

// ---------- TODO 2：买家付款 ----------
// 要求：只有买家、只在 Created 状态（用修饰器）；
// 先把状态改为 Paid，再调用代币的 transferFrom 把 amount 从买家转到本合约（address(this)）；
// transferFrom 返回 false 要 revert；发出 OrderPaid。
// 提示：IERC20(o.token).transferFrom(...)。想清楚代币合约看到的 msg.sender 是谁。
function deposit(uint256 id) public onlyBuyer(id) inStatus(id, Status.Created) {
    Order storage o = _orders[id]; // 拿到订单存储引用
    o.status = Status.Paid; // 修改状态为Paid

    // 调用ERC20的transferFrom，从买家(o.buyer)转账到当前托管合约address(this)
    // 注意：调用前买家必须提前给Escrow合约授权approve！
    bool success = IERC20(o.token).transferFrom(o.buyer, address(this), o.amount);
    require(success, "Escrow: transferFrom failed");

    emit OrderPaid(id);
}

// ---------- 卖家发货 ----------
// 要求：只有卖家可以操作，并且订单必须处于 Paid 状态。
function markShipped(uint256 id) public inStatus(id, Status.Paid) {
    Order storage o = _orders[id];

    require(
        msg.sender == o.seller,
        "Escrow: only seller can mark shipped"
    );

    o.status = Status.Shipped;

    emit OrderShipped(id);
}

// ---------- TODO 3：买家确认收货 ----------
// 要求：只有买家、只在 Paid 状态；状态改为 Completed；代币转给卖家；发出 OrderCompleted。
function confirm(uint256 id) public onlyBuyer(id) inStatus(id, Status.Shipped) {
    Order storage o = _orders[id];

    o.status = Status.Completed;

    bool success = IERC20(o.token).transfer(o.seller, o.amount);
    require(success, "Escrow: transfer failed");

    emit OrderCompleted(id);
}

// ---------- TODO 4：超期退款 ----------
// 要求：只有买家、只在 Paid 状态；block.timestamp 必须大于 deadline；
// 状态改为 Refunded；代币退回买家；发出 OrderRefunded。
function refund(uint256 id) public onlyBuyer(id) inStatus(id, Status.Paid) {
    Order storage o = _orders[id];
    require(block.timestamp > o.deadline, "Escrow: not yet expired");

    o.status = Status.Refunded;
    bool success = IERC20(o.token).transfer(o.buyer, o.amount);
    require(success, "Escrow: refund transfer failed");

    emit OrderRefunded(id);
}

// ---------- TODO 5：发起争议 ----------
// 要求：只在 Paid 状态；调用者必须是买家或卖家；状态改为 Disputed；发出 OrderDisputed。
function dispute(uint256 id) public {
    Order storage o = _orders[id];

    require(
        o.status == Status.Paid || o.status == Status.Shipped,
        "Escrow: wrong status"
    );

    require(
        msg.sender == o.buyer || msg.sender == o.seller,
        "Escrow: only buyer or seller can dispute"
    );

    o.status = Status.Disputed;

    emit OrderDisputed(id, msg.sender);
}

// ---------- TODO 6：仲裁 ----------
// 要求：只有仲裁人、只在 Disputed 状态；
// sellerWins 为 true 则状态 Completed、代币给卖家，否则状态 Refunded、代币退买家；
// 发出 OrderResolved。
function resolve(uint256 id, bool sellerWins)
    public
    inStatus(id, Status.Disputed)
{
    require(
        msg.sender == arbiter1 || msg.sender == arbiter2,
        "Escrow: caller is not an arbiter"
    );

    // 保存当前仲裁人的投票，允许修改之前的意见
    votes[id][msg.sender] = sellerWins;
    hasVoted[id][msg.sender] = true;

    emit ArbiterVoted(id, msg.sender, sellerWins);

    address otherArbiter =
        msg.sender == arbiter1 ? arbiter2 : arbiter1;

    // 另一位仲裁人还没有投票，等待
    if (!hasVoted[id][otherArbiter]) {
        return;
    }

    // 两人意见不一致，继续保持争议状态
    if (votes[id][msg.sender] != votes[id][otherArbiter]) {
        return;
    }

    // 两人意见一致，正式执行裁决
    Order storage o = _orders[id];

    if (sellerWins) {
        o.status = Status.Completed;

        bool success = IERC20(o.token).transfer(o.seller, o.amount);
        require(success, "Escrow: resolve transfer to seller failed");
    } else {
        o.status = Status.Refunded;

        bool success = IERC20(o.token).transfer(o.buyer, o.amount);
        require(success, "Escrow: resolve refund to buyer failed");
    }

    emit OrderResolved(id, sellerWins);
}
}
