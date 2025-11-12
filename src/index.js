import 'dotenv/config';
import { TelegramBot, ParserError } from "../keygram";
import { basename, extname } from 'node:path';
import fs from 'node:fs';

const bot = new TelegramBot(process.env.TOKEN);

const modules = []

for (const path of getModules()) {
    try {
        const { default: def, ...other } = await import(path)
        if (!def?.init && !other.init) console.error("no module default found for " + path)
        else {
            const { priority, init } = def || other
            modules.push({
                name: basename(path, extname(path)),
                priority: priority || 100,
                init,
            })
        }
    } catch (e) {
        console.error(e)
    }
}

modules.sort((a, b) => a.priority - b.priority)

for (const module of modules) {
    module.init(bot)
}

function getModules() {
    return fs.readdirSync('src/modules').map(p => './modules/' + p)
}

console.log('Modules:', modules.map(m => m.name).join(', '))
console.log(bot.print()) // printing middlewares

bot.limit(0.5, ctx => ctx.isCallback && ctx.answer("Притормози!"))
bot.setParser('HTML')
bot.startPolling()

