const Owned = artifacts.require('OwnedwManager');
const truffleAssert = require('truffle-assertions');

const {
	constants: { ZERO_ADDRESS },
} = require('../src/utils.js');

contract('OwnedwManager', accounts => {
	const [deployerAccount, account1, account2, account3, account4] = accounts;

	it('should revert when owner parameter is passed the zero address', async () => {
		await truffleAssert.reverts(
			Owned.new(ZERO_ADDRESS, ZERO_ADDRESS, { from: deployerAccount }),
			"Owner address cannot be 0"
		) 
	});

	it('should set owner address on deployment', async () => {
		const ownedContractInstance = await Owned.new(account1,account1, { from: deployerAccount });
		const owner = await ownedContractInstance.owner();
		assert.equal(owner, account1);;
	});
 
	it('should not nominate new owner when not invoked by current contract owner', async () => {
		const nominatedOwner = account3;
		let ownedContractInstance = await Owned.new(account1,account1, { from: account2 });
		await truffleAssert.reverts(
			ownedContractInstance.nominateNewOwner(nominatedOwner, { from: account2 }),
			"Only the contract owner may perform this action"
		);
		const nominatedOwnerFrmContract = await ownedContractInstance.nominatedOwner();
		assert.equal(nominatedOwnerFrmContract, ZERO_ADDRESS);
	});

	it('should nominate new owner when invoked by current contract owner', async () => {
		const nominatedOwner = account2;
		let ownedContractInstance = await Owned.new(account1,account1, { from: account2 });
		const txn = await ownedContractInstance.nominateNewOwner(nominatedOwner, { from: account1 });
		truffleAssert.eventEmitted(txn, "OwnerNominated", {
            newOwner:nominatedOwner
        });
	});
});
