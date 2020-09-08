
class Items {
    constructor(app){
        this.app = app;
    }

    /**
     * 
     * @param {*} id ID of user to add item to.
     * @param {*} item   Item to add, can be array ex.(["item_box|2","awp|1"])
     * @param {*} amount Amount of item to add, must be number.
     */
    async addItem(id, item, amount){
        if(Array.isArray(item)){
            if(item.length == 0){
                return;
            }
            for(var i = 0; i < item.length; i++){
                
                // store amounts in array as ["rock|5","ak47|2"] then use split("|")
                let itemToCheck = item[i].split("|");
                // Store id and item in array to bulk insert x times # of items.
                let insertValues = Array(parseInt(itemToCheck[1])).fill([id, itemToCheck[0]]); 

                await this.app.query(`INSERT INTO user_items (userId, item) VALUES ?`, [insertValues]);
            }
        }
        else{
            let insertValues = Array(parseInt(amount)).fill([id, item]);
            return await this.app.query(`INSERT INTO user_items (userId, item) VALUES ?`, [insertValues]);
        }
    }

    /**
     * 
     * @param {*} id ID of user to remove item from.
     * @param {*} item   Item to remove, can be an array ex.(["rock|2","item_box|3"])
     * @param {*} amount Amount of item to remove.
     */
    async removeItem(id, item, amount){
        if(Array.isArray(item)){
            if(item.length == 0){
                return;
            }
            for(var i=0; i < item.length; i++){

                //store amounts in array as ["rock|5","ak47|2"] then use split("|")
                let itemToCheck = item[i].split("|");

                await this.app.query(`DELETE FROM user_items WHERE userId = ${id} AND item = '${itemToCheck[0]}' LIMIT ${parseInt(itemToCheck[1])}`);
            }
        }
        else{
            return await this.app.query(`DELETE FROM user_items WHERE userId = ${id} AND item = '${item}' LIMIT ${parseInt(amount)}`);
        }
    }

    /**
     * 
     * @param {*} userItems User's item object.
     * @param {*} item   Item to check user has, can be an array ex.(["awp|1","glock|2"])
     * @param {*} amount Amount of item check for.
     */
    async hasItems(userItems, item, amount){
        if(Array.isArray(item)){
            if(item.length == 0){
                return true;
            }
            for (var i = 0; i < item.length; i++) {
                //do stuff for each item
                let itemToCheck = item[i].split("|");
                if(userItems[itemToCheck[0]] >= parseInt(itemToCheck[1])){
                    if(i == item.length - 1){
                        return true;
                    }
                }
                else{
                    return false;
                }
            }
        }
        else{
            if(userItems[item] >= parseInt(amount)){
                return true;
            }
            else{
                return false;
            }
        }
    }

    /**
     * 
     * @param {*} itemCt Object containing the user's item count.
     * @param {number} amount Amount of items to check if user has space for
     */
    async hasSpace(itemCt, amount = 0){
        console.log((itemCt.itemCt + parseInt(amount)) + " <= " + itemCt.maxCt);

        if((itemCt.itemCt + parseInt(amount)) <= itemCt.maxCt) return true;
        else return false;
    }

    async getItemCount(userItems, userRow, options = { cntBanners: false }){
        options.cntBanners = options.cntBanners == null ? false : options.cntBanners;

        let totalItemCt = 0;

        Object.keys(this.app.itemdata).forEach(key => {
            if(userItems[key] > 0){
                if(this.app.itemdata[key].isBanner && options.cntBanners){
                    totalItemCt += userItems[key];
                }
                else if(key !== 'token' && !this.app.itemdata[key].isBanner){
                    totalItemCt += userItems[key];
                }
            }
        });

        return {
            itemCt: totalItemCt,
            maxCt: (this.app.config.baseInvSlots + userRow.inv_slots),
            open: Math.max(0, (this.app.config.baseInvSlots + userRow.inv_slots) - totalItemCt),
            capacity: (totalItemCt + " / " + (this.app.config.baseInvSlots + userRow.inv_slots))
        }
    }

    /**
     * 
     * @param {*} id User to retrieve items for (in an object format).
     */
    async getItemObject(id){
        const itemRows = (await this.app.query(`SELECT item, COUNT(item) AS amount FROM user_items WHERE userId = "${id}" GROUP BY item`));
        var itemObj = {}
    
        for(var i = 0; i < itemRows.length; i++){
            if(this.app.itemdata[itemRows[i].item]) itemObj[itemRows[i].item] = itemRows[i].amount;
        }
    
        return itemObj;
    }

