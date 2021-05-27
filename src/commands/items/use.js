const RANDOM_SELECTION_MINIMUM = 8 // # of active players required for an attack menu to show when using random

exports.command = {
	name: 'use',
	aliases: ['attack', 'heal'],
	description: 'Use items on yourself or use weapons to attack others!',
	long: 'Use an item on yourself or attack another user with a weapon. If you\'re opening a box, you can specify an amount to open.',
	args: { 'item': 'Item to use.', '@user': 'User to attack item with.' },
	examples: ['use assault rifle @blobfysh', 'use medkit', 'use rock random', 'use crate 4'],
	permissions: ['sendMessages', 'embedLinks', 'externalEmojis'],
	ignoreHelp: false,
	requiresAcc: true,
	requiresActive: true,
	guildModsOnly: false,

	async execute (app, message, { args, prefix, guildInfo, serverSideGuildId }) {
		const row = await app.player.getRow(message.author.id, serverSideGuildId)
		const item = app.parse.items(args)[0]
		const itemInfo = app.itemdata[item]
		const member = app.parse.members(message, args)[0]
		let amount = app.parse.numbers(args)[0] || 1

		if (!item) {
			return message.reply(`❌ You need to specify an item to use! \`${prefix}use <item>\`. For more information and examples, type \`${prefix}help use\`.`)
		}
		else if (['Ranged', 'Melee'].includes(itemInfo.category)) {
			// used weapon
			let userItems = await app.itm.getItemObject(message.author.id, serverSideGuildId)
			const attackCD = await app.cd.getCD(message.author.id, 'attack', { serverSideGuildId })
			const damageMin = itemInfo.minDmg
			const damageMax = itemInfo.maxDmg
			let weaponBreaks = itemInfo.breaksOnUse
			let ammoUsed
			let ammoDamage = 0
			let bleedDamage = 0
			let burnDamage = 0

			if (!app.itm.hasItems(userItems, item, 1)) {
				return message.reply(`❌ You don't have a ${itemInfo.icon}\`${item}\`.`)
			}
			else if (attackCD) {
				return message.reply(`❌ You need to wait \`${attackCD}\` before attacking again.`)
			}

			// check for ammo and add ammo damage
			if (itemInfo.category === 'Ranged' && itemInfo.ammo !== '') {
				const possibleAmmo = itemInfo.ammo.sort(app.itm.sortItemsHighLow.bind(app))
				const availableAmmo = []

				for (const ammo of possibleAmmo) {
					if (app.itm.hasItems(userItems, ammo, 1)) {
						availableAmmo.push(ammo)
					}
				}

				if (!availableAmmo.length) {
					return message.reply(`❌ You don't have any ammo for that weapon! The ${itemInfo.icon}\`${item}\` uses ${possibleAmmo.map(itm => `${app.itemdata[itm].icon}\`${itm}\``).join(', ')} as ammunition.`)
				}
				else if (availableAmmo.length > 1) {
					await message.reply(`You have multiple ammo types for that weapon! Which ammo do you want to use?\n\n${availableAmmo.map(ammo => `${app.itemdata[ammo].icon}\`${ammo}\``).join(', ')}`)

					const result = await app.msgCollector.awaitMessages(message.author.id, message.channel.id, m => m.author.id === message.author.id)

					if (result === 'time') {
						return message.reply('❌ You ran out of time to choose your ammo.')
					}

					const ammoChoice = app.parse.items(result[0].content.split(/ +/))[0]

					if (!ammoChoice) {
						return result[0].reply('❌ That isn\'t a valid ammo choice!')
					}
					else if (!availableAmmo.includes(ammoChoice)) {
						return result[0].reply(`❌ ${app.itemdata[ammoChoice].icon}\`${ammoChoice}\` isn't a valid ammo choice!`)
					}

					userItems = await app.itm.getItemObject(message.author.id, serverSideGuildId)

					if (!app.itm.hasItems(userItems, ammoChoice, 1)) {
						return message.reply(`❌ You have **0x** ${app.itemdata[ammoChoice].icon}\`${ammoChoice}\`.`)
					}
					else if (!app.itm.hasItems(userItems, item, 1)) {
						return message.reply(`❌ You don't have a ${itemInfo.icon}\`${item}\`.`)
					}

					ammoUsed = ammoChoice
				}
				else {
					ammoUsed = availableAmmo[0]
				}

				ammoDamage = app.itemdata[ammoUsed].damage
				bleedDamage = app.itemdata[ammoUsed].bleed > 0 ? app.itemdata[ammoUsed].bleed : 0
				burnDamage = app.itemdata[ammoUsed].burn > 0 ? app.itemdata[ammoUsed].burn : 0
			}

			// regardless if the attack was random or not, this function is used to attack players
			const attackUser = async (victim, victimRow, victimItems) => {
				const passiveShieldCD = await app.cd.getCD(message.author.id, 'passive_shield', { serverSideGuildId })
				const victimArmor = await app.player.getArmor(victim.id, serverSideGuildId)
				const victimLuck = victimRow.luck >= 10 ? 10 : victimRow.luck
				const totalDamage = Math.floor(((Math.floor(Math.random() * (damageMax - damageMin + 1)) + damageMin) + ammoDamage) * row.scaledDamage)
				let finalDamage = totalDamage

				// player attacked, remove passive shield
				if (passiveShieldCD) await app.cd.clearCD(message.author.id, 'passive_shield', serverSideGuildId)

				// Check if victim has armor and if the ammo penetrates armor
				if (victimArmor && (!ammoUsed || !app.itemdata[ammoUsed].penetratesArmor)) {
					finalDamage -= Math.floor(totalDamage * app.itemdata[victimArmor].shieldInfo.protection)
				}

				if (Math.floor(Math.random() * 100) + 1 <= victimLuck) {
					// victim dodged attack
					if (weaponBreaks) {
						return message.channel.createMessage(`🍀 <@${victim.id}> EVADED **${message.member.nick || message.member.username}**'s attack! How lucky!\n\n${app.icons.minus}**${message.member.nick || message.member.username}**'s ${itemInfo.icon}\`${item}\` broke.`)
					}

					return message.channel.createMessage(`🍀 <@${victim.id}> EVADED **${message.member.nick || message.member.username}**'s attack! How lucky!`)
				}
				else if (victimRow.health - finalDamage <= 0) {
					// player was killed
					const randomItems = await app.itm.getRandomUserItems(victimItems)
					const xpGained = randomItems.items.length * 50
					const moneyStolen = Math.floor(victimRow.money * 0.75)

					// passive shield, protects same player from being attacked for 24 hours
					await app.cd.setCD(victim.id, 'passive_shield', app.config.cooldowns.daily * 1000, { serverSideGuildId })

					await app.itm.removeItem(victim.id, randomItems.amounts, null, serverSideGuildId)
					await app.itm.addItem(message.author.id, randomItems.amounts, null, serverSideGuildId)
					await app.player.removeMoney(victim.id, moneyStolen, serverSideGuildId)
					await app.player.addMoney(message.author.id, moneyStolen, serverSideGuildId)

					// 50 xp for each item stolen
					await app.player.addPoints(message.author.id, xpGained, serverSideGuildId)

					if (serverSideGuildId) {
						await app.query(`UPDATE server_scores SET kills = kills + 1 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`) // add 1 to kills
						await app.query(`UPDATE server_scores SET deaths = deaths + 1, health = 100, bleed = 0, burn = 0 WHERE userId = ${victim.id} AND guildId = ${serverSideGuildId}`)
					}
					else {
						await app.query(`UPDATE scores SET kills = kills + 1 WHERE userId = ${message.author.id}`) // add 1 to kills
						await app.query(`UPDATE scores SET deaths = deaths + 1, health = 100, bleed = 0, burn = 0 WHERE userId = ${victim.id}`)
					}

					// add badges
					if (row.kills + 1 >= 20) {
						await app.itm.addBadge(message.author.id, 'specialist', serverSideGuildId)
					}
					if (row.kills + 1 >= 100) {
						await app.itm.addBadge(message.author.id, 'executioner', serverSideGuildId)
					}
					if (victim.id === '168958344361541633') {
						await app.itm.addBadge(message.author.id, 'dev_slayer', serverSideGuildId)
					}

					// send notifications
					if (victimRow.notify2) notifyDeathVictim(app, message, victim, item, finalDamage, randomItems.items.length !== 0 ? randomItems.display : ['You had nothing they could steal!'])

					// log to kill feed
					if (guildInfo.killChan !== undefined && guildInfo.killChan !== 0 && guildInfo.killChan !== '') {
						const killEmbed = new app.Embed()
							.setDescription(`<@${message.author.id}> 🗡 <@${victim.id}> 💀`)
							.addField('Weapon Used', `${itemInfo.icon}\`${item}\` - **${finalDamage} damage**`)
							.addField('Items Stolen', randomItems.items.length !== 0 ? randomItems.display.join('\n') : 'Nothing', true)
							.addField('Balance Stolen', app.common.formatNumber(moneyStolen), true)
							.setColor(16734296)
							.setTimestamp()

						try {
							await app.bot.createMessage(guildInfo.killChan, killEmbed)
						}
						catch (err) {
							// no killfeed channel found
						}
					}

					logKill(app, message.channel.guild.id, message.member, victim, item, ammoUsed, finalDamage, moneyStolen, randomItems)

					// deactivate victim if they had nothing to loot
					if (randomItems.items.length === 0 && moneyStolen <= 1000) {
						await app.player.deactivate(victim.id, message.channel.guild.id)

						if (Object.keys(app.config.activeRoleGuilds).includes(message.channel.guild.id)) {
							try {
								await victim.removeRole(app.config.activeRoleGuilds[message.channel.guild.id].activeRoleID)
							}
							catch (err) {
								console.warn('Failed to add active role.')
							}
						}
					}

					const killedReward = new app.Embed()
						.setTitle('Loot Received')
						.setColor(7274496)
						.addField('Balance Stolen', app.common.formatNumber(moneyStolen))
						.addField(`Items (${randomItems.items.length})`, randomItems.items.length !== 0 ? randomItems.display.join('\n') : 'They had no items to steal!')
						.setFooter(`⭐ ${xpGained} XP earned!`)

					await message.channel.createMessage({
						content: await generateAttackString(app, message, victim, victimRow, finalDamage, item, ammoUsed, weaponBreaks, true, victimArmor, totalDamage),
						embed: killedReward.embed
					})
				}
				else {
					// normal attack
					await app.player.subHealth(victim.id, finalDamage, serverSideGuildId)

					if (ammoUsed === '40mm_smoke_grenade') {
						await app.cd.setCD(victim.id, 'blinded', 7200 * 1000, { serverSideGuildId })

						await message.channel.createMessage(generateAttackString(app, message, victim, victimRow, finalDamage, item, ammoUsed, weaponBreaks, false, victimArmor, totalDamage))
					}
					else {
						await message.channel.createMessage(generateAttackString(app, message, victim, victimRow, finalDamage, item, ammoUsed, weaponBreaks, false, victimArmor, totalDamage))
					}

					if (bleedDamage > 0 && serverSideGuildId) {
						await app.query(`UPDATE server_scores SET bleed = bleed + ${bleedDamage} WHERE userId = ${victim.id} AND guildId = ${serverSideGuildId}`)
					}
					else if (bleedDamage > 0) {
						await app.query(`UPDATE scores SET bleed = bleed + ${bleedDamage} WHERE userId = ${victim.id}`)
					}

					if (burnDamage > 0 && serverSideGuildId) {
						await app.query(`UPDATE server_scores SET burn = burn + ${burnDamage} WHERE userId = ${victim.id} AND guildId = ${serverSideGuildId}`)
					}
					else if (burnDamage > 0) {
						await app.query(`UPDATE scores SET burn = burn + ${burnDamage} WHERE userId = ${victim.id}`)
					}

					if (victimRow.notify2) notifyAttackVictim(app, message, victim, item, finalDamage, victimRow)
				}
			}

			const attackMonster = async monsterRow => {
				const monster = app.mobdata[monsterRow.monster]
				const passiveShieldCD = await app.cd.getCD(message.author.id, 'passive_shield', { serverSideGuildId })
				const armor = await app.player.getArmor(message.author.id, serverSideGuildId)

				// adjust damage based on ammo used
				if (!monster.canBleed && ammoUsed && app.itemdata[ammoUsed].bleed > 0) {
					bleedDamage = 0
				}
				if (!monster.canBurn && ammoUsed && app.itemdata[ammoUsed].burn > 0) {
					burnDamage = 0
				}
				if (monster.title === 'Bradley' && ammoUsed && ammoUsed === 'hv_rocket') {
					// multiply hv_rocket damage by 3 when used against bradley
					ammoDamage *= 3
				}

				const totalDamage = Math.floor(((Math.floor(Math.random() * (damageMax - damageMin + 1)) + damageMin) + ammoDamage) * row.scaledDamage)

				// player attacked, remove passive shield
				if (passiveShieldCD) await app.cd.clearCD(message.author.id, 'passive_shield', serverSideGuildId)

				// track damage for kill rewards
				await app.monsters.playerDealtDamage(message.author.id, message.channel.id, totalDamage)

				if (monsterRow.health - totalDamage <= 0) {
					await app.cd.clearCD(message.channel.id, 'mob')
					await app.cd.clearCD(message.channel.id, 'mobHalf')

					const rewardsEmbed = await app.monsters.disperseRewards(message.channel.id, monster, monsterRow.money, serverSideGuildId)
					await app.monsters.onFinished(message.channel.id, false)

					if (serverSideGuildId) {
						await app.query(`UPDATE server_scores SET kills = kills + 1 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`) // add 1 to kills
					}
					else {
						await app.query(`UPDATE scores SET kills = kills + 1 WHERE userId = ${message.author.id}`) // add 1 to kills
					}

					if (row.kills + 1 >= 20) {
						await app.itm.addBadge(message.author.id, 'specialist', serverSideGuildId)
					}
					if (row.kills + 1 >= 100) {
						await app.itm.addBadge(message.author.id, 'executioner', serverSideGuildId)
					}

					message.channel.createMessage({
						content: generateAttackMobString(app, message, monsterRow, totalDamage, item, ammoUsed, weaponBreaks, true),
						embed: rewardsEmbed.embed
					})
				}
				else {
					await app.monsters.subHealth(message.channel.id, totalDamage)

					if (bleedDamage > 0) {
						await app.monsters.addBleed(message.channel.id, bleedDamage)
					}
					if (burnDamage > 0) {
						await app.monsters.addBurn(message.channel.id, burnDamage)
					}

					message.channel.createMessage({
						content: generateAttackMobString(app, message, monsterRow, totalDamage, item, ammoUsed, weaponBreaks, false),
						embed: (await app.monsters.genMobEmbed(message.channel.id, monster, monsterRow.health - totalDamage, monsterRow.money)).embed
					})

					// mob attacks player
					const baseDmg = Math.floor(Math.random() * (monster.maxDamage - monster.minDamage + 1)) + monster.minDamage
					let mobDmg = baseDmg

					if (armor) {
						mobDmg -= Math.floor(baseDmg * app.itemdata[armor].shieldInfo.protection)
					}

					if (row.health - mobDmg <= 0) {
						// player was killed
						const randomItems = await app.itm.getRandomUserItems(userItems)
						const moneyStolen = Math.floor(row.money * 0.75)

						// passive shield, protects same player from being attacked for 24 hours
						await app.cd.setCD(message.author.id, 'passive_shield', app.config.cooldowns.daily * 1000, { serverSideGuildId })

						await app.itm.removeItem(message.author.id, randomItems.amounts, null, serverSideGuildId)
						await app.player.removeMoney(message.author.id, moneyStolen, serverSideGuildId)

						if (serverSideGuildId) {
							await app.query(`UPDATE server_scores SET deaths = deaths + 1, health = 100, bleed = 0, burn = 0 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`)
						}
						else {
							await app.query(`UPDATE scores SET deaths = deaths + 1, health = 100, bleed = 0, burn = 0 WHERE userId = ${message.author.id}`)
						}

						// send notifications
						if (guildInfo.killChan !== undefined && guildInfo.killChan !== 0 && guildInfo.killChan !== '') {
							const killEmbed = new app.Embed()
								.setDescription(`${monster.title} 🗡 <@${message.author.id}> 💀`)
								.addField('Weapon Used', `${app.itemdata[monster.weapon].icon}\`${monster.weapon}\` - **${mobDmg} damage**`)
								.addField('Items Stolen', randomItems.items.length !== 0 ? randomItems.display.join('\n') : 'Nothing', true)
								.addField('Balance Stolen', app.common.formatNumber(moneyStolen), true)
								.setColor(16734296)
								.setTimestamp()

							try {
								await app.bot.createMessage(guildInfo.killChan, killEmbed)
							}
							catch (err) {
								// no killfeed channel found
							}
						}

						logKill(app, message.channel.guild.id, { username: monster.title, discriminator: '0000', id: monsterRow.monster }, message.author, monster.weapon.name, monster.ammo, mobDmg, moneyStolen, randomItems, 0)

						const killedReward = new app.Embed()
							.setTitle('Loot Lost')
							.setColor(7274496)
							.addField('Balance', app.common.formatNumber(moneyStolen))
							.addField(`Items (${randomItems.items.length})`, randomItems.items.length !== 0 ? randomItems.display.join('\n') : `${monster.mentioned.charAt(0).toUpperCase() + monster.mentioned.slice(1)} did not find anything on you!`)

						message.channel.createMessage({
							content: generateMobAttack(app, message, monsterRow, row, mobDmg, monster.weapon, monster.ammo, true, armor, baseDmg),
							embed: killedReward.embed
						})
					}
					else {
						await app.player.subHealth(message.author.id, mobDmg, serverSideGuildId)
						message.channel.createMessage(generateMobAttack(app, message, monsterRow, row, mobDmg, monster.weapon, monster.ammo, false, armor, baseDmg))
					}
				}
			}

			// used to remove the attackers weapon/ammo before an attack
			const removeWeapon = async () => {
				if (await app.cd.getCD(message.author.id, 'attack', { serverSideGuildId })) {
					return message.reply('❌ You need to wait before attacking again.')
				}
				else if (ammoUsed) {
					await app.itm.removeItem(message.author.id, ammoUsed, 1, serverSideGuildId)
				}

				// weapon removed, add cooldown
				await app.cd.setCD(message.author.id, 'attack', itemInfo.cooldown.seconds * 1000, { serverSideGuildId })

				// check if ranged weapon breaks
				if (itemInfo.category === 'Ranged' && ammoUsed && Math.random() <= parseFloat(itemInfo.chanceToBreak)) {
					weaponBreaks = true
					await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)
					await app.itm.addItem(message.author.id, itemInfo.recyclesTo.materials, null, serverSideGuildId)

					const brokeEmbed = new app.Embed()
						.setTitle(`💥 Unfortunately, your ${itemInfo.icon}\`${item}\` broke from your last attack!`)
						.setDescription(`After rummaging through the pieces you were able to find:\n${app.itm.getDisplay(itemInfo.recyclesTo.materials.sort(app.itm.sortItemsHighLow.bind(app))).join('\n')}`)
						.setColor(14831897)

					try {
						const dm = await message.author.getDMChannel()
						await dm.createMessage(brokeEmbed)
					}
					catch (err) {
						// dm's disabled
					}
				}
				// item breaks if its melee
				else if (weaponBreaks) {
					await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)
				}
			}

			// check if attacking monster
			if (args.map(arg => arg.toLowerCase()).some(arg => ['@spawn', 'spawn', '@enemy', 'enemy', '@bounty', 'bounty'].includes(arg)) || Object.keys(app.mobdata).some(monster => args.map(arg => arg.toLowerCase()).join(' ').includes(app.mobdata[monster].title.toLowerCase()))) {
				const monsterRow = await app.mysql.select('spawns', 'channelId', message.channel.id)

				if (!monsterRow) {
					return message.reply(`❌ There are no enemies in this channel! You can check when one will spawn with \`${prefix}enemy\``)
				}
				else if (itemInfo.category === 'Melee' && app.mobdata[monsterRow.monster].title === 'Patrol Helicopter') {
					return message.reply('❌ The Patrol Helicopter is immune to melee weapons!')
				}

				await removeWeapon()
				await attackMonster(monsterRow)
			}
			else if (guildInfo.randomOnly === 1 && member) {
				return message.reply(`❌ This server allows only random attacks, specifying a target will not work. You can use the item without a mention to attack a random player: \`${prefix}use <item>\``)
			}
			else if (guildInfo.randomOnly === 1 || ['rand', 'random'].some(str => args.map(arg => arg.toLowerCase()).includes(str))) {
				// attack is random, find a random active player

				const activeUsers = await app.query(`SELECT * FROM userguilds WHERE guildId ="${message.channel.guild.id}" ORDER BY LOWER(userId)`)
				const availableTargets = []
				const membersInfo = []

				for (const user of activeUsers) {
					if (user.userId === message.author.id) {
						// don't add self to list of random targets
						continue
					}
					else if (await app.cd.getCD(user.userId, 'passive_shield', { serverSideGuildId })) {
						// user has passive shield
						continue
					}
					else if (ammoUsed === '40mm_smoke_grenade' && await app.cd.getCD(user.userId, 'blinded', { serverSideGuildId })) {
						// user already blinded
						continue
					}

					const randUserRow = await app.player.getRow(user.userId, serverSideGuildId)

					if (row.clanId !== 0 && randUserRow.clanId === row.clanId) {
						// users are in same clan
						continue
					}

					// pushing the row with the id so I don't have to fetch the row again to retrieve the users badge during random selection
					availableTargets.push({ row: randUserRow, id: user.userId })
				}

				const shuffled = app.common.shuffleArr(availableTargets)
				const rand = shuffled.slice(0, 3) // Pick 3 random id's

				for (const randUser of rand) {
					const randomMember = await app.common.fetchMember(message.channel.guild, randUser.id)
					const memberItems = await app.itm.getItemObject(randUser.id, serverSideGuildId)

					if (randomMember) {
						membersInfo.push({ member: randomMember, row: randUser.row, items: memberItems })
					}
				}

				if (membersInfo[0] === undefined) {
					return message.reply('❌ There aren\'t any players you can attack in this server!')
				}
				else if (activeUsers.length < RANDOM_SELECTION_MINIMUM || membersInfo.length < 3) {
					await removeWeapon()
					await attackUser(membersInfo[0].member, membersInfo[0].row, membersInfo[0].items)
				}
				else {
					// random target selection

					// have to remove weapon and ammo before choosing target to prevent inventory changes during selection
					await removeWeapon()

					// show selection menu
					const target = await pickTarget(app, message, membersInfo)

					if (!target) {
						return message.channel.createMessage('❌ There was an error trying to find someone to attack! Please try again or report this in the support server.')
					}

					// refetching row and items because time has passed since target was chosen
					await attackUser(target.member, await app.player.getRow(target.member.id, serverSideGuildId), await app.itm.getItemObject(target.member.id, serverSideGuildId))
				}
			}
			else if (!member) {
				return message.reply('❌ You need to mention someone to attack.')
			}
			else {
				// verify chosen target can be attacked

				const victimRow = await app.player.getRow(member.id, serverSideGuildId)
				const victimPassiveShield = await app.cd.getCD(member.id, 'passive_shield', { serverSideGuildId })
				const victimBlindedCD = await app.cd.getCD(member.id, 'blinded', { serverSideGuildId })

				if (member.id === app.bot.user.id) {
					return message.channel.createMessage('ow...')
				}
				else if (member.id === message.author.id) {
					return message.reply('❌ You can\'t attack yourself!')
				}
				else if (!victimRow) {
					return message.reply('❌ The person you\'re trying to attack doesn\'t have an account!')
				}
				else if (row.clanId !== 0 && victimRow.clanId === row.clanId) {
					return message.reply('❌ You can\'t attack members of your own clan!')
				}
				else if (!await app.player.isActive(member.id, message.channel.guild.id)) {
					return message.reply(`❌ **${member.nick || member.username}** has not activated their account in this server!`)
				}
				else if (victimPassiveShield) {
					return message.reply(`🛡 **${member.nick || member.username}** was killed recently and has a **passive shield**!\nThey are untargetable for \`${victimPassiveShield}\`.`)
				}
				else if (ammoUsed === '40mm_smoke_grenade' && victimBlindedCD) {
					return message.reply(`❌ **${member.nick || member.username}** is already blinded by a ${app.itemdata['40mm_smoke_grenade'].icon}\`40mm_smoke_grenade\`!`)
				}

				await removeWeapon()
				await attackUser(member, victimRow, await app.itm.getItemObject(member.id, serverSideGuildId))
			}
		}
		else if (member) {
			// tried to use non-weapon on someone
			return message.reply('❌ That item cannot be used to attack another player.')
		}
		else if (itemInfo.category === 'Item') {
			let userItems = await app.itm.getItemObject(message.author.id, serverSideGuildId)
			const itemCt = await app.itm.getItemCount(userItems, row)
			if (amount > 10) amount = 10

			if (!userItems[item]) {
				return message.reply(`❌ You don't have a ${app.itemdata[item].icon}\`${item}\`!`)
			}
			else if (item !== 'c4' && userItems[item] < amount) {
				return message.reply(`❌ You don't have enough of that item! You have **${userItems[item] || 0}x** ${app.itemdata[item].icon}\`${item}\`.`)
			}

			if (['crate', 'military_crate', 'candy_pail', 'small_present', 'medium_present', 'large_present', 'supply_drop', 'elite_crate', 'small_loot_bag', 'medium_loot_bag', 'large_loot_bag', 'egg_basket'].includes(item)) {
				// open box
				if (!await app.itm.hasSpace(itemCt)) {
					return message.reply(`❌ **You don't have enough space in your inventory!** (You have **${itemCt.open}** open slots)\n\nYou can clear up space by selling some items.`)
				}

				await app.itm.removeItem(message.author.id, item, amount, serverSideGuildId)

				const results = app.itm.openBox(item, amount, row.luck)
				const bestItem = results.items.sort(app.itm.sortItemsHighLow.bind(app))

				let openStr = ''

				await app.itm.addItem(message.author.id, results.itemAmounts, null, serverSideGuildId)
				await app.player.addPoints(message.author.id, results.xp, serverSideGuildId)

				if (amount === 1) {
					console.log(bestItem[0])

					openStr = `You open the ${app.itemdata[item].icon}\`${item}\` and find... **1x ${app.itemdata[bestItem[0]].icon}\`${bestItem[0]}\` and \`⭐ ${results.xp} XP\`!**`
				}
				else {
					openStr = `You open **${amount}x** ${app.itemdata[item].icon}\`${item}\`'s and find:\n\n${app.itm.getDisplay(results.itemAmounts).join('\n')}\n\n...and \`⭐ ${results.xp} XP\`!`
				}

				message.channel.createMessage(`<@${message.author.id}>, ${openStr}`)
			}
			else if (item === 'supply_signal') {
				await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)

				message.reply('📻 Requesting immediate airdrop...').then(msg => {
					setTimeout(() => {
						message.channel.createMessage('**📻 Airdrop arriving in `10 seconds`!**')
					}, 3000)
					setTimeout(() => {
						message.channel.createMessage('**📻 `5`...**')
					}, 8000)
					setTimeout(() => {
						message.channel.createMessage('**📻 `4`...**')
					}, 9000)
					setTimeout(() => {
						message.channel.createMessage('**📻 `3`...**')
					}, 10000)
					setTimeout(() => {
						app.eventHandler.events.get('airdrop').execute(app, message, { prefix, serverSideGuildId })
					}, 13000)
				})
			}
			else if (itemInfo.isShield) {
				const armorCD = await app.cd.getCD(message.author.id, 'shield', { serverSideGuildId })
				const armor = await app.player.getArmor(message.author.id, serverSideGuildId)

				if (armorCD) {
					return message.reply(`Your ${armor ? `${app.itemdata[armor].icon}\`${armor}\`` : 'current armor'} is still active for \`${armorCD}\`!`)
				}

				await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)
				await app.cd.setCD(message.author.id, 'shield', itemInfo.shieldInfo.seconds * 1000, { armor: item, serverSideGuildId })

				message.reply(`You put on the ${itemInfo.icon}\`${item}\`. You now take **${Math.floor(itemInfo.shieldInfo.protection * 100)}%** less damage from attacks for \`${app.cd.convertTime(itemInfo.shieldInfo.seconds * 1000)}\``)
			}
			else if (itemInfo.isHeal) {
				const healCD = await app.cd.getCD(message.author.id, 'heal', { serverSideGuildId })

				if (healCD) {
					return message.reply(`You need to wait \`${healCD}\` before healing again.`)
				}

				const minHeal = itemInfo.healMin
				const maxHeal = itemInfo.healMax
				const itemBleedHeal = itemInfo.healsBleed

				const randHeal = Math.floor(Math.random() * (maxHeal - minHeal + 1)) + minHeal
				const userMaxHeal = Math.min(row.maxHealth - row.health, randHeal)
				const healBleed = itemBleedHeal && row.bleed > 0

				if (userMaxHeal === 0 && !healBleed) {
					return message.reply('❌ You are already at max health!')
				}

				await app.cd.setCD(message.author.id, 'heal', itemInfo.cooldown.seconds * 1000, { serverSideGuildId })
				await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)

				if (healBleed) {
					const bleedingVal = row.bleed - itemBleedHeal <= 0 ? 0 : row.bleed - itemBleedHeal

					if (serverSideGuildId) {
						await app.query(`UPDATE server_scores SET health = health + ${userMaxHeal}, bleed = ${bleedingVal} WHERE userId = '${message.author.id}' AND guildId = ${serverSideGuildId}`)
					}
					else {
						await app.query(`UPDATE scores SET health = health + ${userMaxHeal}, bleed = ${bleedingVal} WHERE userId = '${message.author.id}'`)
					}

					message.reply(`You have healed for **${userMaxHeal}** health! You now have ${app.player.getHealthIcon(row.health + userMaxHeal, row.maxHealth)} ${row.health + userMaxHeal} / ${row.maxHealth} HP. Bleeding reduced from 🩸**${row.bleed}** to 🩸**${bleedingVal}**.`)
				}
				else {
					await app.player.addHealth(message.author.id, userMaxHeal, serverSideGuildId)
					message.reply(`You have healed for **${userMaxHeal}** health! You now have ${app.player.getHealthIcon(row.health + userMaxHeal, row.maxHealth)} ${row.health + userMaxHeal} / ${row.maxHealth} HP.`)
				}
			}
			else if (itemInfo.givesMoneyOnUse) {
				const minAmt = itemInfo.itemMin
				const maxAmt = itemInfo.itemMax

				const randAmt = Math.floor((Math.random() * (maxAmt - minAmt + 1)) + minAmt)

				await app.player.addMoney(message.author.id, randAmt, serverSideGuildId)
				await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)
				message.reply(`You open the ${itemInfo.icon}\`${item}\` and find... **${app.common.formatNumber(randAmt)}**`)
			}
			else if (item === 'reroll_scroll') {
				await app.itm.removeItem(message.author.id, item, 1, serverSideGuildId)

				if (serverSideGuildId) {
					await app.query(`UPDATE server_scores SET maxHealth = 100 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`)
					await app.query(`UPDATE server_scores SET luck = 0 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`)
					await app.query(`UPDATE server_scores SET scaledDamage = 1.00 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`)
					await app.query(`UPDATE server_scores SET used_stats = 0 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`)
					if (row.health > 100) {
						await app.query(`UPDATE server_scores SET health = 100 WHERE userId = ${message.author.id} AND guildId = ${serverSideGuildId}`)
					}
				}
				else {
					await app.query(`UPDATE scores SET maxHealth = 100 WHERE userId = ${message.author.id}`)
					await app.query(`UPDATE scores SET luck = 0 WHERE userId = ${message.author.id}`)
					await app.query(`UPDATE scores SET scaledDamage = 1.00 WHERE userId = ${message.author.id}`)
					await app.query(`UPDATE scores SET used_stats = 0 WHERE userId = ${message.author.id}`)
					if (row.health > 100) {
						await app.query(`UPDATE scores SET health = 100 WHERE userId = ${message.author.id}`)
					}
				}

				message.reply(`You read the ${app.itemdata.reroll_scroll.icon}\`reroll_scroll\` and feel a sense of renewal. Your skills have been reset.`)
			}
			else if (['c4'].includes(item)) {
				if (serverSideGuildId) {
					return message.reply('❌ You cannot use explosives with server-side economy mode enabled.')
				}

				await message.reply(`What clan do you want to use ${app.itemdata[item].icon}\`${item}\` on?\n\nType the name of the clan:`)

				const result = await app.msgCollector.awaitMessages(message.author.id, message.channel.id, m => m.author.id === message.author.id)

				if (result === 'time') {
					return message.reply('You ran out of time to specify a clan.')
				}

				const clanName = result[0].content.split(/ +/)
				userItems = await app.itm.getItemObject(message.author.id, serverSideGuildId)

				if (!userItems[item]) {
					return message.reply(`❌ You don't have a ${app.itemdata[item].icon}\`${item}\`!`)
				}

				const clanRow = await app.clans.searchClanRow(clanName.join(' '))

				if (!clanRow) {
					return result[0].reply('I could not find a clan with that name! Maybe you misspelled it?')
				}
				else if (row.clanId === clanRow.clanId) {
					return result[0].reply('❌ You cannot use explosives on your own clan.')
				}
				else if (clanRow.health <= 0) {
					return result[0].reply(`❌ That clan can already be raided! Raid them with \`${prefix}clan raid ${clanRow.name}\``)
				}

				await app.itm.removeItem(message.author.id, item, 1)
				await app.query('UPDATE clans SET health = health - ? WHERE clanId = ?', [app.itemdata[item].explosiveDamage, clanRow.clanId])

				await app.clans.addLog(clanRow.clanId, `${`${message.author.username}#${message.author.discriminator}`} used explosives on the clan! (${item})`)

				const msgEmbed = new app.Embed()
					.setAuthor(message.member.nick || message.member.username, message.author.avatarURL)
					.setDescription(`💥 ***BOOM***\n\nThe health of \`${clanRow.name}\` drops from ${app.icons.health.full} **${clanRow.health}** to ${app.icons.health.full} **${clanRow.health - app.itemdata[item].explosiveDamage}**.`)
					.setColor(16734296)

				message.channel.createMessage(msgEmbed)
			}
		}
		else {
			return message.reply(`❌ That item cannot be used on yourself or other players. \`${prefix}use <item> <@user>\``)
		}
	}
}

