import { Markup } from 'telegraf'
import { getUser, save as saveUsers, reset as resetUsers } from '../data/users'
import { getChat, getChatById, save as saveChats, reset as resetChats } from '../data/chats'
import { isAdmin } from '../utils/chats'
import { handleTrainer, handleTrainerState } from '../handlers/trainer'

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
    
    if (spamblock[id] > NOW) return;
    
    if (latestmsg[id] > NOW - 500) {
        spamblock[id] = NOW + 2000
        if(ctx.chat.id < 0) return;
        return await ctx.reply(`💫 <b>Пожалуйста, пишите реже ❤️</b>\nТак вы снижаете нагрузку на бота`, { parse_mode: 'HTML' })
    }
    
    latestmsg[id] = NOW
    
    ctx.reply = (text, params) => ctx.sendMessage(text, { parse_mode: 'HTML', ...params })
    
    if (ctx.message.date < (NOW / 1000 - 5)) {
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

    if (ctx.chat.id < 0) {
        /* Группа */
        ctx.info = await getChat(ctx)
        if (ctx.text === '/link') return handleLink(ctx)
        
        console.log(ctx)
        
        user.groups[ctx.chat.id] = Math.floor(Date.now() / 1000);
        
        /* Система уровней чата */
        const level = user.level;
        let givenExp = 0;
        
        if (ctx.text) {
            const len = ctx.text.length
            givenExp = +(0.25 + len > 30 ? 0.75 : (0.75 / 30 * len)).toFixed(2)
        }
        else {
            givenExp = 1;
        }
        console.log(givenExp)
        
        level[1] -= givenExp
        level[2] += givenExp
        
        if (level[1] <= 0) {
            level[0] ++;
            level[1] = 50 + level[0] * 25;
        }
        
        console.log(level)
    }
    else {
        /* Админские команды */
        if (ctx.from.id === 1067953223) {
            if (ctx.text === '/reset') {
                resetUsers(); resetChats(); return;
            }
        }
        /* Личные сообщения */
        const state = ctx.user.state
        if (state) {
            if (state.type === 'invite') {
                /* Отправка текста анкеты */
                return await handleSendEssay(ctx)
            }
            else if (state.type === 'decline') {
                /* Отмена анкеты админом */
                return await handleAdminEssayDecline(ctx)
            }
            else if (state.type === 'trainer') {
                return await handleTrainerState(ctx)
            }
        }
        else if (ctx.text.match('/trainer')) {
            return await handleTrainer(ctx)
        }
    }
    
    if (ctx.text === '/me') {
        const { level, exp_left, exp_total } = ctx.user.level
        const text = `${ctx.from.first_name}, ваш уровень - <b>${level}</b>\n⚡ Осталось <b>${exp_left} EXP</b> до нового уровня!`
        return await ctx.reply(text)
    }
    
    next() 
}

const handleAdminEssayDecline = async ctx => {
    const text = ctx.text
    if (!text) return await ctx.reply(`💥 <b>Упс!</b>\nОтвет на анкету должен состоять из текста`)
    if (text.length < 4 || text.length > 100) return await ctx.reply(`💥 <b>Упс!</b>\nОтвет на анкету должен умещаться от 4 до 100 символов`)
    
    const chat = await getChatById(state.chatId)
    if (!chat) return;
    const essay = chat.essays[+state.essayId]
    if (!essay || essay.state !== 2) return;
    
    ctx.user.state.canc_reason = text;
    
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback('✅ Да', `essay ${chat.id} ${state.essayId} fin_dec`),
        Markup.button.callback('⛔ Да, и заблокировать', `essay ${chat.id} ${state.essayId} fin_dec block`) ],
        [ Markup.button.callback('🔙 Отменить', `essay ${chat.id} ${state.essayId} cancel`) ],
    ])
    
    const mtext = `☑ <b>Текст:</b> ${text}\nОтправляем?`
    
    return await ctx.reply(mtext, keyboard)
}

const handleSendEssay = async ctx => {
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
    
    const chat = await getChatById(state.chatId)
    if (!chat) {
        return await ctx.reply(`💥 <b>Упс!</b>\nЧат, в который вы хотели вступить, удален!`)
    }
    
    const essay = {
        from: ctx.from,
        text,
        state: 0,
        votes: {},
        date: seconds
    };
    if (!chat.essays) chat.essays = []
    chat.essays.push(essay)
    
    const index = chat.essays.indexOf(essay);
    
    saveChats();
    
    const url = `https://t.me/plytbot?start=0${(chat.id + "").slice(1)}-${index}`
    console.log(url, chat.id)
    
    const req = `🧡 <b>Новый запрос на вступление</b>\nАвтор: <i>${ctx.from.first_name}</i>\n<a href="${url}">Прочитать анкету</a>`
    
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback('✅ За | 0', `vote ${chat.id} essay ${index} 1`),
        Markup.button.callback('❌ Против | 0', `vote ${chat.id} essay ${index} 0`) ],
    ])
    
    ctx.telegram.sendMessage(chat.id, req, { parse_mode: 'HTML', ...keyboard })
    
    const res = `✅ <b>Анкета отправлена!</b>\nТеперь - ждем ответа от админов.`
    return await ctx.reply(res)
}

const handleLink = async ctx => {
    if (!await isAdmin(ctx)) return ctx.reply(`Ты не админ сук.`)
    
    const url = "https://t.me/plytbot?start=" + ctx.info.id
    
    ctx.info.linkEnabled = true;
    
    return ctx.reply(`💦 <b><a href="${url}">Ссылка на чат</a></b>\nПо этой ссылке можно отправлять анкеты!`)
}

export default handleMessages
