const {
    ethers,
    getDefaultProvider
} = require('ethers');

const fs = require('fs-extra');
const path = require('path');
//const hash = require('object-hash');

const w3utils = require('web3-utils')
const {gray, red, yellow} = require('chalk');
const { NonceManager } = require("@ethersproject/experimental");
const frontendConfigFullPath = "/data/code/BSC/Elysian/frontend/src/config.json";
const ancillaryContracts = require("/data/code/BSC/Elysian/C-pLYS/deployment.json");

const whitelist = require("../src/whitelist")
const frontendConfig = require(frontendConfigFullPath);

const { ensureNetwork, loadConnections, getPathToNetwork, toBytes32, constants } = require('../src/utils');

const _saveBuild = (config, network) => {

    const dirName = `${__dirname}`.replace("/migrations", "");

    //Patch front-end 
    fs.writeFileSync(
        frontendConfigFullPath, 
        JSON.stringify(config, null, "\t"), 
        function(err) {
            if (err) {
                console.log(err);
            } 
        }
    );

    const filesToSave = [
        "Elysian", 
        "Presale",
        "ProxyERC20"
    ].map(file => `${file}.json`);

    filesToSave.forEach(file => {
        fs.copyFile(
            `${dirName}/build/contracts/${file}`, 
            `/data/code/BSC/Elysian/Frontend/src/abis/${file}`, (err) => {
            if (err) throw err;
        });
    });
    
    fs.copy(
        `${dirName}/build/contracts`, 
        `/data/code/BSC/Elysian/Frontend/src/deployed/${network}/build/contracts`, 
        function (err) {
            if (err) throw err;
        }
    );
    
    fs.copy(
        `${dirName}/deployed/${network}/deployment.json`, 
        `/data/code/BSC/Elysian/Frontend/src/deployed/${network}/deployment.json`, 
        function (err) {
            if (err) throw err;
        }
    );
 
    fs.copy(
        `${dirName}/build/contracts`, 
        `${dirName}/deployed/${network}/build/contracts`,
        function (err) {
            if (err) throw err;
        }
    );
}

