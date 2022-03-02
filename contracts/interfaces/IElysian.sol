// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

interface IElysian {
    // Views
    function totalSupply() external view returns (uint);
    function transferableElysian(address account) external view returns (uint transferable);
    
    // Stateful functions
    function mint(uint _amount, address _recipient, bool _isEscrowed) external returns (bool);

}
