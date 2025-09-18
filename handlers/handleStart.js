import { Markup } from 'telegraf'
import { getUser, save as saveUsers } from '../data/users'
import { getChatById } from '../data/chats'
import { getMember, isAdmin } from '../utils/chats'

const essay_keyboard = Markup.inlineKeyboard([
    [ Markup.button.callback('💥 Отменить', 'cancel essay') ],
])

const handleStart = async ctx => {
    if(ctx.chat.id < 0) return;

    const payload = ctx.payload
    
    if (payload) {
        if (payload[0] === '-') {
            const chat = await getChatById(+payload) // number
            const user = ctx.user;
            
            if (!chat) return await ctx.reply(`💥 <b>Упс!</b>\nГруппа, в которую вы хотели вступить, удалена.`)
            
            if (!chat.linkEnabled) return await ctx.reply(`💥 <b>Упс!</b>\nГруппа, в которую вы хотели вступить, отключила анкеты.`)
            
            if (user.limits?.essay && user.limits.essay < Date.now() / 1000) return await ctx.reply(`💥 <b>Упс!</b>\nПодождите, прежде чем отправлять новую анкету.`)
            
            if (user.limits?.essays?.find(chatId => chatId === chat.id)) return await ctx.reply(`💥 <b>Упс!</b>\nВы уже отправляли анкету в данную группу.`)
            
            user.state = {
                essay: 1,
                chatId: chat.id
            }
            
            await ctx.reply(`💫 <b>Приветствую!</b>\nЯ нашел группу, в которую ты хочешь подать заявку.\nДля вступления тебе надо написать анкету длиной до 100 символов!\nОна будет проверена админами. Приступаем!`, essay_keyboard)
            
            await saveUsers()
        }
        else if (payload[0] === '0') {
            const [ chatId, essayId ] = payload.slice(1).split('-')
            if(!essayId) return;
            
            const chat = await getChatById(-chatId) // chatId must have MINUS
            
            if (!chat) return;
            if (!await getMember(ctx)) return await ctx.reply(`💥 <b>Упс!</b>\nВы не состоите в группе.`)
            
            const essay = chat.essays?.[+essayId]
            if(!essay) return await ctx.reply(`💥 <b>Упс!</b>\nАнкета не найдена.`)
            
            const admin = await isAdmin(ctx, -chatId);
            const keyboard = admin ? Markup.inlineKeyboard([
                [ Markup.button.callback('💚 Принять', `essay ${chatId} ${essayId} accept`) ],
                [ Markup.button.callback('💥 Отклонить', `essay ${chatId} ${essayId} decline`) ],
            ]) : {}
            
            return await ctx.reply(`🧡 <b>Анкета от</b> ${essay.from.first_name}\nСодержание: ↓\n${essay.text}`, { ...keyboard })
        }
    } else {
        const keyboard = Markup.inlineKeyboard([
            //[ Markup.button.callback('💫 Камеры', 'cctv') ],
            //[ Markup.button.callback('❌ Найти запись', 'disk') ],
        ])
        
        const message = await ctx.reply(`💫 <b>Приветствую!</b>`, keyboard)
    }
}

export default handleStart
