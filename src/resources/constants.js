const ITEM_TYPES = {
	melee: {
		name: 'Melee Weapons',
		type: 'Melee'
	},
	ranged: {
		name: 'Ranged Weapons',
		type: 'Ranged'
	},
	items: {
		name: 'Items',
		type: 'Item'
	},
	ammo: {
		name: 'Ammo',
		type: 'Ammo'
	},
	resources: {
		name: 'Resources',
		type: 'Resource'
	},
	storage: {
		name: 'Storage Containers',
		type: 'Storage'
	},
	banners: {
		name: 'Banners',
		type: 'Banner'
	}
}

const CLANS = {
	levels: {
		1: {
			itemLimit: 5,
			bankLimit: 50000,
			maxHealth: 50,
			upkeep: 1000,
			type: 'Twig',
			repair: {
				item: 'wood',
				heals: 50
			},
			image: 'https://cdn.discordapp.com/attachments/610502203672756295/843342638681423902/base_twig_level1.png'
		},
		2: {
			itemLimit: 10,
			bankLimit: 150000,
			maxHealth: 75,
			upkeep: 5000,
			type: 'Wood',
			repair: {
				item: 'wood',
				heals: 50
			},
			image: 'https://cdn.discordapp.com/attachments/610502203672756295/843406016098992138/base_wood_level2.png',
			cost: {
				money: 50000,
				materials: [
					'wood|2'
				]
			}
		},
		3: {
			itemLimit: 20,
			bankLimit: 300000,
			maxHealth: 100,
			upkeep: 10000,
			type: 'Stone',
			repair: {
				item: 'stone',
				heals: 50
			},
			image: 'https://cdn.discordapp.com/attachments/610502203672756295/843406013218029578/base_stone_level3.png',
			cost: {
				money: 150000,
				materials: [
					'stone|3'
				]
			}
		},
		4: {
			itemLimit: 40,
			bankLimit: 1000000,
			maxHealth: 200,
			upkeep: 20000,
			type: 'Metal',
			repair: {
				item: 'metal',
				heals: 50
			},
			image: 'https://cdn.discordapp.com/attachments/610502203672756295/843406011553415199/base_metal_level4.png',
			cost: {
				money: 300000,
				materials: [
					'metal|4'
				]
			}
		},
		5: {
			itemLimit: 60,
			bankLimit: 2000000,
			maxHealth: 300,
			upkeep: 50000,
			type: 'High Quality Metal',
			repair: {
				item: 'high_quality_metal',
				heals: 100
			},
			image: 'https://cdn.discordapp.com/attachments/610502203672756295/843406618120945674/base_hqm_level5.png',
			cost: {
				money: 1000000,
				materials: [
					'high_quality_metal|4'
				]
			}
		}
	}
}

const RULES = {
	1: {
		desc: 'Bug exploitation',
		warn_message: 'Exploiting bugs to gain an unfair advantage over other players is not allowed, bugs should be reported to the bug-reports channel in the official Lootcord server.'
	},
	2: {
		desc: 'Alt/puppet accounts',
		warn_message: 'Alt abuse or the use of "puppet" accounts violates rule #2, please refrain from using these accounts to gain an unfair advantage over other players.'
	},
	3: {
		desc: 'Cooldown dodging',
		warn_message: 'Cooldown dodging/leaving servers to avoid the deactivate cooldown is not allowed (rule #3).'
	},
	4: {
		desc: 'Kill-farming',
		warn_message: 'Killing another player on purpose so that they receive a passive shield OR trading items back after killing someone to avoid loss of items is against rule #4.'
	},
	5: {
		desc: 'False reports',
		warn_message: 'Please do not spam or use the report command without valid reason as this distracts the moderation team from real reports (rule #6). Thank you.'
	}
}

const PERMISSIONS = {
	sendMessages: 'Send Messages',
	addReactions: 'Add Reactions',
	manageMessages: 'Manage Messages',
	embedLinks: 'Embed Links',
	attachFiles: 'Attach Files',
	externalEmojis: 'Use External Emoji',
	readMessageHistory: 'Read Message History'
}

const BUTTONS = {
	confirmation: [
		{
			type: 1,
			components: [
				{
					type: 2,
					label: 'Confirm',
					style: 3,
					custom_id: 'confirmed'
				},
				{
					type: 2,
					label: 'Cancel',
					style: 4,
					custom_id: 'canceled'
				}
			]
		}
	]
}

module.exports = {
	ITEM_TYPES,
	RULES,
	PERMISSIONS,
	CLANS,
	BUTTONS
}