    /**
     * 
     * @param {*} items User's item object
     * @param {*} options
     * @returns {{onlyBanners:boolean,countBanners:boolean,countLimited:boolean}} Object with array for each item rarity, and value of all items in inventory
     */
    async getUserItems(items, options = { onlyBanners: false, countBanners: false, countLimited: true }){
        options.onlyBanners = options.onlyBanners == null ? false : options.onlyBanners;
        options.countBanners = options.countBanners == null ? false : options.countBanners;
        options.countLimited = options.countLimited == null ? true : options.countLimited;
        
        let ranged = [];
        let melee = [];
        let usables = [];
        let ammo = [];
        let materials = [];
        let storage = [];
        let banners = [];
        let invValue = 0;
        let itemCount = 0;

        let filteredItems = Object.keys(this.app.itemdata).filter(item => {
            if(options.onlyBanners){
                if(this.app.itemdata[item].isBanner) return true;
                else return false;
            }
            else if(options.countBanners && options.countLimited){
                return true;
            }
            else if(!options.countBanners && options.countLimited){
                if(!this.app.itemdata[item].isBanner) return true;
                else return false;
            }
            else if(options.countBanners && !options.countLimited){
                if(this.app.itemdata[item].isBanner && this.app.itemdata[item].rarity !== 'Limited') return true
                else if(!this.app.itemdata[item].isBanner && this.app.itemdata[item].rarity !== 'Limited') return true
                else return false;
            }
        });

        for(let key of filteredItems.sort(this.sortItemsHighLow.bind(this.app))){
            if(items[key] >= 1){
                let itemInfo = this.app.itemdata[key];
                let itemDisplay = itemInfo.icon + '`' + key + '`(' + items[key] + ')';

                switch(itemInfo.category){
                    case 'Ranged': ranged.push(itemDisplay); break;
                    case 'Melee': melee.push(itemDisplay); break;
                    case 'Item': usables.push(itemDisplay); break;
                    case 'Ammo': ammo.push(itemDisplay); break;
                    case 'Material': materials.push(itemDisplay); break;
                    case 'Storage': storage.push(itemDisplay); break;
                    case 'Banner': banners.push(itemDisplay);
                }
    
                invValue += itemInfo.sell * items[key];
                itemCount += items[key];
            }
        }

        return {
            ranged,
            melee,
            usables,
            ammo,
            materials,
            storage,
            banners,
            invValue: invValue,
            itemCount: itemCount
        }
    }

    /**
     * 
     * @param {*} id User to retrieve badges for (in an array format).
     */
    async getBadges(id){
        const badges = (await this.app.query(`SELECT badge FROM badges WHERE userId = "${id}"`));
        let badgeArr = [];

        for(let badge of badges){
            if(this.app.badgedata[badge.badge]) badgeArr.push(badge.badge);
        }

        return badgeArr;
    }

    /**
     * 
     * @param {*} userId ID of user to add badge to.
     * @param {*} badge Badge to add
     */
    async addBadge(userId, badge){
        return await this.app.query(`INSERT IGNORE INTO badges (userId, badge, earned) VALUES (${userId}, '${badge}', ${new Date().getTime()})`);
    }

    /**
     * 
     * @param {*} userId ID of user to remove badge from.
     * @param {*} badge Badge to remove
     */
    async removeBadge(userId, badge){
        await this.app.query(`UPDATE scores SET badge = 'none' WHERE userId = ${userId} AND badge = '${badge}'`);
        return await this.app.query(`DELETE FROM badges WHERE userId = ${userId} AND badge = '${badge}'`);
    }

    getTotalItmCountFromList(list){
        if(list.length == 0){
            return 0;
        }
        let totalItemCt = 0;
        for(var i=0; i < list.length; i++){
            //do stuff for each item
            //store amounts in array as ["rock|5","ak47|2"] then use split("|")
            let itemToCheck = list[i].split("|");
            totalItemCt += parseInt(itemToCheck[1]);
        }
        return totalItemCt;
    }

    openBox(type, amount = 1, luck){
        let itemsDisplay      = [];
        let finalItemsAmounts = [];
        let items             = [];
        let xpToAdd           = 0;
        let weightedArr       = this.generateWeightedArray(this.app.itemdata[type].rates, luck);
    
        for(let i = 0; i < amount; i++){
            let rand = this.pickRandomItem(type, weightedArr);
            let splitRand = rand.item.split('|');
    
            xpToAdd += rand.xp;
            finalItemsAmounts.push(rand.item);
            itemsDisplay.push((splitRand[1] > 1 ? splitRand[1] + "x " : '') + this.app.itemdata[splitRand[0]].icon + "`" + splitRand[0] + "`");
            items.push(splitRand[0]);
        }

        return {
            xp: xpToAdd,
            itemAmounts: finalItemsAmounts,
            display: itemsDisplay,
            items: items
        }
    }

