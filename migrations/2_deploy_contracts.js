const {
    ethers,
    getDefaultProvider
} = require('ethers');

const {
    green,
    red,
    gray,
    yellow
} = require("chalk");

const fs = require('fs');

const { ensureNetwork, loadConnections, getPathToNetwork, constants } = require('../src/utils');

const AddressResolver           = artifacts.require("AddressResolver");
const WhiteList                 = artifacts.require("AddressResolver");
const Presale                   = artifacts.require("Presale");
const ReadProxyAddressResolver  = artifacts.require("ReadProxy");
const Elysian                   = artifacts.require("Elysian");
/*const Distributor               = artifacts.require("Distributor");
const ElysianStaking            = artifacts.require("ElysianStaking");

// =========== Tokens =========== //
const ElysianERC20              = artifacts.require("ElysianERC20");
const sElysianERC20             = artifacts.require("sElysianERC20");*/

const ExchangeRates               = artifacts.require("ExchangeRates");
//const MyTreasury                = artifacts.require("MyTreasury");
//const MyTreasuryState           = artifacts.require("MyTreasuryState");
//const TreasuryVault             = artifacts.require("TreasuryVault");

const PreSale                     = artifacts.require("Presale");
//const MyRebaser                 = artifacts.require("MyRebaser");
//const Rebaser                   = artifacts.require("MyRebaser");

//const Exchange                  = artifacts.require("Exchange");
//const ExchangeState             = artifacts.require("ExchangeState");

//const ElysianEscrow             = artifacts.require("ElysianEscrow");
//const RewardEscrow              = artifacts.require("RewardEscrow");
//const StakingWarmup             = artifacts.require("StakingWarmup");

const SystemStatus              = artifacts.require("SystemStatus");
const SystemSettings            = artifacts.require("SystemSettings");

//const Proxy                     = artifacts.require("Proxy");
const ProxyERC20                = artifacts.require("ProxyERC20Mintable");
//const ProxyElysian              = artifacts.require("Proxy");

const TokenStateElysian         = artifacts.require("TokenState");
const TokenState                = artifacts.require("TokenState");
const State                     = artifacts.require("State");
const FlexibleStorage           = artifacts.require("FlexibleStorage");

// ========== Libraries ===============//
const SafeDecimalMath           = artifacts.require("SafeDecimalMath");
const SafeMath                  = artifacts.require("SafeMath");


const needLinkingA = ["Math", "SystemSettings"];
const needLinkingB = [];

const needResolver = [
    "Elysian",
    "SystemSettings",
    "FlexibleStorage"
];

const needResolver_wl = [
    "Presale",
];

const needProxy = [
    "Elysian",
];

const needTokenState = [
    "Elysian",
];

const needState = [];

const toSkip = ["AddressResolver", "WhiteList"]

let contracts = [];
let deployedAddressResolver, whitelistAddressResolver;

let localPath = "/data/code/BSC/Elysian/C-elysian-scaffold";
let ancillaryDeployPath = `${localPath}/deployed/ganache/deployment.json`;

const saveBuild = (config, deployment, pathToDeployFile, pathToConfigFile) => {
    fs.writeFile(pathToConfigFile, JSON.stringify(config, null, "\t"), function (err) {
        if (err) {
            console.log(err);
        }
    });
    fs.writeFile(pathToDeployFile, JSON.stringify(deployment, null, "\t"), function (err) {
        if (err) {
            console.log(err);
        }
    });
}

