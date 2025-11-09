import { Panel } from "../../keygram";

const linksEnabled = Panel().Callback("❌ Отключить", 'handleLinks', true)
const linksDisabled = Panel().Callback("✅ Включить", 'handleLinks', true)
const cancel = Panel().Callback("✖ Отменить", "cancelForm")
const startKeyboard = Panel().Callback("🦊 Получить лисичку", "sendFox")
const toMenuKeyboard = Panel().Callback("⬅ В меню", "onStart")

// Start panel
const onStart = async ctx => {
    //if (ctx.isCallback) ctx.delete()
    if (!ctx.isChat) return ctx.respond("<b>Добро пожаловать в главное меню!</b>", startKeyboard)
}

// User clicks link (https://.../bot?start=FM{group_id})
const openChatForm = async ctx => {
    if (ctx.isGroup || !ctx.data.startsWith('FM')) return;
    const user = await ctx.getUser()
    
    const chatId = -ctx.data.slice(2)
    if (!chatId) return;
    
    const { title, forms } = (await ctx.findChat(chatId)) || {}
    if (!forms?.enabled) return ctx.reply("💥 <b>К сожалению,</b> данный чат не разрешал отправку анкет :(")
    
    const timelimit = forms.deny?.[ctx.from.id]
    if (timelimit > Date.now()) return ctx.reply("💥 Вы уже отправляли анкету в данный чат!\n<b>Подождите,</b> прежде чем отправлять новую.")
    
    ctx.state = { select: [], chatId }
    await ctx.input(handleForm, ['handleLinks', 'cancelForm', 'handleForm'])
    
    return handleForm(ctx, 'start')
}

// Cancels form
const cancelForm = async ctx => {
    ctx.state = {}; return 'onStart'
}

// Form enter, click or text
const handleForm = async (ctx, param) => {
    if (ctx.isGroup) return ctx.reply("Завершите взаимодействие в ЛС!")
    const chat = (await ctx.findChat(ctx.state.chatId)) || {}
    const { title, forms } = chat
    
    const items = forms?.steps?.length ? forms.items : defaultSteps
    if (!items || !ctx.state.select) return 'cancelForm'
    
    let step = ctx.state.select.length
    
    const { text } = ctx
    
    if (param !== 'start') {
        const previous = items[step]
        
        if (previous.actions) {
            if (param === undefined) return ctx.reply("💥 Используйте <b>кнопки!</b>", cancel)
            
            const entry = previous.actions[param]
            
            if (!entry || entry.action === 'exit') return 'cancelForm'
            else if (entry.action === 'jump') step = entry.to - 1;
            
            ctx.state.select = [ ...ctx.state.select, param ]
            
            step++;
        }
        else {
            if (!text) return ctx.reply("💥 Отправьте только <b>текст!</b>")
            if (text.length < 3 || text.length > 1000) return ctx.reply("💥 Текст не уместился в рамки <b>3-100 символов</b> :(")
            ctx.state.select = [ ...ctx.state.select, text ]
            
            if (ctx.state.messageId) 
                ctx.call('deleteMessage', { message_id: ctx.state.messageId })
            
            step++;
        }
        
        if (previous.fin) return handleFormEnd(ctx, forms)
    }
    
    const item = items[step]
    
    let keyboard = Panel()
    
    if (item.actions) {
        for (let idx = 0; idx < item.actions.length; idx++) {
            const { text } = item.actions[idx]
            keyboard = keyboard.Callback(text, 'handleForm', idx).Row()
        }
    }
    
    keyboard = keyboard.Callback("✖ Отменить", cancelForm)
    const display = `<b>${ item.ask ? ("Шаг " + (step + 1)) : "Анкета в чат"}</b>\n${sub(item.text, ctx, chat, items)}`
    const response = await ctx.respond(`📌 ${display}`, keyboard)
    ctx.state = { ...ctx.state, messageId: response.result.message_id }
    console.error(response)
    
    return true;
}

const handleFormEnd = async (ctx, forms) => {
    const { chatId, select } = ctx.state
    
    ctx.edit("✅ <b>Успешно!</b>\nОжидаем ответа администраторов.")
    
    const { first_name: name, username } = ctx.from
    
    if (!forms.deny) forms.deny = {}
    forms.deny[ctx.from.id] = Date.now() + 60000 * 10
    
    const form = {
        id: btoa(Math.random().toString()).slice(0, 8),
        from: { name, username },
        votes: {},
        action: null,
        select,
        admin: null,
        created: Math.floor(Date.now() / 1000),
    }
    
    forms.list.push(form)
    const keyboard = formVoter(chatId, form)
    const text = getText(form.from, forms, form)
    
    ctx.state = {}
    ctx.call('sendMessage', { text, chat_id: chatId, parse_mode: 'HTML', reply_markup: keyboard.Build() })
}

