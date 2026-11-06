
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const AMOUNT = ethers.parseUnits("30", 18);

async function deployFixture() {
  const [
    deployer,
    buyer,
    seller,
    arbiter1,
    arbiter2,
    stranger,
  ] = await ethers.getSigners();

  const token = await ethers.deployContract("HZYToken");

  await token.mint(
    buyer.address,
    ethers.parseUnits("100", 18)
  );

  // 部署双仲裁人 Escrow
  const escrow = await ethers.deployContract("Escrow", [
    arbiter1.address,
    arbiter2.address,
  ]);

  const deadline = (await time.latest()) + 3600;

  return {
    token,
    escrow,
    deployer,
    buyer,
    seller,
    arbiter1,
    arbiter2,
    stranger,
    deadline,
  };
}

// 创建一个已经付款并发起争议的订单
async function createDisputedOrder() {
  const fixture = await deployFixture();

  const {
    token,
    escrow,
    buyer,
    seller,
    deadline,
  } = fixture;

  const escrowAddr = await escrow.getAddress();

  await escrow.connect(buyer).createOrder(
    seller.address,
    await token.getAddress(),
    AMOUNT,
    deadline,
    "一本书"
  );

  await token.connect(buyer).approve(escrowAddr, AMOUNT);

  await escrow.connect(buyer).deposit(0);

  await escrow.connect(buyer).dispute(0);

  return fixture;
}

