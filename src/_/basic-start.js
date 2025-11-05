import { Markup } from 'telegraf'
import Module from '../module.js'
import { chats, users } from '../utils/data.js'
import { toRoman } from '../_/levels.js'
import { getFact } from '../utils/facts.js'

class StartModule extends Module {
    description = "Типичный ответ на /start"
    priority = 90
    
    async onStart(ctx, next) {
        if (!startStickers.values) await retrieveStickers(ctx)
        
        await ctx.reply(`🍄 <b>Приветствую!</b>\nЯ - мультимодальный бот, полезный для чатов и не только. <i>Что бы вы хотели узнать?</i>`, startKeyboard());
        
        if (startStickers.values) await ctx.sendSticker(pickSticker())
    }
    
    async onCallback(ctx, next) {
        if (ctx.chat.id < 0) next()
        else {
            const query = ctx.callbackQuery?.data;
            const sep = query.indexOf(' ');
            const cmd = sep === -1 ? query : query.slice(0, sep);
            (actions[cmd] || next)(ctx);
        }
    }
}

const actions = {
    "menu-me": handleProfile,
    "me-upd": updateProfile,
    "fact": handleFact,
};

async function handleFact(ctx) {
    const fact = getFact();
    await ctx.reply(`<i>${fact}</i>`)
    if (startStickers.values) await ctx.sendSticker(pickSticker())
}

async function sendProfile(ctx, update) {
    const user = await ctx.getUser(ctx)
    
    let groups = []
    
    for (const chatId in user.groups) {
        if (!user.groups[chatId]) continue
        const group = await chats.getChatById(chatId)
        groups.push(group)
    }
    
    if (!groups.length) await ctx.consider(update, `Вы не состоите в чатах со мной или не писали сообщений!`, profileKeyboard())
    else {
        const userId = ctx.from.id;
        const time = new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" });
        const text = groups.map(group => {
            const level = group.levels?.[userId] || [0, 0, 0]
            const votes = group.essays?.reduce((acc, val) => acc += val.votes[userId] !== undefined, 0)
            return `📌 <b>${group.title}</b>\n<i>Уровень ${toRoman(level[0] + 1)}, голосов: ${votes}</i>`
        }).join('\n')
          + `\n\n🕓 Информация обновлена: ${time} [по МСК]`;
        const e = groups.length === 1 ? 'е' : 'ах';
        await ctx.consider(update, `💡 <b>Ура!</b> Вы состоите в ${groups.length} чат${e} со мной:\n\n${text}`, profileKeyboard())
    }
}

function handleProfile(ctx) {
    return sendProfile(ctx, false);
}

function updateProfile(ctx) {
    return sendProfile(ctx, true);
}

const startStickers = { values: null, retrieving: false }

const startKeyboard = () => Markup.inlineKeyboard([
    [ Markup.button.callback('💫 Мой профиль', 'menu-me') ],
    [ Markup.button.callback('🦊 Лисий факт', 'fact') ],
])

const profileKeyboard = () => Markup.inlineKeyboard([
    [ Markup.button.callback('🕓 Обновить', 'me-upd ' + Math.random()) ],
])

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

export default StartModule
