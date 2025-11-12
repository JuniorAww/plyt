import { Panel, Callback, Pagination, Normalize } from "../../keygram";
import { getChats } from './db';
import { format, finishPoll } from './polls'

/* Pagination №1 */
/*    ГРУППЫ     */
const groupsText = (ctx, data, page) =>
    `<b>Управляемые группы</b> (стр. ${page + 1}/${ctx.maxPage})\n` +
    (!data.length ? `У вас нет доступных групп :(` :
    `Выберите группу для изменения настроек`) +
    "\n\n⚙ Если здесь нет группы, где вы админ, подождите\nоколо <b>5 минут</b>, информация обновляется не сразу!"

const groupsData = (ctx, page) => ctx.findChats(async (chat, id) => {
    return chat.admins?.find(x => x.id === ctx.from.id)
})

const groupsKeys = (_, groups, page) => Panel().Add(
    groups.map(group => [ Callback("Группа " + group.title, openGroup, group.id, page) ])
)

/* Pagination №2 */
/*  ГОЛОСОВАНИЯ  */
const pollsText = (ctx, data, page) =>
    `<b>Голосования группы</b> (стр. ${page + 1}/${ctx.maxPage})\n` +
    (!data.length ? `Голосований еще не было :(` :
    `Вот все голосования, которые\nактивны или были сохранены`)

const getPolls = async (ctx, page, groupId) => {
    const chat = await ctx.findChat(groupId)
    if (!chat) return [ [], 0 ]
    return Object.entries(chat.polls?.list || []).sort((a, b) => b[1].created - a[1].created)
}

const pollsKeys = (ctx, polls, page, groupId) => Panel().Add(
    polls.map(([ id, poll ]) => [ Callback("Голосование: " + poll.text.slice(0, 15) + (poll.text.length > 15 ? "..." : ""),
                                 openPoll, groupId, id, page) ])
)

/* Pagination №3 */
/*    АНКЕТЫ     */
const formsText = (ctx, data, page) =>
    `<b>Анкеты группы</b> (стр. ${page + 1}/${ctx.maxPage})\n` +
    (!data.length ? `В группу еще не приходило заявок!` :
    `Вот все анкеты, которые\nактивны или были сохранены`)

const getForms = async (ctx, page, groupId) => {
    const chat = await ctx.findChat(groupId)
    if (!chat || !chat.forms) return [ [], 0 ]
    return Object.entries(chat.forms.list)
}

const formsKeys = (ctx, forms, page) => Panel().Add(
    forms.map(([ id, form ]) => [ Callback("Анкета от " + form.from.name.slice(0, 20), openForm, groupId, id, page) ])
)

const backKeys = (ctx, forms, page, groupId) => [ Callback("⬅ Обратно", "openGroup", groupId) ]

const groupsPages = Pagination("groups").Text(groupsText).Data(groupsData).Keys(groupsKeys).PageSize(4)
const pollsPages = Pagination("polls").Text(pollsText).Data(getPolls).Keys(pollsKeys).AfterKeys(backKeys).PageSize(4)
const formsPages = Pagination("forms").Text(formsText).Data(getForms).Keys(formsKeys).AfterKeys(backKeys).PageSize(4)

/* == Commands & buttons == */
const listGroups = ctx => {
    if (!ctx.isGroup) return ctx.open(groupsPages)
}

const openGroup = async (ctx, groupId, page) => {
    const chat = await ctx.findChat(groupId)
    if (!chat) return;
    
    const polls = chat.polls?.list ? Object.keys(chat.polls.list).length : 0;
    
    const keyboard = Panel().Callback(`📎 Анкеты (${chat.forms?.enabled ? "включены" : "отключены"})`, openForms, groupId, page)
                            .Row()
                            .Callback(`🗳 Голосования (${polls})`, openPolls, groupId, page)
                            .Row()
                            .Callback(`🥕 Говорилка`, 'talkerSettings', groupId, page)
                            .Row()
                            .Callback("⬅ Обратно", groupsPages.action, page)
    
    return ctx.edit(`<b>Группа ${chat.title}</b>\nЗдесь вы можете настроить разные параметры группы.`, keyboard)
}

const openPolls = async (ctx, groupId) => {
    if (!ctx.isGroup && await ctx.bot.isAdmin(groupId, ctx.from)) return ctx.open(pollsPages, 0, groupId)
}

