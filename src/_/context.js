import Module from '../module.js'
import { chats, users } from '../utils/data.js'

class ContextModule extends Module {
    description = "Инициализируем базы данных для чатов и юзеров"
    priority = 0
    
    async onEverything(ctx, next) {
        /* Ленивый загрузчик (буквально) */
        ctx.getUser = () => _getUser(ctx);
        ctx.getInfo = () => _getChat(ctx);
        
        ctx.reply = (text, params) => ctx.sendMessage(text, { parse_mode: 'HTML', ...params })
        
        next();
    }
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