function logKill (app, guildID, killer, victim, item, ammo, damage, moneyStolen, itemsLost) {
	const embed = new app.Embed()
		.setTitle('Kill Log')
		.setColor(2713128)
		.setDescription(`**Weapon**: \`${item}\` - **${damage} damage**\n**Ammo**: ${ammo ? `\`${ammo}\`` : 'Not required'}`)
		.addField('Killer', `${killer.username}#${killer.discriminator} ID: \`\`\`\n${killer.id}\`\`\``)
		.addField('Victim', `${victim.username}#${victim.discriminator} ID: \`\`\`\n${victim.id}\`\`\``)
		.addField('Items Stolen', itemsLost.items.length !== 0 ? itemsLost.display.join('\n') : 'Nothing', true)
		.addField('Balance Stolen', app.common.formatNumber(moneyStolen), true)
		.setTimestamp()
		.setFooter(`Guild ID: ${guildID}`)

	app.messager.messageLogs(embed)
}

function generateAttackString (app, message, victim, victimRow, damage, itemUsed, ammoUsed, itemBroke, killed, armor, baseDamage) {
	let finalStr = app.itemdata[itemUsed].phrase.replace('{attacker}', `<@${message.author.id}>`)
		.replace('{victim}', `<@${victim.id}>`)
		.replace('{weaponIcon}', app.itemdata[itemUsed].icon)
		.replace('{weapon}', itemUsed)
		.replace('{ammoIcon}', ammoUsed ? app.itemdata[ammoUsed].icon : '')
		.replace('{ammo}', ammoUsed)
		.replace('{damage}', baseDamage)

	if (armor && (!ammoUsed || !app.itemdata[ammoUsed].penetratesArmor)) {
		finalStr += `\n**${victim.nick || victim.username}**'s ${app.itemdata[armor].icon}\`${armor}\` absorbed **${baseDamage - damage}** (${Math.floor(app.itemdata[armor].shieldInfo.protection * 100)}%) damage, lowering the total damage dealt to **${damage}**!`
	}

	if (killed) {
		finalStr += `\n${app.icons.death_skull} **${victim.nick || victim.username} DIED!**`
	}
	else if (Math.random() <= 0.5) { finalStr += `\n**${victim.nick || victim.username}** is spared with ${app.player.getHealthIcon(victimRow.health - damage, victimRow.maxHealth)} **${victimRow.health - damage}** health.` }
	else { finalStr += `\n**${victim.nick || victim.username}** is left with ${app.player.getHealthIcon(victimRow.health - damage, victimRow.maxHealth)} **${victimRow.health - damage}** health.` }

	if (!killed && ammoUsed === '40mm_smoke_grenade') {
		finalStr += `\n**${victim.nick || victim.username}** is blinded by the smoke and cannot use any commands for **2** hours!`
	}

	if (!killed && ammoUsed && app.itemdata[ammoUsed].bleed > 0) {
		finalStr += `\n**${victim.nick || victim.username}** is 🩸 bleeding for **${app.itemdata[ammoUsed].bleed}** damage!`
	}

	if (!killed && ammoUsed && app.itemdata[ammoUsed].burn > 0) {
		finalStr += `\n**${victim.nick || victim.username}** is 🔥 burning for **${app.itemdata[ammoUsed].burn}** damage!`
	}

	if (itemBroke) {
		switch (itemUsed) {
		case 'fish': finalStr += `\n\n${app.icons.minus}**${message.member.nick || message.member.username}**'s ${app.itemdata[itemUsed].icon}\`${itemUsed}\` split!`; break
		default: finalStr += `\n\n${app.icons.minus}**${message.member.nick || message.member.username}**'s ${app.itemdata[itemUsed].icon}\`${itemUsed}\` broke.`
		}
	}

	return finalStr
}

