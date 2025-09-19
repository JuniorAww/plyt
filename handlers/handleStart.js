import { Markup } from 'telegraf'
import { getUser, save as saveUsers } from '../data/users'
import { getChatById } from '../data/chats'
import { getMember, isAdmin } from '../utils/chats'

const essay_keyboard = Markup.inlineKeyboard([
    [ Markup.button.callback('💥 Отменить', 'cancel essay') ],
])

const startStickers = { values: null, retrieving: false }


/* Команда /start с параметрами */
const handleStart = async ctx => {
    if(ctx.chat.id < 0) return;

    const payload = ctx.payload
    
    if (payload) {
        if (payload[0] === '-') return await handleChatInviteLink(ctx, payload)
        else if (payload[0] === '0') return await handleSendEssay(ctx, payload)
    } else {
        const keyboard = Markup.inlineKeyboard([
            [ Markup.button.callback('💫 Мой профиль', 'menu me') ],
            [ Markup.button.callback('🌟 Языковой тренер', 'menu trainer') ],
        ])
        
        if (!startStickers.values) await retrieveStickers(ctx)
        
        await ctx.reply(`🍄 <b>Приветствую!</b>\nЯ - мультимодальный бот, полезный для чатов и не только. <i>Что бы вы хотели испытать?</i>`, keyboard);
        
        if (startStickers.values) await ctx.sendSticker(pickSticker())
    }
}

/* Вспомогательное: стикеры по команде /start */
const pickSticker = () => startStickers.values[Math.floor(Math.random() * startStickers.values.length)];

const retrieveStickers = async ctx => {
    if (!startStickers.retrieving) {
        startStickers.retrieving = true;
        const set = await ctx.telegram.getStickerSet('ImFoxFennec')
        startStickers.values = set.stickers.map(sticker => sticker.file_id)
        startStickers.retrieving = false;
    }
}

/* Переход по инвайт-ссылке */
const handleChatInviteLink = async (ctx, payload) => {
    const chat = await getChatById(+payload) // number
    const user = ctx.user;

    if (!chat) return await ctx.reply(messages['missing_group'])
    if (!chat.linkEnabled) return await ctx.reply(messages['links_disabled'])
    console.log(user.limits?.essay, Date.now() / 1000)
    if (user.limits?.essay && user.limits.essay < Date.now() / 1000) return await ctx.reply(messages['essay_timelimit'])
    if (user.limits?.essays?.find(chatId => chatId === chat.id)) return await ctx.reply(messages['already_sent'])

    user.state = {
        type: 'invite',
        essay: 1,
        chatId: chat.id
    }

    await ctx.reply(messages['essay_start'], essay_keyboard)

    await saveUsers()
}

/* Нажатие на кнопку "Посмотреть анкету" */
const handleSendEssay = async (ctx, payload) => {
    const args = payload.slice(1).split('-')
    if(args.length !== 2) return;
    
    const chatId = -args[0];
    const essayId = +args[1];
    
    const chat = await getChatById(chatId)
    
    if (!chat) return;
    console.log(await getMember(ctx, chatId))
    if (!await getMember(ctx, chatId)) return await ctx.reply(messages['not_member'])
    
    const essay = chat.essays?.[+essayId]
    if(!essay) return await ctx.reply(messages['no_essay'])
    
    const admin = await isAdmin(ctx, chatId);
    const keyboard = admin ? Markup.inlineKeyboard([
        [ Markup.button.callback('💚 Принять', `essay ${chatId} ${essayId} accept`) ],
        [ Markup.button.callback('💥 Отклонить', `essay ${chatId} ${essayId} decline`) ],
    ]) : {}
    
    return await ctx.reply(`🧡 <b>Анкета от</b> ${essay.from.first_name}\nСодержание: ↓\n${essay.text}`, { ...keyboard })
}

/* meow meow meow meow meow meow meow meow */
const messages = {
    missing_group: `💥 <b>Упс!</b>\nГруппа, в которую вы хотели вступить, удалена.`,
    links_disabled: `💥 <b>Упс!</b>\nГруппа, в которую вы хотели вступить, отключила анкеты.`,
    already_sent: `💥 <b>Упс!</b>\nВы уже отправляли анкету в данную группу.`,
    essay_timelimit: `💥 <b>Упс!</b>\nПодождите, прежде чем отправлять новую анкету.`,
    not_member: `💥 <b>Упс!</b>\nВы не состоите в группе.`,
    no_essay: `💥 <b>Упс!</b>\nАнкета не найдена.`,
    essay_start: `💫 <b>Приветствую!</b>\nЯ нашел группу, в которую ты хочешь подать заявку.\nДля вступления тебе надо написать анкету длиной до 100 символов!\nОна будет проверена админами. Приступаем!`,
}
 
export default handleStart