describe("Escrow - 双仲裁人托管合约", function () {

  // 1. 创建订单
  it("createOrder 记录订单并发出事件", async function () {
    const { token, escrow, buyer, seller, deadline } =
      await loadFixture(deployFixture);

    await expect(
      escrow.connect(buyer).createOrder(
        seller.address,
        await token.getAddress(),
        AMOUNT,
        deadline,
        "一本书"
      )
    )
      .to.emit(escrow, "OrderCreated")
      .withArgs(
        0,
        buyer.address,
        seller.address,
        await token.getAddress(),
        AMOUNT,
        deadline
      );

    const order = await escrow.getOrder(0);

    expect(order.buyer).to.equal(buyer.address);
    expect(order.status).to.equal(0);
    expect(await escrow.orderCount()).to.equal(1);
  });

  // 2. 未授权时付款失败
  it("未 approve 时 deposit 失败", async function () {
    const { token, escrow, buyer, seller, deadline } =
      await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(
      seller.address,
      await token.getAddress(),
      AMOUNT,
      deadline,
      "一本书"
    );

    await expect(
      escrow.connect(buyer).deposit(0)
    ).to.be.revertedWith(
      "HZYToken: allowance insufficient"
    );
  });

  // 3. 授权后付款成功
  it("approve 后 deposit 成功，状态变为 Paid", async function () {
    const { token, escrow, buyer, seller, deadline } =
      await loadFixture(deployFixture);

    const escrowAddr = await escrow.getAddress();

    await escrow.connect(buyer).createOrder(
      seller.address,
      await token.getAddress(),
      AMOUNT,
      deadline,
      "一本书"
    );

    await token.connect(buyer).approve(escrowAddr, AMOUNT);

    await escrow.connect(buyer).deposit(0);

    expect(await token.balanceOf(escrowAddr)).to.equal(AMOUNT);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(1);
  });

  // 4. 非买家不能确认收货
  it("非买家调用 confirm 失败", async function () {
    const {
      token,
      escrow,
      buyer,
      seller,
      stranger,
      deadline,
    } = await loadFixture(deployFixture);

    const escrowAddr = await escrow.getAddress();

    await escrow.connect(buyer).createOrder(
      seller.address,
      await token.getAddress(),
      AMOUNT,
      deadline,
      "一本书"
    );

    await token.connect(buyer).approve(escrowAddr, AMOUNT);

    await escrow.connect(buyer).deposit(0);

    await escrow.connect(seller).markShipped(0);

    await expect(
      escrow.connect(stranger).confirm(0)
    ).to.be.revertedWith(
      "Escrow: caller is not the buyer"
    );
  });

  // 5. 卖家发货，买家确认收货
  it("markShipped 后 confirm 成功，卖家收到代币", async function () {
    const { token, escrow, buyer, seller, deadline } =
      await loadFixture(deployFixture);

    const escrowAddr = await escrow.getAddress();

    await escrow.connect(buyer).createOrder(
      seller.address,
      await token.getAddress(),
      AMOUNT,
      deadline,
      "一本书"
    );

    await token.connect(buyer).approve(escrowAddr, AMOUNT);

    await escrow.connect(buyer).deposit(0);

    await expect(
      escrow.connect(seller).markShipped(0)
    ).to.emit(escrow, "OrderShipped").withArgs(0);

    await expect(
      escrow.connect(buyer).confirm(0)
    ).to.emit(escrow, "OrderCompleted").withArgs(0);

    expect(await token.balanceOf(seller.address)).to.equal(AMOUNT);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(2);
  });

  // 6. 超期退款
  it("deadline 之前 refund 失败，之后退款成功", async function () {
    const { token, escrow, buyer, seller, deadline } =
      await loadFixture(deployFixture);

    const escrowAddr = await escrow.getAddress();

    await escrow.connect(buyer).createOrder(
      seller.address,
      await token.getAddress(),
      AMOUNT,
      deadline,
      "一本书"
    );

    await token.connect(buyer).approve(escrowAddr, AMOUNT);

    await escrow.connect(buyer).deposit(0);

    await expect(
      escrow.connect(buyer).refund(0)
    ).to.be.revertedWith(
      "Escrow: not yet expired"
    );

    await time.increase(3600);

    await expect(
      escrow.connect(buyer).refund(0)
    ).to.emit(escrow, "OrderRefunded").withArgs(0);

    expect(
      await token.balanceOf(buyer.address)
    ).to.equal(ethers.parseUnits("100", 18));

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(3);
  });

  // 7. 非仲裁人不能投票
  it("非仲裁人调用 resolve 失败", async function () {
    const {
      escrow,
      stranger,
    } = await loadFixture(createDisputedOrder);

    await expect(
      escrow.connect(stranger).resolve(0, false)
    ).to.be.revertedWith(
      "Escrow: caller is not an arbiter"
    );
  });

  // 8. 第一位仲裁人投票后不立即裁决
  it("第一位仲裁人投票后，订单仍为 Disputed", async function () {
    const {
      escrow,
      arbiter1,
    } = await loadFixture(createDisputedOrder);

    await expect(
      escrow.connect(arbiter1).resolve(0, false)
    )
      .to.emit(escrow, "ArbiterVoted")
      .withArgs(0, arbiter1.address, false);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(4);

    expect(
      await escrow.hasVoted(0, arbiter1.address)
    ).to.equal(true);

    expect(
      await escrow.hasVoted(0, (await escrow.arbiter2()))
    ).to.equal(false);
  });

  // 9. 两位仲裁人意见一致，退款给买家
  it("两位仲裁人意见一致，退款给买家", async function () {
    const {
      token,
      escrow,
      buyer,
      arbiter1,
      arbiter2,
    } = await loadFixture(createDisputedOrder);

    // 仲裁人一投票：退款给买家
    await escrow.connect(arbiter1).resolve(0, false);

    let order = await escrow.getOrder(0);

    expect(order.status).to.equal(4);

    // 仲裁人二投票：同意退款
    await expect(
      escrow.connect(arbiter2).resolve(0, false)
    )
      .to.emit(escrow, "ArbiterVoted")
      .withArgs(0, arbiter2.address, false)
      .and.to.emit(escrow, "OrderResolved")
      .withArgs(0, false);

    order = await escrow.getOrder(0);

    expect(order.status).to.equal(3);

    expect(
      await token.balanceOf(buyer.address)
    ).to.equal(ethers.parseUnits("100", 18));
  });

  // 10. 两位仲裁人意见不一致，可以修改投票
  it("意见不一致时保持 Disputed，修改投票后完成裁决", async function () {
    const {
      token,
      escrow,
      buyer,
      arbiter1,
      arbiter2,
    } = await loadFixture(createDisputedOrder);

    // 仲裁人一：判给卖家
    await escrow.connect(arbiter1).resolve(0, true);

    // 仲裁人二：退款给买家
    await escrow.connect(arbiter2).resolve(0, false);

    let order = await escrow.getOrder(0);

    // 意见不一致，不能完成裁决
    expect(order.status).to.equal(4);

    expect(await escrow.votes(0, arbiter1.address)).to.equal(true);
    expect(await escrow.votes(0, arbiter2.address)).to.equal(false);

    // 仲裁人二修改意见：判给卖家
    await expect(
      escrow.connect(arbiter2).resolve(0, true)
    )
      .to.emit(escrow, "ArbiterVoted")
      .withArgs(0, arbiter2.address, true)
      .and.to.emit(escrow, "OrderResolved")
      .withArgs(0, true);

    order = await escrow.getOrder(0);

    expect(order.status).to.equal(2);

    // 卖家收到托管代币
    expect(
      await token.balanceOf(order.seller)
    ).to.equal(AMOUNT);
  });

  // 11. 两位仲裁人一致判给卖家
  it("两位仲裁人一致判给卖家，状态变为 Completed", async function () {
    const {
      token,
      escrow,
      buyer,
      seller,
      arbiter1,
      arbiter2,
    } = await loadFixture(createDisputedOrder);

    await escrow.connect(arbiter1).resolve(0, true);

    await escrow.connect(arbiter2).resolve(0, true);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(2);

    expect(
      await token.balanceOf(seller.address)
    ).to.equal(AMOUNT);

    expect(
      await token.balanceOf(buyer.address)
    ).to.equal(ethers.parseUnits("70", 18));
  });

});
