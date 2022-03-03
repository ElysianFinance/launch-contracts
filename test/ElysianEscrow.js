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

const Elysian = artifacts.require('Elysian');
const ElysianEscrow = artifacts.require('ElysianEscrow');

const {
    yellow,
    gray
} = require('chalk');
const w3utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

contract('ElysianEscrow', async accounts => {
    const DAY = 86400;
    const WEEK = 604800;
    const YEAR = 31556926;

    const [owner, account1, account2] = accounts;
    let escrow, elysian;

    const getYearFromNow = async () => {
        const timestamp = await currentTime();
        console.log(`Year from now is ${timestamp + YEAR}`)
        return timestamp + YEAR;
    };

    const weeksFromNow = async weeks => {
        const timestamp = await currentTime();
        return timestamp + WEEK * weeks;
    };

    // Run once at beginning
    before(async () => {
        elysian = await Elysian.deployed();
        escrow = await ElysianEscrow.deployed();
    });


    describe(yellow('Constructor & Settings'), async () => {
        it('should set elysian on contructor', async () => {
            const elysianAddress = await escrow.elysian();
            //assert.equal(elysianAddress, elysian.address);
        });

        it('should set owner on contructor', async () => {
            const ownerAddress = await escrow.owner();
            assert.equal(ownerAddress, owner);
        });

        it('should allow owner to set elysian', async () => {
            await escrow.setElysian(ZERO_ADDRESS, {
                from: owner
            });
            const elysianAddress = await escrow.elysian();
            assert.equal(elysianAddress, ZERO_ADDRESS);
        });
    });

    describe(yellow('Only During Setup'), async () => {
        /*    it('should allow owner to purgeAccount', async () => {
                // Transfer of LYS to the escrow must occur before creating an entry
                await elysian.transfer(escrow.address, w3utils.toWei(`${1000}`, "gwei"), {
                    from: owner,
                });
                const yearFromNow = await getYearFromNow();
                await escrow.appendVestingEntry(account1, yearFromNow, w3utils.toWei(`${1000}`, "gwei"), {
                    from: owner,
                });

                assert.equal(1, await escrow.numVestingEntries(account1));
                const escrowedBalance = await escrow.totalVestedAccountBalance(account1);
                assert.equal((w3utils.fromWei(escrowedBalance, "gwei")).toString(), '1000');

                await escrow.purgeAccount(account1, {
                    from: owner
                });

                const totalVestedBalance = await escrow.totalVestedAccountBalance(account1);

                assert.equal(0, await escrow.numVestingEntries(account1));
                assert.equal((w3utils.fromWei(escrowedBalance, "gwei")).toString(), '1000');
                assert.bnEqual(toUnit('0'), w3utils.fromWei(totalVestedBalance, "gwei"));
            });

            it('should allow owner to call addVestingSchedule', async () => {
                // Transfer of LYS to the escrow must occur before creating an entry
                await elysian.transfer(escrow.address, w3utils.toWei(`${200}`, "gwei"), {
                    from: owner,
                });

                const times = [await weeksFromNow(1), await weeksFromNow(2)];
                const quantities = [toUnit('100'), toUnit('100')];
                await escrow.addVestingSchedule(account1, times, quantities, {
                    from: owner
                });

                assert.equal(2, await escrow.numVestingEntries(account1));
                const totalVestedAccountBalanace = await escrow.totalVestedAccountBalance(account1)
                assert.bnEqual(toUnit('200'), w3utils.fromWei(totalVestedAccountBalanace, "ether"));

                assert.isAtLeast(times[0], parseInt(await escrow.getVestingTime(account1, 0)));
                assert.isAtLeast(times[1], parseInt(await escrow.getVestingTime(account1, 1)));
            });
        });

        describe(yellow('Given there are no escrow entries'), async () => {
            it('then numVestingEntries should return 0', async () => {
                assert.equal(0, await escrow.numVestingEntries(account1));
            });
            it('then getNextVestingEntry should return 0', async () => {
                const nextVestingEntry = await escrow.getNextVestingEntry(account1);
                assert.equal(nextVestingEntry[0], 0);
                assert.equal(nextVestingEntry[1], 0);
            });
            it('then calling vest should do nothing and not fail', async () => {
                await escrow.vest({
                    from: account1
                });
                assert.bnEqual(toUnit('0'), await escrow.totalVestedAccountBalance(account1));
            });
        });

        describe(yellow('Functions'), async () => {
            describe('Vesting Schedule Writes', async () => {
                it('should not create a vesting entry with a zero amount', async () => {
                    // Transfer of LYS to the escrow must occur before creating an entry
                    await elysian.transfer(escrow.address, toUnit('1'), {
                        from: owner,
                    });

                    await assert.revert(
                        escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('0'), {
                            from: owner
                        })
                    );
                });

                it('should not create a vesting entry if there is not enough LYS in the contracts balance', async () => {
                    // Transfer of LYS to the escrow must occur before creating an entry
                    await elysian.transfer(escrow.address, toUnit('1'), {
                        from: owner,
                    });
                    await assert.revert(
                        escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('10'), {
                            from: owner
                        })
                    );
                });
            });

            describe(yellow('Vesting Schedule Reads'), async () => {
                beforeEach(async () => {
                    // Transfer of LYS to the escrow must occur before creating a vestinng entry
                    await elysian.transfer(escrow.address, toUnit('6000'), {
                        from: owner,
                    });

                    // Add a few vesting entries as the feepool address
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('1000'), {
                        from: owner,
                    });
                    await fastForward(WEEK);
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('2000'), {
                        from: owner,
                    });
                    await fastForward(WEEK);
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('3000'), {
                        from: owner,
                    });
                });

                it('should append a vesting entry and increase the contracts balance', async () => {
                    const balanceOfRewardEscrow = await elysian.balanceOf(escrow.address);
                    assert.bnEqual(balanceOfRewardEscrow, toUnit('6000'));
                });

                it('should get an accounts total Vested Account Balance', async () => {
                    const balanceOf = await escrow.balanceOf(account1);
                    assert.bnEqual(balanceOf, toUnit('6000'));
                });

                it('should get an accounts number of vesting entries', async () => {
                    const numVestingEntries = await escrow.numVestingEntries(account1);
                    assert.equal(numVestingEntries, 3);
                });

                it('should get an accounts vesting schedule entry by index', async () => {
                    let vestingScheduleEntry;
                    vestingScheduleEntry = await escrow.getVestingScheduleEntry(account1, 0);
                    assert.bnEqual(vestingScheduleEntry[1], toUnit('1000'));

                    vestingScheduleEntry = await escrow.getVestingScheduleEntry(account1, 1);
                    assert.bnEqual(vestingScheduleEntry[1], toUnit('2000'));

                    vestingScheduleEntry = await escrow.getVestingScheduleEntry(account1, 2);
                    assert.bnEqual(vestingScheduleEntry[1], toUnit('3000'));
                });

                it('should get an accounts vesting time for a vesting entry index', async () => {
                    const oneYearAhead = await getYearFromNow();
                    assert.isAtLeast(oneYearAhead, parseInt(await escrow.getVestingTime(account1, 0)));
                    assert.isAtLeast(oneYearAhead, parseInt(await escrow.getVestingTime(account1, 1)));
                    assert.isAtLeast(oneYearAhead, parseInt(await escrow.getVestingTime(account1, 2)));
                });

                it('should get an accounts vesting quantity for a vesting entry index', async () => {
                    assert.bnEqual(await escrow.getVestingQuantity(account1, 0), toUnit('1000'));
                    assert.bnEqual(await escrow.getVestingQuantity(account1, 1), toUnit('2000'));
                    assert.bnEqual(await escrow.getVestingQuantity(account1, 2), toUnit('3000'));
                });
            });

            describe(yellow('Partial Vesting'), async () => {
                beforeEach(async () => {
                    // Transfer of LYS to the escrow must occur before creating a vestinng entry
                    await elysian.transfer(escrow.address, toUnit('6000'), {
                        from: owner,
                    });

                    // Add a few vesting entries as the feepool address
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('1000'), {
                        from: owner,
                    });
                    await fastForward(WEEK);
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('2000'), {
                        from: owner,
                    });
                    await fastForward(WEEK);
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('3000'), {
                        from: owner,
                    });

                    // fastForward to vest only the first weeks entry
                    await fastForward(YEAR - WEEK * 2);

                    // Vest
                    await escrow.vest({
                        from: account1
                    });
                });

                it('should get an accounts next vesting entry index', async () => {
                    assert.bnEqual(await escrow.getNextVestingIndex(account1), 1);
                });

                it('should get an accounts next vesting entry', async () => {
                    const vestingScheduleEntry = await escrow.getNextVestingEntry(account1);
                    assert.bnEqual(vestingScheduleEntry[1], toUnit('2000'));
                });

                it('should get an accounts next vesting time', async () => {
                    const fiveDaysAhead = (await currentTime()) + DAY * 5;
                    assert.isAtLeast(parseInt(await escrow.getNextVestingTime(account1)), fiveDaysAhead);
                });

                it('should get an accounts next vesting quantity', async () => {
                    const nextVestingQuantity = await escrow.getNextVestingQuantity(account1);
                    assert.bnEqual(nextVestingQuantity, toUnit('2000'));
                });
            });

            describe(yellow('Vesting'), async () => {
                beforeEach(async () => {
                    // Transfer of LYS to the escrow must occur before creating a vestinng entry
                    await elysian.transfer(escrow.address, toUnit('6000'), {
                        from: owner,
                    });

                    // Add a few vesting entries as the feepool address
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('1000'), {
                        from: owner,
                    });
                    await fastForward(WEEK);
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('2000'), {
                        from: owner,
                    });
                    await fastForward(WEEK);
                    await escrow.appendVestingEntry(account1, await getYearFromNow(), toUnit('3000'), {
                        from: owner,
                    });

                    // Need to go into the future to vest
                    await fastForward(YEAR + WEEK * 3);
                });

                it('should vest and transfer snx from contract to the user', async () => {
                    await escrow.vest({
                        from: account1
                    });

                    // Check user has all their vested LYS
                    assert.bnEqual(await elysian.balanceOf(account1), toUnit('6000'));

                    // Check escrow does not have any LYS
                    assert.bnEqual(await elysian.balanceOf(escrow.address), toUnit('0'));
                });

                it('should vest and emit a Vest event', async () => {
                    const vestTransaction = await escrow.vest({
                        from: account1
                    });

                    // Vested(msg.sender, now, total);
                    const vestedEvent = vestTransaction.logs.find(log => log.event === 'Vested');
                    assert.eventEqual(vestedEvent, 'Vested', {
                        beneficiary: account1,
                        value: toUnit('6000'),
                    });
                });
            });
            */
        describe(yellow('Transfering'), async () => {
            it('should not allow transfer of elysian in escrow', async () => {
                // Ensure the transfer fails as all the elysian are in escrow
                await truffleAssert.reverts(
                    elysian.transfer(account2, w3utils.toWei('1000', "gwei"), {
                        from: account1,
                    })
                );
            });
        });
    });
});