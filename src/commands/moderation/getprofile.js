module.exports = {
	name: 'getprofile',
	aliases: ['getp'],
	description: 'Fetches a users profile.',
	long: 'Fetches a users profile using their ID.',
	args: {
		'User ID': 'ID of user to check.'
	},
	examples: ['getprofile 168958344361541633'],
	ignoreHelp: false,
	requiresAcc: false,
	requiresActive: false,
	guildModsOnly: false,

	async execute(app, message, { args, prefix }) {
		const userID = args[0]

		if (!userID) {
			return message.reply('❌ You forgot to include a user ID.')
		}

		try {
			const row = await app.player.getRow(userID.toString())

			if (!row) {
				return message.reply('❌ User has no account.')
			}

			const userInfo = await app.common.fetchUser(userID, { cacheIPC: false })
			const userItems = await app.itm.getUserItems(await app.itm.getItemObject(userID), { onlyBanners: true })
			const badges = await app.itm.getBadges(userID)
			const xp = app.common.calculateXP(row.points, row.level)

			const bannerIcon = app.itemdata[row.banner] !== undefined ? app.itemdata[row.banner].icon : ''
			const bannersList = `**Equipped:** ${bannerIcon}\`${row.banner}\`\n${userItems.banners.join('\n')}`
			let userStatus = 'Change your status with the `setstatus` command!'
			let badgeList = ''
			let healthStr = `**${row.health} / ${row.maxHealth}** HP${app.player.getHealthIcon(row.health, row.maxHealth, true)}`

			if (row.bleed > 0) {
				healthStr += `\n🩸 Bleeding: **${row.bleed}**`
			}
			if (row.burn > 0) {
				healthStr += `\n🔥 Burning: **${row.burn}**`
			}

			if (row.status !== '') {
				userStatus = row.status
			}

			if (badges.length) {
				if (row.badge !== 'none') {
					badgeList = `**Display**: ${app.badgedata[row.badge].icon}\`${row.badge}\`\n`
				}

				badgeList += badges.sort().filter(badge => badge !== row.badge).map(badge => `${app.badgedata[badge].icon}\`${badge}\``).join('\n')
			}
			else {
				badgeList = 'None'
			}

			const profileEmbed = new app.Embed()
				.setColor('#e6b8e9')
				.setAuthor(`${userInfo.username}#${userInfo.discriminator}'s Profile`, app.common.getAvatar(userInfo))
				.setDescription(userStatus)
				.addField('Clan', codeWrap(row.clanId !== 0 ? (await app.clans.getRow(row.clanId)).name : 'None', 'js'), true)
				.addField('Level', codeWrap(`${row.level} (XP: ${xp.curLvlXp} / ${xp.neededForLvl})`, 'js'), true)
				.addField('Power', codeWrap(`${row.power} / ${row.max_power} Power`, 'js'), true)
				.addField('K/D Ratio', codeWrap(row.deaths === 0 ? `${row.kills} Kills\n${row.deaths} Deaths (${row.kills} K/D)\n` : `${row.kills} Kills\n${row.deaths} Deaths (${(row.kills / row.deaths).toFixed(2)} K/D)`, 'fix'))
				.addField('Health', healthStr, true)
				.addField('Strength', `${parseFloat(row.scaledDamage).toFixed(2)}x damage`, true)
				.addField('Luck', row.luck.toString(), true)
				.addField('Banners', bannersList, true)
				.addField('Badges', badgeList, true)
				.addField('Preferred Ammo', app.itemdata[row.ammo] ? `${app.itemdata[row.ammo].icon}\`${row.ammo}\`` : 'Not set', true)
				.setFooter(`🌟 Skills upgraded ${row.used_stats} times`)

			if (row.banner !== 'none') {
				profileEmbed.setImage(app.itemdata[row.banner].image)
				profileEmbed.setColor(app.itemdata[row.banner].bannerColor)
			}

			message.channel.createMessage(profileEmbed)
		}
		catch (err) {
			message.reply(`Error:\`\`\`${err}\`\`\``)
		}
	}
}

function codeWrap(input, code) {
	return `\`\`\`${code}\n${input}\`\`\``
}
