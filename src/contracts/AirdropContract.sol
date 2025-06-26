// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title AirdropContract
 * @dev A secure and gas-efficient airdrop contract supporting both direct distribution and merkle tree claims
 */
contract AirdropContract is Ownable, ReentrancyGuard {
    IERC20 public immutable token;
    
    struct AirdropCampaign {
        uint256 totalAmount;
        uint256 claimedAmount;
        bytes32 merkleRoot;
        bool isActive;
        mapping(address => bool) claimed;
    }
    
    mapping(uint256 => AirdropCampaign) public campaigns;
    uint256 public campaignCounter;
    
    event CampaignCreated(
        uint256 indexed campaignId,
        uint256 totalAmount,
        bytes32 merkleRoot
    );
    
    event TokensClaimed(
        uint256 indexed campaignId,
        address indexed recipient,
        uint256 amount
    );
    
    event CampaignStatusChanged(
        uint256 indexed campaignId,
        bool isActive
    );
    
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
    }
    
    /**
     * @dev Create a new airdrop campaign with merkle tree verification
     * @param _totalAmount Total tokens to be distributed in this campaign
     * @param _merkleRoot Merkle root for claim verification
     */
    function createCampaign(
        uint256 _totalAmount,
        bytes32 _merkleRoot
    ) external onlyOwner returns (uint256) {
        require(_totalAmount > 0, "Total amount must be greater than 0");
        require(_merkleRoot != bytes32(0), "Invalid merkle root");
        
        // Transfer tokens to contract
        require(
            token.transferFrom(msg.sender, address(this), _totalAmount),
            "Token transfer failed"
        );
        
        uint256 campaignId = campaignCounter++;
        AirdropCampaign storage campaign = campaigns[campaignId];
        campaign.totalAmount = _totalAmount;
        campaign.merkleRoot = _merkleRoot;
        campaign.isActive = true;
        
        emit CampaignCreated(campaignId, _totalAmount, _merkleRoot);
        return campaignId;
    }
    
    /**
     * @dev Claim tokens from a specific campaign using merkle proof
     * @param _campaignId Campaign ID to claim from
     * @param _amount Amount of tokens to claim
     * @param _merkleProof Merkle proof for verification
     */
    function claimTokens(
        uint256 _campaignId,
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external nonReentrant {
        AirdropCampaign storage campaign = campaigns[_campaignId];
        
        require(campaign.isActive, "Campaign is not active");
        require(!campaign.claimed[msg.sender], "Tokens already claimed");
        require(_amount > 0, "Amount must be greater than 0");
        require(
            campaign.claimedAmount + _amount <= campaign.totalAmount,
            "Insufficient tokens in campaign"
        );
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(
            MerkleProof.verify(_merkleProof, campaign.merkleRoot, leaf),
            "Invalid merkle proof"
        );
        
        // Mark as claimed and update amounts
        campaign.claimed[msg.sender] = true;
        campaign.claimedAmount += _amount;
        
        // Transfer tokens
        require(token.transfer(msg.sender, _amount), "Token transfer failed");
        
        emit TokensClaimed(_campaignId, msg.sender, _amount);
    }
    
    /**
     * @dev Direct airdrop to multiple recipients (gas expensive, use carefully)
     * @param _recipients Array of recipient addresses
     * @param _amounts Array of token amounts for each recipient
     */
    function directAirdrop(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOwner nonReentrant {
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        require(_recipients.length <= 200, "Too many recipients"); // Gas limit protection
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        
        // Transfer total tokens to contract
        require(
            token.transferFrom(msg.sender, address(this), totalAmount),
            "Token transfer failed"
        );
        
        // Distribute tokens
        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient address");
            require(_amounts[i] > 0, "Amount must be greater than 0");
            
            require(
                token.transfer(_recipients[i], _amounts[i]),
                "Token transfer failed"
            );
        }
    }
    
    /**
     * @dev Toggle campaign active status
     * @param _campaignId Campaign ID to toggle
     */
    function setCampaignStatus(
        uint256 _campaignId,
        bool _isActive
    ) external onlyOwner {
        require(_campaignId < campaignCounter, "Campaign does not exist");
        campaigns[_campaignId].isActive = _isActive;
        emit CampaignStatusChanged(_campaignId, _isActive);
    }
    
    /**
     * @dev Check if an address has claimed from a specific campaign
     * @param _campaignId Campaign ID to check
     * @param _address Address to check
     */
    function hasClaimed(
        uint256 _campaignId,
        address _address
    ) external view returns (bool) {
        return campaigns[_campaignId].claimed[_address];
    }
    
    /**
     * @dev Get campaign information
     * @param _campaignId Campaign ID
     */
    function getCampaignInfo(uint256 _campaignId) external view returns (
        uint256 totalAmount,
        uint256 claimedAmount,
        bytes32 merkleRoot,
        bool isActive
    ) {
        AirdropCampaign storage campaign = campaigns[_campaignId];
        return (
            campaign.totalAmount,
            campaign.claimedAmount,
            campaign.merkleRoot,
            campaign.isActive
        );
    }
    
    /**
     * @dev Emergency function to withdraw remaining tokens
     * @param _amount Amount of tokens to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(
            token.transfer(owner(), _amount),
            "Token transfer failed"
        );
    }
    
    /**
     * @dev Get contract token balance
     */
    function getContractBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}