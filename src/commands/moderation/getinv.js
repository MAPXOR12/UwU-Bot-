const { generatePages } = require('../info/inventory')
const { reply } = require('../../utils/messageUtils')

exports.command = {
	name: 'getinv',
	aliases: ['geti'],
	description: 'Fetches a users inventory.',
	long: 'Fetches a users inventory using their ID.',
	args: {
		'User ID': 'ID of user to check.'
	},
	examples: ['getinv 168958344361541633'],
	permissions: ['sendMessages', 'addReactions', 'embedLinks', 'externalEmojis'],
	ignoreHelp: false,
	requiresAcc: false,
	requiresActive: false,
	guildModsOnly: false,

	async execute (app, message, { args, prefix, guildInfo }) {
		const userID = args[0]

		if (!userID) {
			return reply(message, '❌ You forgot to include a user ID.')
		}

		const userInfo = await app.common.fetchUser(userID, { cacheIPC: false })

		app.btnCollector.paginate(message, await generatePages(app, userInfo, message.channel.guild.id, undefined))
	}
}
