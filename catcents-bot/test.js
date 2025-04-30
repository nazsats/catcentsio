// test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN || 'Undefined');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', () => console.log('Bot is online!'));
client.login(process.env.DISCORD_BOT_TOKEN);