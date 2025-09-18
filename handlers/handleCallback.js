import { Markup } from 'telegraf'
import { getUser, save as saveUsers } from '../data/users'
import { getChat, getChatById, save as saveChats } from '../data/chats'
import { getMember } from '../utils/chats'



export default async function handleCallback(ctx) {
    const query = ctx.callbackQuery?.['data']
    
    const args = query.split(' ')
    if (query === 'cancel essay') {
        const user = await getUser(ctx)
        if (!user) return;
        if (!user.state) return await ctx.deleteMessage()
        
        user.state = null
        saveUsers()
        await ctx.editMessageText(`✔ <b>Анкета отменена!</b>`, { parse_mode: 'HTML' })
    }
    else if (args[0] === 'vote' && args[2] === 'essay') {
        const chatId = -args[1]
        if (chatId !== ctx.chat.id) return await ctx.answerCbQuery("Это можно сделать только в чате!")
        if (!await getMember(ctx, chatId)) return await ctx.answerCbQuery("Вы - не участник чата!")
        
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
        await saveChats()
        
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
    else if (args[0] === 'essay') {
        const [ _, chatId, essayId, action ] = args;
        
    }
}
