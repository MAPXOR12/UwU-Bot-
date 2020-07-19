
module.exports = {
    name: 'craftables',
    aliases: ['craftable'],
    description: 'Shows all items you can currently craft.',
    long: 'Shows all items you can currently craft using the items in your inventory.',
    args: {},
    examples: [],
    ignoreHelp: false,
    requiresAcc: true,
    requiresActive: false,
    guildModsOnly: false,
    
    async execute(app, message){
        const row = await app.player.getRow(message.author.id);
        const items = await app.itm.getItemObject(message.author.id);
        const craftableItems = Object.keys(app.itemdata).filter(item => app.itemdata[item].craftedWith !== "" && app.itemdata[item].craftedWith.level <= row.level);
        let craftables = [];

        for(let i = 0; i < craftableItems.length; i++){
            if(canCraft(craftableItems[i])){
                craftables.push(craftableItems[i] + '|' + maxCraft(craftableItems[i]));
            }
        }

        function canCraft(item){
            let data = app.itemdata[item];

            for(let i = 0; i < data.craftedWith.materials.length; i++){
                let matName = data.craftedWith.materials[i].split('|')[0];
                let matAmnt = data.craftedWith.materials[i].split('|')[1];

                if(items[matName] === undefined || items[matName] < matAmnt) return false;
            }

            return true;
        }

        function maxCraft(item){
            let data = app.itemdata[item];
            let max = [];

            for(let i = 0; i < data.craftedWith.materials.length; i++){
                let matName = data.craftedWith.materials[i].split('|')[0];
                let matAmnt = data.craftedWith.materials[i].split('|')[1];

                max.push(Math.floor(items[matName] / matAmnt));
            }

            return max.sort((a, b) => a - b)[0];
        }

        craftables.sort(app.itm.sortItemsHighLow.bind(app));

        for(let i = 0; i < craftables.length; i++){
            let itemAmount = craftables[i].split('|');
            craftables[i] = itemAmount[1] + 'x ' + app.itemdata[itemAmount[0]].icon + '`' + itemAmount[0] + '`';
        }

        const craftableEmb = new app.Embed()
        .setTitle('Craftables')
        .setDescription('**Items you are a high enough level to craft:**\n\n' + (craftableItems.map(item => app.itemdata[item].icon + '`' + item + 
        '` (Level ' + app.itemdata[item].craftedWith.level + '+)').join('\n') || 'Nothing, you should level up more!') + '\n\n' + 
        '**These are the items you can craft right now:**\n\n' + (craftables.length ? craftables.join('\n') : 'You don\'t have the materials to craft anything right now!'))
        .setColor(13451564)

        message.channel.createMessage(craftableEmb);
    },
}