function generateAttackMobString (app, message, monsterRow, damage, itemUsed, ammoUsed, itemBroke, killed) {
	const monster = app.mobdata[monsterRow.monster]
	const monsterDisplay = monster.mentioned.charAt(0).toUpperCase() + monster.mentioned.slice(1)
	let finalStr = app.itemdata[itemUsed].phrase.replace('{attacker}', `<@${message.author.id}>`)
		.replace('{victim}', monster.mentioned)
		.replace('{weaponIcon}', app.itemdata[itemUsed].icon)
		.replace('{weapon}', itemUsed)
		.replace('{ammoIcon}', ammoUsed ? app.itemdata[ammoUsed].icon : '')
		.replace('{ammo}', ammoUsed)
		.replace('{damage}', damage)

	if (killed) {
		finalStr += `\n${app.icons.death_skull} ${monsterDisplay} DIED!`
	}
	else {
		finalStr += `\n${monsterDisplay} is left with ${app.icons.health.full} **${monsterRow.health - damage}** health.`
	}

	if (ammoUsed === '40mm_smoke_grenade') {
		finalStr += `\n${monsterDisplay} resisted the effects of the ${app.itemdata[ammoUsed].icon}\`${ammoUsed}\`!`
	}

	if (!killed && ammoUsed && monster.canBleed && app.itemdata[ammoUsed].bleed > 0) {
		finalStr += `\n${monsterDisplay} is 🩸 bleeding for **${app.itemdata[ammoUsed].bleed}** damage!`
	}
	if (!killed && ammoUsed && monster.canBurn && app.itemdata[ammoUsed].burn > 0) {
		finalStr += `\n${monsterDisplay} is 🔥 burning for **${app.itemdata[ammoUsed].burn}** damage!`
	}

	if (itemBroke) {
		finalStr += `\n\n${app.icons.minus}**${message.member.nick || message.member.username}**'s ${app.itemdata[itemUsed].icon}\`${itemUsed}\` broke.`
	}

	return finalStr
}

