import { Markup } from 'telegraf'
import Module from '../module.js'
import { chats, users } from '../utils/data.js'
import { getMember, isAdmin } from '../utils/chats.js'
import handleCallback from './forms-cb.jsx'

class FormsModule extends Module {
    description = "Заявки (анкеты) в чаты с голосованием"
    priority = 55
    
    async onMessage(ctx, next) {
        const text = ctx.text;
        const user = await ctx.getUser()
        
        if (text) {
            if (text === '/link') return await sendFormLink(ctx)
        }
        
        const { state } = user;
        if (state) {
            if (state.type === 'invite') return await handleFormText(ctx, user);
            else if (state.type === 'decline') return await handleFormDecline(ctx, user);
        }
        
        next()
    }
    
    async onStart(ctx, next) {
        const payload = ctx.text.slice(7)
        if (payload[0] === '-') return await handleChatInviteLink(ctx, payload);
        else if (payload[0] === '0') return await handleSendEssay(ctx, payload);
        next();
    }
    
    onCallback(ctx, next) {
        return handleCallback(ctx, next)
    }
    
    onJoinRequest(ctx) {
        return handleJoinRequest(ctx)
    }
}

/* ============= */
/* Команда /link */
/* ============= */
async function sendFormLink(ctx) {
    if (ctx.chat.id > 0) return await ctx.reply("Команду можно использовать в чатах")
    
    const chat = await ctx.getInfo()
    chat.linkEnabled = true;
    console.log(chat)
    
    const url = "https://t.me/plytbot?start=" + ctx.chat.id
    return ctx.reply(`💦 <b><a href="${url}">Ссылка на чат</a></b>`
                  + `\nПо этой ссылке принимаются <b>анкеты</b> на рассмотрение участниками чата ${ctx.chat.title}`)
}

/* ===================================== */
/* Обрабатываем переход по инвайт-ссылке */
/* ===================================== */
const handleChatInviteLink = async (ctx, payload) => {
    const chat = await chats.getChatById(+payload) // number
    const user = await ctx.getUser();
    console.log(chat)
    if (!chat) return await ctx.reply(messages['missing_group'])
    if (!chat.linkEnabled) return await ctx.reply(messages['links_disabled'])
    
    if (user.limits?.essay && user.limits.essay > Date.now() / 1000) return await ctx.reply(messages['essay_timelimit'])
    if (user.limits?.essays?.find(chatId => chatId === chat.id)) return await ctx.reply(messages['already_sent'])

    user.state = {
        type: 'invite',
        essay: 1,
        chatId: chat.id
    }

    await ctx.reply(messages['essay_start'], essay_keyboard)
}

const essay_keyboard = Markup.inlineKeyboard([
    [ Markup.button.callback('💥 Отменить', 'cancel essay') ],
])

