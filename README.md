# launch-contracts

This is the smart contract code for Elysian Finance launch phase. 


## Requirements
- Node v12 or higher
- Truffle 

## 1. Setup 

To setup and install dependencies please run:

```bash
# setup (install all dependencies)
npm install
```

## 2. Build
Will compile bytecode and ABIs for all .sol files found in node_modules and the contracts folder. It will output them in the build folder.

```bash
# build (compile all .sol sources)
node publish build 
```

## 3. Deploy
Will attempt to deploy (or reuse) all of the contracts listed in the given config.json input file, as well as perform initial connections between the contracts.

:warning: **This step requires the `build` step having been run to compile the sources into ABIs and bytecode.**

> Note: this action will update the deployment files for the associated network in "deployed/<network-name>". For example, [here's the "deployment.json" file for ganache](deployed/ganache/deployment.json).

```bash
# deploy (deploy compiled .sol sources)
npm run deploy-ganache
```

To deploy the code on multiple networks the truffle-config.js file needs to be adjusted, see instructions [here](https://trufflesuite.com/docs/truffle/reference/configuration#networks).

