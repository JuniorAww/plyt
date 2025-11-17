import { Panel, Callback, Pagination, Normalize } from "keygram";

const talkerSettings = async (ctx, groupId, page) => {
    if (ctx.state.allow) ctx.state = {}
    if (ctx.isGroup) return;
    
    const chat = await ctx.findChat(groupId)
    
    if (!chat.talker) chat.talker = {
        messages: [],
        memory: {},
        system: undefined
    }
    
    const keyboard = Panel().Callback("Системный текст", talkerSystemText, groupId, page)
                            .Row()
                            .Callback("⬅ Обратно", 'PgO groups', page)
    
    return ctx.respond("🥕 <b>Настройка Talker'а</b>"
                   + `\nМодель: gemma2:9b (нельзя изменить)`
                   + `\nРазмер системного текста: ${chat.talker.system?.length || 0} симв.`, keyboard)
}

/* Middleware to save latest chat messages */
const saveMessages = async (ctx) => {
    if (!ctx.isGroup) return;
    
    const chat = await ctx.getChat()
    
    if (!chat.talker) chat.talker = {
        messages: [],
        memory: {},
        system: undefined
    }
    
    if (chat.talker.system) {
        if (chat.talker.messages.length >= 10) chat.talker.messages.splice(0, 1)
        const rx = await regex(ctx.bot)
        let appeal = ctx.text && rx.test(ctx.text) || +ctx.update.reply_to_message?.from?.id === +ctx.bot.id;
        
        let msgContent = getContent(ctx);
        if (appeal) msgContent = msgContent.replace(rx, '')
        
        const name = ctx.from.first_name + (ctx.from.last_name ? (" " + ctx.from.last_name) : "");
        const from = name.length ? name : "безымянный"
        const content = `${from}: ${msgContent}`
        chat.talker.messages.push([ 0, content ])
        
        if (ctx.update.new_chat_members) {
            appeal = 'spec';
            if (chat.talker.messages.length >= 10) chat.talker.messages.splice(0, 1)
            chat.talker.messages.push([ 2, welcome + ctx.update.new_chat_members.map(x => x.first_name).join(', ') ])
        }
        else if (ctx.update.left_chat_member) {
            appeal = 'spec';
            if (chat.talker.messages.length >= 10) chat.talker.messages.splice(0, 1)
            chat.talker.messages.push([ 2, goodbye + ctx.update.left_chat_member.first_name ])
        }
        
        if (appeal) {
            if (ctx.text?.[0] !== '/') {
                if (generating) {
                    if (appeal !== 'spec') ctx.react("👎")
                }
                else {
                    const [ message_id, content ] = await getResponse(ctx, chat.talker)
                    generating = false;
                    if (content && content.length) {
                        if (chat.talker.messages.length >= 10) chat.talker.messages.splice(0, 1)
                        chat.talker.messages.push([ 1, content ])
                        if (message_id) return await ctx.call('editMessageText', { message_id, text: content })
                        else return await ctx.call('sendMessage', { text: content, reply_parameters: { message_id: ctx.update.message_id } });
                    }
                }
            }
        }
    }
}

const welcome = "There's a new member in the chat! Give them a warm welcome! Names: "
const goodbye = "Member have left the chat. Say goodbye to him heartily. Name: "

let currentRegex
const regex = async (bot) => {
    if (!currentRegex) currentRegex = new RegExp(`@${(await bot.me()).username}\\b|(^|\\s)плут(\\s|$)`, 'i');
    return currentRegex;
}

let generating = false;

const getContent = ctx => {
    const cnt = (ctx.update.message || ctx.update);
    if (cnt.text?.length) return cnt.text.length > 200 ? cnt.text.slice(0, 200) : cnt.text;
    else if (cnt.sticker) return "[стикер, который ты не сможешь увидеть]"
    else if (cnt.video) return "[видео, которое ты не сможешь посмотреть]"
    else if (cnt.photo) return "[фото, которое ты не сможешь увидеть]"
    else if (cnt.document) return "[файл, который ты не сможешь смотреть]"
    else if (cnt.voice) return "[голосовое сообщение, который ты не сможешь смотреть]"
    else if (cnt.audio) return "[файл музыки, который ты не сможешь услышать]"
    else if (cnt.new_chat_members) return "[joined the chat]"
    else if (cnt.left_chat_member) return "[left the chat]"
    else return "[сообщение, которое ты не сможешь понять]"
}



