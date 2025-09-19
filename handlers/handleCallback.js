import { Markup } from 'telegraf'
import { getUser, getUserById, save as saveUsers } from '../data/users'
import { getChat, getChatById, save as saveChats } from '../data/chats'
import { getMember, isAdmin } from '../utils/chats'
import { handleTrainerCallback } from '../handlers/trainer'

/* Отмена отправки анкеты в чат */
const handleEssayCancel = async (ctx) => {
    const user = await getUser(ctx)
    if (!user) return;
    if (!user.state) return await ctx.deleteMessage()

    user.state = null
    saveUsers()
    await ctx.editMessageText(`✔ <b>Анкета отменена!</b>`, { parse_mode: 'HTML' })
}

/* Голосование на анкету */
const handleEssayVoting = async (ctx, args) => {
    const chatId = +args[1]
    if (chatId !== ctx.chat.id) return await ctx.answerCbQuery("❌ Это можно сделать только в чате!")
    if (!await getMember(ctx, chatId)) return await ctx.answerCbQuery("❌ Вы - не участник чата!")
    
    const vote = +args[4]
    if (vote !== 0 && vote !== 1) return;
    
    /* TODO рейт лимиты */
    const chat = await getChatById(chatId)
    if (!chat) return;
    const essay = chat.essays?.[+args[3]]
    if (!essay) return;
    
    const voted = Object.entries(essay.votes).find(([ id, _ ]) => +id === +ctx.from.id)
    console.log(voted)
    if (vote === voted?.[1]) return await ctx.answerCbQuery("Вы уже проголосовали!")
    /* TODO блокировка юзера в случае Exception */
    essay.votes[ctx.from.id] = args[4] === '1' ? 1 : 0
    
    saveChats() /* не асинхронно, не замедляем отклик */
    
    const values = Object.values(essay.votes)
    const up = values.filter(x => x === 1).length
    const down = values.filter(x => x === 0).length
    
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback(`✅ За | ${up}`, `vote ${args[1]} essay ${args[3]} 1 ${Math.random()}`),
        Markup.button.callback(`❌ Против | ${down}`, `vote ${args[1]} essay ${args[3]} 0 ${Math.random()}`) ],
    ])
    
    const messageId = ctx.callbackQuery.message.message_id;
    await ctx.editMessageReplyMarkup(keyboard.reply_markup)
}

/* TODO ОЧЕНЬ ВАЖНО */
/* сделать escapeHtml для юзернеймов с <> и т.д. */

/* Решение админа по анкете */
const handleEssayVerdict = async (ctx, args) => {
    const [ _, chatId, essayId, action ] = args;
    if (!await isAdmin(ctx, +chatId)) return await ctx.answerCbQuery("❌ Вы - не администратор!")
    
    //if (!/^(accept|decline|silent)$/.test(action)) return;
    
    const user = await getUser(ctx)
    if (!user) return await ctx.answerCbQuery("❌ Ошибка 501")
    
    /* TODO рейт лимиты */
    const chat = await getChatById(chatId)
    if (!chat) return;
    const essay = chat.essays?.[essayId]
    if (!essay) return;
    if (essay.state % 2 === 1) {
        if (user.state && user.state.type === 'decline') delete user['state']
        if (!essay.admin) return await ctx.answerCbQuery("❌ Ошибка 500")
        return await ctx.answerCbQuery("❌ Анкета уже была обработана " + essay.admin.first_name)
    }
    
    if (action === 'decline') {
        essay.state = 2
        
        user.state = { type: 'decline', chatId: +chatId, essayId }
        
        const keyboard = Markup.inlineKeyboard([
            [ Markup.button.callback('❌ Молча отклонить', `essay ${chatId} ${essayId} silent`) ],
        ])
        
        await ctx.reply(`⚠ Окей! Сейчас вы можете написать причину отклонения, которую увидит подавший анкету (или ничего не писать)\n\n<b>Важно:</b> если вы молча отклоните анкету, пользователь не сможет подать анкету повторно.`, { ...keyboard, parse_mode: 'HTML' })
    }
    else if (action === 'silent') {
        delete user['state']
        essay.state = 3
        essay.admin = ctx.from
        
        const text = `❌ <b>Ваша анкета была отклонена!</b>\nАдмин не прикрепил сопровождающего текста :(`
        await ctx.telegram.sendMessage(essay.from.id, text, { parse_mode: 'HTML' })
        
        await ctx.reply(`✅ <b>Заявка успешно отклонена!</b>`, { parse_mode: 'HTML' })
    }
    else if (action === 'fin_dec') {
        if (!user.state === 2) return await ctx.deleteMessage();
        const block = args[4] === 'block';
        
        if (!block) {
            const receiver = await getUserById(essay.from.id)
            receiver.limits.essays.splice(receiver.limits.essays.indexOf(+chat.id))
        }
        
        const reason = user.state.canc_reason
        
        delete user['state']
        essay.state = 3
        essay.admin = ctx.from
        
        saveChats()
        
        const text = block ? `❌ <b>Ваша анкета была отклонена!</b>\nАдмин оставил сообщение:\n${reason}` : `⚠ <b>Анкета отправлена на уточнение!</b>\nАдмин оставил сообщение:\n${reason}\n\n<i>Вы можете переписать анкету, повторно перейдя по ссылке</i>`
        await ctx.telegram.sendMessage(essay.from.id, text, { parse_mode: 'HTML' })
        
        await ctx.reply(`✅ <b>Успешно!</b>\n${essay.from.first_name} получил уведомление.`, { parse_mode: 'HTML' })
    }
    else if (action === 'accept') {
        let inviteLink;
        try {
            const response = await ctx.telegram.createChatInviteLink(chat.id, {
                name: 'Принято ' + ctx.from.first_name,
                creates_join_request: true,
            })
            inviteLink = response.invite_link
        } catch (e) {
            console.error(e)
            return await ctx.reply(`❌ Не удалось создать ссылку на чат!`)
        }
        
        essay.state = 1
        essay.admin = ctx.from
        
        /* Сохраняем инвайт, чтобы обработать заявку */
        if (!chat.invited) chat.invited = {}
        chat.invited[inviteLink] = { userId: essay.from.id }
        saveChats()
        
        const text = `✅ <b>Ваша анкета была одобрена!</b>\n<a href="${inviteLink}">Вступайте скорее! <b>(клик)</b></a>`
        await ctx.telegram.sendMessage(essay.from.id, text, { parse_mode: 'HTML' })
        
        await ctx.reply(`✅ <b>Успешно!</b>\n${essay.from.first_name} получил уведомление с ссылкой на чат.\n\n⚠ Важно: если ${essay.from.first_name} не вступит в чат в ближайшее время, вы можете удалить ссылку в панели управления группой`, { parse_mode: 'HTML' })
    }
    else if (action === 'cancel') {
        essay.state = 0
        delete user['state']
        ctx.deleteMessage();
        await ctx.reply(`🔙 <b>Ответ на анкету отменен!</b>`, { parse_mode: 'HTML' })
    }
}


export default async function handleCallback(ctx) {
    const query = ctx.callbackQuery?.['data']
    
    const args = query.split(' ')
    if (query === 'cancel essay') await handleEssayCancel(ctx)
    else if (args[0] === 'vote' && args[2] === 'essay') await handleEssayVoting(ctx, args)
    else if (args[0] === 'essay') await handleEssayVerdict(ctx, args)
    else if (args[0] === 'trainer') await handleTrainerCallback(ctx, args)
}



