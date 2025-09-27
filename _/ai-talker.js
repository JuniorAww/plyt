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
            
            if (ctx.text === '/talk') {
                if (!await isAdmin(ctx)) return;
                
                if (chat.talk) {
                    delete chat['talk'];
                    return await ctx.reply(`❌ <b>Режим общения</b> отключен!`)
                }
                
                chat.talk = {
                    enabled: true,
                    memory: initialMemory(ctx)
                }
                
                return await ctx.reply(`✅ <b>Режим общения</b> активирован!`)
            }
            
            if (chat.talk) {
                if (chat.talk.memory.length >= 20) chat.talk.memory.splice(1, 1)
                
                const msgContent = getContent(ctx);
                const name = ctx.from.first_name + (ctx.from.last_name ? (" " + ctx.from.last_name) : "");
                const from = name.length ? name : "безымянный"
                const content = `${from}: ${msgContent}`
                chat.talk.memory.push({ role: 'user', content })
                
                const text = ctx.text;
                if (text) {
                    if (text.match(/ плут /i) || text.match(/^плут(.*)/i)) {
                        if (!generating) {
                            const message = await getResponse(ctx, chat.talk)
                            if (message && message.content.length) {
                                if (chat.talk) {
                                    if (chat.talk.memory.length >= 20) chat.talk.memory.splice(1, 1)
                                    chat.talk.memory.push(message)
                                }
                                await ctx.reply(message.content);
                            }
                        }
                    }
                }
            }
            
        }
        
        next()
    }
}

const initialMemory = (ctx) => {
    return [{
      "role": "system",
      "content": `ты бот по имени плут, хитрая лиса в публичном чате "${ctx.chat.title}".  
говори всегда с маленькой буквы. иногда используй пунктуацию.  
никогда не используй форматирование, смайлики или эмодзи.  
отвечай максимум 1–3 предложениями, каждое до 10 слов.  
отвечай только от себя, не копируй чужие реплики.  
участники пишут так: "имя: текст". имя всегда до первого двоеточия.  
отвечай на языке, на котором задают вопрос.  
никогда не нарушай образ плута-лисы.`
    }]
}

let generating = false;

const getContent = ctx => {
    if (ctx.text) return ctx.text.length > 250 ? ctx.text.slice(0, 250) : ctx.text;
    else if (ctx.sticker) return "[стикер, который ты не сможешь увидеть]"
    else if (ctx.video) return "[видео, которое ты не сможешь посмотреть]"
    else if (ctx.photo) return "[фото, которое ты не сможешь увидеть]"
    else if (ctx.document) return "[файл, который ты не сможешь смотреть]"
    else if (ctx.voice) return "[голосовое сообщение, который ты не сможешь смотреть]"
    else if (ctx.audio) return "[файл музыки, который ты не сможешь услышать]"
    else return "[сообщение, которое ты не сможешь понять]"
}

const getResponse = async (ctx, entry) => {
    generating = true;
    console.log(JSON.stringify(entry.memory))
    
    const resp = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: 
            JSON.stringify({
                model: "gemma3:12b",
                messages: entry.memory,
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