function generateMobAttack (app, message, monsterRow, playerRow, damage, itemUsed, ammoUsed, killed, armor, baseDamage) {
	const monster = app.mobdata[monsterRow.monster]
	let finalStr = ''

	if (ammoUsed) {
		// weapon uses ammo
		finalStr = `${monster.mentioned.charAt(0).toUpperCase() + monster.mentioned.slice(1)} fires a ${app.itemdata[ammoUsed].icon}\`${ammoUsed}\` straight at <@${message.author.id}> using a ${itemUsed.icon}\`${itemUsed.name}\`! **${baseDamage}** damage dealt!`
	}
	else {
		// melee weapon
		finalStr = `${monster.mentioned.charAt(0).toUpperCase() + monster.mentioned.slice(1)} cuts up <@${message.author.id}> with a ${itemUsed.icon}\`${itemUsed.name}\` dealing **${baseDamage}** damage!`
	}

	if (armor) {
		finalStr += `\n**${message.member.nick || message.member.username}**'s ${app.itemdata[armor].icon}\`${armor}\` absorbed **${baseDamage - damage}** (${Math.floor(app.itemdata[armor].shieldInfo.protection * 100)}%) damage, lowering the total damage dealt to **${damage}**!`
	}

	if (killed) {
		finalStr += `\n${app.icons.death_skull} **${message.member.nick || message.member.username} DIED!**`
	}
	else {
		finalStr += `\n**${message.member.nick || message.member.username}** is left with ${app.player.getHealthIcon(playerRow.health - damage, playerRow.maxHealth)} **${playerRow.health - damage}** health.`
	}

	return finalStr
}

