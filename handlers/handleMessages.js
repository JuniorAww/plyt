import { Markup } from 'telegraf'
import { getUser, save as saveUsers, reset as resetUsers } from '../data/users'
import { getChat, getChatById, save as saveChats, reset as resetChats } from '../data/chats'
import { isAdmin } from '../utils/chats'

/* Вывод userId в консоль */
let batch = []

setInterval(() => {
    if(!batch.length) return;
    const i = batch.length
    console.log(`> Обработан${i>1?'о':''} ${i} запрос${i>4?'ов':i>1?'а':''}\n${batch.join(', ')}`)
    batch = []
}, 5000)

/* Защита от спама */
const spamblock = {}
const latestmsg = {}
const aliveresp = {}

const handleMessages = async (ctx, next) => {
    const { id, username } = ctx.from
    const NOW = Date.now()
    
    const name = username ? ('@'+username) : id
     
    batch.push(name)
    
    //if(!admin[name]) return;
    
    if(spamblock[id] > NOW) return;
    
    if(latestmsg[id] > NOW - 500) {
        spamblock[id] = NOW + 2000
        if(ctx.chat.id < 0) return;
        return await ctx.reply(`💫 <b>Пожалуйста, пишите реже ❤️</b>\nТак вы снижаете нагрузку на бота`, { parse_mode: 'HTML' })
    }
    
    latestmsg[id] = NOW
    
    ctx.reply = (text, params) => ctx.sendMessage(text, { parse_mode: 'HTML', ...params })
    
    if(ctx.message.date < (NOW / 1000 - 5)) {
        if(aliveresp[ctx.from.id]) return;
        aliveresp[ctx.from.id] = true;
        if(ctx.chat.id < 0) return;
        return await ctx.reply(`💫 <b>Бот снова доступен!</b>`)
    }
    
    ctx.user = await getUser(ctx).catch(async e => {
        console.error(e)
        if(ctx.chat.id > 0) await ctx.reply(`💫 <b>Упс! Испытываем проблемы.</b>\nПожалуйста, свяжитесь с разработчиком`)
        return null
    })

    if(ctx.chat.id < 0) {
        /* Группа */
        ctx.info = await getChat(ctx)
        if(ctx.text === '/link') return handleLink(ctx)
    }
    else {
        if(ctx.from.id === 1067953223) {
            if(ctx.text === '/reset') {
                resetUsers(); resetChats(); return;
            }
        }
        /* Личные сообщения */
        const state = ctx.user.state
        if(state) {
            if(state.essay) {
                const text = ctx.text
                if (!text) return await ctx.reply(`💥 <b>Упс!</b>\nАнкета должна состоять из текста.`)
                if (text.length < 4 || text.length > 100) return await ctx.reply(`💥 <b>Упс!</b>\nВаша анкета не вписалась в рамки от 4 до 100 символов, попробуйте снова!`)
                
                const seconds = Math.floor(Date.now() / 1000)
                
                delete ctx.user['state']
                const nextLimit = seconds + 600;
                if (!ctx.user.limits) ctx.user.limits = { essays: [ state.chatId ], essay: nextLimit }
                else {
                    if (!ctx.user.limits.essays) ctx.user.limits.essays = [ state.chatId ]
                    else ctx.user.limits.essays.push(state.chatId)
                    ctx.user.limits.essay = nextLimit
                }
                
                saveUsers();
                
                const chat = await getChatById(+state.chatId)
                if (!chat) {
                    return await ctx.reply(`💥 <b>Упс!</b>\nЧат, в который вы хотели вступить, удален!`)
                }
                
                const essay = {
                    from: ctx.from,
                    text,
                    checked: false,
                    votes: {},
                    date: seconds
                };
                if (!chat.essays) chat.essays = []
                chat.essays.push(essay)
                
                const index = chat.essays.indexOf(essay);
                const chatId = (chat.id + "").slice(1);
                
                saveChats();
                
                const url = `https://t.me/plytbot?start=0${chatId}-${index}`
                
                const req = `🧡 <b>Новый запрос на вступление</b>\nАвтор: <i>${ctx.from.first_name}</i>\n<a href="${url}">Прочитать анкету</a>`
                
                const keyboard = Markup.inlineKeyboard([
                    [ Markup.button.callback('✅ За | 0', `vote ${chatId} essay ${index} 1`),
                    Markup.button.callback('❌ Против | 0', `vote ${chatId} essay ${index} 0`) ],
                ])
                
                ctx.telegram.sendMessage(chat.id, req, { parse_mode: 'HTML', ...keyboard })
                
                const res = `✅ <b>Анкета отправлена!</b>\nТеперь - ждем ответа от админов.`
                return await ctx.reply(res)
            }
        }
    }
    
    next() 
}

const handleLink = async ctx => {
    if(!await isAdmin(ctx)) return ctx.reply(`Ты не админ сук.`)
    
    const url = "https://t.me/plytbot?start=" + ctx.info.id
    
    ctx.info.linkEnabled = true;
    
    return ctx.reply(`💦 <b><a href="${url}">Ссылка на чат</a></b>\nПо этой ссылке можно отправлять анкеты!`)
}

export default handleMessages
