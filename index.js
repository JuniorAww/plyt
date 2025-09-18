import 'dotenv/config'
import { Telegraf } from 'telegraf'

//find ./ -type f | entr ./sync.sh

import handleMessages from './handlers/handleMessages'
import handleCallback from './handlers/handleCallback'
import handleStart from './handlers/handleStart'

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

bot.on('message', handleMessages)
bot.on('callback_query', handleCallback)
bot.command('start', handleStart)

bot.launch()
console.log('Success!\nPlyt initialized')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
