require('dotenv').config(); 
const TronWeb = require('tronweb')
const abi = require('./abi.json');
const express = require('express');
const appKey = process.env.api_key;
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const MAIN_ADDRESS = process.env.main_address;
const RECEIVER_USDT_ADDRESS = process.env.receiver_address;
const MAIN_KEY = process.env.main_key;
const URL = "https://api.trongrid.io";
const app = express();


const tronWEB = new TronWeb({
    fullHost: URL,
    headers: { "TRON-PRO-API-KEY": appKey },
    privateKey: MAIN_KEY
});

const generateAddress = async () => {
    let account = await tronWEB.createAccount();
    return {
        'address': account['address']['base58'],
        'privateKey': account['privateKey']
    };
}
/*
*  Get address balance of USDT
*/
const get_USDT_balance = async (address) => {
    let contract = await tronWEB.contract(abi, USDT_CONTRACT);
    let result = await contract.balanceOf(address).call();
    return Number(result.toString()) / (1000_000);
}

const get_TRX_balance = async (address) => {
    return await tronWEB.trx.getBalance(address); 
}
/*
*  Send Tron token
*/
const sendTrx = async (toAddress, amount) => {
    let fromAddress = MAIN_ADDRESS;
    const tradeobj = await tronWEB.transactionBuilder.sendTrx(tronWEB.address.toHex(toAddress), amount * 1000_000, tronWEB.address.toHex(fromAddress));
    const signedtxn = await tronWEB.trx.sign(tradeobj, MAIN_KEY);
    const receipt = await tronWEB.trx.sendRawTransaction(signedtxn);
    return receipt;
}

const sendUSDT = async (fromAddress, pk, toAddress, amt) =>{
    const tronWeb = new TronWeb({
        fullHost: URL,
        headers: { "TRON-PRO-API-KEY": appKey },
        privateKey: pk
    });
    const functionSelector = 'transfer(address,uint256)';
    const parameter = [{type:'address', value:toAddress}, {type:'uint256', value: amt * 1000_000}]
    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
        USDT_CONTRACT, 
        functionSelector, 
        {}, 
        parameter,
        tronWeb.address.toHex(fromAddress)
    );
    const signedTx = await tronWeb.trx.sign(tx.transaction);
    const result = await tronWeb.trx.sendRawTransaction(signedTx);
    return result; 
}


const estimateFee = async (fromAddress, pk, toAddress, amt) =>{
    const tronWeb = new TronWeb({
        fullHost: URL,
        headers: { "TRON-PRO-API-KEY": appKey },
        privateKey: pk
    });
    const functionSelector = 'transfer(address,uint256)';
    const parameter = [{type:'address', value:toAddress}, {type:'uint256', value: amt * 1000_000}]
    const tx = await tronWeb.transactionBuilder
    .triggerConstantContract(
        USDT_CONTRACT, 
        functionSelector, 
        {}, 
        parameter,
        tronWeb.address.toHex(fromAddress)
    );
    let gas_cost_per_unit = 420; 
    return tx.energy_used * gas_cost_per_unit; 
}

app.get('/generate_address/', (req, res)=>{
    generateAddress().then(address=>{
        res.send(address);
    }).catch(error=>{}); 
});

app.get('/get_balance/:addr', (req, res)=>{
    let address = req.params.addr;
    get_USDT_balance(address).then(balance=>{
        res.send(  JSON.stringify({'bal': balance})  );
    }).catch(error=>{}); 
});

app.get('/get_fee/:addr/:pk/:amt', (req, res)=>{
    let fromAddress = req.params.addr;
    let pk = req.params.pk;
    let amt = req.params.amt; 
    get_TRX_balance(MAIN_ADDRESS).then(balance=>{
        estimateFee(fromAddress, pk, RECEIVER_USDT_ADDRESS, amt).then(fee=>{
            if(balance >= fee){
                sendTrx(fromAddress, fee/1000_000).then(result => {
                    res.send( JSON.stringify(result) );
                }).catch(error=>{ console.log(error) }); 
            }
        }).catch(error=>{ console.log(error)   }); 
    }).catch(error=>{  console.log(error) }); 
});

app.get('/move_to_main/:addr/:pk/:amt', (req, res)=>{
    let fromAddress = req.params.addr;
    let pk = req.params.pk;
    let amt = req.params.amt; 
    let toAddress = RECEIVER_USDT_ADDRESS; 
    sendUSDT(fromAddress, pk, toAddress, amt).then(result=>{
        res.send( JSON.stringify(result) );
    }).catch(error=>{
        console.log(error)
    }); 
});

let port = 5000;
app.listen(port, function(){
    console.log("listening on port "+port);
});