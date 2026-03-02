// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title USDTEscrow
 * @notice Escrow contract for USDT deposits on Polygon PoS
 * @dev Users deposit USDT, platform tracks deposits via events
 *      Admin can withdraw funds to cold storage
 *
 * Polygon Mainnet USDT: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F
 * Polygon Mumbai USDT (test): deploy your own mock ERC20
 */
contract USDTEscrow is Ownable, ReentrancyGuard {
    IERC20 public immutable usdtToken;

    // Deposit tracking
    mapping(address => uint256) public userDeposits;
    uint256 public totalDeposits;

    // Events for off-chain monitoring
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event AdminWithdraw(address indexed to, uint256 amount, uint256 timestamp);

    constructor(address _usdtAddress) Ownable(msg.sender) {
        require(_usdtAddress != address(0), "Invalid USDT address");
        usdtToken = IERC20(_usdtAddress);
    }

    /**
     * @notice Deposit USDT into escrow
     * @param amount Amount of USDT to deposit (6 decimals)
     * @dev User must approve this contract first
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(
            usdtToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        userDeposits[msg.sender] += amount;
        totalDeposits += amount;

        emit Deposit(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Admin withdraws USDT to specified address (e.g. cold storage)
     * @param to Destination address
     * @param amount Amount to withdraw
     */
    function adminWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        require(
            usdtToken.balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );

        require(usdtToken.transfer(to, amount), "Transfer failed");

        emit AdminWithdraw(to, amount, block.timestamp);
    }

    /**
     * @notice Get contract's USDT balance
     */
    function getBalance() external view returns (uint256) {
        return usdtToken.balanceOf(address(this));
    }

    /**
     * @notice Emergency: recover any ERC20 tokens accidentally sent
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        IERC20(token).transfer(owner(), amount);
    }
}