async function pickTarget (app, message, membersInfo) {
	try {
		const collectorObj = app.msgCollector.createUserCollector(message.author.id, message.channel.id, m => m.author.id === message.author.id, { time: 16000 })

		const atkEmbed = new app.Embed()
			.setAuthor(`${message.author.username}#${message.author.discriminator}`, message.author.avatarURL)
			.setTitle('Pick someone to attack!')
			.setDescription(`Type 1, 2, or 3 to select.\n
			1. ${app.player.getBadge(membersInfo[0].row.badge)} **${`${membersInfo[0].member.username}#${membersInfo[0].member.discriminator}`}** ${app.icons.health.full} ${membersInfo[0].row.health} - ${app.common.formatNumber(membersInfo[0].row.money)} - ${(await app.itm.getItemCount(membersInfo[0].items, membersInfo[0].row)).itemCt} items\n
			2. ${app.player.getBadge(membersInfo[1].row.badge)} **${`${membersInfo[1].member.username}#${membersInfo[1].member.discriminator}`}** ${app.icons.health.full} ${membersInfo[1].row.health} - ${app.common.formatNumber(membersInfo[1].row.money)} - ${(await app.itm.getItemCount(membersInfo[1].items, membersInfo[1].row)).itemCt} items\n
			3. ${app.player.getBadge(membersInfo[2].row.badge)} **${`${membersInfo[2].member.username}#${membersInfo[2].member.discriminator}`}** ${app.icons.health.full} ${membersInfo[2].row.health} - ${app.common.formatNumber(membersInfo[2].row.money)} - ${(await app.itm.getItemCount(membersInfo[2].items, membersInfo[2].row)).itemCt} items`)
			.setColor(13451564)
			.setFooter('You have 15 seconds to choose. Otherwise one will be chosen for you.')

		const botMessage = await message.channel.createMessage(atkEmbed)

		return new Promise(resolve => {
			collectorObj.collector.on('collect', m => {
				if (m.content === '1') {
					botMessage.delete()
					app.msgCollector.stopCollector(collectorObj)
					resolve(membersInfo[0])
				}
				else if (m.content === '2') {
					botMessage.delete()
					app.msgCollector.stopCollector(collectorObj)
					resolve(membersInfo[1])
				}
				else if (m.content === '3') {
					botMessage.delete()
					app.msgCollector.stopCollector(collectorObj)
					resolve(membersInfo[2])
				}
			})
			collectorObj.collector.on('end', reason => {
				if (reason === 'time') {
					botMessage.delete()
					resolve(membersInfo[Math.floor(Math.random() * membersInfo.length)])
				}
			})
		})
	}
	catch (err) {
		console.log(err)
		// if bot is lagging and attack message does not send...
	}
}

async function notifyAttackVictim (app, message, victim, itemUsed, damage, victimRow) {
	const notifyEmbed = new app.Embed()
		.setTitle('You were attacked!')
		.setDescription(`${`${message.author.username}#${message.author.discriminator}`} hit you for **${damage}** damage using a ${app.itemdata[itemUsed].icon}\`${itemUsed}\`.

    Health: ${app.player.getHealthIcon(victimRow.health - damage, victimRow.maxHealth)} **${victimRow.health - damage} / ${victimRow.maxHealth}**`)
		.setColor(16610383)

	try {
		const dm = await victim.user.getDMChannel()
		await dm.createMessage(notifyEmbed)
	}
	catch (err) {
		// user disabled DMs
	}
}
async function notifyDeathVictim (app, message, victim, itemUsed, damage, itemsLost) {
	const notifyEmbed = new app.Embed()
		.setTitle('You were killed!')
		.setDescription(`${`${message.author.username}#${message.author.discriminator}`} hit you for **${damage}** damage using a ${app.itemdata[itemUsed].icon}\`${itemUsed}\`.`)
		.addField('Items Lost:', itemsLost.join('\n'))
		.setColor(16600911)

	try {
		const dm = await victim.user.getDMChannel()
		await dm.createMessage(notifyEmbed)
	}
	catch (err) {
		// user disabled DMs
	}
}