    generateWeightedArray(rates, luck){
        let weightedArr = [];
        let luckMltplr = 0;
    
        Object.keys(rates).forEach(percentage => {
            if(parseFloat(percentage) <= 25){
                luckMltplr = luck/2;
            }
            else{
                luckMltplr = 0;
            }

            // Multiply the percentage by 2 for accuracy, 0.5 => 1, increase for better accuracy ie. 0.2 => 1 would require multiplier of 5
            for(let i = 0; i < (parseFloat(percentage) * 2) + luckMltplr; i++){
                weightedArr.push(percentage);
            }
        });
    
        return weightedArr;
    }

    pickRandomItem(type, weightedArray){
        let rand = weightedArray[Math.floor(Math.random() * weightedArray.length)];
        let rewards = this.app.itemdata[type].rates[rand].items;
    
        return {
            xp: this.app.itemdata[type].rates[rand].xp,
            item: rewards[Math.floor(Math.random() * rewards.length)]
        };
    }

    /**
     * Gets random items from a user, can also return multiple of the same item.
     * @param {*} userId User to get random items from
     * @param {*} amount Amount of items to get
     */
    async getRandomUserItems(userId, amount){
        const items = await this.getItemObject(userId);

        let randArr = [];
        
        for(let item in items){
            if(this.app.itemdata[item].canBeStolen){
                for(let i = 0; i < items[item]; i++){
                    randArr.push(item);
                }
            }
        }

        // no amount specified, get amount based on user item count.
        if(!amount && amount !== 0){
            if(randArr.length == 0){
                amount = 0;
            }
            else if(randArr.length <= 9){
                amount = 2;
            }
            else{
                amount = Math.floor(randArr.length / 4);
            }
        }

        randArr = randArr.sort(() => 0.5 - Math.random());
        
        let results = randArr.slice(0, amount);
        let amountResults = [];

        for(let i = 0; i < results.length; i++){
            let exists = amountResults.filter(item => item.split('|')[0] === results[i]);

            if(!exists.length){
                let sameItems = results.filter(item => item === results[i]);

                amountResults.push(results[i] + '|' + sameItems.length);
            }
        }

        return {
            items: results,
            display: this.getDisplay(amountResults.sort(this.sortItemsHighLow.bind(this.app))),
            amounts: amountResults
        }
    }

    sortItemsLowHigh(a, b){
        if(a.includes('|')){
            a = a.split('|')[0];
            b = b.split('|')[0];
        }

        let aitem = this.itemdata[a];
        let bitem = this.itemdata[b];

        if(bitem.tier > aitem.tier) return -1;

        else if(bitem.tier < aitem.tier) return 1;

        else if(b > a) return -1;
        
        else if(b < a) return 1;

        return 0;
    }

    sortItemsHighLow(a, b){
        if(a.includes('|')){
            a = a.split('|')[0];
            b = b.split('|')[0];
        }

        let aitem = this.itemdata[a];
        let bitem = this.itemdata[b];

        if(bitem.tier < aitem.tier) return -1;

        else if(bitem.tier > aitem.tier) return 1;

        else if(b > a) return -1;
        
        else if(b < a) return 1;
        
        return 0;
    }

    combineItems(itemList){
        let nameArr = [];
        let amountArr = [];
        let finalArr = [];
    
        for(let i = 0; i < itemList.length; i++){
            let item = itemList[i].split('|');
    
            let nameArrIndex = nameArr.indexOf(item[0]);
    
            if(nameArrIndex !== -1){
                amountArr[nameArrIndex] = parseInt(amountArr[nameArrIndex]) + parseInt(item[1]);
            }
            else{
                nameArr.push(item[0]);
                amountArr.push(item[1]);
            }
        }

        for(let i = 0; i < nameArr.length; i++){
            finalArr.push(nameArr[i] + '|' + amountArr[i]);
        }

        return finalArr;
    }

    getDisplay(itemList){
        let combined = this.combineItems(itemList);
        let finalArr = [];
    
        for(let i = 0; i < combined.length; i++){
            let itemAmnt = combined[i].split('|');
            
            finalArr.push('**' + itemAmnt[1] + 'x** ' + this.app.itemdata[itemAmnt[0]].icon + '`' + itemAmnt[0] + '`');
        }
    
        return finalArr;
    }
}

module.exports = Items;