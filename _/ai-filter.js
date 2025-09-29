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
            if (ctx?.text?.match(/^\/кч(.*)$/)) return await handleSwitchCommand(ctx)
        }
        next()
    }
}

const sendTempMessage = async (ctx, seconds, text) => {
    try {
        const { message_id } = await ctx.reply(text + `\n<i>Удаление через ${seconds} секунды...</i>`);
        await new Promise(r => setTimeout(r, seconds * 1000));
        await ctx.telegram.deleteMessage(ctx.chat.id, message_id);
    } catch (e) {
        console.log(e)
    }
}

const handleSwitchCommand = async ctx => {
    if (!await isAdmin(ctx)) return;
    const chat = await ctx.getInfo();
      
    const [ _, _from, _to ] = ctx.text.split(' ')
    
    if (_from) {
        const from = parseInt(_from);
        const to = parseInt(_to);
        if (isNaN(from) || isNaN(to)) {
            return sendTempMessage(ctx, 3, `<b>Если хотите задать время, то надо так:</b>\n/комчас <b>22 10</b> (<b>22</b>:00 по МСК = начало, <b>10</b>:00 по МСК = конец)`);
        }
        
        chat.moderate = {
            enabled: true,
            schedule: [ from, to ]
        }
        
        return sendTempMessage(ctx, 3, "✅ <b>Коммендатский час</b> будет включён с "
                          + `${from}:00 до ${to}:00 по МСК`)
    }
    
    if (!chat.moderate) chat.moderate = {};
    const enabled = !chat.moderate.enabled;
    
    chat.moderate = {
        enabled,
        schedule: enabled ? chat.moderate.schedule : undefined,
        _ed: chat.moderate._ed,
        _dd: chat.moderate._dd,
    }
    
    /* Ставим метку, чтобы если включен камчас, он не отреагировал */
    if (chat.moderate.schedule) {
        const currentHour = new Date().getUTCHours() + 3;
        const currentDate = new Date().getUTCDate();
        if (enabled && chat.moderate.schedule[0] === currentHour) 
            chat.moderate._ed = currentDate;
        else if (!enabled && chat.moderate.schedule[1] === currentHour) 
            chat.moderate._dd = currentDate;
    }
    
    if (chat.moderate.enabled) {
        sendTempMessage(ctx, 3, "✅ <b>Коммендатский час</b> активирован")
    }
    else sendTempMessage(ctx, 3, "❌ <b>Коммендатский час</b> деактивирован")
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
    
    if (queue[chat] > 20) {
        return;
    }
    
    const msg = ctx.message.message_id;
    
    if (!queue[chat]) queue[chat] = 1;
    else queue[chat] += 1;
    
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
        
        if (result.explicit > 0.75) {
            try {
                deleted = true;
                await ctx.deleteMessage()
            } catch (e) {}
        }
    } catch (e) {
        console.log(e)
    } finally {
        queue[chat] -= 1;
        
        if (deleted) {
            if (warningTimeout[chat] !== undefined) {
                clearTimeout(warningTimeout[chat])
            }
            
            warningTimeout[chat] = setTimeout(async () => {
                warningTimeout[chat] = undefined;
                try { await ctx.reply(`${ctx.from.first_name} простите, но сейчас некоторые фото фильтруются!`) } catch (e) {}
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
