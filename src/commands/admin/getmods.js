exports.command = {
	name: 'getmods',
	aliases: [],
	description: 'Get a list of all moderators.',
	long: 'Get a list of all moderators.',
	args: {},
	examples: [],
	permissions: ['sendMessages', 'addReactions', 'embedLinks', 'externalEmojis'],
	ignoreHelp: false,
	requiresAcc: false,
	requiresActive: false,
	guildModsOnly: false,

	async execute(app, message, { args, prefix, guildInfo }) {
		try {
			const moddedList = []
			const mods = await app.query('SELECT * FROM mods')


			for (let i = 0; i < mods.length; i++) {
				const user = await app.common.fetchUser(mods[i].userId, { cacheIPC: false })

				moddedList.push(`${i + 1}. ${user.username}#${user.discriminator} \`${user.id}\``)
			}

			const modMsg = new app.Embed()
				.setAuthor('Moderator list')
				.setDescription(moddedList.join('\n') || 'None')
				.setColor(720640)
			message.channel.createMessage(modMsg)
		}
		catch (err) {
			message.reply(`Error: \`\`\`${err}\`\`\``)
		}
	}
}