/* Здесь можно завершить или удалить голосование (преждевременно) */
const openPoll = async (ctx, groupId, pollId, page) => {
    if (ctx.isGroup || !await ctx.bot.isAdmin(groupId, ctx.from)) return;
    
    const chat = await ctx.findChat(groupId)
    const poll = chat?.polls?.list?.[pollId]
    
    if (ctx.state?.allow) ctx.state = {}
    
    if (!poll) return ctx.answer("Голосование не найдено!")
    
    let keyboard = Panel()
    if (!poll.finish) keyboard = keyboard.Callback("📌 Завершить", adminFinishPoll, groupId, pollId, page).Row()
    keyboard = keyboard.Callback("🗑 Удалить", adminDeletePoll, groupId, pollId, page)
                       .Row()
                       .Callback("⬅ Обратно", pollsPages.action, page, groupId)
    
    let text = `<b>Текст:</b> ${poll.text}\n<b>Пункты:</b>\n`
    
    for (let idx = 0; idx < poll.vars.length; idx++) {
        const _var = poll.vars[idx]
        const votes = Object.entries(poll.votes).filter(x => x[1] === idx)
        let users = []
        for (const [ voter ] of votes) users.push((await ctx.findUser(voter)).name)
        text += `${_var} (${votes.length} голосов${users.length ? (', '+users.join(', ')) : ''})\n`
    }
    
    if (!poll.finish) {
        const left = poll.time - (Date.now() / 1000 - poll.created)
        text += "Голосование завершится через <b>" + format(Math.min(5, left)) + "</b>"
    }
    else {
        const estimated = Math.ceil(Date.now() / 1000 - poll.finish)
        text += "Голосование завершено <b>" + format(estimated) + " назад</b>"
    }
    
    return ctx.respond(`<b>Голосование от ${poll.author.name}</b>\n${text}`, keyboard)
}

const adminFinishPoll = async (ctx, groupId, pollId, page) => {
    if (ctx.isGroup || !await ctx.bot.isAdmin(groupId, ctx.from)) return;
    const chat = await ctx.findChat(groupId)
    const poll = chat?.polls?.list?.[pollId]
    if (!poll) return ctx.answer("Голосование не найдено!")
    if (poll.finish) return ctx.answer("Голосование уже завершено!")
    await finishPoll(ctx.bot, groupId, poll, ctx.from)
    return openPoll(ctx, groupId, pollId, page)
}

const adminDeletePoll = async (ctx, groupId, pollId, page) => {
    if (ctx.isGroup || !await ctx.bot.isAdmin(groupId, ctx.from)) return;
    const chat = await ctx.findChat(groupId)
    const poll = chat?.polls?.list?.[pollId]
    if (!poll) return ctx.answer("Голосование не найдено!")
    ctx.state = { allow: [ 'adminDeletePollConfirm', 'openPoll' ] }
    const keyboard = Panel().Callback("❌ Да, удалить", adminDeletePollConfirm, groupId, pollId, page)
                            .Row()
                            .Callback("⬅ Обратно", openPoll, groupId, pollId, page)
    return ctx.respond("🗑 Вы уверены, что хотите <b>удалить голосование</b>?", keyboard)
}

const adminDeletePollConfirm = async (ctx, groupId, pollId, page) => {
    if (ctx.isGroup || !await ctx.bot.isAdmin(groupId, ctx.from)) return;
    const chat = await ctx.findChat(groupId)
    const poll = chat?.polls?.list?.[pollId]
    if (!poll) return ctx.open(pollsPages, page, groupId)
    if (!poll.finish) await finishPoll(ctx.bot, groupId, poll, ctx.from)
    delete chat.polls.list[pollId]
    ctx.state = {}
    return ctx.open(pollsPages, page, groupId)
}

const openForms = async (ctx, groupId) => {
    if (!ctx.isGroup && await ctx.bot.isAdmin(groupId, ctx.from)) return ctx.open(formsPages, 0, groupId)
}

const openForm = async (ctx, groupId, id, page) => {
    return ctx.answer('В разработке!')
}

/* ==================== */
const sleep = t => new Promise(r => setTimeout(r, t))

const fetchAdmins = async bot => {
    const chats = getChats()
    
    for (const chat_id in chats) {
        const { result: admins } = await bot.call('getChatAdministrators', { chat_id })
        if (!admins) continue;
        chats[chat_id].admins = admins.filter(admin => !admin.user.is_bot)
                                      .map(({ user, custom_title: title }) => ({ id: user.id, title }))
        await sleep(1000)
    }
    
    await sleep(60 * 1000)
}

export default {
    priority: 10,
    init: bot => {
        bot.text("/groups", listGroups)
        bot.text("/dice", ctx => ctx.call('sendDice')) // test
        
        fetchAdmins(bot);
        
        bot.register(listGroups, openGroup, openPolls, openPoll, openForms, adminFinishPoll)
    }
}