const talkerSystemText = async (ctx, groupId, page) => {
    if (ctx.isGroup) return;
    
    const chat = await ctx.findChat(groupId)
    if (!chat) return;
    
    const text = chat.talker.system || "Не установлен (отключен)"
    
    let keyboard = Panel()
    if (chat.talker.system) {
        keyboard = keyboard.Callback("Сбросить", resetSystemText)
    }
    keyboard = keyboard.Row().Callback("⬅ Обратно", 'talkerSettings', groupId, page)
    
    const { result: update } = await ctx.edit(" <b>Настройка Talker'а</b>\nПожалуйста, введите новый системный текст.\n<b>Текущий:</b>\n" + text, keyboard)
    
    ctx.state = { allow: ['talkerSettings'], groupId, page, messageId: update.message_id }
    return await ctx.input(talkerInput)
}

const resetSystemText = async (ctx, groupId, page) => {
    ctx.state = {}
    const chat = await ctx.findChat(groupId)
    if (!chat) return;
    chat.talker.system = undefined
    return await talkerSettings(ctx, groupId, page)
}

const talkerInput = async (ctx) => {
    if (!ctx.text) return ctx.reply("Пожалуйста, введите текст!")
    const chat = await ctx.findChat(ctx.state?.groupId)
    if (!chat) return ctx.reply("Ошибка! №1")
    chat.talker.system = ctx.text
    const { groupId, page, messageId } = ctx.state
    await ctx.call('editMessageText', { message_id: messageId, parse_mode: 'HTML', text: '🥕 <b>Системный текст установлен!</b>' })
    ctx.state = {}
    return await talkerSettings(ctx, groupId, page)
}

const brokenText = "🌟 Упс! Я что-то сломался..."

const hardcoded = { role: 'system', content: `
Ты — участник группового чата.
Все предыдущие сообщения даются только для контекста.
Не пересказывай и не цитируй историю.
Отвечай только на последнее сообщение, если оно не от ассистента.
Формат сообщений от пользователей: "USERNAME: MESSAGE".
Никогда не пиши своё имя в ответ. Отвечай без указания своего имени.
`.trim() }

const getResponse = async (ctx, talker) => {
    const messages = [
        { role: 'system', content: talker.system },
        hardcoded,
        ...talker.messages.map(([ role, content ]) => ({
            role: role === 1 ? 'assistant' : role === 2 ? 'system' : 'user',
            content
        }))
    ]
    
    console.log('Generating...', messages.map((x, i) => i + '. ' + x.content).join('\n'))
    
    const response = await fetch("http://ollama:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: 
            JSON.stringify({
                model: "gemma2:9b",
                messages,
                stream: true,
                //keep_alive: '1m'
            }),
        signal: AbortSignal.timeout(50000)
    });
    
    let fullResponse = "";
    let done = false;
    const decoder = new TextDecoder();
    
    let message_id
    
    const edit = setInterval(async () => {
        if (!fullResponse.length) return;
        if (done) return;
        if (!message_id) {
            const { result: message } = await ctx.call('sendMessage', { text: fullResponse, reply_parameters: { message_id: ctx.update.message_id } })
            message_id = message.message_id
            if (done) ctx.call('deleteMessage', { message_id })
        }
        else await ctx.call('editMessageText', { message_id, text: fullResponse })
    }, 2500)

    for await (const chunk of response.body) {
        const decodedChunk = decoder.decode(chunk);
        const lines = decodedChunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line)
                const content = parsed.message.content || "";
                fullResponse += content;
                
                process.stdout.write(content);
                
                if (parsed.done) {
                    clearInterval(edit)
                    done = true;
                    return [ message_id, fullResponse.trim() ];
                }
            } catch (e) {
                console.warn("Couldn't parse!", line);
            }
        }
    }
    
    return [];
}




export default {
    priority: 50,
    init: bot => {
        //bot.text(/^\/ask/, ask)
        bot.use(saveMessages)
        bot.on('sticker', ctx => console.log(ctx.update.sticker))
        
        bot.register(talkerSettings, talkerSystemText, resetSystemText, talkerInput)
    }
}
