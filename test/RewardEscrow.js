const {
	mockToken,
	setupContract,
	toUnit,
	constants: {
		ZERO_ADDRESS
	},
	fastForward,
	currentTime
} = require('../src/utils');
const truffleAssert = require('truffle-assertions');
const Elysian = artifacts.require('Elysian');
const RewardEscrow = artifacts.require('RewardEscrow');
const {
	gray,
	yellow
} = require('chalk');

const {
	fromWei,
	toWei
} = web3.utils;

contract('RewardEscrow', async accounts => {
	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

	let rewardEscrow, elysian, feePool;

	const [owner, account1, account2] = accounts;
	const feePoolAccount = account1;

	// Run once at beginning - snapshots will take care of resetting this before each test
	before(async () => {
		elysian = await Elysian.deployed();
		rewardEscrow = await RewardEscrow.deployed();
		feePool = {
			address: account1
		}; // mock contract with address
	});


	describe(yellow('Constructor & Settings'), async () => {

		it('should set owner on contructor', async () => {
			const ownerAddress = await rewardEscrow.owner();
			assert.equal(ownerAddress, owner);
		});

	});

	describe(yellow('Given there are no escrow entries'), async () => {
		it('then numVestingEntries should return 0', async () => {
			assert.equal(0, await rewardEscrow.numVestingEntries(account1));
		});
		it('then getNextVestingEntry should return 0', async () => {
			const nextVestingEntry = await rewardEscrow.getNextVestingEntry(account1);
			assert.equal(nextVestingEntry[0], 0);
			assert.equal(nextVestingEntry[1], 0);
		});
		it('then vest should do nothing and not revert', async () => {
			await rewardEscrow.vest({
				from: account1
			});
			const totalVestedAccountBalanace = await rewardEscrow.totalVestedAccountBalance(account1);
			assert.equal((fromWei(totalVestedAccountBalanace, "gwei")).toString(), '0');
		});
	});

	describe('Functions', async () => {
		describe(yellow('Vesting Schedule Writes'), async () => {
			it('should not create a vesting entry with a zero amount', async () => {
				// Transfer of LYS to the escrow must occur before creating an entry
				await elysian.transfer(rewardEscrow.address, toWei('1', "gwei"), {
					from: owner,
				});

				await truffleAssert.reverts(
					rewardEscrow.appendVestingEntry(account1, toWei('0', "gwei"), {
						from: feePoolAccount
					})
				);
			});

			it('should not create a vesting entry if there is not enough LYS in the contracts balance', async () => {
				// Transfer of LYS to the escrow must occur before creating an entry
				await elysian.transfer(rewardEscrow.address, toWei(`1`, "gwei"), {
					from: owner,
				});
				await truffleAssert.reverts(
					rewardEscrow.appendVestingEntry(account1, toWei(`1`, "gwei"), {
						from: feePoolAccount
					}),
					"Only Elysian, Treasury contracts allowed"
				);
			});
		});

		describe(yellow('Vesting Schedule Reads'), async () => {
			beforeEach(async () => {
				// Transfer of LYS to the escrow must occur before creating a vestinng entry
				await elysian.transfer(rewardEscrow.address, toWei(`6000`, "gwei"), {
					from: owner,
				});

				// Add a few vesting entries as the feepool address
				await rewardEscrow.appendVestingEntry(account1, toWei(`6000`, "gwei"), {
					from: owner
				});
				await fastForward(WEEK * 2, web3);
				//await rewardEscrow.appendVestingEntry(account1, toWei(`2000`, "gwei"), { from: owner });
				//await fastForward(WEEK * 4, web3);
				//await rewardEscrow.appendVestingEntry(account1, toWei(`3000`, "gwei"), { from: owner });
			});

			it('should append a vesting entry and increase the contracts balance', async () => {
				const balanceOfRewardEscrow = await elysian.balanceOf(rewardEscrow.address);
				//account for two gwei transferred above
				assert.equal((fromWei(balanceOfRewardEscrow, "gwei")).toString(), '6002');
			});

			it('should get an accounts total Vested Account Balance', async () => {
				const balanceOf = await rewardEscrow.balanceOf(account1);
				assert.equal((fromWei(balanceOf, "gwei")).toString(), '12000');
			});

			it('should get an accounts number of vesting entries', async () => {
				const numVestingEntries = await rewardEscrow.numVestingEntries(account1);
				assert.equal(numVestingEntries.toString(), 3);
			});

			it('should get an accounts vesting schedule entry by index', async () => {
				let vestingScheduleEntry;
				vestingScheduleEntry = await rewardEscrow.getVestingScheduleEntry(account1, 0);
				assert.equal((fromWei(vestingScheduleEntry[1], "gwei")).toString(), '6000');

				//vestingScheduleEntry = await rewardEscrow.getVestingScheduleEntry(account1, 1);
				//assert.equal((fromWei(vestingScheduleEntry[1], "gwei")).toString(), '2000');

				//vestingScheduleEntry = await rewardEscrow.getVestingScheduleEntry(account1, 2);
				//assert.equal((fromWei(vestingScheduleEntry[1], "gwei")).toString(), '3000');
			});

			it('should get an accounts vesting time for a vesting entry index', async () => {
				const oneYearAhead = (await currentTime()) + DAY * 365;
				assert.isAtLeast(oneYearAhead, parseInt(await rewardEscrow.getVestingTime(account1, 0)));
				//assert.isAtLeast(oneYearAhead, parseInt(await rewardEscrow.getVestingTime(account1, 1)));
				//assert.isAtLeast(oneYearAhead, parseInt(await rewardEscrow.getVestingTime(account1, 2)));
			});

			it('should get an accounts vesting quantity for a vesting entry index', async () => {
				assert.equal((fromWei(await rewardEscrow.getVestingQuantity(account1, 0), "gwei")).toString(), '6000');
				//assert.equal((fromWei(await rewardEscrow.getVestingQuantity(account1, 1), "gwei")).toString(), '2000');
				//assert.equal((fromWei(await rewardEscrow.getVestingQuantity(account1, 2), "gwei")).toString(), '3000');
			});
		});

		describe(yellow('Partial Vesting'), async () => {
			beforeEach(async () => {
				// Transfer of LYS to the escrow must occur before creating a vestinng entry
				await elysian.transfer(rewardEscrow.address, toWei('6000', "gwei"), {
					from: owner,
				});

				// Add a few vesting entries as the feepool address
				await rewardEscrow.appendVestingEntry(account1, toWei('6000', "gwei"), {
					from: owner
				});
				await fastForward(WEEK, web3);
				//await rewardEscrow.appendVestingEntry(account1, toWei('2000', "gwei"), { from: owner });
				//await fastForward(WEEK * 4, web3);
				//await rewardEscrow.appendVestingEntry(account1, toWei('3000', "gwei"), { from: owner });

				// fastForward to vest only the first weeks entry
				await fastForward(YEAR - WEEK, web3);

				// Vest
				await rewardEscrow.vest({
					from: account1
				});
			});

			/*('should get an accounts next vesting entry index', async () => {
                const nextVestingEntryIndex = await rewardEscrow.getNextVestingEntryIndex(account1);
				assert.equal(nextVestingEntryIndex.toString(), 1);
			});

			it('should get an accounts next vesting entry', async () => {
				const vestingScheduleEntry = await rewardEscrow.getNextVestingEntry(account1);
                assert.equal((fromWei(vestingScheduleEntry[1], "gwei")).toString(), '2000');
			});

			it('should get an accounts next vesting time', async () => {
				const fiveDaysAhead = (await currentTime()) + DAY * 5;
				assert.isAtLeast(parseInt(await rewardEscrow.getNextVestingTime(account1)), fiveDaysAhead);
			});

			it('should get an accounts next vesting quantity', async () => {
				const nextVestingQuantity = await rewardEscrow.getNextVestingQuantity(account1);
                assert.equal((fromWei(nextVestingQuantity, "gwei")).toString(), '2000');
			});*/
		});

		describe(yellow('Transfering'), async () => {
			it('should not allow transfer of elysian in escrow', async () => {
				// Ensure the transfer fails as all the elysian are in escrow
				await truffleAssert.reverts(
					elysian.transfer(account2, toWei('1000', "gwei"), {
						from: account1,
					}),
					"Not enough LYS balance"
				);
			});
		});

		describe(yellow('Vesting'), async () => {
			beforeEach(async () => {
				// Transfer of LYS to the escrow must occur before creating a vestinng entry
				await elysian.transfer(rewardEscrow.address, toWei(`6000`, "gwei"), {
					from: owner,
				});

				// Add a few vesting entries 
				const txn = await rewardEscrow.appendVestingEntry(account1, toWei('6000', "gwei"), {
					from: owner
				});
				//await fastForward(WEEK, web3);
				//await rewardEscrow.appendVestingEntry(account1, toWei('2000', "gwei"), { from: owner });
				//await fastForward(WEEK * 4, web3);
				//await rewardEscrow.appendVestingEntry(account1, toWei('3000', "gwei"), { from: owner });
				const vestedEvent = txn.logs.find(log => log.event === 'VestingEntryCreated');
				assert.equal(vestedEvent.args[0], account1);

				// Need to go into the future to vest
				await fastForward(YEAR * 2, web3);
			});

			it('should vest and transfer LYS from contract to the user', async () => {
				const txn = await rewardEscrow.vest({
					from: account1
				});

				// Check user has all their vested LYS
				assert.equal((fromWei(await elysian.balanceOf(account1), "gwei")).toString(), '42000');

				// Check rewardEscrow does not have any LYS except 2 gwei
				assert.equal((fromWei(await elysian.balanceOf(rewardEscrow.address), "gwei")).toString(), '2');

				// Vested(msg.sender, now, total);
				const vestedEvent = txn.logs.find(log => log.event === 'Vested');

				assert.equal(vestedEvent.args[0], account1);
			});

			it('should vest and emit a Vest event', async () => {
				const txn = await rewardEscrow.vest({
					from: account1
				});

				// Vested(msg.sender, now, total);
				const vestedEvent = txn.logs.find(log => log.event === 'Vested');

				assert.equal(vestedEvent.args[0], account1);

			});

			/*it('should vest and update totalEscrowedAccountBalance', async () => {
				// This account should have an escrowedAccountBalance
				let escrowedAccountBalance = await rewardEscrow.totalEscrowedAccountBalance(account1);
                assert.equal((fromWei(escrowedAccountBalance, "gwei")).toString(), '6000');

				// Vest
				await rewardEscrow.vest({ from: account1 });

				// This account should not have any amount escrowed
				escrowedAccountBalance = await rewardEscrow.totalEscrowedAccountBalance(account1);
                assert.equal((fromWei(escrowedAccountBalance, "gwei")).toString(), '0');
			});

			it('should vest and update totalVestedAccountBalance', async () => {
				// This account should have zero totalVestedAccountBalance
				let totalVestedAccountBalance = await rewardEscrow.totalVestedAccountBalance(account1);
                assert.equal((fromWei(totalVestedAccountBalance, "gwei")).toString(), '0');

				// Vest
				await rewardEscrow.vest({ from: account1 });

				// This account should have vested its whole amount
				totalVestedAccountBalance = await rewardEscrow.totalVestedAccountBalance(account1);
                assert.equal((fromWei(totalVestedAccountBalance, "gwei")).toString(), '6000');
			});

			it('should vest and update totalEscrowedBalance', async () => {
				await rewardEscrow.vest({ from: account1 });
				// There should be no Escrowed balance left in the contract
                assert.equal((fromWei(await rewardEscrow.totalEscrowedBalance(), "gwei")).toString(), '0');
			});*/
		});



	});
});