const { version } = require('../../../package.json');

module.exports = {
    name: 'botinfo',
    aliases: ['update', 'info', 'version', 'stats'],
    description: "Displays various information about the bot.",
    long: "Displays information about the current update and the bot.",
    args: {},
    examples: [],
    ignoreHelp: false,
    requiresAcc: false,
    requiresActive: false,
    guildModsOnly: false,
    
    async execute(app, message){
        let used = process.memoryUsage().heapUsed / 1024 / 1024;
        let stats = JSON.parse(await app.cache.get('stats')) || {};

        const embedInfo = new app.Embed()
        embedInfo.setTitle(`Lootcord Update Info`)
        embedInfo.setColor(13451564)
        embedInfo.setThumbnail(app.bot.user.avatarURL)
        embedInfo.setDescription('Read [here](https://lootcord.com/blog) for update details')
        embedInfo.addField("Shard ID", codeWrap(message.channel.guild.shard.id.toString(), 'js'), true)
        embedInfo.addField("Cluster ID", codeWrap(app.clusterID.toString(), 'js'), true)
        embedInfo.addField("Active Servers", codeWrap(stats.guilds || '1', 'js'), true)
        embedInfo.addField("Uptime", codeWrap(app.cd.convertTime(app.bot.uptime), 'fix'), true)
        embedInfo.addField("Memory Usage", codeWrap(Math.round(used) + " MB", 'fix'),true)
        embedInfo.addField("Library", codeWrap("Eris", 'js'), true)
        embedInfo.addField("Creators","blobfysh#4679\nShteebr#0007",true)
        embedInfo.addField("Website", "https://lootcord.com",true)
        embedInfo.addField("Discord","https://discord.gg/apKSxuE",true)
        message.channel.createMessage(embedInfo);
    },
}

function codeWrap(input, code){
    return '```' + code + '\n' + input + '```';
}