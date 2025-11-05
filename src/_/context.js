import Module from '../module.js'
import { chats, users } from '../utils/data.js'

class ContextModule extends Module {
    description = "Инициализируем базы данных для чатов и юзеров"
    priority = 0
    
    async onEverything(ctx, next) {
        /* Ленивый загрузчик (буквально) */
        ctx.getUser = () => _getUser(ctx);
        ctx.getInfo = () => _getChat(ctx);
        
        ctx.reply = reply.bind(ctx);
        ctx.consider = consider.bind(ctx);
        
        next();
    }
}

async function reply(text, params) {
    return await this.sendMessage(text, { parse_mode: 'HTML', ...params })
}

async function consider(update, text, params) {
    console.log(update, this.chat.id, this.update?.callback_query?.message)
    try {
        if (update) await this.telegram.editMessageText(this.chat.id, this.update.callback_query.message.message_id, undefined, text, { parse_mode: 'HTML', ...params})
        else await this.reply(text, params)
    } catch (e) { console.error(e) }
}

async function _getUser(ctx) {
    if (ctx._user) return ctx._user;
    ctx._user = await users.getUser(ctx);
    if (!ctx._user) {
        if (ctx.chat.id > 0) await ctx.reply(`💫 <b>Упс! Испытываем проблемы</b>`);
    }
    return ctx._user;
}

async function _getChat(ctx) {
    if (ctx._chat) return ctx._chat;
    ctx._chat = await chats.getChat(ctx);
    return ctx._chat;
}

export default ContextModule