const formVoter = (chatId, form) => {
    const votes = Object.values(form.votes)
    const adv = votes.filter(x => x === true).length
    const dev  = votes.filter(x => x === false).length
    return Panel().Callback(`✅ За (${adv})`, vote, chatId, form.id, true)
                  .Callback(`❌ Против (${dev})`, vote, chatId, form.id, false)
}

const getText = (from, forms, form) => {
    const steps = forms.steps.length ? forms.steps : defaultSteps
    
    const username = from.username ? ("@" + from.username) : ("@id" + from.id)
    return `➕ <b>${from.name}</b> (${username}) подал заявку на вступление.\n`
    + steps.filter(x => x.ask && !x.hide).map((s, i) => {
        const text = s.actions ? s.actions[form.select[i]]?.text : form.select[i]
        const separator = text.length > 10 ? '\n' : ' '
        return `<b>${s.name}</b>:${separator}${text}`
    }).join('\n')
}

const defaultSteps = [
    { name: 'Возраст', text: `Чат "TITLE" имеет возрастное ограничение <b>18+</b>`
          + `\nДля вступления <b>согласитесь</b>, что вы совершеннолетний!`,
      ask: true,
      actions: [{ text: "💚 Мне нет 18", action: "jump", to: 4 },{ text: "💥 Мне есть 18", action: "next" }] },
    { name: 'Отношение к милитари темам', text: `<b>Отлично!</b> Давай заполним основную информацию.\nКак вы относитесь к милитари темам?`, ask: true },
    { name: 'Насколько консерватор', text: `<b>Еще немножко...</b> Напишите, пожалуйста, насколько вы консерватор?`, ask: true },
    { text: `<b>Завершили!</b> Проверьте вашу анкету:\n<b>Имя:</b> NAME\n<b>1)</b> %0\n<b>2)</b> %1\n<b>3)</b> %2`,
      actions: [{ text: "✅ Отправить", action: "send" }], fin: true, ask: true, hide: true },
    { text: "Простите, но совершеннолетним в чат <b>нельзя</b> :(", actions: [] }
]

const handleLinks = async (ctx, swap) => {
    if (!ctx.isGroup) return;
    
    const chat = await ctx.getChat()
    const me = await ctx.service.bot()
    
    const url = `https://t.me/${me.username}?start=FM${-ctx.chat.id}`
    const admin = await ctx.isAdmin()
    
    if (admin && swap) {
        if (!chat.forms) chat.forms = {
            enabled: false,
            version: btoa(Math.random().toString()).slice(0, 8),
            list: [],
            steps: []
        }
        chat.forms.enabled = !chat.forms.enabled
        ctx.answer("✅ Изменено!")
    }
    
    if (chat.forms?.enabled) {
        const text = `💦 <a href="${url}"><b>Ссылка на чат</b></a>\n`
                   + `По этой ссылке принимаются <b>анкеты</b> на рассмотрение участниками чата ${ctx.chat.title}`
        return ctx.respond(text, admin ? linksEnabled : {})
    }
    else {
        if (!admin) return ctx.respond(`📌 <b>Анкеты отключены</b> - включить может только админ!`)
        else return ctx.respond(`📌 <b>Анкеты отключены</b>\nВ личных сообщениях можно настроить пункты анкеты`, linksDisabled)
    }
}

const vote = async (ctx, chatId, formId, adv) => {
    const chat = await ctx.findChat(chatId)
    if (!chat || !chat.forms) return ctx.answer("Не удалось найти чат :(")
    const form = chat.forms.list.find(x => x.id === formId)
    if (!form) return true
    if (form.votes[ctx.from.id] === adv) return ctx.answer("Вы уже проголосовали!")
    form.votes[ctx.from.id] = adv
    const text = getText(form.from, chat.forms, form)
    const keyboard = formVoter(chatId, form)
    return ctx.edit(text, keyboard)
}

/* Show text */
function sub(text, ctx, chat, items) {
    while (text.includes('%')) {
        const index = text.indexOf('%')
        if (index === text.length) break; // if it's just % at the end
        const select = +text.slice(index + 1, index + 2)
        const value = ctx.state.select[select]
        
        const item = typeof value === 'string' ? value : items[select]?.actions?.[value]?.text
        
        text = text.slice(0, index) + item + text.slice(index + 2)
    }
    return text.replace(/TITLE/g, chat.title)
               .replace(/NAME/g, ctx.from.first_name)
}

export default {
    priority: 5,
    init: bot => {
        bot.on("/start", openChatForm)
        bot.on("/start", onStart)
        bot.on("/link", handleLinks)
        
        bot.register(handleLinks, handleForm, handleFormEnd, vote, cancelForm, onStart)
    }
}
