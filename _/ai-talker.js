import Module from '../module.js'
import { isAdmin } from '../utils/chats.js'
import { chats } from '../utils/data.js'
import { bot } from '../index.js'

class AITalkingModule extends Module {
    description = "Общаемся в чатах"
    priority = 75
    
    async onMessage(ctx, next) {
        if (ctx.chat.id < 0) {
            const chat = await ctx.getInfo();
            
            if (ctx.text === '/talk') return await handleSwitchCommand(ctx, chat)
            
            if (chat.talk?.enabled) {
                if (chat.talk.messages.length >= 8) chat.talk.messages.splice(0, 1)
                const appeal = ctx.text ? regex().test(ctx.text) : false;
                
                let msgContent = getContent(ctx);
                if (appeal) msgContent = msgContent.replace(regex(), '')
                
                const name = ctx.from.first_name + (ctx.from.last_name ? (" " + ctx.from.last_name) : "");
                const from = name.length ? name : "безымянный"
                const content = `${from}: ${msgContent}`
                chat.talk.messages.push({ role: 'user', content })
                
                if (appeal) {
                    if (ctx.text[0] !== '/' && !generating) {
                        const message = await getResponse(ctx, chat.talk)
                        if (message && message.content.length) {
                            if (chat.talk) {
                                if (chat.talk.messages.length >= 8) chat.talk.messages.splice(0, 1)
                                chat.talk.messages.push({ role: 'system', content: message.content })
                            }
                            return await ctx.reply(message.content);
                        }
                    }
                }
            }
        }
        
        if (ctx.text) {
            if (ctx.text.match(/\/ai-talker(.*)/)) return await handleTalkerCommand(ctx)
        }
        
        next()
    }
}

let currentRegex;
const regex = () => {
    if (!currentRegex) currentRegex = new RegExp(`@${bot.botInfo.username}\\b|(^|\\s)плут(\\s|$)`, 'i');
    return currentRegex;
}

const handleSwitchCommand = async (ctx, chat) => {
    if (!await isAdmin(ctx)) return;
    
    if (!chat.talk) chat.talk = { enabled: false };
    
    if (chat.talk.enabled) {
        delete chat['talk'];
        return await ctx.reply(`❌ <b>Режим общения</b> отключен!`)
    }
    
    const user = await ctx.getUser();
    
    if (!user.talk?.system) {
        return await ctx.reply(`❌ Задайте системное сообщение в личке бота /ai-talker system (текст)`)
    }
    
    chat.talk.enabled = true;
    chat.talk.messages = [];
    chat.talk.system = user.talk.system;
    
    return await ctx.reply(`✅ <b>Режим общения</b> активирован!`)
}

const handleTalkerCommand = async (ctx) => {
    if (ctx.chat.id < 0) return await ctx.reply(`Команда доступна в личке бота!`)
    const user = await ctx.getUser();
    
    if (!user.talk) user.talk = {};
    
    if (ctx.text.match(/^\/ai-talker system (.*)/)) {
        const system = ctx.text.split(' ').slice(2).join(' ');
        if (system.length < 20 || system.length > 1000) return await ctx.reply(`Длина от 20 до 1000 символов, вы ввели ${system.length} симв.`)
        user.talk.system = system;
        await ctx.reply(`Успешно!`);
    }
}

let generating = false;

const getContent = ctx => {
    const cnt = ctx.update.message;
    if (cnt.text) return ctx.text.length > 200 ? ctx.text.slice(0, 200) : ctx.text;
    else if (cnt.sticker) return "[стикер, который ты не сможешь увидеть]"
    else if (cnt.video) return "[видео, которое ты не сможешь посмотреть]"
    else if (cnt.photo) return "[фото, которое ты не сможешь увидеть]"
    else if (cnt.document) return "[файл, который ты не сможешь смотреть]"
    else if (cnt.voice) return "[голосовое сообщение, который ты не сможешь смотреть]"
    else if (cnt.audio) return "[файл музыки, который ты не сможешь услышать]"
    else return "[сообщение, которое ты не сможешь понять]"
}

const getResponse = async (ctx, entry) => {
    generating = true;
    
    const messages = [{
            role: 'system',
            content: entry.system
        },
        {
            role: 'system',
            content: 'Никогда не пиши более 2 предложений'
        },
        ...entry.messages,
    ];
    console.log(messages)
    
    const resp = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: 
            JSON.stringify({
                model: "gemma3:12b",
                messages,
                num_predict: 64,
                stream: false,
            })
    });
    
    let full = "";
    for await (const chunk of resp.body) {
        const text = Buffer.from(chunk).toString("utf-8"); // чанк -> строка
        full += text;
    }
    
    let response;
    try {
        response = JSON.parse(full)
    } catch (e) {
        console.log(e);
        return null;
    }
    
    console.log("Ответ модели:", response);
    generating = null;
    return response.message;
}

export default AITalkingModule