/* ===================================== */
/* Нажатие на кнопку "Посмотреть анкету" */
/* ===================================== */
const handleSendEssay = async (ctx, payload) => {
    const args = payload.slice(1).split('-')
    if(args.length !== 2) return;
    
    const chatId = -args[0];
    const essayId = +args[1];
    
    const chat = await chats.getChatById(chatId)
    if (!chat) return;
    
    if (!await getMember(ctx, chatId)) return await ctx.reply(messages['not_member'])
    
    const essay = chat.essays?.[+essayId]
    if(!essay) return await ctx.reply(messages['no_essay'])
    
    const admin = await isAdmin(ctx, chatId);
    const keyboard = admin ? Markup.inlineKeyboard([
        [ Markup.button.callback('💚 Принять', `essay ${chatId} ${essayId} accept`) ],
        [ Markup.button.callback('💥 Отклонить', `essay ${chatId} ${essayId} decline`) ],
    ]) : {}
      
    const tag = !admin ? "" : essay.from.username ? ` (@${essay.from.username})` : ` (пользователь не имеет тэга)`
    
    return await ctx.reply(`🧡 <b>Анкета от ${essay.from.first_name}</b>${tag}\nСодержание: ↓\n${essay.text}`, { ...keyboard })
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

/* =========================== */
/* Обрабатываем текст с заявок */
/* =========================== */
async function handleFormText(ctx, user) {
    const { text } = ctx;
    
    if (!text) return await ctx.reply(`💥 <b>Упс!</b>\nИзображения / видео не поддерживаются`)
    const len = text.length;
    
    if (len > 500 || len < 4) return await ctx.reply(`💥 <b>Упс!</b>\nВаша анкета не вписалась в рамки от 4 до 500 символов, попробуйте снова!`)
    
    if (text.match(/^\//)) return await ctx.reply(`💥 Хорошо, теперь введите текст для отправки анкеты в чат или нажмите кнопку "Отменить"`)
    
    const { state } = user;
    delete user['state']
    
    const seconds = Math.floor(Date.now() / 1000)
    const nextLimit = seconds + 600;
    if (!user.limits) user.limits = { essays: [ state.chatId ], essay: nextLimit }
    else {
        if (!user.limits.essays) user.limits.essays = [ state.chatId ]
        else user.limits.essays.push(state.chatId)
        user.limits.essay = nextLimit
    }
    
    const chat = await chats.getChatById(state.chatId)
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
    
    const url = `https://t.me/plytbot?start=0${(chat.id + "").slice(1)}-${index}`
    console.log(url, chat.id)
    
    const req = `🧡 <b>Новый запрос на вступление</b>\nАвтор: <i>${ctx.from.first_name}</i>\n<a href="${url}">Прочитать анкету</a>`
    
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback('✅ За | 0', `vote ${chat.id} essay ${index} 1`),
        Markup.button.callback('❌ Против | 0', `vote ${chat.id} essay ${index} 0`) ],
    ])
    
    const { message_id } = await ctx.telegram.sendMessage(state.chatId, req, { parse_mode: 'HTML', ...keyboard })
    essay.voting_msg = message_id;
    
    const res = `✅ <b>Анкета отправлена!</b>\nТеперь - ждем ответа от админов.`
    return await ctx.reply(res)
}

/* =================================== */
/* Обрабатываем отказ админа по заявке */
/* =================================== */
async function handleFormDecline(ctx, user) {
    const { text } = ctx;
    
    if (!text) return await ctx.reply(`💥 <b>Упс!</b>\nИзображения / видео не поддерживаются`)
    const len = text.length;
    
    if (len > 500 || len < 4) return await ctx.reply(`💥 <b>Упс!</b>\nВаша анкета не вписалась в рамки от 4 до 500 символов, попробуйте снова!`)
    
    const { state } = user;
    const chat = await chats.getChatById(state.chatId)
    if (!chat) return;
    
    const essay = chat.essays[+state.essayId]
    if (!essay || essay.state !== 2) return;
    
    user.state.canc_reason = text;
    
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback('✅ Да', `essay ${chat.id} ${state.essayId} fin_dec`),
        Markup.button.callback('⛔ Да, и заблокировать', `essay ${chat.id} ${state.essayId} fin_dec block`) ],
        [ Markup.button.callback('🔙 Отменить', `essay ${chat.id} ${state.essayId} cancel`) ],
    ])
    
    const mtext = `☑ <b>Текст:</b> ${text}\nОтправляем?`
    
    return await ctx.reply(mtext, keyboard)
}

/* =================================================== */
/* Обработка вступлений в группу по одобренным заявкам */
/* =================================================== */
async function handleJoinRequest(ctx) {
    const req = ctx.chatJoinRequest;
    const user = req.from;
    const { id: chatId } = req.chat;
    const { invite_link, is_revoked, creator } = req.invite_link || {};
    
    const chat = await chats.getChatById(chatId);
    console.log(chat)
    
    if (!chat) return;
    
    const invite_entry = chat.invited?.[invite_link]
    
    if (!inviteEntry) return console.warn("No invite entry found for " + user);
    if (is_revoked) return console.warn("Revoked invite used by " + user);
    
    if (invite_entry.userId !== user.id) {
        await ctx.declineChatJoinRequest(user.id);
        const userEntry = await users.getUserById(invite_entry.userId);
        const name = (userEntry?.name) || "неизвестного";
        const warn = `По ссылке для ${name} попытался зайти чужак `
                   + `${user.first_name}${user.last_name ? (" " + user.last_name) : ""} `
                   + `(ID ${user.id}${user.username ? " @" + user.username : ""})`;
        await ctx.sendMessage(warn)
    }
    else {
        await ctx.approveChatJoinRequest(user.id);
        await ctx.telegram.revokeChatInviteLink(
            ctx.chat.id,
            invite_link
        );
        delete chat.invited[invite_link];
    }
}


export default FormsModule
