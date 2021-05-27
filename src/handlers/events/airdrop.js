module.exports = {
	name: 'airdrop',
	cooldown: 3600 * 1000,

	async execute (app, message, { prefix, serverSideGuildId }) {
		console.log('[EVENT] Airdrop started')

		const collectorObj = app.msgCollector.createChannelCollector(message, m => m.channel.id === message.channel.id &&
            m.content.toLowerCase() === 'claimdrop', { time: 40000 })

		const exploreEmbed = new app.Embed()
			.setColor(13451564)
			.setTitle('Event - __AIRDROP__')
			.setDescription(`**A ${app.itemdata.supply_drop.icon}\`supply_drop\` has arrived!**\n\nType \`claimdrop\` to try and steal it!`)
			.setImage(app.itemdata.supply_drop.image)

		try {
			const startedMessage = await message.channel.createMessage(exploreEmbed)
			const joined = {}

			collectorObj.collector.on('collect', async m => {
				if (!await app.player.isActive(m.author.id, m.channel.guild.id)) return m.channel.createMessage(`Your account is not active in this server! Use \`${prefix}play\` to activate it here`)

				// ignore users who have already joined this event
				else if (Object.keys(joined).includes(m.author.id)) return

				// max 20 people per airdrop event
				else if (Object.keys(joined).length >= 20) return

				joined[m.author.id] = m.author
				m.addReaction(app.icons.confirm)
			})

			collectorObj.collector.on('end', async reason => {
				exploreEmbed.setDescription(`**A ${app.itemdata.supply_drop.icon}\`supply_drop\` has arrived!**\n\n~~Type \`claimdrop\` to try and steal it!~~\n❌ This event has ended and is no longer accepting responses! ${app.icons.blackjack_dealer_lost}`)
				startedMessage.edit(exploreEmbed)

				const participants = Object.keys(joined)

				if (participants.length) {
					const winner = participants[Math.floor(Math.random() * participants.length)]

					await app.itm.addItem(winner, 'supply_drop', 1, serverSideGuildId)

					const resultsEmb = new app.Embed()
						.setColor(13451564)
						.setTitle('Event Results - __AIRDROP__')
						.setDescription(`<@${winner}> runs away with the ${app.itemdata.supply_drop.icon}\`supply_drop\`!`)

					await message.channel.createMessage(resultsEmb)
				}
			})
		}
		catch (err) {
			// kicked bot during event?
			console.warn(err)
		}
	}
}
