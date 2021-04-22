const axios = require('axios')
const { decode } = require('html-entities')
let triviaFile

try {
	triviaFile = require('../../resources/json/trivia_questions.json')
}
catch (err) {
	triviaFile = require('../../resources/json/trivia_questions_example.json')
}

module.exports = {
	name: 'trivia',
	aliases: [''],
	description: 'Answer a random question for a reward!',
	long: 'Answer a random trivia question for a reward!',
	args: {},
	examples: [],
	ignoreHelp: false,
	requiresAcc: true,
	requiresActive: true,
	guildModsOnly: false,

	async execute(app, message, { args, prefix }) {
		const triviaCD = await app.cd.getCD(message.author.id, 'trivia')

		if (triviaCD) {
			return message.reply(`You just played a game of trivia! Please wait \`${triviaCD}\` before playing another.`)
		}

		await app.cd.setCD(message.author.id, 'trivia', app.config.cooldowns.trivia * 1000)

		const { question, correct_answer, incorrect_answers, category } = await getQuestion()

		// combine correct answer and incorrect answers and shuffle them
		const [questionA, questionB, questionC, questionD] = app.common.shuffleArr([correct_answer, ...incorrect_answers])

		const chanceR = Math.floor(Math.random() * 10) // returns 0-9 (10% chance)
		const reward = {}

		const itemCt = await app.itm.getItemCount(await app.itm.getItemObject(message.author.id), await app.player.getRow(message.author.id))
		const hasEnough = await app.itm.hasSpace(itemCt, 1)

		if (chanceR <= 0 && hasEnough) {
			reward.display = `${app.itemdata.military_crate.icon}\`military_crate\``
			reward.item = 'military_crate'
			reward.amount = 1
		}
		else if (hasEnough) {
			reward.display = `1x ${app.itemdata.crate.icon}\`crate\``
			reward.item = 'crate'
			reward.amount = 1
		}
		else {
			reward.display = app.common.formatNumber(5000)
			reward.item = 'money'
			reward.amount = 5000
		}

		const embedTrivia = new app.Embed()
			.setAuthor(`Category - ${category}`)
			.setTitle(decode(question))
			.setColor(16777215)
			.setDescription(`🇦 ${decode(questionA)}\n🇧 ${decode(questionB)}\n🇨 ${decode(questionC)}\n🇩 ${decode(questionD)}`)
			.addField('Reward', reward.display)
			.setFooter('You have 20 seconds to answer.')

		const botMessage = await message.channel.createMessage(embedTrivia)

		try {
			const collected = await app.react.getFirstReaction(message.author.id, botMessage, 20000, ['🇦', '🇧', '🇨', '🇩'])

			if (collected === '🇦' && questionA === correct_answer) {
				triviaReward()
			}
			else if (collected === '🇧' && questionB === correct_answer) {
				triviaReward()
			}
			else if (collected === '🇨' && questionC === correct_answer) {
				triviaReward()
			}
			else if (collected === '🇩' && questionD === correct_answer) {
				triviaReward()
			}
			else {
				const embedWrong = new app.Embed()
					.setTitle('Incorrect')
					.setColor(13632027)
					.addField('Reward:', '`shame`')
				botMessage.edit(embedWrong)
			}
		}
		catch (err) {
			const errorEmbed = new app.Embed()
				.setColor(16734296)
				.setDescription('❌ You ran out of time!')
			botMessage.edit(errorEmbed)
		}

		async function triviaReward() {
			if (reward.item === 'money') {
				await app.player.addMoney(message.author.id, reward.amount)
			}
			else {
				await app.itm.addItem(message.author.id, reward.item, reward.amount)
			}

			const embedReward = new app.Embed()
				.setTitle(`${decode(correct_answer)} is correct!`)
				.setColor(720640)
				.addField('Reward:', reward.display)
			botMessage.edit(embedReward)
		}
	}
}

async function getQuestion() {
	try {
		const res = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple')

		if (res.status !== 200 || (res.data && res.data.response_code !== 0)) {
			throw new Error('Failed to fetch trivia')
		}

		return res.data.results[0]
	}
	catch (err) {
		// use local trivia file
		return triviaFile[Math.floor(Math.random() * triviaFile.length)]
	}
}