const run = async(network, accounts) => {
    ensureNetwork(network);

    const pathToDeployFile      = getPathToNetwork({network, file: constants.DEPLOYMENT_FILENAME});
    const pathToConfigFile      = getPathToNetwork({network, file: constants.CONFIG_FILENAME});
    const pathToParametersFile  = getPathToNetwork({network, file: constants.DEPLOY_PARAMETERS_FILENAME});

    const config            = require(pathToConfigFile);
    const deployment        = require(pathToDeployFile);
    const deployParameters  = require(pathToParametersFile);

	const { providerUrl, privateKey } = loadConnections({
		network,
	});

    const provider      = new ethers.providers.StaticJsonRpcProvider(providerUrl);
    const wallet        = new ethers.Wallet(privateKey, provider);
    const managedSigner = new NonceManager(wallet);

 
    // Overriding parameters; any of these are optional and get passed
    // as an additional parameter after all function parameters.
    const overrideOptions = (sendValue = false, value = 0) => {
        return {
            gasLimit: 6000000,
            gasPrice:5000000000, 
            from: wallet.address,
            value: sendValue ? w3utils.toWei(`${value}`) : 0
        };
    };

    const AddressResolver           = artifacts.require("AddressResolver");
    const WhiteList                 = artifacts.require("AddressResolver");
    const ReadProxyAddressResolver  = artifacts.require("ReadProxy");
    const Elysian                   = artifacts.require("Elysian");
    const SafeDecimalMath           = artifacts.require("SafeDecimalMath");
    const SystemStatus              = artifacts.require("SystemStatus");
    const SystemSettings            = artifacts.require("SystemSettings");
    const Proxy                     = artifacts.require("Proxy");
    const ProxyElysian              = artifacts.require("ProxyERC20");
    const TokenState                = artifacts.require("TokenState");
    const TokenStateElysian         = TokenState

    const IReadProxyAddressResolver = require('../build/contracts/ReadProxy.json');

    const ReadProxyAddressResolverAddress = deployment.targets["ReadProxyAddressResolver"].address; 
    const AddressResolverAddress          = deployment.targets["AddressResolver"].address;
    const WhitelistAddress                = deployment.targets["WhiteList"].address;

    const ElysianAddress                  = deployment.targets["Elysian"].address;

    const _ReadProxyAddressResolver  = await ReadProxyAddressResolver.at(ReadProxyAddressResolverAddress);
    const _AddressResolver           = await AddressResolver.at(AddressResolverAddress);
    const _Whitelist                 = await WhiteList.at(WhitelistAddress);
    const _Elysian                   = await Elysian.at(ElysianAddress);

    let tx, txObj;

    //Configure system
    options = overrideOptions();
    console.log(yellow(`Configuring system ... `))

    let associatedContract = await _ReadProxyAddressResolver.target();

    if (associatedContract != deployment.targets["AddressResolver"].address) {
        tx = await _ReadProxyAddressResolver.setTarget(
            deployment.targets["AddressResolver"].address, 
            options
        );
        console.log(tx);


    } else {
        console.log(gray(`Action not needed`))
    }

 	// -------------------------
	// Address Resolver imports
	// -------------------------
	const expectedAddressesInResolver = [
        //System contracts
		{ name: 'Elysian',              address: deployment.targets["Elysian"].address },
        { name: 'FlexibleStorage',      address: deployment.targets["FlexibleStorage"].address },
        { name: 'ElysianVault',         address: ancillaryContracts.networks["ganache"].Vault },
	];
    // ancillaryContracts.networks["ganache"].Vault
	// Count how many addresses are not yet in the resolver
	const addressesNotInResolver = (
		await Promise.all(
			expectedAddressesInResolver.map(async ({ name, address }) => {
				const foundAddress =  await _AddressResolver.getAddress(toBytes32(name));
                console.log(foundAddress)
				return { name, address, found: address === foundAddress }; // return name if not found
			})
		)
	).filter(entry => !entry.found);  
            
    console.log(addressesNotInResolver)

    if (addressesNotInResolver.length > 0) {

        console.log(
            gray(
                `Detected ${addressesNotInResolver.length} / ${expectedAddressesInResolver.length} missing or incorrect in the AddressResolver.\n\t` +
                    addressesNotInResolver.map(({ name, address }) => `${name} ${address}`).join('\n\t') +
                    `\nAdding all addresses in one transaction.`
            )
        );

        let tx = await _AddressResolver.importAddresses(
            addressesNotInResolver.map(({ name }) => toBytes32(name)),
            addressesNotInResolver.map(({ address }) => address),            
        )
        console.log(tx)
    }

    //WhiteList configuration
    const expectedAddressesInWhitelist = whitelist.map(({name, address}) => {
        if (name == "DAI") {
            let _name = toBytes32(name);
            return {
                name:_name,
                address
            }
        } else if (name == "ExchangeRates") {
            let _name = toBytes32(name);
            return {
                name:_name,
                address
            }
        } else if (name == "ETH") {
            let _name = toBytes32(name);
            return {
                name:_name,
                address
            }
        } 
        return {
            name: address,
            address: address
        }
    })

    console.log(expectedAddressesInWhitelist)
	// Count how many addresses are not yet in the whitelist
	const addressesNotInWhitelist = (
		await Promise.all(
			expectedAddressesInWhitelist.map(async ({ name, address }) => {
				const foundAddress =  await _Whitelist.getAddress(name);
                console.log(foundAddress)
				return { name, address, found: address === foundAddress }; // return name if not found
			})
		)
	).filter(entry => !entry.found);  
            
    console.log(addressesNotInWhitelist)

    if (addressesNotInWhitelist.length > 0) {

        console.log(
            gray(
                `Detected ${addressesNotInWhitelist.length} / ${expectedAddressesInWhitelist.length} missing or incorrect in the AddressResolver.\n\t` +
                    addressesNotInWhitelist.map(({ name, address }) => `${name} ${address}`).join('\n\t') +
                    `\nAdding all addresses in one transaction.`
            )
        );

        let tx = await _Whitelist.importAddresses(
            addressesNotInWhitelist.map(({ name }) => name),
            addressesNotInWhitelist.map(({ address }) => address),            
        )
        console.log(tx)
    }


    const rebuildCache = [
        "Elysian", 
        "ExchangeRates", 
        "MyTreasury",
    ];
    const chunk = [];

    const deployableContracts =  Object.keys(deployment.targets);

    let proxies = deployableContracts
        .map(item => {
            return item.startsWith("Proxy") ? item : null
        })
        .filter(item => item != null);

    //console.log(proxies)

    let excludedContracts = [                                                           
        'sElysianERC20',     
        'MyTreasury',                                                                             
        'Rebaser',                                                                                
        'ElysianEscrow',                                                                         
        'RewardEscrow',                                                                           
        'ElysianStaking',                                                                         
        'ExchangeState',                                                                          
        'Exchange',                                                                               
        'Distributor',                                                                            
        'StakingWarmup',                                                                          
        'MyTreasuryState',                                                                        
        'TreasuryVault'                                                                 
    ]

    
    let otherContracts = deployableContracts.filter(item => !item.startsWith("Proxy") && !item.startsWith("TokenState") && !excludedContracts.includes(item)) ;

    // Now for all targets that have a setResolver, we need to ensure the resolver is set
    otherContracts = otherContracts.filter(key => !key.includes('WhiteList'));
    console.log(otherContracts);
    
    otherContracts
    .forEach(async (key) => {
        if (rebuildCache.includes(key)) {
            chunk.push(deployment.targets[key].address)
        }
        key == "ReadProxyAddressResolver" ? (key = "ReadProxy", _key = "ReadProxyAddressResolver") : _key = key
        let ContractInterface = artifacts.require(`${key}`); 

        try {
            let Contract = await ContractInterface.at(deployment.targets[_key].address);

            if ( typeof Contract.setResolver === "function") {
                console.log(Contract.setResolver)
            }            
        } catch (error) {
            console.log(`${key} is not a contract`)
            console.log(error)
        }
    })

    //console.log(chunk)
    //tx = await _AddressResolver.rebuildCaches(chunk)
    //console.log(tx)

    let contracts = {
        "LYS": deployment.targets["Elysian"].address,
    }
    const _deployment = { targets: {}}

    Object.entries(contracts).forEach((key)=> {
        _deployment.targets[key[0]] = key[1]
    })

    console.log(_deployment)
    //_saveBuild(_deployment)

    let _TokenStateElysian = artifacts.require("TokenState") ;
    _TokenStateElysian = await _TokenStateElysian.at(deployment.targets["TokenStateElysian"].address);
 
    tx = await _TokenStateElysian.setAssociatedContract(deployment.targets["Elysian"].address);
    console.log(tx);

    let _ProxyElysian =  artifacts.require("ProxyERC20") ;
    _ProxyElysian = await _ProxyElysian.at(deployment.targets["ProxyElysian"].address);
    
    tx = await _ProxyElysian.setTarget(deployment.targets["Elysian"].address);
    console.log(tx);
    
    tx = await _Elysian.setProxy(deployment.targets["ProxyElysian"].address);
    console.log(tx);

    frontendConfig.networks["ganache"].contractAddresses["Elysian"] = deployment.targets["Elysian"].address

    frontendConfig.networks["ganache"].knownTokens = frontendConfig.networks["ganache"].knownTokens.map(token => {
        if (token.symbol == "LYS" ) {
            token.contractAddress = deployment.targets["Elysian"].address
        }
        return token
    });

    _saveBuild(frontendConfig, network);

    let mint = false;
    if (mint) {
        tx = await _Elysian.mint(w3utils.toWei(`${300000}`, "gwei"), accounts[0], false);
        console.log(tx);    
    }

    //tx = await _Elysian.transfer(accounts[1], w3utils.toWei(`${10}`, "gwei"));
    //console.log(tx)
    //console.log(accounts)

    console.log(`Balance of account ${accounts[0]} is ${w3utils.fromWei(await _Elysian.balanceOf(accounts[0]))} LYS `);
    console.log(`Balance of account ${accounts[1]} is ${w3utils.fromWei(await _Elysian.balanceOf(accounts[1]))} LYS `);

    const totalSupply =  await _Elysian.totalSupply();

    console.log(`Elysian (LYS) total supply is ${w3utils.fromWei(totalSupply, "gwei")}`);

}



module.exports = (deployer, network, accounts) => {
    deployer.then(async () => {
        if ( network === 'tests' ) { 
            return
        } 
        await run(network, accounts);
    });
};