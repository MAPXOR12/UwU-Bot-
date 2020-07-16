
module.exports = {
    name: 'open',
    aliases: [''],
    description: 'Opens a specified box.',
    long: 'Opens a specified box. You can also open boxes with the use command.',
    args: {"item": "Box to open.", "amount": "Amount to open."},
    examples: ["open item_box 10","open care package"],
    ignoreHelp: true,
    requiresAcc: true,
    requiresActive: true,
    guildModsOnly: false,
    
    async execute(app, message){
        const row = await app.player.getRow(message.author.id);
        let item = app.parse.items(message.args)[0];
        let amount = app.parse.numbers(message.args)[0] || 1;

        if(!item){
            return message.reply(`❌ You need to specify a box to open! \`${message.prefix}open <item>\`.`);
        }
        else if(['crate', 'military_crate', 'candy_pail', 'present', 'supply_drop'].includes(item)){
            const userItems = await app.itm.getItemObject(message.author.id);
            const itemCt = await app.itm.getItemCount(userItems, row);
            if(amount > 10) amount = 10;

            if(!await app.itm.hasItems(userItems, item, amount)){
                return message.reply(`❌ You don't have enough of that item! You have **${userItems[item] || 0}x** ${app.itemdata[item].icon}\`${item}\``);
            }

            // open box
            if(!await app.itm.hasSpace(itemCt)){
                return message.reply(`❌ **You don't have enough space in your inventory!** (You have **${itemCt.open}** open slots)\n\nYou can clear up space by selling some items.`);
            }

            await app.itm.removeItem(message.author.id, item, amount);

            let results = app.itm.openBox(item, amount, row.luck);
            let bestItem = results.items.sort(app.itm.sortItemsHighLow.bind(app));
            let openStr = '';

            await app.itm.addItem(message.author.id, results.itemAmounts);
            await app.player.addPoints(message.author.id, results.xp);
            
            if(amount === 1){
                console.log(bestItem[0]);

                openStr = 'You open the ' + app.itemdata[item].icon + '`' + item + '` and find... **' + app.common.getA(bestItem[0]) + ' ' + app.itemdata[bestItem[0]].icon + '`' + bestItem[0] + '` and `⭐ ' + results.xp + ' XP`!**';
            }
            else{
                openStr = 'You open **' + amount + 'x** ' + app.itemdata[item].icon + '`' + item + '`\'s and find:\n\n' + app.itm.getDisplay(results.itemAmounts).join('\n') + '\n\n...and `⭐ ' + results.xp + ' XP`!';
            }

            message.channel.createMessage('<@' + message.author.id + '>, ' + openStr);
        }
        else{
            return message.reply(`❌ That item cannot be opened.`);
        }
    },
}