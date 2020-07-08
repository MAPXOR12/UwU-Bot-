const { RARITIES } = require('../../../resources/constants');

module.exports = {
    name: 'vault',
    aliases: ['inv', 'v'],
    description: 'Show the items in a clans vault.',
    long: 'Shows all items in a clans vault.',
    args: {"clan/user": "Clan or user to search, will default to your own clan if none specified."},
    examples: ["clan vault Mod Squad"],
    requiresClan: false,
    requiresActive: false,
    minimumRank: 0,
    
    async execute(app, message, args){
        const scoreRow = await app.player.getRow(message.author.id);
        const mentionedUser = app.parse.members(message, args)[0];

        if(!args.length && scoreRow.clanId == 0){
            return message.reply('You are not a member of any clan! You can look up other clans by searching their name.');
        }
        else if(!args.length){
            message.channel.createMessage(await getVaultInfo(app, scoreRow.clanId));
        }
        else if(mentionedUser !== undefined){
            const mentionedScoreRow = await app.player.getRow(mentionedUser.id);
            if(!mentionedScoreRow){
                return message.reply(`❌ The person you're trying to search doesn't have an account!`);
            }
            else if(mentionedScoreRow.clanId == 0){
                return message.reply('❌ That user is not in a clan.');
            }
            else{
                message.channel.createMessage(await getVaultInfo(app, mentionedScoreRow.clanId));
            }
        }
        else{
            let clanName = args.join(" ");
            const clanRow = await app.clans.searchClanRow(clanName);

            if(!clanRow){
                return message.reply('I could not find a clan with that name! Maybe you misspelled it?');
            }
            
            message.channel.createMessage(await getVaultInfo(app, clanRow.clanId));
        }
    },
}

async function getVaultInfo(app, clanId){
    const clanRow = await app.clans.getRow(clanId);
    const clanItems = await app.itm.getUserItems(await app.itm.getItemObject(clanId));

    let ultraItemList    = clanItems.ultra;
    let legendItemList   = clanItems.legendary;
    let epicItemList     = clanItems.epic;
    let rareItemList     = clanItems.rare;
    let uncommonItemList = clanItems.uncommon;
    let commonItemList   = clanItems.common;
    let limitedItemList  = clanItems.limited;

    const embedInfo = new app.Embed()
    .setColor(13215302)
    .setAuthor(clanRow.name, 'https://cdn.discordapp.com/attachments/497302646521069570/695319745003520110/clan-icon-zoomed-out.png')
    .setTitle('Vault')
    
    if(clanRow.iconURL){
        embedInfo.setThumbnail(clanRow.iconURL)
    }

    if(ultraItemList != ""){
        embedInfo.addField(RARITIES['ultra'].name, ultraItemList.join('\n'), true);
    }
    
    if(legendItemList != ""){
        embedInfo.addField(RARITIES['legendary'].name, legendItemList.join('\n'), true);
    }
    
    if(epicItemList != ""){
        embedInfo.addField(RARITIES['epic'].name, epicItemList.join('\n'), true);
    }
    
    if(rareItemList != ""){
        embedInfo.addField(RARITIES['rare'].name, rareItemList.join('\n'), true);
    }
    
    if(uncommonItemList != ""){
        embedInfo.addField(RARITIES['uncommon'].name, uncommonItemList.join('\n'), true);
    }
    
    if(commonItemList != ""){
        embedInfo.addField(RARITIES['common'].name, commonItemList.join('\n'), true);
    }
    
    if(limitedItemList != ""){
        embedInfo.addField(RARITIES['limited'].name, limitedItemList.join('\n'), true);
    }
    
    if(ultraItemList == "" && legendItemList == "" && epicItemList == "" && rareItemList == "" && uncommonItemList == "" && commonItemList == ""&& limitedItemList == ""){
        embedInfo.addField('The vault is empty!', "\u200b");
    }

    embedInfo.addField("\u200b", `Power (slots) used: ${clanItems.itemCount} | Vault value: ${app.common.formatNumber(clanItems.invValue)}`)

    return embedInfo;
}