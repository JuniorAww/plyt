import 'dotenv/config'
import { Telegraf } from 'telegraf'
import { readdirSync } from 'node:fs'
import Module from './module.js'

/* Принцип */
/* Каждое сообщение проходит сквозь все модули согласно приоритету 0 → ∞ */

//find ./ -type f | entr ./sync.sh

/* Находим модули */
const _modules = getModules('_');
const modules = [];

for (const path of _modules) {
    const { default: def } = await import(path);
    if (!def) throw "no module default found for " + path;
    if (!(def.prototype instanceof Module)) throw "wrong module class " + path;
    const instance = new def();
    if (instance.check()) throw instance.check();
    modules.push(instance);
}

modules.sort((A, B) => A.getPriority() - B.getPriority())

console.log("\x1b[1m\x1b[33m> Последовательность модулей\n\x1b[0m\x1b[33m"
           + modules
             .map((module, i) => `${i + 1}. ${module.getDescription()}`)
             .join('\n')
          + "\x1b[32m")

/* Инициализируем сами команды */
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

modules.forEach(module => {
    init('all', 'onEverything', module);
    init('message', 'onMessage', module);
    init('callback_query', 'onCallback', module);
    init('start', 'onStart', module);
    init('chat_join_request', 'onChatJoinRequest', module);
    init('photo', 'onPhoto', module);
    init('sticker', 'onSticker', module);
})

bot.launch()
console.log('\x1b[0m✔ Успешно!\n✔ Бот инициализирован')

function getModules(path) {
    return readdirSync(path)
           .filter(file => file.match(/(.*)\.(js|py)$/))
           .map(file => './' + path + '/' + file)
}

function init(handler_name, property_name, module) {
    if (module.constructor.prototype.hasOwnProperty(property_name)) {
        if (handler_name === 'start') {
            /* Для команды /start особый обработчик */
            bot.on('text', (c,n) => 
                /^\/start(.*)/.test(c.message.text) && c.chat.id > 0 ? module[property_name](c,n) : n(c,n))
            console.log(`+ Handler onStart by ${module.constructor.name}`)
        }
        else if (handler_name === 'all') {
            bot.use(module[property_name]);
            console.log(`+ Everything handler`
                     + ` by ${module.constructor.name}`)
        }
        else {
            /* Telegraf понимает callback_query, photo и так далее */
            bot.on(handler_name, module[property_name]);
            console.log(`+ Handler ${property_name}`
                     + ` by ${module.constructor.name}`)
        }
    }
}

/* Завершение Windows без ошибок ✔✔✔ */
const gracefulStop = async () => { await bot.stop(); process.exit(0) }
process.once('SIGINT', gracefulStop)
process.once('SIGTERM', gracefulStop)

export { bot };
