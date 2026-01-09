// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SpinON_V2
 * @dev 1/10 şansla 1.2x ödül veren Spin-to-Win kontratı.
 */
contract SpinON {
    address public owner;
    
    // Spin ücreti (Varsayılan: 0.0001 ETH)
    uint256 public spinFee = 0.0001 ether;
    
    // Ödül çarpanı (Örn: 120 = 1.2x)
    uint256 public constant WIN_MULTIPLIER = 120; 
    
    // Kazanma ihtimali (10'da 1)
    uint256 public constant WIN_CHANCE = 10;

    // Kullanıcıların biriken ve çekilmeyi bekleyen ödülleri
    mapping(address => uint256) public pendingWinnings;
    
    // İstatistikler
    uint256 public totalSpins;
    mapping(address => uint256) public userSpinCounts;

    // Olaylar (Frontend takibi için)
    event SpinExecuted(address indexed user, bool isWinner, uint256 rewardAmount, uint256 timestamp);
    event WinningsClaimed(address indexed user, uint256 amount);
    event LiquidityAdded(address indexed provider, uint256 amount);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Sadece sahip yetkili");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Çarkı çevirir. 1/10 şansla 1.2 katı ödül kazandırır.
     */
    function spin() external payable {
        require(msg.value >= spinFee, "Yetersiz spin ucreti");
        
        totalSpins++;
        userSpinCounts[msg.sender]++;

        // Rastgele sayı üretimi (0-9 arası)
        // Not: Çok büyük projeler için Chainlink VRF önerilir, ancak bu temel sürüm için standart yöntemdir.
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            totalSpins
        ))) % WIN_CHANCE;

        bool isWinner = (randomNumber == 0); // Sadece 0 gelirse kazanır (1/10 şans)
        uint256 reward = 0;

        if (isWinner) {
            reward = (spinFee * WIN_MULTIPLIER) / 100;
            pendingWinnings[msg.sender] += reward;
        }

        emit SpinExecuted(msg.sender, isWinner, reward, block.timestamp);

        // Kullanıcı fazla para gönderdiyse iade et
        if (msg.value > spinFee) {
            uint256 excess = msg.value - spinFee;
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Iade basarisiz");
        }
    }

    /**
     * @dev Kullanıcının kazandığı ödülleri cüzdanına çeker.
     */
    function claimWinnings() external {
        uint256 amount = pendingWinnings[msg.sender];
        require(amount > 0, "Cekilecek odulunuz yok");
        require(address(this).balance >= amount, "Kontratta yeterli odul havuzu yok");

        pendingWinnings[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer basarisiz");

        emit WinningsClaimed(msg.sender, amount);
    }

    /**
     * @dev Kontrat sahibi sisteme ödül havuzu için likidite ekler.
     */
    function depositLiquidity() external payable {
        emit LiquidityAdded(msg.sender, msg.value);
    }

    /**
     * @dev Kontrat sahibi biriken fonları çekebilir.
     */
    function withdrawFunds(uint256 _amount) external onlyOwner {
        require(address(this).balance >= _amount, "Yetersiz bakiye");
        payable(owner).transfer(_amount);
        emit EmergencyWithdraw(owner, _amount);
    }

    /**
     * @dev Spin ücretini günceller.
     */
    function setSpinFee(uint256 _newFee) external onlyOwner {
        spinFee = _newFee;
    }

    /**
     * @dev Kontratın toplam bakiyesini gösterir.
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Doğrudan ETH gönderimlerini kabul eder
    receive() external payable {
        emit LiquidityAdded(msg.sender, msg.value);
    }
}