import Module from '../module.js'
import { isAdmin } from '../utils/chats.js'
import { chats } from '../utils/data.js'
import { bot } from '../index.js'

class AIFilterModule extends Module {
    description = "Фильтруем картинки в чатах через нейросеть"
    priority = 1
    
    async onPhoto(ctx, next) {
        if (ctx.chat.id < 0) {
            const chat = await ctx.getInfo()
            
            if (chat.moderate) {
                const bestPhoto = pickBestSize(ctx.message.photo);
                const file = await ctx.telegram.getFileLink(bestPhoto.file_id);
                await processPhoto(ctx, file.href)
            }
        }
    }
    
    async onMessage(ctx, next) {
        if (ctx.chat.id < 0) {
            const chat = await ctx.getInfo();
            if (ctx?.text?.match(/^\/камчас$/)) {
                if (!await isAdmin(ctx)) return;
                
                const enabled = !chat.moderate?.enabled;
                
                chat.moderate = {
                    enabled,
                    schedule: chat.moderate?.schedule,
                }
                
                /* Ставим метку, чтобы если включен автокамчас, он не отреагировал */
                const currentHour = new Date().getUTCHours() + 3;
                const currentDate = new Date().getUTCDate();
                if (enabled && chat.moderate.schedule[0] === currentHour) 
                    chat.moderate._ed = currentDate;
                else if (!enabled && chat.moderate.schedule[1] === currentHour) 
                    chat.moderate._dd = currentDate;
                
                if (chat.moderate) {
                    await ctx.reply("✅ <b>Коммендатский час</b> активирован")
                }
                else await ctx.reply("❌ <b>Коммендатский час</b> деактивирован")
                
                return;
            }
            else if (ctx?.text?.match(/^\/автокамчас(.*)$/)) {
                if (!await isAdmin(ctx)) return;
                
                const [ _, _from, _to ] = ctx.text.split(' ')
                
                if (_from) {
                    const from = parseInt(_from);
                    const to = parseInt(_to);
                    if (isNaN(from) || isNaN(to)) 
                        return await ctx.reply(`<b>Использование:</b>\n/автокамчас <b>22 10</b> (<b>22</b>:00 по МСК = начало, <b>10</b>:00 по МСК = конец)`)
                    
                    chat.moderate = {
                        enabled: true,
                        schedule: [ from, to ]
                    }
                    
                    await ctx.reply("✅ <b>Коммендатский час</b> будет включаться с "
                                      + `${from}:00 до ${to}:00 по МСК`)
                    }
                else {
                    if (!chat.moderate.schedule)
                        return await ctx.reply("❌ <b>Коммендантский час</b> уже отключен!\nЕсли хотите включить: /автокамчас <b>22 10</b> (<b>22</b>:00 по МСК = начало, <b>10</b>:00 по МСК = конец)");
                    
                    chat.moderate = {
                        enabled: chat.moderate?.enabled,
                        schedule: undefined
                    }
                    
                    await ctx.reply("❌ <b>Коммендатский час</b> не будет включаться автоматически")
                }
                
                return;
            }
        }
        next()
    }
}

const handleSchedules = async () => {
    const allChats = await chats.get();
    
    const currentHour = new Date().getUTCHours() + 3;
    const currentDate = new Date().getUTCDate();
    
    for(const chatId in allChats) {
        const chat = allChats[chatId];
        const schedule = chat.moderate?.schedule;
        
        if (!schedule) continue;
        
        // ed = enabledDate, dd = disabledDate 
        if (currentHour === schedule[0] 
            && !chat.moderate.enabled && chat.moderate._ed !== currentDate) {
            chats.getChatById(chatId).then(_chat => {
                _chat.moderate._ed = currentDate;
                _chat.moderate.enabled = true;
            })
            await bot.telegram.sendMessage(chatId, `🕒 <b>Коммендантский час</b> включен по расписанию`, { parse_mode: 'HTML' })
        }
        else if (currentHour === schedule[1] 
            && chat.moderate.enabled && chat.moderate._dd !== currentDate) {
            chats.getChatById(chatId).then(_chat => {
                _chat.moderate._dd = currentDate;
                _chat.moderate.enabled = false;
            })
            await bot.telegram.sendMessage(chatId, `🕒 <b>Коммендантский час</b> на сегодня завершен! Можно смело кидать йифф`, { parse_mode: 'HTML' })
        }
    }
}

setInterval(handleSchedules, 1000 * 10)
setTimeout(handleSchedules, 1000 * 2)

let queue = {};
let warningTimeout = {}

/* Отправка фото в нейросеть */
const processPhoto = async (ctx, href) => {
    const chat = ctx.chat.id;
    
    if (queue[chat] > 10) {
        try {
            await ctx.deleteMessage()
        } catch (e) {}
        
        return;
    }
    
    const msg = ctx.message.message_id;
    
    if (!queue[chat]) queue[chat] = [];
    queue[chat].push(msg);
    
    console.log("Проверка в " + ctx.chat.title + " фото " + href);
    let deleted = false;
    
    try {
        const resp = await fetch(href);
        const arrayBuffer = await resp.arrayBuffer();
        
        const formData = new FormData();
        const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
        formData.append("file", blob, "image.jpg");
        
        const serverRes = await fetch("http://localhost:8100/check_nsfw", {
            method: "POST",
            body: formData
        });
        
        const { result, error } = await serverRes.json();
        
        if (error) throw error;
        console.log(result)
        
        if (result.explicit > 0.1 || result.questionable > 0.1) {
            try {
                deleted = true;
                await ctx.deleteMessage()
            } catch (e) {}
        }
    } catch (e) {
        console.log(e)
    } finally {
        queue[chat].splice(queue[chat].indexOf(msg), 1)
        
        if (deleted) {
            if (warningTimeout[chat] !== undefined) {
                clearTimeout(warningTimeout[chat])
            }
            
            warningTimeout[chat] = setTimeout(async () => {
                warningTimeout[chat] = undefined;
                try { await ctx.reply(`${ctx.from.first_name}, не будьте врагом народа, соблюдайте коммендантский час!`) } catch (e) {}
            }, 2000)
        }
    }
}

/* Для нейросетки находим 380 х 380 фото */
function pickBestSize (photoSizes) {
    const target = 380 * 380;
    let best = photoSizes[0];
    let bestDiff = Math.abs(photoSizes[0].width * photoSizes[0].height - target);

    for (const p of photoSizes) {
        const diff = Math.abs(p.width * p.height - target);
        if (diff < bestDiff) {
            best = p;
            bestDiff = diff;
        }
    }
    return best;
}

export default AIFilterModule
