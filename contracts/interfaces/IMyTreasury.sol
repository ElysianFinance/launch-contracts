// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

interface IMyTreasury {

    function getReservesValue(bytes32 _currencyName) external view returns (uint256) ;
    function getReserveBalanceByIndex(uint index) external view returns (uint) ;

    /* ========== MUTATIVE FUNCTIONS ========== */
    function deposit(uint _depositAmount, bytes32 _tokenName, uint256 _profit, bool _isEscrowed) external returns(uint) ;
    function depositFor(address from, uint _depositAmount, uint _mintable, bytes32 _tokenName, uint256 _profit, bool _isEscrowed) external returns(uint) ;

}