async function doDeploy(deployer, network) {

    ensureNetwork(network);

    const pathToDeployFile      = getPathToNetwork({network, file: constants.DEPLOYMENT_FILENAME});
    const pathToConfigFile      = getPathToNetwork({network, file: constants.CONFIG_FILENAME});
    const pathToParametersFile  = getPathToNetwork({network, file: constants.DEPLOY_PARAMETERS_FILENAME});

    const config                = require(pathToConfigFile);
    const deployment            = require(ancillaryDeployPath);
    const deployParameters      = require(pathToParametersFile);

    console.log(yellow(`Starting deployment to network ${network}. Path ${pathToDeployFile}`));

	const { providerUrl, privateKey } = loadConnections({
		network,
	});

    const provider      = new ethers.providers.StaticJsonRpcProvider(providerUrl);
    const wallet        = new ethers.Wallet(privateKey, provider);
    const oracleAddress = wallet.address;

    //All contracts depend on AddressResolver, so it must be deployed separately
    if (config["AddressResolver"].deploy) {
        deployedAddressResolver = await deployer.deploy(
            AddressResolver,
            wallet.address
        );

        config["AddressResolver"].deploy = false;

        let contractObject = {
            "AddressResolver": {
                contract: "AddressResolver",
                address: deployedAddressResolver.address
            }
        }

        deployment.targets = {
            ...deployment.targets,
            ...contractObject
        };

    } else {
        deployedAddressResolver = {
            address: deployment.targets["AddressResolver"].address
        }
    }

    if (config["WhiteList"].deploy) {
        whitelistAddressResolver = await deployer.deploy(
            WhiteList,
            wallet.address
        );

        config["WhiteList"].deploy = false;

        let contractObject = {
            "WhiteList": {
                contract: "WhiteList",
                address: whitelistAddressResolver.address
            }
        }

        deployment.targets = {
            ...deployment.targets,
            ...contractObject
        };

    } else {
        whitelistAddressResolver = {
            address: deployment.targets["WhiteList"].address
        }
    }

    //============================= DEPLOY PROXIES  ==============================//
    const deployableContracts = Object.entries(config);
    let deployedProxies = [];
    let deployedTokenStates = [];
    let deployedStates = [];

    let runFirst = async () => {
        let proxies = deployableContracts
            .map(item => {
                return item[0].startsWith("Proxy") ? item : null
            })
            .filter(item => item != null);

        for (proxy of proxies) {
            console.log(`Deploying ${proxy[0]}`);

            let contractName = proxy[0];
            let flags = proxy[1];

            if (flags.deploy && !toSkip.includes(contractName)) {

                let Contract = await deployer.deploy(
                    ProxyERC20,
                    deployParameters.owner
                );

                let contractObject = {
                    contract: contractName,
                    address: Contract.address
                };

                contracts.push(contractObject);
                deployment.targets[contractName] = contractObject;
                config[contractName].deploy = false;
                deployedProxies.push(contractObject);
            }

        };

        //============================= DEPLOY TOKEN STATES  ==============================//

        let tokenStates = deployableContracts
            .map(item => {
                return item[0].startsWith("TokenState") ? item : null
            })
            .filter(item => item != null);

        for (tokenState of tokenStates) {
            console.log(`Deploying ${tokenState[0]}`);

            let contractName = tokenState[0];
            let flags = tokenState[1];

            if (flags.deploy && !toSkip.includes(contractName)) {

                let Contract = await deployer.deploy(
                    TokenState,
                    deployParameters.owner,
                    deployParameters.owner
                );

                let contractObject = {
                    contract: contractName,
                    address: Contract.address
                };

                contracts.push(contractObject);
                deployment.targets[contractName] = contractObject;
                config[contractName].deploy = false;
                deployedTokenStates.push(contractObject);
            }

        };

        //============================= DEPLOY STATES  ==============================//
        let states = deployableContracts
            .map(item => {
                return item[0].includes("State") && !item[0].includes("Token") ? item : null
            })
            .filter(item => item != null);

        console.log(`${green(`States contracts`)}`, states[0]);
        //console.log(states)


        for (state of states) {
            let contractName = state[0];
            let flags = state[1];

            if (flags.deploy && !toSkip.includes(contractName)) {

                let _pars = [deployParameters.owner, deployParameters.owner];
                console.log(`Contract name is ${yellow(contractName)}`);

                let Contract = await deployer.deploy(
                    artifacts.require(contractName),
                    ..._pars
                );

                let contractObject = {
                    contract: contractName,
                    address: Contract.address
                };

                //console.log(contractObject)
                contracts.push(contractObject);
                deployment.targets[contractName] = contractObject;
                config[contractName].deploy = false;
                //console.log(contractObject)
                deployedStates.push(contractObject);
            }

        };
    }


    //============================= DEPLOY REMAINING CONTRACTS  ==============================//

    const runLast = async () => {

        let otherContracts = deployableContracts.filter(item =>
            !item[0].startsWith("Proxy") &&
            !item[0].startsWith("TokenState") &&
            !(item[0].includes("State") && !item[0].includes("Token")));

        for (let i = 0; i < otherContracts.length; i++) {

            let contract = otherContracts[i];
            let contractName = contract[0];
            let flags = contract[1];

            if (flags.deploy && !toSkip.includes(contractName)) {

                let Contract = eval(contractName);

                if (needLinkingA.includes(contractName)) {
                    await deployer.link(SafeDecimalMath, Contract);
                }
                if (needLinkingB.includes(contractName)) {
                    await deployer.link(SafeMath, Contract);
                }

                let parameters = flags.pars;

                parameters = parameters.map((parameter) => {
                    if (parameter == "owner") {
                        return parameter = deployParameters.owner;
                    }
                    if (parameter == "oracle") {
                        return parameter = deployParameters.oracle;
                    }
                    return parameter;
                })

                if (needResolver.includes(contractName)) {
                    parameters = parameters.map((parameter) => {
                        if (parameter == "resolverNeeded") {
                            return parameter = deployedAddressResolver.address;
                        }
                        return parameter;
                    })
                }

                if (needResolver_wl.includes(contractName)) {
                    parameters = parameters.map((parameter) => {
                        if (parameter == "whitelistNeeded") {
                            return parameter = whitelistAddressResolver.address;
                        }
                        return parameter;
                    })
                }

                if (needProxy.includes(contractName)) {
                    console.log(`Got ${contractName}`)
                    parameters = parameters.map((parameter) => {
                        if (parameter == "needProxy") {
                            console.log(`Contract name is ${contractName}`, deployedProxies)
                            let contractObj = deployedProxies.find(item => item.contract.includes(contractName))
                            if (typeof contractObj !== "Object") {
                                contractObj = deployment.targets[`Proxy${contractName}`]
                            }
                            return parameter = contractObj.address;
                        }
                        return parameter;
                    })
                }

                if (needTokenState.includes(contractName)) {
                    parameters = parameters.map((parameter) => {
                        if (parameter == "needTokenState") {
                            let contractObj = deployedTokenStates.find(item => item.contract.includes(contractName))
                            if (typeof contractObj !== "Object") {
                                contractObj = deployment.targets[`TokenState${contractName}`]
                            }
                            return parameter = contractObj.address;
                        }
                        return parameter;
                    })
                }

                if (needState.includes(contractName)) {
                    console.log(`Contract name ${contractName} needs state`)
                    parameters = parameters.map((parameter) => {
                        if (parameter == "needState") {
                            let contractObj = deployedStates.find(item => item.contract.includes(contractName))
                            if (typeof contractObj !== "Object") {
                                contractObj = deployment.targets[`${contractName}State`]
                            }
                            return parameter = contractObj.address;
                        }
                        return parameter;
                    })
                }

                try {
                    console.log(`Deploying ${contractName} deploy: ${flags.deploy} parameters: ${parameters.length ? parameters: []}`);
                    console.log(...parameters);

                    let deployedContract = await deployer.deploy(
                        Contract, ...parameters
                    );

                    if (contractName == "AddressResolver") {
                        deployedAddressResolver = deployedContract.address;
                    }

                    if (contractName == "WhiteList") {
                        whitelistAddressResolver = whitelistAddressResolver.address;
                    }

                    let contractObject = {
                        contract: contractName,
                        address: deployedContract.address
                    };

                    contracts.push(contractObject);
                    deployment.targets[contractName] = contractObject;
                    config[contractName].deploy = false;

                    saveBuild(
                        config, 
                        deployment, 
                        pathToDeployFile, 
                        pathToConfigFile
                    );

                } catch (err) {
                    throw err;
                }

            }
        };
    }
    await runFirst();
    await runLast();
}

module.exports = (deployer, network) => {
    deployer.then(async () => {
        if ( network === 'tests' ) { 
            return;
        } 
        await doDeploy(deployer, network);

    });
};